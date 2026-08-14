from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MembershipBase(BaseModel):
    client_id: int
    membership_plan_id: int
    trainer_name: str | None = None


class MembershipCreate(MembershipBase):
    pass


class MembershipUpdate(BaseModel):
    status: str | None = None
    is_active: bool | None = None
    trainer_name: str | None = None


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    client_id: int
    membership_plan_id: int

    start_date: datetime
    end_date: datetime

    price: float

    status: str
    is_active: bool
    trainer_name: str | None = None

    created_at: datetime
    updated_at: datetime