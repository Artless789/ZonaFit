from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class RegisterRequest(BaseModel):
    owner_name: str
    owner_email: EmailStr
    owner_password: str
    gym_name: str
    gym_legal_name: str = ""
    gym_phone: str = ""
    gym_address: str = ""
    gym_city: str = ""

    @field_validator("owner_email", mode="before")
    @classmethod
    def normalize_owner_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres.")
        return v