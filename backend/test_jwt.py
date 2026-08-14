from app.core.security import (
    create_access_token,
    verify_access_token
)

data = {
    "sub": "admin@merwilfit.com",
    "user_id": 1,
    "gym_id": 1,
    "role": "ADMIN"
}

token = create_access_token(data)

print("JWT generado:\n")
print(token)

print("\n----------------------------------")

payload = verify_access_token(token)

print("\nInformación recuperada del JWT:\n")

for clave, valor in payload.items():
    print(f"{clave}: {valor}")