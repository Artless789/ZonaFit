from app.core.security import hash_password, verify_password

password = "123456"

hashed = hash_password(password)

print("Contraseña original:", password)
print("Hash generado:", hashed)

print("\nVerificando contraseña correcta:")
print(verify_password("123456", hashed))

print("\nVerificando contraseña incorrecta:")
print(verify_password("abcdef", hashed))