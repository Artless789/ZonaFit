from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, ConfigDict


class ClientFieldDiff(BaseModel):
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class ClientPreviewItem(BaseModel):
    row_number: int
    category: Literal["NO_CHANGE", "NEW", "MODIFIED", "MISSING", "CONFLICT", "NO_DOCUMENT", "DUPLICATE"]
    client_id: Optional[int] = None
    document_type: str
    document: str
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    diffs: Optional[Dict[str, ClientFieldDiff]] = None
    conflict_reason: Optional[str] = None
    is_selected: bool = True

    model_config = ConfigDict(from_attributes=True)


class ClientImportSummary(BaseModel):
    total_rows: int
    no_change_count: int
    new_count: int
    modified_count: int
    missing_count: int
    conflict_count: int
    no_document_count: int
    duplicate_count: int


class ClientImportPreviewResponse(BaseModel):
    summary: ClientImportSummary
    items: List[ClientPreviewItem]
    missing_clients: List[ClientPreviewItem]


class ClientImportNewItem(BaseModel):
    document_type: str
    document: str
    full_name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None


class ClientImportUpdateItem(BaseModel):
    client_id: int
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class ClientImportApplyRequest(BaseModel):
    new_clients: List[ClientImportNewItem] = []
    updated_clients: List[ClientImportUpdateItem] = []


class ClientImportApplyResponse(BaseModel):
    success: bool = True
    created_count: int
    updated_count: int
    skipped_count: int = 0
    message: str
