#!/usr/bin/env python
"""
Script de importación administrativa de membresías activas para el gimnasio "Primero de Mayo".
Destino: Base de datos de producción (Spaceship VPS / Hyperlift).

Características:
- Reutiliza modelos Membership, MembershipPlan, Client, Gym, User de SQLAlchemy.
- Conecta usando DATABASE_URL del entorno o parámetro --database-url.
- Valida estrictamente el usuario 'merwilcompany@gmail.com' y gimnasio 'MerwilFit Primero de Mayo' / 'Primero de Mayo'.
- Valida la existencia de planes de 31 días ("Mensualidad") y 15 días ("Quincena"). No crea ni modifica planes.
- Parser exacto de backend/data/PRIMERO_DE_MAYO_ACTIVOS_PLANIFICADOS.md (120 registros):
    * 107 Mensualidad (31 días)
    * 9 Quincena (15 días)
    * 4 REVISAR (omitidos)
    * 116 candidatos a insertar
- Mapeo exacto:
    * gym_id del gimnasio validado
    * client_id por búsqueda cédula (o nombre en caso de cédula vacía)
    * membership_plan_id según plan asignado
    * start_date y end_date según INICIO y FIN del markdown (UTC)
    * status = 'ACTIVE', is_active = True
    * price = plan.price
- No crea pagos ni facturas.
- No modifica clientes, usuarios, inventario ni caja.
- Detección de duplicados e idempotencia: no duplica si ya existe membresía para ese cliente, plan y período.
- Transaccional: commit atómico o rollback en caso de fallo.
- Soporta --dry-run y ejecución controlada por IMPORT_PRIMERO_DE_MAYO_MEMBERSHIPS=true.
- Seguro: no imprime contraseñas, credenciales ni URLs completas.
"""

import argparse
from datetime import datetime, timezone
import logging
import os
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Añadir el directorio backend al PYTHONPATH
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, func, text
from sqlalchemy.orm import Session, sessionmaker

from app.constants.membership_status import MembershipStatus
from app.models.client import Client
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.user import User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("import_primero_de_mayo_memberships")


def mask_database_url(url: str) -> str:
    """Oculta la contraseña y credenciales sensibles de una URL de conexión."""
    if not url:
        return "<no configurada>"
    try:
        parsed = urllib.parse.urlsplit(url)
        netloc = ""
        if parsed.username:
            netloc += parsed.username
        if parsed.password:
            netloc += ":****"
        if parsed.hostname:
            netloc += f"@{parsed.hostname}" if netloc else parsed.hostname
        if parsed.port:
            netloc += f":{parsed.port}"
        return urllib.parse.urlunsplit(
            (parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment)
        )
    except Exception:
        return "<url oculta por seguridad>"


def parse_date(date_str: str) -> datetime:
    """Parsea una cadena de fecha a datetime con timezone UTC."""
    cleaned = date_str.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    raise ValueError(f"Formato de fecha inválido: '{cleaned}'")


def parse_activos_markdown(file_path: Path) -> Dict[str, any]:
    """
    Parsea la tabla markdown de activos planificados.
    Formato esperado: | NOMBRE | CEDULA | TELEFONO | INICIO | FIN | DÍAS | PLAN |
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Archivo de datos no encontrado: {file_path}")

    all_rows = []
    mensualidad_rows = []
    quincena_rows = []
    revisar_rows = []
    other_rows = []

    with open(file_path, "r", encoding="utf-8") as f:
        for line_idx, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str.startswith("|") or "NOMBRE" in line_str or "---" in line_str:
                continue

            parts = [p.strip() for p in line_str.split("|")[1:-1]]
            if len(parts) < 7:
                continue

            name, doc, phone, start_str, end_str, days_str, plan_str = parts[:7]

            record = {
                "line_num": line_idx,
                "full_name": name,
                "document": doc,
                "phone": phone,
                "start_str": start_str,
                "end_str": end_str,
                "days": int(days_str) if days_str.isdigit() else 0,
                "plan_type": plan_str,
                "start_date": parse_date(start_str),
                "end_date": parse_date(end_str),
            }

            all_rows.append(record)

            if plan_str == "Mensualidad":
                mensualidad_rows.append(record)
            elif plan_str == "Quincena":
                quincena_rows.append(record)
            elif plan_str == "REVISAR":
                revisar_rows.append(record)
            else:
                other_rows.append(record)

    candidates = mensualidad_rows + quincena_rows

    return {
        "all_rows": all_rows,
        "mensualidad_rows": mensualidad_rows,
        "quincena_rows": quincena_rows,
        "revisar_rows": revisar_rows,
        "other_rows": other_rows,
        "candidates": candidates,
        "total_read": len(all_rows),
        "mensualidad_count": len(mensualidad_rows),
        "quincena_count": len(quincena_rows),
        "revisar_count": len(revisar_rows),
        "candidates_count": len(candidates),
    }


def validate_user_and_gym(
    db: Session, target_email: str, target_gym_name: str
) -> Tuple[User, Gym]:
    """
    Verifica que el usuario administrador exista, tenga gym_id y pertenezca al gimnasio indicado.
    Si cualquier verificación falla, detiene el proceso inmediatamente.
    """
    db.info["bypass_rls"] = True
    try:
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    except Exception:
        pass

    user = (
        db.query(User)
        .filter(func.lower(User.email) == target_email.strip().lower())
        .first()
    )
    if not user:
        raise ValueError(
            f"Validación crítica fallida: No existe ningún usuario con el correo '{target_email}'."
        )

    if not user.gym_id:
        raise ValueError(
            f"Validación crítica fallida: El usuario '{user.email}' (ID: {user.id}) no tiene gym_id asignado."
        )

    gym = db.query(Gym).filter(Gym.id == user.gym_id).first()
    if not gym:
        raise ValueError(
            f"Validación crítica fallida: El gimnasio con ID {user.gym_id} no fue encontrado en la base de datos."
        )

    gym_name_clean = gym.name.strip().lower()
    target_clean = target_gym_name.strip().lower()
    valid_gym_names = {target_clean}
    if "primero de mayo" in target_clean:
        valid_gym_names.add("merwilfit primero de mayo")
        valid_gym_names.add("primero de mayo")

    if gym_name_clean not in valid_gym_names:
        raise ValueError(
            f"Validación crítica fallida: El gimnasio asociado (ID: {gym.id}, '{gym.name}') "
            f"no coincide con el gimnasio objetivo '{target_gym_name}'."
        )

    db.info["tenant_id"] = gym.id
    try:
        db.execute(
            text("SELECT set_config('app.current_gym_id', :gym_id, true)"),
            {"gym_id": str(gym.id)},
        )
    except Exception:
        pass

    return user, gym


def get_required_plans(db: Session, gym_id: int) -> Tuple[MembershipPlan, MembershipPlan]:
    """
    Busca y valida los planes de membresía existentes requeridos para la importación:
    - Mensualidad: plan activo de 31 días.
    - Quincena: plan activo de 15 días.
    No crea ni modifica planes. Lanza excepción si alguno no existe.
    """
    # 1. Buscar plan de 31 días (Mensualidad)
    plans_31 = (
        db.query(MembershipPlan)
        .filter(
            MembershipPlan.gym_id == gym_id,
            MembershipPlan.duration_days == 31,
            MembershipPlan.is_active == True,
        )
        .all()
    )

    plan_mensualidad = None
    if plans_31:
        # Si hay varios, priorizar por nombre que contenga 'mensual'
        for p in plans_31:
            if "mensual" in p.name.lower():
                plan_mensualidad = p
                break
        if not plan_mensualidad:
            plan_mensualidad = plans_31[0]

    if not plan_mensualidad:
        raise ValueError(
            f"Validación crítica fallida: No existe un plan activo de 31 días ('Mensualidad') para gym_id {gym_id}."
        )

    # 2. Buscar plan de 15 días (Quincena)
    plans_15 = (
        db.query(MembershipPlan)
        .filter(
            MembershipPlan.gym_id == gym_id,
            MembershipPlan.duration_days == 15,
            MembershipPlan.is_active == True,
        )
        .all()
    )

    plan_quincena = None
    if plans_15:
        # Si hay varios, priorizar por nombre que contenga 'quincen'
        for p in plans_15:
            if "quincen" in p.name.lower():
                plan_quincena = p
                break
        if not plan_quincena:
            plan_quincena = plans_15[0]

    if not plan_quincena:
        raise ValueError(
            f"Validación crítica fallida: No existe un plan activo de 15 días ('Quincena') para gym_id {gym_id}."
        )

    logger.info(
        "Plan 'Mensualidad' identificado: ID=%d, Nombre='%s', Duración=%d días, Precio=%s",
        plan_mensualidad.id,
        plan_mensualidad.name,
        plan_mensualidad.duration_days,
        str(plan_mensualidad.price),
    )
    logger.info(
        "Plan 'Quincena' identificado: ID=%d, Nombre='%s', Duración=%d días, Precio=%s",
        plan_quincena.id,
        plan_quincena.name,
        plan_quincena.duration_days,
        str(plan_quincena.price),
    )

    return plan_mensualidad, plan_quincena


def find_client_for_record(db: Session, gym_id: int, record: Dict[str, any]) -> Optional[Client]:
    """
    Busca al cliente por gym_id y cédula.
    Si la cédula está vacía, busca por coincidencia exacta de nombre (case-insensitive).
    """
    doc = record["document"].strip()
    name = record["full_name"].strip()

    if doc:
        client = (
            db.query(Client)
            .filter(Client.gym_id == gym_id, Client.document == doc)
            .first()
        )
        if client:
            return client

    # Fallback por nombre si no tiene cédula o no se encontró por documento
    if name:
        client = (
            db.query(Client)
            .filter(Client.gym_id == gym_id, func.lower(Client.full_name) == name.lower())
            .first()
        )
        if client:
            return client

    return None


def find_existing_equivalent_membership(
    db: Session, gym_id: int, client_id: int, plan_id: int, start_date: datetime, end_date: datetime
) -> Optional[Membership]:
    """
    Verifica si el cliente ya tiene una membresía equivalente para el mismo plan y período.
    Idempotencia para evitar duplicaciones.
    """
    # Comparación exacta de datetime
    exact = (
        db.query(Membership)
        .filter(
            Membership.gym_id == gym_id,
            Membership.client_id == client_id,
            Membership.membership_plan_id == plan_id,
            Membership.start_date == start_date,
            Membership.end_date == end_date,
        )
        .first()
    )
    if exact:
        return exact

    # Comparación por fecha (date-only) para robustez ante variaciones horarias
    date_match = (
        db.query(Membership)
        .filter(
            Membership.gym_id == gym_id,
            Membership.client_id == client_id,
            Membership.membership_plan_id == plan_id,
            func.date(Membership.start_date) == start_date.strftime("%Y-%m-%d"),
            func.date(Membership.end_date) == end_date.strftime("%Y-%m-%d"),
        )
        .first()
    )
    return date_match


def run_import(
    db: Session,
    markdown_path: Path,
    dry_run: bool = True,
    target_email: str = "merwilcompany@gmail.com",
    target_gym_name: str = "MerwilFit Primero de Mayo",
) -> Dict[str, any]:
    """
    Ejecuta el flujo de importación de membresías (dry-run o real).
    Retorna un diccionario de resumen estructurado.
    """
    logger.info("Iniciando validación de usuario y gimnasio destino...")
    target_user, target_gym = validate_user_and_gym(db, target_email, target_gym_name)
    logger.info(
        "Contexto verificado: Usuario ID %d (%s) -> Gimnasio ID %d ('%s')",
        target_user.id,
        target_user.email,
        target_gym.id,
        target_gym.name,
    )

    logger.info("Verificando existencia de planes requeridos (31 días y 15 días)...")
    plan_mensualidad, plan_quincena = get_required_plans(db, target_gym.id)

    logger.info("Parseando archivo de activos: %s", markdown_path)
    parsed = parse_activos_markdown(markdown_path)

    # Validaciones críticas de cantidades esperadas
    if parsed["total_read"] != 120:
        raise ValueError(
            f"Validación fallida: Se esperaban 120 registros en total, se leyeron {parsed['total_read']}."
        )
    if parsed["mensualidad_count"] != 107:
        raise ValueError(
            f"Validación fallida: Se esperaban 107 registros de Mensualidad, se encontraron {parsed['mensualidad_count']}."
        )
    if parsed["quincena_count"] != 9:
        raise ValueError(
            f"Validación fallida: Se esperaban 9 registros de Quincena, se encontraron {parsed['quincena_count']}."
        )
    if parsed["revisar_count"] != 4:
        raise ValueError(
            f"Validación fallida: Se esperaban 4 registros para REVISAR, se encontraron {parsed['revisar_count']}."
        )
    if parsed["candidates_count"] != 116:
        raise ValueError(
            f"Validación fallida: Se esperaban 116 candidatos a insertar, se obtuvieron {parsed['candidates_count']}."
        )

    logger.info(
        "Cantidades validadas con éxito: %d leídos, %d Mensualidad, %d Quincena, %d REVISAR, %d candidatos.",
        parsed["total_read"],
        parsed["mensualidad_count"],
        parsed["quincena_count"],
        parsed["revisar_count"],
        parsed["candidates_count"],
    )

    inserted_count = 0
    already_existing_count = 0
    existing_details = []
    error_count = 0
    errors = []
    candidates_to_insert = []

    # Procesar candidatos
    for record in parsed["candidates"]:
        line_num = record["line_num"]
        plan_type = record["plan_type"]
        target_plan = plan_mensualidad if plan_type == "Mensualidad" else plan_quincena

        # Buscar cliente
        client = find_client_for_record(db, target_gym.id, record)
        if not client:
            error_count += 1
            err_msg = f"Cliente no encontrado en gym_id {target_gym.id}: '{record['full_name']}' (cédula: '{record['document']}')."
            logger.error("Línea %d: %s", line_num, err_msg)
            errors.append({"line": line_num, "record": record, "reason": err_msg})
            continue

        # Verificar si ya existe membresía equivalente (idempotencia)
        existing = find_existing_equivalent_membership(
            db=db,
            gym_id=target_gym.id,
            client_id=client.id,
            plan_id=target_plan.id,
            start_date=record["start_date"],
            end_date=record["end_date"],
        )
        if existing:
            already_existing_count += 1
            reason = f"Membresía ya existe (ID: {existing.id}, Plan: {target_plan.name}, {record['start_str']} a {record['end_str']})"
            existing_details.append({"line": line_num, "record": record, "reason": reason})
            continue

        # Crear instancia de Membership
        new_membership = Membership(
            gym_id=target_gym.id,
            client_id=client.id,
            membership_plan_id=target_plan.id,
            start_date=record["start_date"],
            end_date=record["end_date"],
            price=target_plan.price,
            status=MembershipStatus.ACTIVE,
            is_active=True,
            trainer_name=None,
        )
        candidates_to_insert.append((record, new_membership))

    new_to_insert = len(candidates_to_insert)

    if not dry_run:
        if error_count > 0:
            db.rollback()
            raise RuntimeError(
                f"La importación se detuvo sin realizar cambios porque se detectaron {error_count} errores."
            )

        logger.info("Persistiendo %d membresías nuevas en la base de datos...", new_to_insert)
        for _, membership in candidates_to_insert:
            db.add(membership)
        db.commit()
        inserted_count = new_to_insert
        logger.info("Commit ejecutado exitosamente.")
    else:
        logger.info("Modo DRY-RUN activo: no se persisten cambios en la base de datos.")
        db.rollback()

    return {
        "dry_run": dry_run,
        "target_user_email": target_user.email,
        "target_user_id": target_user.id,
        "target_gym_id": target_gym.id,
        "target_gym_name": target_gym.name,
        "plan_mensualidad_id": plan_mensualidad.id,
        "plan_mensualidad_name": plan_mensualidad.name,
        "plan_quincena_id": plan_quincena.id,
        "plan_quincena_name": plan_quincena.name,
        "total_read": parsed["total_read"],
        "mensualidad_count": parsed["mensualidad_count"],
        "quincena_count": parsed["quincena_count"],
        "revisar_count": parsed["revisar_count"],
        "candidates_count": parsed["candidates_count"],
        "new_to_insert": new_to_insert,
        "inserted_count": inserted_count,
        "already_existing_count": already_existing_count,
        "existing_details": existing_details,
        "error_count": error_count,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Importador operativo de membresías activas para el gimnasio Primero de Mayo."
    )
    parser.add_argument(
        "--file",
        type=str,
        default=str(BACKEND_DIR / "data" / "PRIMERO_DE_MAYO_ACTIVOS_PLANIFICADOS.md"),
        help="Ruta al archivo Markdown con las membresías activas planificadas.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=None,
        help="Simula la importación sin guardar cambios en la base de datos.",
    )
    parser.add_argument(
        "--production",
        action="store_true",
        help="Ejecuta la inserción real en la base de datos de producción.",
    )
    parser.add_argument(
        "--target-email",
        type=str,
        default="merwilcompany@gmail.com",
        help="Correo del administrador del gimnasio para validación de tenant.",
    )
    parser.add_argument(
        "--target-gym",
        type=str,
        default="MerwilFit Primero de Mayo",
        help="Nombre esperado del gimnasio.",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="URL de conexión SQLAlchemy opcional.",
    )
    parser.add_argument(
        "--allow-sqlite",
        action="store_true",
        help="Permite ejecución sobre SQLite (exclusivo para pruebas automatizadas).",
    )

    args = parser.parse_args()

    # Determinar modo de ejecución:
    # Si --production está explícito o la variable IMPORT_PRIMERO_DE_MAYO_MEMBERSHIPS=true está activa, es modo producción.
    env_import_flag = os.getenv("IMPORT_PRIMERO_DE_MAYO_MEMBERSHIPS", "").strip().lower() == "true"
    if args.production or env_import_flag:
        is_dry_run = False
    elif args.dry_run is not None:
        is_dry_run = args.dry_run
    else:
        # Por defecto siempre seguro: simulación
        is_dry_run = True

    db_url = args.database_url or os.getenv("DATABASE_URL")
    if not db_url:
        logger.error(
            "ERROR CRÍTICO: No se proporcionó DATABASE_URL ni parámetro --database-url."
        )
        sys.exit(1)

    if db_url.startswith("sqlite") and not args.allow_sqlite:
        logger.error("ERROR CRÍTICO: No está permitido ejecutar la importación contra SQLite.")
        sys.exit(1)

    logger.info("=" * 65)
    logger.info(" IMPORTADOR DE MEMBRESÍAS - GIMNASIO PRIMERO DE MAYO")
    logger.info(" Modo: %s", "SIMULACION (--dry-run)" if is_dry_run else "IMPORTACION REAL (PRODUCCION)")
    logger.info(" Conexion BD: %s", mask_database_url(db_url))
    logger.info("=" * 65)

    data_file = Path(args.file)
    engine = create_engine(db_url, pool_pre_ping=True)
    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionFactory()

    try:
        summary = run_import(
            db=session,
            markdown_path=data_file,
            dry_run=is_dry_run,
            target_email=args.target_email,
            target_gym_name=args.target_gym,
        )

        print("\n" + "=" * 65)
        print(" RESUMEN DE EJECUCIÓN")
        print("=" * 65)
        print(f" - Modo ejecución:          {'DRY-RUN (Sin cambios guardados)' if summary['dry_run'] else 'PRODUCCIÓN (Cambios guardados)'}")
        print(f" - Usuario identificado:     {summary['target_user_email']} (ID: {summary['target_user_id']})")
        print(f" - Gimnasio destino:         {summary['target_gym_name']} (gym_id: {summary['target_gym_id']})")
        print(f" - Plan Mensualidad:         ID {summary['plan_mensualidad_id']} ('{summary['plan_mensualidad_name']}')")
        print(f" - Plan Quincena:            ID {summary['plan_quincena_id']} ('{summary['plan_quincena_name']}')")
        print(f" - Total registros leídos:   {summary['total_read']}")
        print(f" - Mensualidad (31 días):    {summary['mensualidad_count']}")
        print(f" - Quincena (15 días):       {summary['quincena_count']}")
        print(f" - REVISAR (omitidos):       {summary['revisar_count']}")
        print(f" - Candidatos a insertar:    {summary['candidates_count']}")
        print(f" - Nuevos para insertar:     {summary['new_to_insert']}")
        if not summary["dry_run"]:
            print(f" - Registros insertados:     {summary['inserted_count']}")
        print(f" - Registros existentes:     {summary['already_existing_count']}")
        print(f" - Errores:                  {summary['error_count']}")
        print("=" * 65)

        if summary["already_existing_count"] > 0:
            logger.info("Detalle de registros existentes / omitidos (%d):", summary["already_existing_count"])
            for item in summary["existing_details"][:10]:
                logger.info("  Línea %d: %s (%s)", item["line"], item["record"]["full_name"], item["reason"])
            if summary["already_existing_count"] > 10:
                logger.info("  ... y %d registros más.", summary["already_existing_count"] - 10)

        if summary["error_count"] > 0:
            logger.warning("Detalle de errores detectados (%d):", summary["error_count"])
            for err in summary["errors"]:
                logger.warning("  Línea %d: %s", err["line"], err["reason"])

        if summary["dry_run"]:
            print("\n[OK] Simulación finalizada correctamente. Ninguna membresía fue insertada.")
        else:
            print(f"\n[OK] Importación finalizada exitosamente. {summary['inserted_count']} membresías insertadas en gym_id {summary['target_gym_id']}.")

    except Exception as e:
        logger.error("FALLO EN LA OPERACIÓN: %s", e)
        sys.exit(2)
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
