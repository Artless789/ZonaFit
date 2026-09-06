"""
Pruebas funcionales - Modulo: Memberships (P0.6)
Ejecutar desde: C:/Dev/ZonaFit/backend
Comando: python test_memberships_p06.py
"""

import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.schemas.membership_plan import MembershipPlanCreate
from app.schemas.membership import MembershipCreate, MembershipUpdate
from app.services.membership_plan_service import MembershipPlanService
from app.services.membership_service import MembershipService
from app.constants.membership_status import MembershipStatus
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException

PASS_COUNT = 0
FAIL_COUNT = 0


def log(label: str, passed: bool, detail: str = "") -> None:
    global PASS_COUNT, FAIL_COUNT
    icon = "[OK]" if passed else "[FAIL]"
    suffix = f" -> {detail}" if detail else ""
    print(f"  {icon}  {label}{suffix}")
    if passed:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1


def create_test_session(gym_id: int | None = None):
    db = SessionLocal()
    db.info['bypass_rls'] = True
    if gym_id:
        db.info['tenant_id'] = gym_id
    return db


def setup_gym_and_admin(name: str, slug: str) -> tuple[int, int]:
    db = create_test_session()
    try:
        gym_email = f"{slug}@zonafit.co"
        gym = db.query(Gym).filter(Gym.email == gym_email).first()
        if not gym:
            gym = Gym(name=name, email=gym_email, address="Calle Test", phone="3000000000")
            db.add(gym)
            db.commit()
            db.refresh(gym)

        user_email = f"admin_{slug}@zonafit.co"
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            user = User(full_name=f"Admin {name}", email=user_email, password="xxx", role="ADMIN", gym_id=gym.id)
            db.add(user)
            db.commit()
            db.refresh(user)
        return gym.id, user.id
    finally:
        db.close()


def cleanup(gym_id: int):
    db = create_test_session(gym_id)
    try:
        db.query(Membership).filter(Membership.gym_id == gym_id).delete()
        db.query(MembershipPlan).filter(MembershipPlan.gym_id == gym_id).delete()
        db.query(Client).filter(Client.gym_id == gym_id).delete()
        db.commit()
    finally:
        db.close()


def run_tests():
    print("\n==========================================")
    print("  ZonaFit - Pruebas: Memberships (P0.6)")
    print("==========================================\n")

    gym1_id, admin1_id = setup_gym_and_admin("Gym Alfa", "gym_alfa_p06")
    gym2_id, admin2_id = setup_gym_and_admin("Gym Beta", "gym_beta_p06")

    cleanup(gym1_id)
    cleanup(gym2_id)

    db = create_test_session(gym1_id)
    try:
        admin1 = db.query(User).filter(User.id == admin1_id).first()
        admin2 = db.query(User).filter(User.id == admin2_id).first()

        # TEST 1: Crear Plan de Membresia en Gym 1
        print("[TEST 1] Crear MembershipPlan valido")
        plan1 = MembershipPlanService.create_plan(
            db,
            admin1,
            MembershipPlanCreate(
                name="Mensual Pro",
                description="Acceso ilimitado 30 dias",
                duration_days=30,
                price=Decimal("120000.00")
            )
        )
        log("Plan creado con exito", plan1.id is not None)
        log("Duracion correcta", plan1.duration_days == 30)

        # TEST 2: Intentar crear plan con nombre duplicado en mismo gym
        print("\n[TEST 2] Plan duplicado en mismo Gym -> ConflictException")
        try:
            MembershipPlanService.create_plan(
                db,
                admin1,
                MembershipPlanCreate(
                    name="Mensual Pro",
                    description="Otro plan",
                    duration_days=30,
                    price=Decimal("130000.00")
                )
            )
            log("Debe fallar por duplicado", False, "No se lanzo excepcion")
        except ConflictException:
            log("Rechaza plan duplicado con ConflictException", True)

        # TEST 3: Crear cliente en Gym 1
        print("\n[TEST 3] Crear Cliente en Gym 1")
        client1 = Client(
            gym_id=gym1_id,
            full_name="Carlos Gomez",
            document_type="CC",
            document="123456",
            email="carlos@gmail.com",
            phone="3111111111",
            is_active=True
        )
        db.add(client1)
        db.commit()
        db.refresh(client1)
        log("Cliente creado", client1.id is not None)

        # TEST 4: Asignar Membresia al Cliente
        print("\n[TEST 4] Asignar Membresia a Cliente")
        membership1 = MembershipService.create(
            db,
            admin1,
            MembershipCreate(
                client_id=client1.id,
                membership_plan_id=plan1.id,
                trainer_name="Coach Alex"
            )
        )
        log("Membresia creada con exito", membership1.id is not None)
        log("Estado inicial ACTIVE", membership1.status == MembershipStatus.ACTIVE)
        log("Vigencia calculada exactamente 30 dias", (membership1.end_date - membership1.start_date).days == 30)
        log("Precio capturado del plan", membership1.price == Decimal("120000.00"))

        # TEST 5: Renovacion anticipada -> extension de vigencia
        print("\n[TEST 5] Renovacion anticipada extiende vigencia")
        membership2 = MembershipService.create(
            db,
            admin1,
            MembershipCreate(
                client_id=client1.id,
                membership_plan_id=plan1.id,
                trainer_name="Coach Alex"
            )
        )
        log("Segunda membresia creada", membership2.id is not None)
        log("Inicio de renovacion coincide con fin de membresia previa", membership2.start_date == membership1.end_date)
        log("Nueva vigencia termina 30 dias despues de la previa", (membership2.end_date - membership1.end_date).days == 30)

        # TEST 6: Deteccion dinamica de membresia vencida
        print("\n[TEST 6] Deteccion dinamica de membresia vencida")
        # Creamos una membresia simulando fecha pasada
        past_start = datetime.now(timezone.utc) - timedelta(days=40)
        past_end = datetime.now(timezone.utc) - timedelta(days=10)
        expired_membership = Membership(
            gym_id=gym1_id,
            client_id=client1.id,
            membership_plan_id=plan1.id,
            start_date=past_start,
            end_date=past_end,
            price=Decimal("120000.00"),
            status=MembershipStatus.ACTIVE,
            is_active=True
        )
        db.add(expired_membership)
        db.commit()
        db.refresh(expired_membership)

        fetched_expired = MembershipService.get_by_id(db, admin1, expired_membership.id)
        log("Membresia con end_date en el pasado se retorna como EXPIRED", fetched_expired.status == MembershipStatus.EXPIRED)

        # TEST 7: Aislamiento Multi-Tenant
        print("\n[TEST 7] Aislamiento Multi-Tenant entre Gyms")
        # Gym 2 no debe poder consultar ni modificar la membresia de Gym 1
        fetched_cross = MembershipService.get_by_id(db, admin2, membership1.id)
        log("Gym 2 no puede acceder a membresia de Gym 1", fetched_cross is None)

        # Gym 2 no puede asignar plan de Gym 1 a cliente de Gym 2
        client2 = Client(
            gym_id=gym2_id,
            full_name="Diana Lopez",
            document_type="CC",
            document="654321",
            phone="3222222222",
            is_active=True
        )
        db.add(client2)
        db.commit()
        db.refresh(client2)

        try:
            MembershipService.create(
                db,
                admin2,
                MembershipCreate(
                    client_id=client2.id,
                    membership_plan_id=plan1.id # Plan de Gym 1
                )
            )
            log("Debe rechazar plan cruzado de otro Gym", False, "No se lanzo excepcion")
        except NotFoundException:
            log("Rechaza plan de otro Gym con NotFoundException", True)

        # TEST 8: Cancelar membresia
        print("\n[TEST 8] Modificar estado de membresia")
        updated = MembershipService.update(
            db,
            membership1,
            MembershipUpdate(status=MembershipStatus.CANCELLED, is_active=False)
        )
        log("Estado actualizado a CANCELLED", updated.status == MembershipStatus.CANCELLED)
        log("is_active actualizado a False", updated.is_active is False)

    finally:
        cleanup(gym1_id)
        cleanup(gym2_id)
        db.close()

    print("\n==========================================")
    print(f"  Resultado: {PASS_COUNT} pasaron | {FAIL_COUNT} fallaron")
    print("==========================================\n")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
