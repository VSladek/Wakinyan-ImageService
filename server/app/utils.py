import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image


def save_image(album_dir: Path, original_name: str, raw_bytes: bytes) -> tuple[str, int]:
    """
    Verify that the payload is a real image, then write it verbatim.
    Returns (filename, bytes_written).
    """
    album_dir.mkdir(parents=True, exist_ok=True)

    # basic validity check (does not modify bytes)
    Image.open(BytesIO(raw_bytes)).verify()

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    ext = Path(original_name).suffix or ".img"
    name = f"{ts}_{uuid.uuid4().hex[:8]}{ext}"
    dest = album_dir / name

    dest.write_bytes(raw_bytes)
    return name, len(raw_bytes)


class Identity:
    def __init__(self, id: str, login_id: str):
        self.id = id
        self.login_id = login_id
