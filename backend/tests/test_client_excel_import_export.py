import io
import pytest
import openpyxl
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.audit_log import AuditLog
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_client_excel.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == 'Connection':
        dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

test_current_user_id = 1

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_get_current_user():
    db = TestingSessionLocal()
    return db.query(User).filter(User.id == test_current_user_id).first()

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


def build_excel_file(headers, rows, sheet_name="CLIENTES"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def setup_db():
    global test_current_user_id
    test_current_user_id = 1
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 & User 1
    gym1 = Gym(id=1, name="Gym Norte", email="gym1@zonafit.com", owner_id=1, is_active=True)
    db.add(gym1)
    user1 = User(
        id=1,
        gym_id=1,
        email="owner1@zonafit.com",
        full_name="Owner Gym 1",
        password=hash_password("Pass1234"),
        role="OWNER",
        is_active=True,
    )
    db.add(user1)

    # Gym 2 & User 2
    gym2 = Gym(id=2, name="Gym Sur", email="gym2@zonafit.com", owner_id=2, is_active=True)
    db.add(gym2)
    user2 = User(
        id=2,
        gym_id=2,
        email="owner2@zonafit.com",
        full_name="Owner Gym 2",
        password=hash_password("Pass1234"),
        role="OWNER",
        is_active=True,
    )
    db.add(user2)

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(id=1, gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(id=2, gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add(sub1)
    db.add(sub2)

    # Clients in Gym 1
    c1 = Client(id=1, gym_id=1, document_type="CC", document="1001", full_name="Carlos Gomez", phone="3001111111", email="carlos@test.com", notes="Regular", is_active=True)
    c2 = Client(id=2, gym_id=1, document_type="CC", document="1002", full_name="Ana Torres", phone="3002222222", email="ana@test.com", notes="", is_active=True)
    c3 = Client(id=3, gym_id=1, document_type="TI", document="1003", full_name="Pedro Infante", phone="3003333333", email="pedro@test.com", notes="", is_active=True)
    db.add_all([c1, c2, c3])

    # Client in Gym 2 (for multi-tenant isolation)
    c4 = Client(id=4, gym_id=2, document_type="CC", document="9999", full_name="Mario Bros", phone="3119999999", email="mario@gym2.com", notes="VIP", is_active=True)
    db.add(c4)

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


# =====================================================================
# 1. Test Plantilla Oficial
# =====================================================================

def test_download_template_structure():
    response = client.get("/clients/import/template")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "plantilla_clientes_zonafit.xlsx" in response.headers.get("content-disposition", "")

    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    assert "CLIENTES" in wb.sheetnames
    assert "INSTRUCCIONES" in wb.sheetnames

    ws_clients = wb["CLIENTES"]
    headers = [cell.value for cell in ws_clients[1]]
    expected_headers = ["document_type", "document", "full_name", "phone", "email", "notes", "is_active"]
    assert headers == expected_headers


# =====================================================================
# 2. Test Encabezados Incorrectos / Formato no permitido
# =====================================================================

def test_preview_rejects_non_xlsx():
    response = client.post(
        "/clients/import/preview",
        files={"file": ("datos.csv", b"document_type,document\nCC,123", "text/csv")},
    )
    assert response.status_code == 400
    assert "extensión .xlsx" in response.json()["detail"]


def test_preview_rejects_invalid_headers():
    bad_excel = build_excel_file(
        headers=["cedula", "nombre", "telefono"],
        rows=[["123", "Test User", "3000000000"]],
    )
    response = client.post(
        "/clients/import/preview",
        files={"file": ("clientes.xlsx", bad_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 400
    assert "no coinciden con la plantilla oficial" in response.json()["detail"]


# =====================================================================
# 3. Test Comparación y Categorías (Preview)
# =====================================================================

def test_preview_classifies_categories():
    headers = ["document_type", "document", "full_name", "phone", "email", "notes", "is_active"]
    rows = [
        # 1. NO_CHANGE: Carlos Gomez (id=1, 1001, phone=3001111111)
        ["CC", "1001", "Carlos Gomez", "3001111111", "carlos@test.com", "Regular", "SI"],
        # 2. MODIFIED: Ana Torres (id=2, 1002, changed phone & notes)
        ["CC", "1002", "Ana Torres Ortiz", "3008888888", "ana@test.com", "Nueva Nota", "SI"],
        # 3. NEW: Nuevo cliente
        ["CC", "2001", "Lucia Perez", "3151234567", "lucia@test.com", "Cliente nueva", "SI"],
        # 4. DUPLICATE: Repeated 2001
        ["CC", "2001", "Lucia Perez Duplicada", "3151234567", "lucia@test.com", "", "SI"],
        # 5. NO_DOCUMENT: Missing document
        ["CC", "", "Persona Sin Documento", "3000000000", "", "", "SI"],
        # 6. CONFLICT: Document 1003 exists with TI, but here sent with CE
        ["CE", "1003", "Pedro Infante", "3003333333", "pedro@test.com", "", "SI"],
        # 7. CONFLICT: Invalid document_type
        ["PASAPORTE_INVALIDO", "5555", "Extranjero", "3111111111", "", "", "SI"],
    ]
    # Note: Client c3 (id=3, TI 1003) is in DB, but document mismatch causes it to not match by tuple.
    # What about c3 missing? Since 1003 wasn't matched strictly by tuple, it will be in missing_clients!

    excel_bytes = build_excel_file(headers, rows)
    response = client.post(
        "/clients/import/preview",
        files={"file": ("clientes_test.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200
    data = response.json()
    summary = data["summary"]

    assert summary["total_rows"] == 7
    assert summary["no_change_count"] == 1
    assert summary["modified_count"] == 1
    assert summary["new_count"] == 1
    assert summary["duplicate_count"] == 1
    assert summary["no_document_count"] == 1
    assert summary["conflict_count"] == 2

    # Verify modified diff details
    modified_item = next(i for i in data["items"] if i["category"] == "MODIFIED")
    assert modified_item["document"] == "1002"
    assert "phone" in modified_item["diffs"]
    assert modified_item["diffs"]["phone"]["old_value"] == "3002222222"
    assert modified_item["diffs"]["phone"]["new_value"] == "3008888888"
    assert "full_name" in modified_item["diffs"]
    assert modified_item["diffs"]["full_name"]["new_value"] == "Ana Torres Ortiz"

    # Verify missing clients (Client 3 wasn't matched by tuple)
    assert len(data["missing_clients"]) >= 1
    assert any(m["document"] == "1003" for m in data["missing_clients"])


# =====================================================================
# 4. Test Exportación y Aislamiento Multi-Tenant
# =====================================================================

def test_export_clients_multi_tenant_isolation():
    global test_current_user_id
    # Gym 1 export
    test_current_user_id = 1
    res1 = client.get("/clients/export")
    assert res1.status_code == 200
    wb1 = openpyxl.load_workbook(io.BytesIO(res1.content))
    ws1 = wb1["CLIENTES"]
    docs_gym1 = [row[2] for row in ws1.iter_rows(min_row=2, values_only=True)]
    assert "1001" in docs_gym1
    assert "1002" in docs_gym1
    assert "1003" in docs_gym1
    assert "9999" not in docs_gym1  # Gym 2 client must NOT appear

    # Gym 2 export
    test_current_user_id = 2
    res2 = client.get("/clients/export")
    assert res2.status_code == 200
    wb2 = openpyxl.load_workbook(io.BytesIO(res2.content))
    ws2 = wb2["CLIENTES"]
    docs_gym2 = [row[2] for row in ws2.iter_rows(min_row=2, values_only=True)]
    assert "9999" in docs_gym2
    assert "1001" not in docs_gym2
    assert "1002" not in docs_gym2


# =====================================================================
# 5. Test Aplicación Transaccional y Faltantes Sin Eliminación
# =====================================================================

def test_apply_import_transactional_success():
    global test_current_user_id
    test_current_user_id = 1

    payload = {
        "new_clients": [
            {
                "document_type": "CC",
                "document": "7777",
                "full_name": "Nuevo Cliente Uno",
                "phone": "3201234567",
                "email": "nuevo1@test.com",
                "notes": "Bienvenido",
            }
        ],
        "updated_clients": [
            {
                "client_id": 1,
                "full_name": "Carlos Gomez Modificado",
                "phone": "3009999999",
                "email": "carlos.nuevo@test.com",
                "notes": "Nota actualizada",
            }
        ],
    }

    response = client.post("/clients/import/apply", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["created_count"] == 1
    assert data["updated_count"] == 1

    # Verify DB state
    db = TestingSessionLocal()
    # 1. New client created
    new_c = db.query(Client).filter(Client.gym_id == 1, Client.document == "7777").first()
    assert new_c is not None
    assert new_c.full_name == "Nuevo Cliente Uno"

    # 2. Existing client updated
    c1 = db.query(Client).filter(Client.id == 1).first()
    assert c1.full_name == "Carlos Gomez Modificado"
    assert c1.phone == "3009999999"

    # 3. Missing clients (c2, c3) NOT deleted and still active
    c2 = db.query(Client).filter(Client.id == 2).first()
    c3 = db.query(Client).filter(Client.id == 3).first()
    assert c2 is not None and c2.is_active is True
    assert c3 is not None and c3.is_active is True

    # 4. Check audit log
    log = (
        db.query(AuditLog)
        .filter(AuditLog.gym_id == 1, AuditLog.action == "CLIENTS_BULK_IMPORT")
        .first()
    )
    assert log is not None
    assert log.new_values["created_count"] == 1
    assert log.new_values["updated_count"] == 1
    db.close()


# =====================================================================
# 6. Test Seguridad Multi-Tenant: Rechazo de Manipulación de client_id
# =====================================================================

def test_apply_import_cross_tenant_rejected():
    global test_current_user_id
    test_current_user_id = 1  # User from Gym 1

    # Client id=4 belongs to Gym 2
    payload = {
        "new_clients": [],
        "updated_clients": [
            {
                "client_id": 4,  # Belongs to Gym 2!
                "full_name": "Intento de hack",
            }
        ],
    }

    response = client.post("/clients/import/apply", json=payload)
    assert response.status_code == 403
    assert "no pertenece a tu gimnasio" in response.json()["detail"]

    # Verify client 4 in Gym 2 was NOT altered
    db = TestingSessionLocal()
    c4 = db.query(Client).filter(Client.id == 4).first()
    assert c4.full_name == "Mario Bros"
    db.close()
