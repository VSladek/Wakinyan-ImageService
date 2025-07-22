from datetime import datetime
from enum import Enum
from pathlib import Path

from . import db
from .config import Config


class UserRole(Enum):
    ADMIN = "admin"
    CONSUMER = "consumer"


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.Enum(UserRole), nullable=False)
    # skautis_id = db.Column(db.String(128), unique=True, nullable=False)
    username = db.Column(db.String(128), nullable=False, unique=True)
    display_name = db.Column(db.String(128))
    email = db.Column(db.String(256))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    albums = db.relationship(
        "Album",   backref="owner",  cascade="all, delete")
    comments = db.relationship(
        "Comment", backref="author", cascade="all, delete")


class Album(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    images = db.relationship("Image", backref="album", cascade="all, delete")

    @property
    def dir_path(self) -> Path:
        return Config.STORAGE_PATH / f"album_{self.id}"


class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    original_name = db.Column(db.String(256), nullable=False)
    status = db.Column(db.String(50), default='approved', nullable=False)
    album_id = db.Column(db.Integer, db.ForeignKey("album.id"), nullable=False)
    uploader_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship(
        "Comment", backref="image", cascade="all, delete")


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    image_id = db.Column(db.Integer, db.ForeignKey("image.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
