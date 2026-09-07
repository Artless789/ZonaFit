import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from scripts.import_primero_de_mayo_clients import (
    parse_clients_markdown,
    validate_user_and_gym,
    run_import,
    mask_database_url,
)

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "PRIMERO_DE_MAYO_CLIENTES.md"


def test_parse_clients_markdown_count_and_structure():
    assert DATA_FILE.exists(), f"Data file does not exist at {DATA_FILE}"
    records = parse_clients_markdown(DATA_FILE)
    
    # Must contain exactly 279 records
    assert len(records) == 279

    # First record: 1 | FLOR SAMPAYO | 1007218223 | 3122762622
    assert records[0]["row_num"] == 1
    assert records[0]["full_name"] == "FLOR SAMPAYO"
    assert records[0]["document"] == "1007218223"
    assert records[0]["phone"] == "3122762622"
    assert records[0]["document_type"] == "CC"

    # Row 41: 41 | OMAIRA MOLINA | | |
    assert records[40]["row_num"] == 41
    assert records[40]["full_name"] == "OMAIRA MOLINA"
    assert records[40]["document"] == ""
    assert records[40]["phone"] == ""

    # Last record: 279 | JULIETH AMAYA | 1018431409 | 3002872503
    assert records[-1]["row_num"] == 279
    assert records[-1]["full_name"] == "JULIETH AMAYA"
    assert records[-1]["document"] == "1018431409"
    assert records[-1]["phone"] == "3002872503"


def test_mask_database_url():
    url = "postgresql://myuser:supersecretpass@myhost.spaceship.net:5432/mydb"
    masked = mask_database_url(url)
    assert "supersecretpass" not in masked
    assert "****" in masked
    assert "myhost.spaceship.net" in masked
    assert "myuser" in masked
    assert "mydb" in masked


def test_validation_fails_if_user_not_found():
    db = MagicMock()
    query_mock = db.query.return_value
    filter_mock = query_mock.filter.return_value
    filter_mock.first.return_value = None

    with pytest.raises(ValueError, match="No existe ningún usuario con el correo"):
        validate_user_and_gym(db, "merwilcompany@gmail.com", "Primero de Mayo")


def test_validation_fails_if_user_has_no_gym_id():
    db = MagicMock()
    fake_user = User(id=1, email="merwilcompany@gmail.com", gym_id=None)
    
    query_mock = db.query.return_value
    filter_mock = query_mock.filter.return_value
    filter_mock.first.return_value = fake_user

    with pytest.raises(ValueError, match="no tiene gym_id asignado"):
        validate_user_and_gym(db, "merwilcompany@gmail.com", "Primero de Mayo")


def test_validation_fails_if_gym_name_mismatch():
    db = MagicMock()
    fake_user = User(id=1, email="merwilcompany@gmail.com", gym_id=10)
    fake_gym = Gym(id=10, name="Gym Diferente", email="dif@gym.com")

    def query_side_effect(model):
        m = MagicMock()
        if model == User:
            m.filter.return_value.first.return_value = fake_user
        elif model == Gym:
            m.filter.return_value.first.return_value = fake_gym
        return m

    db.query.side_effect = query_side_effect

    with pytest.raises(ValueError, match="no coincide con el gimnasio objetivo"):
        validate_user_and_gym(db, "merwilcompany@gmail.com", "Primero de Mayo")


@pytest.fixture
def sqlite_test_db(tmp_path):
    # Usar base de datos SQLite en memoria solo para pruebas unitarias de aislamiento
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine, tables=[User.__table__, Gym.__table__, Client.__table__])
    Session = sessionmaker(bind=engine)
    session = Session()

    gym = Gym(id=1, name="Primero de Mayo", email="primerodemayo@zonafit.com", is_active=True)
    session.add(gym)
    session.flush()

    user = User(id=1, full_name="Merwil Admin", email="merwilcompany@gmail.com", password="hash", role="OWNER", gym_id=gym.id)
    session.add(user)
    session.commit()

    yield session
    session.close()


def test_run_import_dry_run(sqlite_test_db):
    summary = run_import(
        db=sqlite_test_db,
        markdown_path=DATA_FILE,
        dry_run=True,
        target_email="merwilcompany@gmail.com",
        target_gym_name="Primero de Mayo"
    )

    assert summary["target_user_email"] == "merwilcompany@gmail.com"
    assert summary["target_gym_name"] == "Primero de Mayo"
    assert summary["target_gym_id"] == 1
    assert summary["total_read"] == 279
    assert summary["valid_count"] == 279
    assert summary["new_to_insert"] == 279
    assert summary["inserted_count"] == 0
    assert summary["already_existing_count"] == 0
    assert summary["error_count"] == 0

    # Ensure no clients were actually saved to the database in dry run
    client_count = sqlite_test_db.query(Client).count()
    assert client_count == 0


def test_run_import_real_and_idempotent(sqlite_test_db):
    # Ejecución real
    summary = run_import(
        db=sqlite_test_db,
        markdown_path=DATA_FILE,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="Primero de Mayo"
    )

    assert summary["inserted_count"] == 279
    assert summary["new_to_insert"] == 279
    assert summary["already_existing_count"] == 0

    # Verify directly in DB
    clients = sqlite_test_db.query(Client).filter(Client.gym_id == 1).all()
    assert len(clients) == 279
    for c in clients:
        assert c.gym_id == 1
        assert c.document_type == "CC"
        assert c.is_active is True

    # Re-ejecutar: debe detectar que todos los 279 ya existen y no duplicar
    summary_replay = run_import(
        db=sqlite_test_db,
        markdown_path=DATA_FILE,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="Primero de Mayo"
    )

    assert summary_replay["inserted_count"] == 0
    assert summary_replay["new_to_insert"] == 0
    assert summary_replay["already_existing_count"] == 279
    assert sqlite_test_db.query(Client).filter(Client.gym_id == 1).count() == 279
