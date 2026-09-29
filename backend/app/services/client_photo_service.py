import os
import logging
from sqlalchemy.orm import Session
from app.models.client import Client
from app.models.client_photo import ClientPhoto
from app.routers.clients import UPLOAD_DIR, FALLBACK_UPLOAD_DIRS

logger = logging.getLogger(__name__)

MIME_BY_EXT = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def sync_orphan_disk_photos_to_db(db: Session) -> dict:
    """
    Scans existing clients who have a photo_url pointing to a disk file
    but do not yet have a persistent binary record in the client_photos table.
    Migrates the image bytes into PostgreSQL so they survive container rebuilds.
    Non-destructive: preserves all existing disk files and database records.
    """
    clients_with_photos = (
        db.query(Client)
        .filter(Client.photo_url.isnot(None), Client.photo_url != "")
        .all()
    )

    scanned = len(clients_with_photos)
    migrated = 0
    already_persisted = 0
    missing_on_disk = 0

    for client in clients_with_photos:
        # Check if already backed up in DB
        existing_photo = (
            db.query(ClientPhoto)
            .filter(
                ClientPhoto.client_id == client.id,
                ClientPhoto.gym_id == client.gym_id,
            )
            .first()
        )
        if existing_photo:
            already_persisted += 1
            continue

        # Extract filename from photo_url (/clients/photo/<filename>)
        if not client.photo_url or not client.photo_url.startswith("/clients/photo/"):
            continue

        filename = client.photo_url.split("/")[-1]
        ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
        content_type = MIME_BY_EXT.get(ext, "image/jpeg")

        # Find file on disk
        target_path = None
        for dir_path in [UPLOAD_DIR] + FALLBACK_UPLOAD_DIRS:
            candidate = os.path.join(dir_path, filename)
            if os.path.exists(candidate) and os.path.isfile(candidate):
                target_path = candidate
                break

        if not target_path:
            missing_on_disk += 1
            logger.warning(
                "Client %s has photo_url %s but file not found on disk",
                client.id,
                client.photo_url,
            )
            continue

        try:
            with open(target_path, "rb") as f:
                data = f.read()

            if not data:
                continue

            new_photo = ClientPhoto(
                gym_id=client.gym_id,
                client_id=client.id,
                filename=filename,
                content_type=content_type,
                file_size=len(data),
                data=data,
            )
            db.add(new_photo)
            db.commit()
            migrated += 1
            logger.info("Migrated photo for client %s (%s bytes) to DB", client.id, len(data))
        except Exception as e:
            db.rollback()
            logger.error("Failed to migrate photo for client %s: %s", client.id, e)

    return {
        "scanned": scanned,
        "migrated": migrated,
        "already_persisted": already_persisted,
        "missing_on_disk": missing_on_disk,
    }
