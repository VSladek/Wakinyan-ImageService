from flask import Blueprint, g, jsonify, request

from ..auth import admin_required, login_required
from ..models import Album, db

bp = Blueprint("albums", __name__, url_prefix="/api/albums")


@bp.get("/")
@login_required
def list_albums():
    """
    List All Albums
    Retrieves a list of all available albums.
    ---
    tags:
      - Albums
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
    responses:
      200:
        description: A list of albums.
    """
    albums = Album.query.order_by(Album.created_at.desc()).all()
    return jsonify(albums=[{"id": a.id, "name": a.name} for a in albums])


@bp.post("/")
@login_required
@admin_required
def create_album():
    """
    Create a New Album (Admin Only)
    Creates a new album. Requires admin privileges.
    ---
    tags:
      - Albums
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              description: The name of the new album.
              example: "Summer Camp 2024"
    responses:
      200:
        description: Album created successfully.
      401:
        description: Admin privileges required.
    """
    name = (request.get_json(force=True).get("name") or "").strip()
    if not name:
        return jsonify(error="name required"), 400
    album = Album(name=name, owner_id=g.current_user.id)
    db.session.add(album)
    db.session.commit()
    return jsonify(success=True, album={"id": album.id, "name": album.name})
