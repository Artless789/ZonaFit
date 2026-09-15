import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    WOMPI_ENVIRONMENT: str = os.getenv("WOMPI_ENVIRONMENT", "SANDBOX")
    WOMPI_API_URL: str = os.getenv("WOMPI_API_URL", "https://sandbox.wompi.co/v1")
    WOMPI_PUBLIC_KEY: str = os.getenv("WOMPI_PUBLIC_KEY", "pub_test_XXXXX")
    WOMPI_PRIVATE_KEY: str = os.getenv("WOMPI_PRIVATE_KEY", "prv_test_XXXXX")
    WOMPI_EVENTS_SECRET: str = os.getenv("WOMPI_EVENTS_SECRET", "events_test_XXXXX")
    WOMPI_INTEGRITY_SECRET: str = os.getenv("WOMPI_INTEGRITY_SECRET", "integrity_test_XXXXX")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URLS: str = os.getenv("FRONTEND_URLS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
    TOKEN_EXPIRATION_MINUTES: int = int(os.getenv("TOKEN_EXPIRATION_MINUTES", "60"))
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    APPLICATION_PORT: int = int(os.getenv("APPLICATION_PORT", os.getenv("PORT", "8000")))
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", os.path.join(os.getcwd(), "uploads"))

settings = Settings()
