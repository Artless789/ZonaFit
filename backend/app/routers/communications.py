from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.communication import (
    CommunicationPrepareRequest,
    CommunicationPrepareResponse,
    CommunicationRecordOpenedRequest,
    CommunicationRecordOpenedResponse,
)
from app.services.communication_service import CommunicationService

router = APIRouter(
    prefix="/communications",
    tags=["Communications"],
)


@router.post(
    "/prepare",
    response_model=CommunicationPrepareResponse,
    summary="Prepare WhatsApp Web message and validate context",
)
def prepare_communication_message(
    request: CommunicationPrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunicationService.prepare_message(
        db=db,
        current_user=current_user,
        request=request,
    )


@router.post(
    "/record-opened",
    response_model=CommunicationRecordOpenedResponse,
    summary="Record that a WhatsApp Web communication flow was opened",
)
def record_communication_opened(
    request: CommunicationRecordOpenedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommunicationService.record_opened(
        db=db,
        current_user=current_user,
        request=request,
    )
