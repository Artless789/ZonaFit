#!/usr/bin/env python
"""
Script de importación administrativa de clientes para el gimnasio "Primero de Mayo".
Destino: Base de datos de producción (Spaceship VPS / Hyperlift).

Características:
- Reutiliza modelos y configuración SQLAlchemy del proyecto.
- Conecta usando DATABASE_URL del entorno o parámetro --database-url.
- Valida estrictamente la existencia de 'merwilcompany@gmail.com' y gym 'Primero de Mayo'.
- Parser exacto de backend/data/PRIMERO_DE_MAYO_CLIENTES.md (279 clientes).
- Mapeo exacto: NOMBRE -> full_name, CEDULA -> document, TELEFONO -> phone, document_type -> 'CC'.
- No inventa ni altera valores vacíos o existentes.
- Detección de duplicados por (gym_id, document) y (gym_id, full_name).
- Transaccional (commit atómico o rollback en caso de fallo).
- Soporta --dry-run.
- Seguro: no imprime contraseñas, secretos, tokens ni la DATABASE_URL completa.
- No modifica ninguna otra tabla de negocio (membresías, pagos, caja, etc.).
"""

import argparse
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

from app.models.client import Client
from app.models.gym import Gym
from app.models.user import User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("import_primero_de_mayo")


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


def parse_clients_markdown(file_path: Path) -> List[Dict[str, str]]:
    """
    Parsea la tabla markdown de clientes preservando exactamente los valores proporcionados.
    Formato esperado: | # | NOMBRE | CEDULA | TELEFONO |
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Archivo de datos no encontrado: {file_path}")

    records = []
    line_pattern = re.compile(
        r"^\s*\|\s*(\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*$"
    )

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            # Ignorar encabezados y separadores
            if not line_str.startswith("|") or "NOMBRE" in line_str or "---" in line_str:
                continue

            match = line_pattern.match(line_str)
            if match:
                num_str, name, doc, phone = match.groups()
                records.append(
                    {
                        "row_num": int(num_str.strip()),
                        "full_name": name.strip(),
                        "document": doc.strip(),
                        "phone": phone.strip(),
                        "document_type": "CC",
                    }
                )

    return records


def validate_user_and_gym(
    db: Session, target_email: str, target_gym_name: str
) -> Tuple[User, Gym]:
    """
    Verifica que el usuario administrador exista, tenga gym_id y pertenezca al gimnasio indicado.
    Si cualquier verificación falla, detiene el proceso inmediatamente.
    """
    # Activar bypass de RLS para consultas administrativas seguras
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

    if gym.name.strip().lower() != target_gym_name.strip().lower():
        raise ValueError(
            f"Validación crítica fallida: El gimnasio asociado (ID: {gym.id}, '{gym.name}') "
            f"no coincide con el gimnasio objetivo '{target_gym_name}'."
        )

    # Configurar tenant_id de la sesión para el contexto del gimnasio
    db.info["tenant_id"] = gym.id
    try:
        db.execute(
            text("SELECT set_config('app.current_gym_id', :gym_id, true)"),
            {"gym_id": str(gym.id)},
        )
    except Exception:
        pass

    return user, gym


def run_import(
    db: Session,
    markdown_path: Path,
    dry_run: bool = True,
    target_email: str = "merwilcompany@gmail.com",
    target_gym_name: str = "Primero de Mayo",
) -> Dict[str, any]:
    """
    Ejecuta el flujo de importación (dry-run o real).
    Retorna un diccionario de resumen estructurado.
    """
    # 1. Validar usuario y gimnasio objetivo
    user, gym = validate_user_and_gym(db, target_email, target_gym_name)
    gym_id = gym.id

    # 2. Parsear el archivo de datos
    raw_records = parse_clients_markdown(markdown_path)
    total_read = len(raw_records)

    # 3. Consultar clientes existentes en el gimnasio
    existing_clients = (
        db.query(Client)
        .filter(Client.gym_id == gym_id)
        .all()
    )

    existing_docs = {
        c.document.strip() for c in existing_clients if c.document and c.document.strip()
    }
    existing_names = {
        c.full_name.strip().upper()
        for c in existing_clients
        if c.full_name and c.full_name.strip()
    }

    # 4. Clasificar registros
    valid_records = []
    already_existing_records = []
    error_records = []

    seen_batch_docs = set()
    seen_batch_names = set()

    for r in raw_records:
        name = r["full_name"]
        doc = r["document"]
        phone = r["phone"]

        if not name:
            error_records.append(
                {"row": r["row_num"], "reason": "Nombre vacío", "record": r}
            )
            continue

        # Detección de duplicados contra base de datos o lote actual
        is_duplicate = False
        duplicate_reason = ""

        if doc:
            if doc in existing_docs:
                is_duplicate = True
                duplicate_reason = f"Cédula {doc} ya registrada en la BD para este gym"
            elif doc in seen_batch_docs:
                is_duplicate = True
                duplicate_reason = f"Cédula {doc} duplicada dentro del archivo"
        else:
            # Si no tiene cédula, verificar por nombre exacto
            name_upper = name.upper()
            if name_upper in existing_names:
                is_duplicate = True
                duplicate_reason = f"Nombre '{name}' ya registrado sin cédula en la BD"
            elif name_upper in seen_batch_names:
                is_duplicate = True
                duplicate_reason = f"Nombre '{name}' duplicado dentro del archivo"

        if is_duplicate:
            already_existing_records.append(
                {"row": r["row_num"], "reason": duplicate_reason, "record": r}
            )
        else:
            valid_records.append(r)
            if doc:
                seen_batch_docs.add(doc)
            seen_batch_names.add(name.upper())

    # 5. Inserción (si no es dry-run)
    inserted_count = 0
    if not dry_run and valid_records:
        clients_to_create = [
            Client(
                gym_id=gym_id,
                full_name=r["full_name"],
                document_type=r["document_type"],
                document=r["document"],
                phone=r["phone"],
                is_active=True,
            )
            for r in valid_records
        ]

        try:
            db.add_all(clients_to_create)
            db.commit()
            inserted_count = len(clients_to_create)
        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Error al insertar clientes en PostgreSQL: {e}")
    elif dry_run:
        inserted_count = 0

    return {
        "target_user_email": user.email,
        "target_user_id": user.id,
        "target_gym_id": gym_id,
        "target_gym_name": gym.name,
        "total_read": total_read,
        "valid_count": len(valid_records) + len(already_existing_records),
        "new_to_insert": len(valid_records),
        "inserted_count": inserted_count,
        "already_existing_count": len(already_existing_records),
        "error_count": len(error_records),
        "dry_run": dry_run,
        "errors": error_records,
        "existing_details": already_existing_records,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Importación segura de clientes Primero de Mayo para Merwil ZonaFit"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ejecuta la validación y simulación sin guardar cambios en la base de datos.",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=None,
        help="URL de conexión a PostgreSQL (opcional, por defecto toma DATABASE_URL del entorno).",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=str(BACKEND_DIR / "data" / "PRIMERO_DE_MAYO_CLIENTES.md"),
        help="Ruta al archivo markdown de clientes.",
    )
    parser.add_argument(
        "--target-email",
        type=str,
        default="merwilcompany@gmail.com",
        help="Email del administrador propietario esperado.",
    )
    parser.add_argument(
        "--target-gym",
        type=str,
        default="Primero de Mayo",
        help="Nombre del gimnasio esperado.",
    )

    args = parser.parse_args()

    # Resolver DATABASE_URL
    db_url = args.database_url or os.getenv("DATABASE_URL")

    # Si no se pasó DATABASE_URL explícita, intentar cargar desde backend/.env como respaldo
    if not db_url:
        from dotenv import load_dotenv

        env_path = BACKEND_DIR / ".env"
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            db_url = os.getenv("DATABASE_URL")

    if not db_url:
        logger.error(
            "ERROR CRÍTICO: No se detectó la variable de entorno DATABASE_URL.\n"
            "Esta importación debe ejecutarse exclusivamente contra la base de datos de producción (Spaceship VPS / Hyperlift).\n"
            "Configura DATABASE_URL o utiliza el parámetro --database-url."
        )
        sys.exit(1)

    # Validar que no apunte a SQLite
    if db_url.startswith("sqlite"):
        logger.error("ERROR CRÍTICO: No está permitido ejecutar la importación contra SQLite.")
        sys.exit(1)

    logger.info("=" * 65)
    logger.info(" IMPORTADOR DE CLIENTES - GIMNASIO PRIMERO DE MAYO")
    logger.info(" Modo: %s", "SIMULACION (--dry-run)" if args.dry_run else "IMPORTACION REAL (PRODUCCION)")
    logger.info(" Conexion BD: %s", mask_database_url(db_url))
    logger.info("=" * 65)

    data_file = Path(args.file)

    # Crear engine y session
    engine = create_engine(db_url, pool_pre_ping=True)
    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionFactory()

    try:
        summary = run_import(
            db=session,
            markdown_path=data_file,
            dry_run=args.dry_run,
            target_email=args.target_email,
            target_gym_name=args.target_gym,
        )

        print("\n" + "=" * 65)
        print(" RESUMEN DE EJECUCIÓN")
        print("=" * 65)
        print(f" - Modo ejecución:      {'DRY-RUN (Sin cambios guardados)' if summary['dry_run'] else 'PRODUCCIÓN (Cambios guardados)'}")
        print(f" - Usuario identificado: {summary['target_user_email']} (ID: {summary['target_user_id']})")
        print(f" - Gimnasio destino:     {summary['target_gym_name']} (gym_id: {summary['target_gym_id']})")
        print(f" - Registros leídos:     {summary['total_read']}")
        print(f" - Registros válidos:    {summary['valid_count']}")
        print(f" - Registros nuevos:     {summary['new_to_insert']}")
        if not summary["dry_run"]:
            print(f" - Registros insertados: {summary['inserted_count']}")
        print(f" - Registros existentes: {summary['already_existing_count']}")
        print(f" - Errores:              {summary['error_count']}")
        print("=" * 65)

        if summary["already_existing_count"] > 0:
            logger.info("Detalle de registros existentes / omitidos (%d):", summary["already_existing_count"])
            for item in summary["existing_details"][:10]:
                logger.info("  Fila %d: %s (%s)", item["row"], item["record"]["full_name"], item["reason"])
            if summary["already_existing_count"] > 10:
                logger.info("  ... y %d registros más.", summary["already_existing_count"] - 10)

        if summary["error_count"] > 0:
            logger.warning("Detalle de errores detectados (%d):", summary["error_count"])
            for err in summary["errors"]:
                logger.warning("  Fila %d: %s", err["row"], err["reason"])

        if summary["dry_run"]:
            print("\n[OK] Simulación finalizada correctamente. Ningún registro fue insertado.")
        else:
            print(f"\n[OK] Importación finalizada exitosamente. {summary['inserted_count']} clientes insertados en gym_id {summary['target_gym_id']}.")

    except Exception as e:
        logger.error("FALLO EN LA OPERACIÓN: %s", e)
        sys.exit(2)
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
