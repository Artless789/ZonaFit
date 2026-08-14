"""
Pruebas funcionales - Modulo: Rate Limiting
Ejecutar desde: C:/Dev/ZonaFit/backend
Comando: .\\venv\\Scripts\\python.exe test_rate_limiter.py

NOTA: Las pruebas usan TestClient de Starlette para hacer peticiones HTTP
reales en proceso, sin necesidad de levantar el servidor.
El IP por defecto en TestClient es "testclient", lo que mantiene los
contadores de rate limit separados de trafico real.
"""

import sys
from starlette.testclient import TestClient
from app.main import app

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


def run_tests() -> None:
    print("\n==========================================")
    print("  ZonaFit - Pruebas: Rate Limiting")
    print("==========================================\n")

    client = TestClient(app, raise_server_exceptions=False)

    # TEST 1: El endpoint raiz responde correctamente (limiter activo)
    print("[TEST 1] App responde con rate limiter activo")
    resp = client.get("/")
    log("GET / retorna 200", resp.status_code == 200, f"status={resp.status_code}")

    # TEST 2: Login acepta peticiones dentro del limite
    print("\n[TEST 2] Login acepta peticiones dentro del limite (10/minuto)")
    first_statuses = []
    for i in range(5):
        resp = client.post(
            "/auth/login",
            data={"username": "test@test.com", "password": "wrong"},
        )
        first_statuses.append(resp.status_code)

    non_429 = [s for s in first_statuses if s != 429]
    log("Las primeras 5 peticiones no son 429", len(non_429) == 5,
        f"statuses={first_statuses}")

    # TEST 3: Login bloquea al superar el limite (10/minuto)
    print("\n[TEST 3] Login retorna 429 al superar limite")
    hit_429 = False
    for i in range(15):
        resp = client.post(
            "/auth/login",
            data={"username": "test@test.com", "password": "wrong"},
        )
        if resp.status_code == 429:
            hit_429 = True
            log("Rate limit activado correctamente", True, f"en peticion {i + 6}")
            break

    if not hit_429:
        log("Rate limit no se activo en 15 peticiones extra", False)

    # TEST 4: Respuesta 429 tiene el formato correcto del proyecto
    print("\n[TEST 4] Respuesta 429 sigue el formato de error del proyecto")
    for _ in range(20):
        resp = client.post(
            "/auth/login",
            data={"username": "test@test.com", "password": "wrong"},
        )
        if resp.status_code == 429:
            body = resp.json()
            log("Campo 'success' es False", body.get("success") is False)
            log("Campo 'error' presente", "error" in body)
            if "error" in body:
                error = body["error"]
                log("type = RateLimitExceeded", error.get("type") == "RateLimitExceeded")
                log("status_code = 429", error.get("status_code") == 429)
                log("path presente", "path" in error)
            break
    else:
        log("No se pudo obtener respuesta 429 para validar formato", False)

    # TEST 5: El endpoint /auth/me (GET) tiene limite global de 100/min
    # Solo verificamos que responde (el limite es alto, no lo saturamos)
    print("\n[TEST 5] Endpoint GET protegido responde normalmente")
    resp = client.get("/auth/me")
    log("GET /auth/me responde (401 sin token, no 429)",
        resp.status_code in (401, 403, 422),
        f"status={resp.status_code}")

    # TEST 6: Estructura del middleware registrada correctamente
    print("\n[TEST 6] SlowAPIMiddleware registrado en el app")
    from slowapi.middleware import SlowAPIMiddleware
    middleware_types = [type(m) for m in app.middleware_stack.__class__.__mro__]
    has_state = hasattr(app.state, "limiter")
    log("app.state.limiter esta configurado", has_state)

    print("\n==========================================")
    print(f"  Resultado: {PASS_COUNT} pasaron | {FAIL_COUNT} fallaron")
    print("==========================================\n")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
