from app.database.database import engine
from sqlalchemy import text

try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version();"))
            print("Conexion exitosa")
            print(result.fetchone()[0])

except Exception as e:
        print("Error de conexion:")
        print(e)