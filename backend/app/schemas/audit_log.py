from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    module: Optional[str] = None
    entity_type: str
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "SUCCESS"
    old_values: Optional[Any] = None
    new_values: Optional[Any] = None
    ip_address: Optional[str] = None
    created_at: datetime
