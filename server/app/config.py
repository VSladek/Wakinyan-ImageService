import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    ADMIN_API_KEY = os.environ["ADMIN_API_KEY"]
    CONSUMER_API_KEY = os.environ["CONSUMER_API_KEY"]

    # database
    SQLALCHEMY_DATABASE_URI = (
        os.environ.get("DATABASE_URL")
        or f"sqlite:///{BASE_DIR/'image_service.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # storage
    STORAGE_PATH = Path(os.environ.get("STORAGE_PATH", BASE_DIR / "storage"))
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)
