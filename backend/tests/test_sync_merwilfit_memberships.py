import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.constants.membership_status import MembershipStatus
from app.database.base import Base
from app.models.client import Client
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.user import User

from scripts.sync_merwilfit_memberships import (
    DOC_CORRECTION_CASES,
    IDENTITY_CONFLICT_CASES,
    NAME_CORRECTION_CASES,
    clean_doc,
    clean_phone,
    get_required_plans,
    load_dataset,
    mask_database_url,
    parse_date,
    run_sync,
    validate_user_and_gym,
)

DATA_JSON = BACKEND_DIR / "data" / "MERWILFT_NV_26_DE_MAYO.json"


def test_load_dataset_json_metrics():
    """Valida la lectura y estructura del dataset de 330 registros."""
    assert DATA_JSON.exists(), f"El archivo {DATA_JSON} debe existir."
    records = load_dataset(DATA_JSON)

    assert len(records) == 330

    activos = [r for r in records if r["status"] == "ACTIVO"]
    vencidos = [r for r in records if r["status"] == "VENCIDO"]
    empty_docs = [r for r in records if not r["document"]]

    assert len(activos) == 138
    assert len(vencidos) == 192
    assert len(empty_docs) == 1
    assert empty_docs[0]["full_name"] == "OMAIRA MOLINA"


def test_mask_database_url_redacts_credentials():
    """Valida que no se expongan contraseñas ni secretos en URLs de conexión."""
    test_urls = [
        (
            "postgresql://user:secret123@db.prod.internal:5432/zonafit",
            "user:****@db.prod.internal:5432/zonafit",
        ),
        (
            "postgresql://admin:P%40ssw0rd!_complex@10.0.0.5:5432/zonafit_prod",
            "admin:****@10.0.0.5:5432/zonafit_prod",
        ),
    ]
    for raw_url, expected in test_urls:
        masked = mask_database_url(raw_url)
        assert "****" in masked
        assert "secret123" not in masked
        assert "P%40ssw0rd!_complex" not in masked


def test_special_cases_definitions():
    """Valida que los casos especiales identificados estén definidos exactamente."""
    # Corrección de documento
    assert "1233494723" in DOC_CORRECTION_CASES  # ELIANA TOVAR
    assert "1021398205" in DOC_CORRECTION_CASES  # VICTORIA CASTILLERO

    # Conflicto de identidad
    assert "1065822924" in IDENTITY_CONFLICT_CASES  # VANESSA MARTINEZ
    assert "1003379453" in IDENTITY_CONFLICT_CASES  # SHAROL PEREZ

    # Corrección de nombre
    assert "49787848" in NAME_CORRECTION_CASES  # ROSIO GELVIS
    assert NAME_CORRECTION_CASES["49787848"]["new_name"] == "ROSIO GELVIS"


@pytest.fixture
def sqlite_sync_db():
    """Crea una sesión de base de datos SQLite en memoria con esquema completo."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Gym.__table__,
            User.__table__,
            Client.__table__,
            MembershipPlan.__table__,
            Membership.__table__,
        ],
    )
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed gimnasio y usuario
    gym = Gym(
        id=1,
        name="MerwilFit Primero de Mayo",
        email="merwilcompany@gmail.com",
        is_active=True,
    )
    session.add(gym)
    session.flush()

    user = User(
        id=1,
        gym_id=gym.id,
        full_name="Merwil Admin",
        email="merwilcompany@gmail.com",
        role="ADMIN",
        password="fakehashedpassword",
        is_active=True,
    )
    session.add(user)

    # Seed planes requeridos
    plan_m = MembershipPlan(
        id=1,
        gym_id=gym.id,
        name="Mensualidad",
        duration_days=31,
        price=Decimal("80000.00"),
        is_active=True,
    )
    plan_q = MembershipPlan(
        id=2,
        gym_id=gym.id,
        name="Quincena",
        duration_days=15,
        price=Decimal("45000.00"),
        is_active=True,
    )
    session.add(plan_m)
    session.add(plan_q)

    # Seed cliente base existente: FLOR SAMPAYO con membresía ACTIVA
    c1 = Client(
        id=1,
        gym_id=gym.id,
        full_name="FLOR SAMPAYO",
        document="1007218223",
        document_type="CC",
        phone="3122762622",
        is_active=True,
    )
    # Seed cliente existente con nombre a corregir: ROSIO GEVIS
    c2 = Client(
        id=2,
        gym_id=gym.id,
        full_name="ROSIO GEVIS",
        document="49787848",
        document_type="CC",
        phone="3116716575",
        is_active=True,
    )
    # Seed cliente existente con membresía que vencerá
    c3 = Client(
        id=3,
        gym_id=gym.id,
        full_name="CLIENTE POR VENCER",
        document="1121298526",  # EUCARYS AVILA en dataset
        document_type="CC",
        phone="3042345877",
        is_active=True,
    )
    session.add_all([c1, c2, c3])
    session.flush()

    # Membresía activa existente para FLOR SAMPAYO
    m1 = Membership(
        id=1,
        gym_id=gym.id,
        client_id=c1.id,
        membership_plan_id=plan_m.id,
        start_date=datetime(2026, 8, 19, 0, 0, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    # Membresía activa para c3 que en dataset nuevo está vencida
    m3 = Membership(
        id=3,
        gym_id=gym.id,
        client_id=c3.id,
        membership_plan_id=plan_m.id,
        start_date=datetime(2026, 8, 18, 0, 0, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    session.add_all([m1, m3])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


def test_validate_user_and_gym_success(sqlite_sync_db):
    user, gym = validate_user_and_gym(
        sqlite_sync_db, "merwilcompany@gmail.com", "MerwilFit Primero de Mayo"
    )
    assert user.email == "merwilcompany@gmail.com"
    assert gym.name == "MerwilFit Primero de Mayo"


def test_validate_user_and_gym_mismatch(sqlite_sync_db):
    with pytest.raises(ValueError, match="no coincide con el gimnasio objetivo"):
        validate_user_and_gym(
            sqlite_sync_db, "merwilcompany@gmail.com", "Gimnasio Inexistente"
        )


def test_get_required_plans(sqlite_sync_db):
    pm, pq = get_required_plans(sqlite_sync_db, gym_id=1)
    assert pm.name == "Mensualidad"
    assert pq.name == "Quincena"
    assert pm.duration_days == 31
    assert pq.duration_days == 15


def test_run_sync_dry_run_makes_no_changes(sqlite_sync_db):
    """Garantiza que el modo dry-run no modifica ningún registro en la base de datos."""
    initial_clients = sqlite_sync_db.query(Client).count()
    initial_memberships = sqlite_sync_db.query(Membership).count()

    summary = run_sync(
        db=sqlite_sync_db,
        dataset_path=DATA_JSON,
        dry_run=True,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
        do_snapshot=False,
    )

    assert summary["dry_run"] is True
    # La BD debe permanecer idéntica
    assert sqlite_sync_db.query(Client).count() == initial_clients
    assert sqlite_sync_db.query(Membership).count() == initial_memberships


def test_run_sync_real_mode_and_idempotency(sqlite_sync_db):
    """
    Ejecuta la sincronización en modo real sobre SQLite:
    1. Verifica creación de nuevos clientes con is_active=True.
    2. Verifica corrección de nombre de ROSIO GELVIS.
    3. Verifica que la membresía vencida no desactiva al cliente.
    4. Verifica idempotencia al reejecutar.
    """
    summary_1 = run_sync(
        db=sqlite_sync_db,
        dataset_path=DATA_JSON,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
        do_snapshot=False,
    )

    assert summary_1["dry_run"] is False
    assert summary_1["clientes_nuevos_count"] > 0
    assert summary_1["conflictos_identidad_count"] >= 2
    assert summary_1["documentos_revision_count"] >= 3
    assert summary_1["duraciones_no_estandar_count"] == 6

    # Verificar que ROSIO GELVIS fue actualizado
    rosio = sqlite_sync_db.query(Client).filter(Client.document == "49787848").first()
    assert rosio is not None
    assert rosio.full_name == "ROSIO GELVIS"

    # Verificar que el cliente cuya membresía expiró sigue teniendo is_active=True
    cliente_vencido = (
        sqlite_sync_db.query(Client).filter(Client.document == "1121298526").first()
    )
    assert cliente_vencido is not None
    assert cliente_vencido.is_active is True

    # Verificar que todos los nuevos clientes creados tienen is_active=True
    all_clients = sqlite_sync_db.query(Client).filter(Client.gym_id == 1).all()
    for c in all_clients:
        assert c.is_active is True, f"El cliente {c.full_name} debe tener is_active=True"

    # Conteo después de la primera ejecución
    count_clients_after_1 = sqlite_sync_db.query(Client).count()
    count_memberships_after_1 = sqlite_sync_db.query(Membership).count()

    # Reejecución para verificar idempotencia
    summary_2 = run_sync(
        db=sqlite_sync_db,
        dataset_path=DATA_JSON,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
        do_snapshot=False,
    )

    assert summary_2["clientes_nuevos_count"] == 0
    assert summary_2["membresias_nuevas_count"] == 0
    assert sqlite_sync_db.query(Client).count() == count_clients_after_1
    assert sqlite_sync_db.query(Membership).count() == count_memberships_after_1


def test_multi_tenancy_isolation(sqlite_sync_db):
    """Garantiza que otros gimnasios (gym_id != 1) jamás sean modificados."""
    other_gym = Gym(id=99, name="Otro Gym", email="otro@gym.com", is_active=True)
    sqlite_sync_db.add(other_gym)
    sqlite_sync_db.flush()

    other_client = Client(
        id=999,
        gym_id=other_gym.id,
        full_name="CLIENTE OTRO GYM",
        document="99999999",
        document_type="CC",
        phone="3000000000",
        is_active=True,
    )
    sqlite_sync_db.add(other_client)
    sqlite_sync_db.commit()

    run_sync(
        db=sqlite_sync_db,
        dataset_path=DATA_JSON,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
        do_snapshot=False,
    )

    untouched = (
        sqlite_sync_db.query(Client).filter(Client.id == other_client.id).first()
    )
    assert untouched is not None
    assert untouched.full_name == "CLIENTE OTRO GYM"
    assert untouched.gym_id == 99


def test_entrypoint_sh_contains_sync_hook():
    """Garantiza que entrypoint.sh contenga el hook para SYNC_MERWILFIT_MEMBERSHIPS."""
    entrypoint_path = BACKEND_DIR.parent / "entrypoint.sh"
    assert entrypoint_path.exists()
    content = entrypoint_path.read_text(encoding="utf-8")
    assert "SYNC_MERWILFIT_MEMBERSHIPS" in content
    assert "sync_merwilfit_memberships.py" in content
