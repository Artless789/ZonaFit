import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("\n--- PRUEBA: HEALTH CHECK ---")
    res = client.get("/health")
    if res.status_code == 200 and res.json() == {"status": "ok"}:
        print("   => PASS")
    else:
        print("   => FAIL", res.text)

if __name__ == "__main__":
    run_tests()
