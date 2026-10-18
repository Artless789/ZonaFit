#!/usr/bin/env python
"""
Script de sincronización y actualización masiva de membresías y clientes para el gimnasio "MerwilFit" (Primero de Mayo).
Destino: Base de datos de producción (Spaceship VPS / Hyperlift).

Características principales:
- Reutiliza modelos Client, Membership, MembershipPlan, Gym, User de SQLAlchemy.
- Conecta usando DATABASE_URL del entorno o parámetro --database-url.
- Valida estrictamente el usuario administrador 'merwilcompany@gmail.com' y gimnasio 'MerwilFit Primero de Mayo' / 'Primero de Mayo'.
- Parser dual: lee archivo Excel (.xlsm / .xlsx) u archivo estructurado JSON (backend/data/MERWILFT_NV_26_DE_MAYO.json).
- Identidad principal: gym_id + document_type + document.
- Creación de clientes nuevos con is_active=True (incluso si su membresía está vencida).
- Regla crítica: ACTIVO/VENCIDO pertenece a Membership, NUNCA desactiva a Client (Client.is_active=True).
- Clasificación estricta de planes:
    * 15–16 días -> Quincena (15 días)
    * 30–33 días -> Mensualidad (31 días)
    * Cualquier otra duración -> NO actualizar automáticamente, registrar para revisión.
- Manejo defensivo de casos especiales:
    * ELIANA TOVAR (1233494723 vs 1233484720): corrección de documento -> requiere revisión manual.
    * VICTORIA CASTILLERO (1021398205 vs 102139805): corrección de documento -> requiere revisión manual.
    * ANGELA MARTINEZ / VANESSA MARTINEZ: conflicto de identidad -> detenido para revisión.
    * SHAROL CERRO / SHAROL PEREZ: cambio de nombre y teléfono -> detenido para revisión.
    * ROSIO GEVIS -> ROSIO GELVIS: corrección tipográfica sobre mismo documento -> permitida.
    * OMAIRA MOLINA (cédula vacía) -> detenida para revisión.
- Idempotencia: no duplica clientes ni membresías equivalentes para el mismo período.
- Mantiene membresías anteriores como historial (NO elimina membresías históricas).
- NO crea pagos, facturas ni movimientos de caja.
- Respaldo lógico: genera snapshot JSON antes de modificar la base de datos en ejecución real.
- Soporta --dry-run (por defecto) y --production / SYNC_MERWILFIT_MEMBERSHIPS=true.
- Seguro: no imprime contraseñas, tokens, credenciales ni URLs completas.
"""

import argparse
from datetime import date, datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple
import urllib.parse

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
logger = logging.getLogger("sync_merwilfit_memberships")


def mask_database_url(url: str) -> str:
    """Oculta contraseñas y credenciales sensibles de una URL de conexión."""
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


def parse_date(val: Any) -> Optional[datetime]:
    """Parsea una fecha a datetime con timezone UTC."""
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day, tzinfo=timezone.utc)

    cleaned = str(val).strip()
    if not cleaned:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    raise ValueError(f"Formato de fecha inválido o no reconocido: '{cleaned}'")


def clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def clean_doc(val: Any) -> str:
    s = clean_str(val)
    if s.endswith(".0"):
        s = s[:-2]
    return s.strip()


def clean_phone(val: Any) -> str:
    s = clean_str(val)
    if s.endswith(".0"):
        s = s[:-2]
    return s.strip()


def load_dataset(file_path: Path) -> List[Dict[str, Any]]:
    """
    Carga el dataset de clientes y membresías desde JSON o Excel (.xlsm / .xlsx).
    Normaliza tipos y calcula duración de días.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Archivo de dataset no encontrado: {file_path}")

    records = []

    if file_path.suffix.lower() == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        for idx, item in enumerate(raw_data, start=2):
            start_dt = parse_date(item.get("start_date"))
            end_dt = parse_date(item.get("end_date"))
            diff = item.get("diff_days")
            if diff is None and start_dt and end_dt:
                diff = (end_dt.date() - start_dt.date()).days

            records.append({
                "row_num": item.get("row_num", idx),
                "full_name": clean_str(item.get("full_name")),
                "document": clean_doc(item.get("document")),
                "document_type": clean_str(item.get("document_type")) or "CC",
                "phone": clean_phone(item.get("phone")),
                "start_date": start_dt,
                "end_date": end_dt,
                "diff_days": diff,
                "status": clean_str(item.get("status")).upper(),
                "observations": clean_str(item.get("observations")),
            })
        return records

    # Lectura vía openpyxl
    try:
        import openpyxl
    except ImportError:
        raise ImportError("Se requiere openpyxl para leer archivos Excel (.xlsm, .xlsx).")

    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet_name = "Base de datos" if "Base de datos" in wb.sheetnames else wb.sheetnames[0]
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    data_rows = rows[1:]
    for idx, r in enumerate(data_rows, start=2):
        name = clean_str(r[0])
        doc = clean_doc(r[1])
        phone = clean_phone(r[2])
        start = r[3]
        end = r[4]
        status = clean_str(r[5]).upper()
        obs = clean_str(r[8]) if len(r) > 8 else ""

        start_dt = parse_date(start)
        end_dt = parse_date(end)
        diff = None
        if start_dt and end_dt:
            diff = (end_dt.date() - start_dt.date()).days

        records.append({
            "row_num": idx,
            "full_name": name,
            "document": doc,
            "document_type": "CC",
            "phone": phone,
            "start_date": start_dt,
            "end_date": end_dt,
            "diff_days": diff,
            "status": status,
            "observations": obs,
        })

    return records


def validate_user_and_gym(
    db: Session, target_email: str, target_gym_name: str
) -> Tuple[User, Gym]:
    """
    Verifica que el usuario administrador exista, tenga gym_id y pertenezca al gimnasio indicado.
    Activa bypass de RLS y establece app.current_gym_id.
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
    Busca y valida los planes de membresía requeridos:
    - Mensualidad: plan activo de ~31 días (o nombre 'Mensualidad').
    - Quincena: plan activo de ~15 días (o nombre 'Quincena').
    """
    plans = (
        db.query(MembershipPlan)
        .filter(
            MembershipPlan.gym_id == gym_id,
            MembershipPlan.is_active == True,
        )
        .all()
    )

    plan_mensualidad = None
    plan_quincena = None

    for p in plans:
        name_lower = p.name.lower()
        if "mensual" in name_lower or p.duration_days in (30, 31):
            if not plan_mensualidad or "mensual" in name_lower:
                plan_mensualidad = p
        if "quincen" in name_lower or p.duration_days in (14, 15, 16):
            if not plan_quincena or "quincen" in name_lower:
                plan_quincena = p

    if not plan_mensualidad:
        raise ValueError(
            f"Validación crítica fallida: No existe un plan activo de Mensualidad (30-31 días) para gym_id {gym_id}."
        )
    if not plan_quincena:
        raise ValueError(
            f"Validación crítica fallida: No existe un plan activo de Quincena (15 días) para gym_id {gym_id}."
        )

    return plan_mensualidad, plan_quincena


def create_logical_snapshot(db: Session, gym_id: int, output_dir: Path) -> Path:
    """
    Genera un snapshot lógico JSON de los clientes y membresías existentes para el gym_id
    antes de aplicar cualquier modificación.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    snapshot_file = output_dir / f"backup_merwilfit_{gym_id}_{timestamp}.json"

    clients = db.query(Client).filter(Client.gym_id == gym_id).all()
    memberships = db.query(Membership).filter(Membership.gym_id == gym_id).all()

    snapshot_data = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "gym_id": gym_id,
        "total_clients": len(clients),
        "total_memberships": len(memberships),
        "clients": [
            {
                "id": c.id,
                "full_name": c.full_name,
                "document": c.document,
                "document_type": c.document_type,
                "phone": c.phone,
                "email": c.email,
                "is_active": c.is_active,
            }
            for c in clients
        ],
        "memberships": [
            {
                "id": m.id,
                "client_id": m.client_id,
                "membership_plan_id": m.membership_plan_id,
                "start_date": m.start_date.isoformat() if m.start_date else None,
                "end_date": m.end_date.isoformat() if m.end_date else None,
                "price": str(m.price) if m.price else None,
                "status": str(m.status.value) if hasattr(m.status, "value") else str(m.status),
                "is_active": m.is_active,
            }
            for m in memberships
        ],
    }

    with open(snapshot_file, "w", encoding="utf-8") as f:
        json.dump(snapshot_data, f, indent=2, ensure_ascii=False)

    logger.info("Snapshot lógico guardado exitosamente en: %s", snapshot_file)
    return snapshot_file


# Lista de casos especiales explícitos de revisión/conflicto
DOC_CORRECTION_CASES = {
    "1233494723": {
        "name": "ELIANA TOVAR",
        "old_doc": "1233484720",
        "phone": "3116579202",
        "reason": "Posible corrección de documento (1233484720 -> 1233494723). Requiere confirmación manual.",
    },
    "1021398205": {
        "name": "VICTORIA CASTILLERO",
        "old_doc": "102139805",
        "phone": "3114419512",
        "reason": "Posible corrección de documento (102139805 -> 1021398205). Requiere confirmación manual.",
    },
}

IDENTITY_CONFLICT_CASES = {
    "1065822924": {
        "name": "VANESSA MARTINEZ",
        "conflict_with": "ANGELA MARTINEZ",
        "old_doc": "106822924",
        "phone": "3143859488",
        "reason": "Conflicto de identidad: mismo teléfono (3143859488) con cédula y nombre distintos. Bloqueado.",
    },
    "1003379453": {
        "name": "SHAROL PEREZ",
        "conflict_with": "SHAROL CERRO",
        "old_phone": "3123092680",
        "new_phone": "312309680",
        "reason": "Cambio simultáneo de nombre (SHAROL CERRO -> SHAROL PEREZ) y teléfono. Bloqueado.",
    },
}

NAME_CORRECTION_CASES = {
    "49787848": {
        "old_name": "ROSIO GEVIS",
        "new_name": "ROSIO GELVIS",
        "reason": "Corrección tipográfica de apellido sobre misma cédula inequívoca.",
    }
}


def run_sync(
    db: Session,
    dataset_path: Path,
    dry_run: bool = True,
    target_email: str = "merwilcompany@gmail.com",
    target_gym_name: str = "MerwilFit Primero de Mayo",
    do_snapshot: bool = True,
) -> Dict[str, Any]:
    """
    Ejecuta el flujo completo de sincronización de clientes y membresías.
    Es completamente transaccional e idempotente.
    """
    logger.info("Validando usuario y gimnasio destino...")
    target_user, target_gym = validate_user_and_gym(db, target_email, target_gym_name)
    gym_id = target_gym.id

    logger.info("Verificando planes activos en gimnasio ID %d...", gym_id)
    plan_mensualidad, plan_quincena = get_required_plans(db, gym_id)

    logger.info("Cargando dataset desde: %s", dataset_path)
    records = load_dataset(dataset_path)
    total_records = len(records)
    logger.info("Total registros leídos: %d", total_records)

    # Métricas "ANTES" en base de datos
    antes_clients = db.query(Client).filter(Client.gym_id == gym_id).count()
    antes_clients_active = (
        db.query(Client).filter(Client.gym_id == gym_id, Client.is_active == True).count()
    )
    antes_memberships = db.query(Membership).filter(Membership.gym_id == gym_id).count()
    antes_memberships_active = (
        db.query(Membership)
        .filter(Membership.gym_id == gym_id, Membership.status == MembershipStatus.ACTIVE)
        .count()
    )
    antes_memberships_expired = (
        db.query(Membership)
        .filter(Membership.gym_id == gym_id, Membership.status == MembershipStatus.EXPIRED)
        .count()
    )

    # Mapeo de clientes existentes en DB por documento (limpio)
    existing_clients_list = db.query(Client).filter(Client.gym_id == gym_id).all()
    clients_by_doc = {clean_doc(c.document): c for c in existing_clients_list if clean_doc(c.document)}
    clients_by_id = {c.id: c for c in existing_clients_list}

    # Mapeo de membresías existentes en DB por client_id
    existing_memberships_list = db.query(Membership).filter(Membership.gym_id == gym_id).all()
    memberships_by_client_id: Dict[int, List[Membership]] = {}
    for m in existing_memberships_list:
        memberships_by_client_id.setdefault(m.client_id, []).append(m)

    # Colecciones de clasificación
    clientes_nuevos_crear: List[Tuple[Dict[str, Any], Client]] = []
    clientes_encontrados: List[Dict[str, Any]] = []
    clientes_actualizar: List[Tuple[Client, str, str]] = []  # (client, field, new_val)

    membresias_nuevas_crear: List[Tuple[Dict[str, Any], Membership]] = []
    membresias_renovadas: List[Tuple[Dict[str, Any], Membership]] = []
    membresias_ya_existentes: List[Dict[str, Any]] = []
    membresias_a_expirar: List[Tuple[Membership, Dict[str, Any]]] = []

    conflictos_identidad: List[Dict[str, Any]] = []
    documentos_revision: List[Dict[str, Any]] = []
    duraciones_no_estandar: List[Dict[str, Any]] = []
    registros_omitidos: List[Dict[str, Any]] = []
    errores: List[Dict[str, Any]] = []

    # Procesar los 330 registros del Excel/dataset
    for r in records:
        row_num = r["row_num"]
        doc = r["document"]
        name = r["full_name"]
        phone = r["phone"]
        status = r["status"]
        diff_days = r["diff_days"]
        start_date = r["start_date"]
        end_date = r["end_date"]

        # 1. Caso documento vacío (e.g. OMAIRA MOLINA)
        if not doc:
            documentos_revision.append({
                "row": row_num,
                "full_name": name,
                "document": doc,
                "phone": phone,
                "status": status,
                "reason": "Cédula vacía. Requiere identificación manual.",
            })
            registros_omitidos.append({"row": row_num, "record": r, "reason": "Cédula vacía"})
            continue

        # 2. Conflicto de identidad bloqueado
        if doc in IDENTITY_CONFLICT_CASES:
            info = IDENTITY_CONFLICT_CASES[doc]
            conflictos_identidad.append({
                "row": row_num,
                "full_name": name,
                "document": doc,
                "phone": phone,
                "status": status,
                "reason": info["reason"],
            })
            registros_omitidos.append({"row": row_num, "record": r, "reason": info["reason"]})
            continue

        # 3. Documento en caso especial de corrección
        if doc in DOC_CORRECTION_CASES:
            info = DOC_CORRECTION_CASES[doc]
            documentos_revision.append({
                "row": row_num,
                "full_name": name,
                "document": doc,
                "phone": phone,
                "status": status,
                "reason": info["reason"],
            })
            registros_omitidos.append({"row": row_num, "record": r, "reason": info["reason"]})
            continue

        # 4. Clasificación de cliente: ¿Existe o es nuevo?
        target_client = clients_by_doc.get(doc)

        if not target_client:
            # Cliente nuevo: se creará siempre con is_active=True
            new_client = Client(
                gym_id=gym_id,
                full_name=name,
                document=doc,
                document_type=r["document_type"] or "CC",
                phone=phone,
                email=None,
                notes=r["observations"] if r["observations"] else None,
                is_active=True,
            )
            clientes_nuevos_crear.append((r, new_client))
        else:
            clientes_encontrados.append(r)
            # Verificar si aplica corrección de nombre permitida (ROSIO GELVIS)
            if doc in NAME_CORRECTION_CASES:
                corr = NAME_CORRECTION_CASES[doc]
                if target_client.full_name != corr["new_name"]:
                    clientes_actualizar.append((target_client, "full_name", corr["new_name"]))

        # 5. Tratamiento de membresía
        if status == "ACTIVO":
            # Validar duración estándar
            if diff_days is not None and 15 <= diff_days <= 16:
                assigned_plan = plan_quincena
                plan_name = "Quincena"
            elif diff_days is not None and 30 <= diff_days <= 33:
                assigned_plan = plan_mensualidad
                plan_name = "Mensualidad"
            else:
                duraciones_no_estandar.append({
                    "row": row_num,
                    "full_name": name,
                    "document": doc,
                    "diff_days": diff_days,
                    "start_date": start_date.strftime("%Y-%m-%d") if start_date else None,
                    "end_date": end_date.strftime("%Y-%m-%d") if end_date else None,
                    "reason": f"Duración no estándar ({diff_days} días). No se asigna plan automático.",
                })
                registros_omitidos.append({
                    "row": row_num,
                    "record": r,
                    "reason": f"Duración no estándar ({diff_days} días)",
                })
                continue

            # Si el cliente ya existe, comprobar membresías existentes
            if target_client:
                existing_ms = memberships_by_client_id.get(target_client.id, [])
                is_duplicate = False

                for m in existing_ms:
                    # Comparación por fecha (date)
                    m_start = m.start_date.date() if m.start_date else None
                    m_end = m.end_date.date() if m.end_date else None
                    r_start = start_date.date() if start_date else None
                    r_end = end_date.date() if end_date else None

                    if (
                        m.membership_plan_id == assigned_plan.id
                        and m_start == r_start
                        and m_end == r_end
                    ):
                        is_duplicate = True
                        membresias_ya_existentes.append({
                            "row": row_num,
                            "full_name": name,
                            "document": doc,
                            "plan": plan_name,
                            "membership_id": m.id,
                            "reason": "Membresía idéntica ya existente en el sistema.",
                        })
                        break

                if not is_duplicate:
                    # Es una nueva membresía o renovación
                    new_m = Membership(
                        gym_id=gym_id,
                        client_id=target_client.id,
                        membership_plan_id=assigned_plan.id,
                        start_date=start_date,
                        end_date=end_date,
                        price=assigned_plan.price,
                        status=MembershipStatus.ACTIVE,
                        is_active=True,
                    )
                    if existing_ms:
                        membresias_renovadas.append((r, new_m))
                    else:
                        membresias_nuevas_crear.append((r, new_m))
            else:
                # El cliente es nuevo, la membresía se creará cuando se inserte el cliente
                # Se creará asociada temporalmente a new_client
                new_m = Membership(
                    gym_id=gym_id,
                    membership_plan_id=assigned_plan.id,
                    start_date=start_date,
                    end_date=end_date,
                    price=assigned_plan.price,
                    status=MembershipStatus.ACTIVE,
                    is_active=True,
                )
                membresias_nuevas_crear.append((r, new_m))

        elif status == "VENCIDO":
            # Si el cliente existe en el sistema y tiene membresía en DB que en el Excel aparece VENCIDO
            # Solo expirar si la fecha de fin ya transcurrió en tiempo real (no pisar renovaciones ni membresías futuras)
            now_utc = datetime.now(timezone.utc)
            if target_client:
                existing_ms = memberships_by_client_id.get(target_client.id, [])
                for m in existing_ms:
                    if m.status == MembershipStatus.ACTIVE and m.end_date:
                        end_utc = m.end_date.replace(tzinfo=timezone.utc) if m.end_date.tzinfo is None else m.end_date.astimezone(timezone.utc)
                        if end_utc <= now_utc:
                            membresias_a_expirar.append((m, r))

    # Resumen de cómputos
    summary = {
        "dry_run": dry_run,
        "target_email": target_email,
        "target_gym_id": gym_id,
        "target_gym_name": target_gym.name,
        "total_records_dataset": total_records,
        "clientes_nuevos_count": len(clientes_nuevos_crear),
        "clientes_existentes_count": len(clientes_encontrados),
        "clientes_actualizados_count": len(clientes_actualizar),
        "membresias_nuevas_count": len(membresias_nuevas_crear),
        "membresias_renovadas_count": len(membresias_renovadas),
        "membresias_ya_existentes_count": len(membresias_ya_existentes),
        "membresias_vencidas_actualizadas_count": len(membresias_a_expirar),
        "conflictos_identidad_count": len(conflictos_identidad),
        "conflictos_identidad_detalles": conflictos_identidad,
        "documentos_revision_count": len(documentos_revision),
        "documentos_revision_detalles": documentos_revision,
        "duraciones_no_estandar_count": len(duraciones_no_estandar),
        "duraciones_no_estandar_detalles": duraciones_no_estandar,
        "registros_omitidos_count": len(registros_omitidos),
        "errores_count": len(errores),
        "antes": {
            "clientes_totales": antes_clients,
            "clientes_activos": antes_clients_active,
            "membresias_totales": antes_memberships,
            "membresias_activas": antes_memberships_active,
            "membresias_vencidas": antes_memberships_expired,
        },
        "despues": {},
    }

    # PERSISTENCIA REAL (SI NO ES DRY-RUN)
    if not dry_run:
        if do_snapshot:
            snapshot_dir = BACKEND_DIR / "data" / "snapshots"
            create_logical_snapshot(db, gym_id, snapshot_dir)

        logger.info("Persistiendo cambios en la base de datos de producción...")

        # 1. Crear clientes nuevos
        for r, client_obj in clientes_nuevos_crear:
            db.add(client_obj)
        db.flush()  # Para asignar IDs autoincrementales a los nuevos clientes

        # 2. Actualizar clientes existentes aprobados (ej. ROSIO GELVIS)
        for client_obj, field, val in clientes_actualizar:
            setattr(client_obj, field, val)

        # 3. Insertar membresías nuevas
        for r, m_obj in membresias_nuevas_crear:
            if not m_obj.client_id:
                # Buscar el cliente recién insertado o existente por documento
                c = clients_by_doc.get(r["document"]) or (
                    db.query(Client)
                    .filter(Client.gym_id == gym_id, Client.document == r["document"])
                    .first()
                )
                if c:
                    m_obj.client_id = c.id
                else:
                    raise RuntimeError(f"No se pudo resolver client_id para el documento {r['document']}.")
            db.add(m_obj)

        # 4. Insertar renovaciones
        for r, m_obj in membresias_renovadas:
            db.add(m_obj)

        # 5. Actualizar membresías a vencidas (sólo la membresía, NO el cliente; mantener is_active=True para histórico)
        for m_obj, r in membresias_a_expirar:
            m_obj.status = MembershipStatus.EXPIRED
            m_obj.is_active = True

        db.commit()
        logger.info("Transacción confirmada exitosamente.")

        # Recalcular métricas "DESPUÉS"
        despues_clients = db.query(Client).filter(Client.gym_id == gym_id).count()
        despues_clients_active = (
            db.query(Client).filter(Client.gym_id == gym_id, Client.is_active == True).count()
        )
        despues_memberships = db.query(Membership).filter(Membership.gym_id == gym_id).count()
        despues_memberships_active = (
            db.query(Membership)
            .filter(Membership.gym_id == gym_id, Membership.status == MembershipStatus.ACTIVE)
            .count()
        )
        despues_memberships_expired = (
            db.query(Membership)
            .filter(Membership.gym_id == gym_id, Membership.status == MembershipStatus.EXPIRED)
            .count()
        )

        summary["despues"] = {
            "clientes_totales": despues_clients,
            "clientes_activos": despues_clients_active,
            "membresias_totales": despues_memberships,
            "membresias_activas": despues_memberships_active,
            "membresias_vencidas": despues_memberships_expired,
        }
    else:
        # En modo simulación (dry-run) proyectar métricas
        summary["despues"] = {
            "clientes_totales": antes_clients + len(clientes_nuevos_crear),
            "clientes_activos": antes_clients_active + len(clientes_nuevos_crear),
            "membresias_totales": (
                antes_memberships + len(membresias_nuevas_crear) + len(membresias_renovadas)
            ),
            "membresias_activas": (
                antes_memberships_active
                + len(membresias_nuevas_crear)
                + len(membresias_renovadas)
                - len(membresias_a_expirar)
            ),
            "membresias_vencidas": antes_memberships_expired + len(membresias_a_expirar),
        }

    return summary


def print_summary_report(summary: Dict[str, Any]):
    """Imprime el reporte estructurado sin exponer datos confidenciales."""
    print("\n" + "=" * 70)
    print(" REPORTE DE SINCRONIZACIÓN — MERWIL ZONAFIT")
    print("=" * 70)
    print(f" Modo:                     {'SIMULACIÓN / PREVIEW (--dry-run)' if summary['dry_run'] else 'PRODUCCIÓN (APLICADO)'}")
    print(f" Gimnasio destino:         {summary['target_gym_name']} (gym_id: {summary['target_gym_id']})")
    print(f" Administrador validado:   {summary['target_email']}")
    print(f" Total registros fuente:   {summary['total_records_dataset']}")
    print("-" * 70)
    print(" ESTADISTICAS DE CLIENTES:")
    print(f"   * Clientes nuevos a crear:          {summary['clientes_nuevos_count']}")
    print(f"   * Clientes existentes encontrados:  {summary['clientes_existentes_count']}")
    print(f"   * Clientes actualizados (nombres):  {summary['clientes_actualizados_count']}")
    print("-" * 70)
    print(" ESTADISTICAS DE MEMBRESIAS:")
    print(f"   * Membresias nuevas a crear:        {summary['membresias_nuevas_count']}")
    print(f"   * Membresias renovadas:             {summary['membresias_renovadas_count']}")
    print(f"   * Membresias ya existentes (omit):  {summary['membresias_ya_existentes_count']}")
    print(f"   * Membresias pasadas a VENCIDO:     {summary['membresias_vencidas_actualizadas_count']}")
    print("-" * 70)
    print(" CASOS ESPECIALES Y REGISTROS OMITIDOS:")
    print(f"   * Conflictos de identidad (bloq):   {summary['conflictos_identidad_count']}")
    print(f"   * Documentos que requieren revision:{summary['documentos_revision_count']}")
    print(f"   * Duraciones no estandar (bloq):    {summary['duraciones_no_estandar_count']}")
    print(f"   * Total registros omitidos:         {summary['registros_omitidos_count']}")
    print(f"   * Errores no controlados:           {summary['errores_count']}")
    print("-" * 70)
    print(" TABLA COMPARATIVA: ANTES -> DESPUES")
    print("-" * 70)
    a = summary["antes"]
    d = summary["despues"]
    print(f" {'Metrica':<30} | {'ANTES':<15} | {'DESPUES':<15}")
    print(f" {'Clientes Totales':<30} | {a.get('clientes_totales', 0):<15} | {d.get('clientes_totales', 0):<15}")
    print(f" {'Clientes Activos':<30} | {a.get('clientes_activos', 0):<15} | {d.get('clientes_activos', 0):<15}")
    print(f" {'Membresias Totales':<30} | {a.get('membresias_totales', 0):<15} | {d.get('membresias_totales', 0):<15}")
    print(f" {'Membresias Activas':<30} | {a.get('membresias_activas', 0):<15} | {d.get('membresias_activas', 0):<15}")
    print(f" {'Membresias Vencidas':<30} | {a.get('membresias_vencidas', 0):<15} | {d.get('membresias_vencidas', 0):<15}")
    print("=" * 70)

    if summary["conflictos_identidad_detalles"]:
        print("\n[!] DETALLE DE CONFLICTOS DE IDENTIDAD:")
        for c in summary["conflictos_identidad_detalles"]:
            print(f"   - Fila {c['row']}: {c['full_name']} (Doc: {c['document']}, Tel: {c['phone']}) -> {c['reason']}")

    if summary["documentos_revision_detalles"]:
        print("\n[!] DETALLE DE DOCUMENTOS QUE REQUIEREN REVISIÓN:")
        for doc_item in summary["documentos_revision_detalles"]:
            print(f"   - Fila {doc_item['row']}: {doc_item['full_name']} (Doc: '{doc_item['document']}', Tel: {doc_item['phone']}) -> {doc_item['reason']}")

    if summary["duraciones_no_estandar_detalles"]:
        print("\n[!] DETALLE DE DURACIONES NO ESTÁNDAR (MEMBRESÍA BLOQUEADA):")
        for dur in summary["duraciones_no_estandar_detalles"]:
            print(f"   - Fila {dur['row']}: {dur['full_name']} (Doc: {dur['document']}, Días: {dur['diff_days']}, {dur['start_date']} a {dur['end_date']})")

    print("\n" + "=" * 70)


def resolve_default_dataset_path() -> Path:
    """Busca el archivo de dataset en las ubicaciones estándar."""
    candidates = [
        BACKEND_DIR / "data" / "MERWILFT_NV_26_DE_MAYO.json",
        BACKEND_DIR / "data" / "MERWILFT_NV_26_DE_MAYO.xlsm",
        Path(r"C:\Users\Juan Moscote\Downloads\MERWILFT NV 26 DE MAYO (1)(Recuperado automáticamentee).xlsm"),
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def main():
    parser = argparse.ArgumentParser(
        description="Sincronizador masivo de clientes y membresías para Merwil ZonaFit."
    )
    parser.add_argument(
        "--file",
        type=str,
        default=str(resolve_default_dataset_path()),
        help="Ruta al archivo JSON o Excel (.xlsm / .xlsx) con el dataset.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=None,
        help="Ejecuta en modo simulación (preview) sin modificar la base de datos.",
    )
    parser.add_argument(
        "--production",
        action="store_true",
        help="Ejecuta la actualización real en producción.",
    )
    parser.add_argument(
        "--target-email",
        type=str,
        default="merwilcompany@gmail.com",
        help="Correo del administrador para validación de tenant.",
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
        help="Permite ejecución sobre SQLite para pruebas automatizadas.",
    )

    args = parser.parse_args()

    env_flag = os.getenv("SYNC_MERWILFIT_MEMBERSHIPS", "").strip().lower() == "true"
    if args.production or env_flag:
        is_dry_run = False
    elif args.dry_run is not None:
        is_dry_run = args.dry_run
    else:
        # Por defecto siempre seguro: simulación
        is_dry_run = True

    db_url = args.database_url or os.getenv("DATABASE_URL")
    if not db_url:
        # Probar construcción desde variables DB_* de backend/.env
        DB_HOST = os.getenv("DB_HOST") or os.getenv("\ufeffDB_HOST")
        if DB_HOST:
            DB_PORT = os.getenv("DB_PORT") or "5432"
            DB_NAME = os.getenv("DB_NAME") or "zonafit"
            DB_USER = os.getenv("DB_USER") or "zonafit_app"
            DB_PASSWORD = os.getenv("DB_PASSWORD") or ""
            db_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    if not db_url:
        logger.error("ERROR CRÍTICO: No se proporcionó DATABASE_URL ni configuración en el entorno.")
        sys.exit(1)

    if db_url.startswith("sqlite") and not args.allow_sqlite:
        logger.error("ERROR CRÍTICO: No está permitido ejecutar contra SQLite sin --allow-sqlite.")
        sys.exit(1)

    logger.info("=" * 70)
    logger.info(" SINCRONIZACIÓN DE MEMBRESÍAS — MERWIL ZONAFIT")
    logger.info(" Modo: %s", "SIMULACIÓN / PREVIEW (--dry-run)" if is_dry_run else "PRODUCCIÓN (APLICADO)")
    logger.info(" Base de Datos: %s", mask_database_url(db_url))
    logger.info("=" * 70)

    dataset_path = Path(args.file)
    engine = create_engine(db_url, pool_pre_ping=True)
    SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionFactory()

    try:
        summary = run_sync(
            db=session,
            dataset_path=dataset_path,
            dry_run=is_dry_run,
            target_email=args.target_email,
            target_gym_name=args.target_gym,
        )
        print_summary_report(summary)

    except Exception as e:
        logger.error("FALLO EN LA OPERACIÓN DE SINCRONIZACIÓN: %s", e)
        sys.exit(2)
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
