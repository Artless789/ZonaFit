import io
import re
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.user import User
from app.core.database_transaction import DatabaseTransaction
from app.services.audit_service import AuditService
from app.schemas.client_excel import (
    ClientFieldDiff,
    ClientPreviewItem,
    ClientImportSummary,
    ClientImportPreviewResponse,
    ClientImportApplyRequest,
    ClientImportApplyResponse,
)

OFFICIAL_HEADERS = [
    "document_type",
    "document",
    "full_name",
    "phone",
    "email",
    "notes",
    "is_active",
]

ALLOWED_DOC_TYPES = {"CC", "TI", "CE", "PASAPORTE", "NIT"}


class ClientExcelService:

    @staticmethod
    def generate_import_template() -> io.BytesIO:
        """
        Genera la plantilla oficial .xlsx para importación de clientes.
        Contiene exactamente las 7 columnas oficiales en la hoja CLIENTES
        y una hoja de INSTRUCCIONES.
        """
        wb = openpyxl.Workbook()
        
        # -------------------------------------------------------------
        # Hoja 1: CLIENTES
        # -------------------------------------------------------------
        ws_clients = wb.active
        ws_clients.title = "CLIENTES"

        # Estilo de encabezados
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        for col_idx, header in enumerate(OFFICIAL_HEADERS, start=1):
            cell = ws_clients.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border

        # 2 filas de ejemplo para guiar al usuario
        example_rows = [
            ["CC", "1020304050", "JUAN CARLOS PEREZ", "3001234567", "juan.perez@example.com", "Afiliado regular", "SI"],
            ["TI", "1098765432", "MARIA FERNANDA GOMEZ", "3109876543", "maria.gomez@example.com", "Horario matutino", "SI"],
        ]

        data_font = Font(name="Arial", size=10)
        data_alignment = Alignment(horizontal="left", vertical="center")

        for row_idx, row_data in enumerate(example_rows, start=2):
            for col_idx, value in enumerate(row_data, start=1):
                cell = ws_clients.cell(row=row_idx, column=col_idx, value=value)
                cell.font = data_font
                cell.alignment = data_alignment
                cell.border = thin_border
                # Formatear celdas de documento y teléfono como texto
                if col_idx in (1, 2, 4):
                    cell.number_format = "@"

        # Auto-ajustar anchos de columnas
        column_widths = {
            1: 18,  # document_type
            2: 20,  # document
            3: 32,  # full_name
            4: 20,  # phone
            5: 32,  # email
            6: 28,  # notes
            7: 14,  # is_active
        }
        for col_idx, width in column_widths.items():
            ws_clients.column_dimensions[get_column_letter(col_idx)].width = width

        ws_clients.row_dimensions[1].height = 28
        ws_clients.row_dimensions[2].height = 20
        ws_clients.row_dimensions[3].height = 20

        # -------------------------------------------------------------
        # Hoja 2: INSTRUCCIONES
        # -------------------------------------------------------------
        ws_instructions = wb.create_sheet(title="INSTRUCCIONES")
        ws_instructions.views.sheetView[0].showGridLines = True

        title_font = Font(name="Arial", size=14, bold=True, color="0F172A")
        section_font = Font(name="Arial", size=11, bold=True, color="1E293B")
        body_font = Font(name="Arial", size=10, color="334155")
        bullet_font = Font(name="Arial", size=10, bold=True, color="2563EB")

        ws_instructions.cell(row=1, column=1, value="INSTRUCCIONES DE IMPORTACIÓN DE CLIENTES - MERWIL ZONAFIT").font = title_font
        ws_instructions.row_dimensions[1].height = 30

        instructions_list = [
            ("1.", "Una persona por fila", "Cada registro debe representar un único cliente."),
            ("2.", "Tipos de documento permitidos", "Usa únicamente: CC, TI, CE, PASAPORTE o NIT."),
            ("3.", "Documento como texto", "El campo 'document' debe ingresarse como texto sin puntos ni comas para no perder ceros iniciales."),
            ("4.", "Teléfono como texto", "El campo 'phone' debe ingresarse como texto (ej: 3001234567). Es obligatorio para clientes nuevos."),
            ("5.", "Nombre completo obligatorio", "El campo 'full_name' es mandatorio y debe contener el nombre completo de la persona."),
            ("6.", "Correo electrónico opcional", "El campo 'email' es opcional. Si se ingresa, debe ser una dirección válida."),
            ("7.", "Estado activo (is_active)", "Usa únicamente 'SI' o 'NO'. (Este campo es informativo en esta versión)."),
            ("8.", "No modificar encabezados", "La fila 1 de la hoja 'CLIENTES' debe conservarse exactamente con sus 7 columnas oficiales."),
            ("9.", "No combinar celdas", "Cada celda debe ser individual sin combinaciones de filas o columnas."),
            ("10.", "No usar fórmulas", "Ingresa datos en texto plano, sin fórmulas ni hipervínculos."),
            ("11.", "No repetir documentos", "No debe haber más de una fila con el mismo documento en el archivo."),
            ("12.", "Seguridad de clientes faltantes", "Los clientes que no aparezcan en este archivo NO serán eliminados ni desactivados de tu gimnasio."),
        ]

        for idx, (num, rule, desc) in enumerate(instructions_list, start=3):
            cell_num = ws_instructions.cell(row=idx, column=1, value=num)
            cell_num.font = bullet_font
            cell_num.alignment = Alignment(horizontal="right", vertical="top")

            cell_rule = ws_instructions.cell(row=idx, column=2, value=rule)
            cell_rule.font = section_font
            cell_rule.alignment = Alignment(horizontal="left", vertical="top")

            cell_desc = ws_instructions.cell(row=idx, column=3, value=desc)
            cell_desc.font = body_font
            cell_desc.alignment = Alignment(horizontal="left", vertical="top")

            ws_instructions.row_dimensions[idx].height = 22

        ws_instructions.column_dimensions["A"].width = 6
        ws_instructions.column_dimensions["B"].width = 34
        ws_instructions.column_dimensions["C"].width = 85

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    def export_clients_to_excel(db: Session, gym_id: int) -> io.BytesIO:
        """
        Exporta exclusivamente los clientes del gimnasio autenticado en formato .xlsx.
        """
        clients = (
            db.query(Client)
            .filter(Client.gym_id == gym_id)
            .order_by(Client.id.asc())
            .all()
        )

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "CLIENTES"

        export_headers = [
            "ID Interno",
            "document_type",
            "document",
            "full_name",
            "phone",
            "email",
            "notes",
            "is_active",
            "Fecha Creación",
            "Fecha Actualización",
        ]

        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        for col_idx, header in enumerate(export_headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border

        data_font = Font(name="Arial", size=10)
        data_alignment = Alignment(horizontal="left", vertical="center")

        for row_idx, client in enumerate(clients, start=2):
            created_str = client.created_at.strftime("%Y-%m-%d %H:%M") if client.created_at else ""
            updated_str = client.updated_at.strftime("%Y-%m-%d %H:%M") if client.updated_at else ""

            row_values = [
                client.id,
                client.document_type,
                client.document,
                client.full_name,
                client.phone,
                client.email or "",
                client.notes or "",
                "SI" if client.is_active else "NO",
                created_str,
                updated_str,
            ]

            for col_idx, value in enumerate(row_values, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.font = data_font
                cell.alignment = data_alignment
                cell.border = thin_border
                if col_idx in (2, 3, 5):  # doc_type, doc, phone as text
                    cell.number_format = "@"

        column_widths = {
            1: 12,  # ID Interno
            2: 18,  # document_type
            3: 20,  # document
            4: 32,  # full_name
            5: 20,  # phone
            6: 32,  # email
            7: 28,  # notes
            8: 14,  # is_active
            9: 20,  # Fecha Creación
            10: 20, # Fecha Actualización
        }
        for col_idx, width in column_widths.items():
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        ws.row_dimensions[1].height = 26

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    def _normalize_str(val: Any) -> str:
        if val is None:
            return ""
        return " ".join(str(val).strip().split())

    @staticmethod
    def _normalize_doc(val: Any) -> str:
        if val is None:
            return ""
        return str(val).strip().upper()

    @staticmethod
    def _normalize_phone(val: Any) -> str:
        if val is None:
            return ""
        raw = str(val).strip()
        # Remove floating point suffix if Excel read as float (e.g. 3001234567.0)
        if raw.endswith(".0"):
            raw = raw[:-2]
        return re.sub(r"[\s\-\(\)\.]", "", raw)

    @staticmethod
    def _normalize_email(val: Any) -> str:
        if val is None:
            return ""
        return str(val).strip().lower()

    @classmethod
    def preview_import_excel(cls, db: Session, gym_id: int, file_bytes: bytes) -> ClientImportPreviewResponse:
        """
        Lee y valida el archivo Excel según la plantilla oficial.
        Realiza la comparación completa categorizando en:
        NO_CHANGE, NEW, MODIFIED, MISSING, CONFLICT, NO_DOCUMENT, DUPLICATE.
        """
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo proporcionado no es un archivo Excel (.xlsx) válido o está dañado.",
            )

        # Buscar hoja "CLIENTES" o tomar la primera
        sheet_name = "CLIENTES" if "CLIENTES" in wb.sheetnames else wb.sheetnames[0]
        ws = wb[sheet_name]

        # -------------------------------------------------------------
        # Validación estricta de encabezados oficiales
        # -------------------------------------------------------------
        row_1 = [cell.value for cell in ws[1]]
        actual_headers = [str(val).strip().lower() if val is not None else "" for val in row_1]
        
        # Eliminar celdas vacías al final de los encabezados
        while actual_headers and not actual_headers[-1]:
            actual_headers.pop()

        if actual_headers != OFFICIAL_HEADERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Los encabezados no coinciden con la plantilla oficial. "
                    f"Esperado: {', '.join(OFFICIAL_HEADERS)}. "
                    f"Recibido: {', '.join(actual_headers) if actual_headers else 'Vacío'}. "
                    "Por favor descarga la plantilla oficial usando el botón 'Descargar plantilla'."
                ),
            )

        # -------------------------------------------------------------
        # Cargar clientes existentes del gimnasio autenticado
        # -------------------------------------------------------------
        existing_clients = (
            db.query(Client)
            .filter(Client.gym_id == gym_id)
            .all()
        )

        # Mapeos de identidad
        # 1. Por combinación estricta (doc_type, doc)
        existing_by_tuple: Dict[Tuple[str, str], Client] = {
            (c.document_type.strip().upper(), c.document.strip().upper()): c
            for c in existing_clients
        }
        # 2. Por documento solo (para detectar conflictos de tipo de documento)
        existing_by_doc: Dict[str, Client] = {
            c.document.strip().upper(): c
            for c in existing_clients
        }

        matched_client_ids = set()
        seen_documents: Dict[Tuple[str, str], int] = {}  # (doc_type, doc) -> first_row

        items: List[ClientPreviewItem] = []
        
        # Conteo de categorías
        counts = {
            "total_rows": 0,
            "no_change_count": 0,
            "new_count": 0,
            "modified_count": 0,
            "missing_count": 0,
            "conflict_count": 0,
            "no_document_count": 0,
            "duplicate_count": 0,
        }

        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            # Verificar si la fila está completamente vacía
            if not row or all(cell is None or str(cell).strip() == "" for cell in row[:7]):
                continue

            counts["total_rows"] += 1

            raw_doc_type = row[0] if len(row) > 0 else None
            raw_doc = row[1] if len(row) > 1 else None
            raw_name = row[2] if len(row) > 2 else None
            raw_phone = row[3] if len(row) > 3 else None
            raw_email = row[4] if len(row) > 4 else None
            raw_notes = row[5] if len(row) > 5 else None
            raw_is_active = row[6] if len(row) > 6 else None

            # Normalizar valores para comparación
            doc_type = cls._normalize_doc(raw_doc_type)
            # Limpiar float si vino como 102030.0
            doc_str = str(raw_doc).strip() if raw_doc is not None else ""
            if doc_str.endswith(".0"):
                doc_str = doc_str[:-2]
            doc = cls._normalize_doc(doc_str)

            full_name = cls._normalize_str(raw_name)
            phone = cls._normalize_phone(raw_phone)
            email = cls._normalize_email(raw_email)
            notes = cls._normalize_str(raw_notes)

            # Interpretar is_active (informativo)
            is_active_val = True
            if raw_is_active is not None:
                str_active = str(raw_is_active).strip().upper()
                if str_active in ("NO", "FALSE", "0", "INACTIVO"):
                    is_active_val = False

            # ---------------------------------------------------------
            # 1. Validación: Sin documento
            # ---------------------------------------------------------
            if not doc:
                counts["no_document_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="NO_DOCUMENT",
                        client_id=None,
                        document_type=doc_type or "NO_ESPECIFICADO",
                        document="",
                        full_name=full_name or "SIN NOMBRE",
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason="La fila no tiene número de documento o cédula.",
                        is_selected=False,
                    )
                )
                continue

            # ---------------------------------------------------------
            # 2. Validación: Documento duplicado dentro del mismo archivo
            # ---------------------------------------------------------
            doc_key = (doc_type, doc)
            if doc_key in seen_documents:
                counts["duplicate_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="DUPLICATE",
                        client_id=None,
                        document_type=doc_type,
                        document=doc,
                        full_name=full_name,
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason=f"Documento repetido dentro del archivo (primera aparición en la fila {seen_documents[doc_key]}).",
                        is_selected=False,
                    )
                )
                continue
            seen_documents[doc_key] = row_idx

            # ---------------------------------------------------------
            # 3. Validación: Tipo de documento permitido
            # ---------------------------------------------------------
            if doc_type not in ALLOWED_DOC_TYPES:
                counts["conflict_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="CONFLICT",
                        client_id=None,
                        document_type=doc_type,
                        document=doc,
                        full_name=full_name,
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason=f"Tipo de documento '{doc_type}' no permitido. Use: {', '.join(sorted(ALLOWED_DOC_TYPES))}.",
                        is_selected=False,
                    )
                )
                continue

            # ---------------------------------------------------------
            # 4. Validación: Conflicto de tipo de documento con cliente existente
            # ---------------------------------------------------------
            if doc in existing_by_doc and doc_key not in existing_by_tuple:
                existing_mismatch = existing_by_doc[doc]
                counts["conflict_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="CONFLICT",
                        client_id=existing_mismatch.id,
                        document_type=doc_type,
                        document=doc,
                        full_name=full_name,
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason=(
                            f"El documento '{doc}' ya existe en ZonaFit para '{existing_mismatch.full_name}' "
                            f"con tipo '{existing_mismatch.document_type}', pero en el Excel viene como '{doc_type}'."
                        ),
                        is_selected=False,
                    )
                )
                continue

            # ---------------------------------------------------------
            # 5. Cliente existente: Comparar y detectar MODIFIED / NO_CHANGE
            # ---------------------------------------------------------
            if doc_key in existing_by_tuple:
                existing_client = existing_by_tuple[doc_key]
                matched_client_ids.add(existing_client.id)

                diffs: Dict[str, ClientFieldDiff] = {}

                # Comparar full_name (normalizado)
                curr_name_norm = cls._normalize_str(existing_client.full_name)
                if full_name and curr_name_norm != full_name:
                    diffs["full_name"] = ClientFieldDiff(
                        old_value=existing_client.full_name,
                        new_value=full_name,
                    )

                # Comparar phone (normalizado)
                curr_phone_norm = cls._normalize_phone(existing_client.phone)
                if phone and curr_phone_norm != phone:
                    diffs["phone"] = ClientFieldDiff(
                        old_value=existing_client.phone,
                        new_value=phone,
                    )

                # Comparar email (normalizado)
                curr_email_norm = cls._normalize_email(existing_client.email)
                if email != curr_email_norm:
                    diffs["email"] = ClientFieldDiff(
                        old_value=existing_client.email or "",
                        new_value=email,
                    )

                # Comparar notes (normalizado)
                curr_notes_norm = cls._normalize_str(existing_client.notes)
                if notes != curr_notes_norm:
                    diffs["notes"] = ClientFieldDiff(
                        old_value=existing_client.notes or "",
                        new_value=notes,
                    )

                # Comparar is_active (informativo)
                if is_active_val != existing_client.is_active:
                    diffs["is_active"] = ClientFieldDiff(
                        old_value="SI" if existing_client.is_active else "NO",
                        new_value="SI" if is_active_val else "NO",
                    )

                # Solo campos actualizables cuentan para marcar MODIFIED
                actualizable_diffs = {k: v for k, v in diffs.items() if k in ("full_name", "phone", "email", "notes")}

                if actualizable_diffs:
                    counts["modified_count"] += 1
                    items.append(
                        ClientPreviewItem(
                            row_number=row_idx,
                            category="MODIFIED",
                            client_id=existing_client.id,
                            document_type=existing_client.document_type,
                            document=existing_client.document,
                            full_name=full_name or existing_client.full_name,
                            phone=phone or existing_client.phone,
                            email=email if email else existing_client.email,
                            notes=notes if notes else existing_client.notes,
                            is_active=existing_client.is_active,
                            diffs=diffs,
                            conflict_reason=None,
                            is_selected=True,
                        )
                    )
                else:
                    counts["no_change_count"] += 1
                    items.append(
                        ClientPreviewItem(
                            row_number=row_idx,
                            category="NO_CHANGE",
                            client_id=existing_client.id,
                            document_type=existing_client.document_type,
                            document=existing_client.document,
                            full_name=existing_client.full_name,
                            phone=existing_client.phone,
                            email=existing_client.email,
                            notes=existing_client.notes,
                            is_active=existing_client.is_active,
                            diffs=None,
                            conflict_reason=None,
                            is_selected=False,
                        )
                    )
                continue

            # ---------------------------------------------------------
            # 6. Cliente nuevo: Validar campos mínimos
            # ---------------------------------------------------------
            if not full_name:
                counts["conflict_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="CONFLICT",
                        client_id=None,
                        document_type=doc_type,
                        document=doc,
                        full_name="",
                        phone=phone,
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason="El nombre completo ('full_name') es obligatorio para crear un cliente nuevo.",
                        is_selected=False,
                    )
                )
                continue

            if not phone:
                counts["conflict_count"] += 1
                items.append(
                    ClientPreviewItem(
                        row_number=row_idx,
                        category="CONFLICT",
                        client_id=None,
                        document_type=doc_type,
                        document=doc,
                        full_name=full_name,
                        phone="",
                        email=email if email else None,
                        notes=notes if notes else None,
                        is_active=is_active_val,
                        diffs=None,
                        conflict_reason="El teléfono ('phone') es obligatorio para registrar un cliente nuevo.",
                        is_selected=False,
                    )
                )
                continue

            # Cliente nuevo válido
            counts["new_count"] += 1
            items.append(
                ClientPreviewItem(
                    row_number=row_idx,
                    category="NEW",
                    client_id=None,
                    document_type=doc_type,
                    document=doc,
                    full_name=full_name,
                    phone=phone,
                    email=email if email else None,
                    notes=notes if notes else None,
                    is_active=is_active_val,
                    diffs=None,
                    conflict_reason=None,
                    is_selected=True,
                )
            )

        # -------------------------------------------------------------
        # 7. Clientes faltantes (existen en ZonaFit pero no en el Excel)
        # -------------------------------------------------------------
        missing_clients: List[ClientPreviewItem] = []
        for client in existing_clients:
            if client.id not in matched_client_ids:
                counts["missing_count"] += 1
                missing_clients.append(
                    ClientPreviewItem(
                        row_number=0,
                        category="MISSING",
                        client_id=client.id,
                        document_type=client.document_type,
                        document=client.document,
                        full_name=client.full_name,
                        phone=client.phone,
                        email=client.email,
                        notes=client.notes,
                        is_active=client.is_active,
                        diffs=None,
                        conflict_reason="No aparece en el Excel importado. Permanecerá intacto en el sistema.",
                        is_selected=False,
                    )
                )

        summary = ClientImportSummary(**counts)
        return ClientImportPreviewResponse(
            summary=summary,
            items=items,
            missing_clients=missing_clients,
        )

    @classmethod
    def apply_confirmed_import(
        cls,
        db: Session,
        current_user: User,
        payload: ClientImportApplyRequest,
    ) -> ClientImportApplyResponse:
        """
        Ejecuta la actualización masiva de clientes confirmada de forma estrictamente transaccional.
        Solo actualiza los campos permitidos (full_name, phone, email, notes).
        No altera jamás document_type ni document (identidad inmutable).
        Revalida cada client_id contra current_user.gym_id (prohíbe cross-tenant).
        Registra auditoría mediante AuditService.
        """
        created_count = 0
        updated_count = 0
        skipped_count = 0

        with DatabaseTransaction(db):
            # ---------------------------------------------------------
            # 1. Crear clientes nuevos seleccionados
            # ---------------------------------------------------------
            for new_item in payload.new_clients:
                doc_type = cls._normalize_doc(new_item.document_type)
                doc = cls._normalize_doc(new_item.document)
                full_name = cls._normalize_str(new_item.full_name)
                phone = cls._normalize_phone(new_item.phone)
                email = cls._normalize_email(new_item.email) if new_item.email else None
                notes = cls._normalize_str(new_item.notes) if new_item.notes else None

                if doc_type not in ALLOWED_DOC_TYPES or not doc or not full_name or not phone:
                    skipped_count += 1
                    continue

                # Validar si ya existe para este gym_id
                exists = (
                    db.query(Client)
                    .filter(
                        Client.gym_id == current_user.gym_id,
                        Client.document == doc,
                    )
                    .first()
                )
                if exists:
                    skipped_count += 1
                    continue

                client_obj = Client(
                    gym_id=current_user.gym_id,
                    document_type=doc_type,
                    document=doc,
                    full_name=full_name,
                    phone=phone,
                    email=email,
                    notes=notes,
                    is_active=True,
                )
                db.add(client_obj)
                created_count += 1

            # ---------------------------------------------------------
            # 2. Actualizar clientes modificados seleccionados
            # ---------------------------------------------------------
            for update_item in payload.updated_clients:
                client = (
                    db.query(Client)
                    .filter(Client.id == update_item.client_id)
                    .first()
                )

                if not client:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"El cliente con ID {update_item.client_id} no fue encontrado.",
                    )

                # Seguridad Multi-Tenant estricta: revalidar pertenencia al gimnasio
                if client.gym_id != current_user.gym_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Acceso denegado: El cliente con ID {update_item.client_id} no pertenece a tu gimnasio.",
                    )

                # Solo modificar campos permitidos
                modified = False
                if update_item.full_name is not None:
                    norm_name = cls._normalize_str(update_item.full_name)
                    if norm_name and norm_name != client.full_name:
                        client.full_name = norm_name
                        modified = True

                if update_item.phone is not None:
                    norm_phone = cls._normalize_phone(update_item.phone)
                    if norm_phone and norm_phone != client.phone:
                        client.phone = norm_phone
                        modified = True

                if update_item.email is not None:
                    norm_email = cls._normalize_email(update_item.email) if update_item.email else None
                    if norm_email != client.email:
                        client.email = norm_email
                        modified = True

                if update_item.notes is not None:
                    norm_notes = cls._normalize_str(update_item.notes) if update_item.notes else None
                    if norm_notes != client.notes:
                        client.notes = norm_notes
                        modified = True

                if modified:
                    updated_count += 1

            # ---------------------------------------------------------
            # 3. Registrar auditoría
            # ---------------------------------------------------------
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action="CLIENTS_BULK_IMPORT",
                entity_type="CLIENT",
                user_id=current_user.id,
                entity_id=None,
                old_values=None,
                new_values={
                    "created_count": created_count,
                    "updated_count": updated_count,
                    "skipped_count": skipped_count,
                    "total_requested_new": len(payload.new_clients),
                    "total_requested_updated": len(payload.updated_clients),
                    "executor_email": current_user.email,
                },
                ip_address=None,
            )

        return ClientImportApplyResponse(
            success=True,
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            message=(
                f"Importación completada con éxito. "
                f"Se crearon {created_count} clientes nuevos y se actualizaron {updated_count} clientes existentes. "
                "Los clientes faltantes permanecieron sin cambios."
            ),
        )
