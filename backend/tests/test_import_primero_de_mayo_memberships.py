import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.models.client import Client
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.user import User
from scripts.import_primero_de_mayo_memberships import (
    find_client_for_record,
    find_existing_equivalent_membership,
    get_required_plans,
    mask_database_url,
    parse_activos_markdown,
    parse_date,
    run_import,
    validate_user_and_gym,
)

DATA_FILE = BACKEND_DIR / "data" / "PRIMERO_DE_MAYO_ACTIVOS_PLANIFICADOS.md"


def test_parse_activos_markdown_counts_and_structure():
    assert DATA_FILE.exists(), f"Data file does not exist at {DATA_FILE}"
    parsed = parse_activos_markdown(DATA_FILE)

    # Validar exactamente los conteos del requerimiento
    assert parsed["total_read"] == 120
    assert parsed["mensualidad_count"] == 107
    assert parsed["quincena_count"] == 9
    assert parsed["revisar_count"] == 4
    assert parsed["candidates_count"] == 116

    # Validar primer candidato: FLOR SAMPAYO
    first = parsed["mensualidad_rows"][0]
    assert first["full_name"] == "FLOR SAMPAYO"
    assert first["document"] == "1007218223"
    assert first["phone"] == "3122762622"
    assert first["days"] == 31
    assert first["plan_type"] == "Mensualidad"
    assert first["start_date"] == datetime(2026, 8, 19, 0, 0, 0, tzinfo=timezone.utc)
    assert first["end_date"] == datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc)

    # Validar candidata con cédula vacía: OMAIRA MOLINA
    omaira = [r for r in parsed["candidates"] if r["full_name"] == "OMAIRA MOLINA"]
    assert len(omaira) == 1
    assert omaira[0]["document"] == ""
    assert omaira[0]["plan_type"] == "Mensualidad"

    # Validar registros REVISAR excluidos de candidatos
    revisar_names = [r["full_name"] for r in parsed["revisar_rows"]]
    assert len(revisar_names) == 4
    assert "DANIS ARDINA" in revisar_names
    assert "YURIS CASTILLO" in revisar_names
    assert "FERNANDO PEREZ" in revisar_names
    assert "JEISON YAIR" in revisar_names

    for rev in parsed["revisar_rows"]:
        assert rev not in parsed["candidates"]


def test_mask_database_url():
    url = "postgresql://myuser:supersecretpass@myhost.spaceship.net:5432/mydb"
    masked = mask_database_url(url)
    assert "supersecretpass" not in masked
    assert "****" in masked
    assert "myhost.spaceship.net" in masked
    assert "myuser" in masked


@pytest.fixture
def db_session():
    """Crea una sesión de base de datos SQLite en memoria para tests aislados."""
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

    # Seed gimnasio y usuario administrador
    gym = Gym(id=1, name="MerwilFit Primero de Mayo", email="merwilcompany@gmail.com", is_active=True)
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
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)


def test_validate_user_and_gym_success(db_session):
    user, gym = validate_user_and_gym(
        db_session, "merwilcompany@gmail.com", "MerwilFit Primero de Mayo"
    )
    assert user.email == "merwilcompany@gmail.com"
    assert gym.name == "MerwilFit Primero de Mayo"
    assert gym.id == 1


def test_validate_user_and_gym_unknown_user(db_session):
    with pytest.raises(ValueError, match="No existe ningún usuario"):
        validate_user_and_gym(
            db_session, "desconocido@gmail.com", "MerwilFit Primero de Mayo"
        )


def test_validate_user_and_gym_mismatched_gym(db_session):
    with pytest.raises(ValueError, match="no coincide con el gimnasio objetivo"):
        validate_user_and_gym(
            db_session, "merwilcompany@gmail.com", "Gimnasio San Martin"
        )


def test_get_required_plans(db_session):
    plan_m, plan_q = get_required_plans(db_session, gym_id=1)
    assert plan_m.duration_days == 31
    assert plan_q.duration_days == 15
    assert plan_m.price == Decimal("80000.00")
    assert plan_q.price == Decimal("45000.00")


def test_get_required_plans_missing_plan(db_session):
    # Desactivar plan quincena para probar fallo de validación
    db_session.query(MembershipPlan).filter(MembershipPlan.duration_days == 15).update(
        {"is_active": False}
    )
    db_session.commit()

    with pytest.raises(ValueError, match="No existe un plan activo de 15 días"):
        get_required_plans(db_session, gym_id=1)


def test_find_client_by_document_and_by_name(db_session):
    c1 = Client(
        gym_id=1,
        full_name="FLOR SAMPAYO",
        document="1007218223",
        phone="3122762622",
        document_type="CC",
    )
    c2 = Client(
        gym_id=1,
        full_name="OMAIRA MOLINA",
        document="",
        phone="",
        document_type="CC",
    )
    db_session.add(c1)
    db_session.add(c2)
    db_session.commit()

    # Búsqueda por documento
    res1 = find_client_for_record(
        db_session, 1, {"document": "1007218223", "full_name": "FLOR SAMPAYO"}
    )
    assert res1 is not None
    assert res1.id == c1.id

    # Búsqueda por nombre cuando documento está vacío
    res2 = find_client_for_record(
        db_session, 1, {"document": "", "full_name": "omaira molina"}
    )
    assert res2 is not None
    assert res2.id == c2.id

    # Cliente no existente
    res3 = find_client_for_record(
        db_session, 1, {"document": "9999999999", "full_name": "NADIE"}
    )
    assert res3 is None


def test_run_import_dry_run_and_production_idempotence(db_session):
    parsed = parse_activos_markdown(DATA_FILE)

    # Seed todos los 116 clientes candidatos
    for idx, candidate in enumerate(parsed["candidates"], start=1):
        db_session.add(
            Client(
                id=idx,
                gym_id=1,
                full_name=candidate["full_name"],
                document=candidate["document"],
                phone=candidate["phone"],
                document_type="CC",
                is_active=True,
            )
        )
    db_session.commit()

    # 1. DRY-RUN: Simulación sin persistencia
    summary_dry = run_import(
        db=db_session,
        markdown_path=DATA_FILE,
        dry_run=True,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
    )

    assert summary_dry["dry_run"] is True
    assert summary_dry["total_read"] == 120
    assert summary_dry["mensualidad_count"] == 107
    assert summary_dry["quincena_count"] == 9
    assert summary_dry["revisar_count"] == 4
    assert summary_dry["candidates_count"] == 116
    assert summary_dry["new_to_insert"] == 116
    assert summary_dry["inserted_count"] == 0
    assert summary_dry["already_existing_count"] == 0
    assert summary_dry["error_count"] == 0

    # Verificar que en la base de datos realmente no se guardó nada
    assert db_session.query(Membership).count() == 0

    # 2. PRODUCCIÓN REAL: Inserción atómica
    summary_prod = run_import(
        db=db_session,
        markdown_path=DATA_FILE,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
    )

    assert summary_prod["dry_run"] is False
    assert summary_prod["new_to_insert"] == 116
    assert summary_prod["inserted_count"] == 116
    assert summary_prod["already_existing_count"] == 0
    assert summary_prod["error_count"] == 0

    # Verificar conteo y datos en base de datos
    assert db_session.query(Membership).count() == 116
    first_m = db_session.query(Membership).filter(Membership.client_id == 1).first()
    assert first_m is not None
    assert first_m.gym_id == 1
    assert first_m.status == "ACTIVE"
    assert first_m.is_active is True
    assert first_m.price == Decimal("80000.00")

    # 3. IDEMPOTENCIA: Ejecución repetida no debe duplicar membresías
    summary_second = run_import(
        db=db_session,
        markdown_path=DATA_FILE,
        dry_run=False,
        target_email="merwilcompany@gmail.com",
        target_gym_name="MerwilFit Primero de Mayo",
    )

    assert summary_second["new_to_insert"] == 0
    assert summary_second["inserted_count"] == 0
    assert summary_second["already_existing_count"] == 116
    assert summary_second["error_count"] == 0

    # La base de datos sigue teniendo exactamente 116 membresías
    assert db_session.query(Membership).count() == 116


def test_run_import_aborts_on_missing_client(db_session):
    # Sin agregar clientes a la base de datos
    # En modo producción, debe lanzar RuntimeError y no insertar nada
    with pytest.raises(RuntimeError, match="se detectaron.*errores"):
        run_import(
            db=db_session,
            markdown_path=DATA_FILE,
            dry_run=False,
            target_email="merwilcompany@gmail.com",
            target_gym_name="MerwilFit Primero de Mayo",
        )

    assert db_session.query(Membership).count() == 0
