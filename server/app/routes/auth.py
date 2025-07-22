from flask import Blueprint, g, jsonify

from app.models import User

from ..auth import login_required

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.get("/validate")
@login_required
def validate_key():
    """
    Validate API Key
    Checks if the provided API Key and Username are valid.
    ---
    tags:
      - Authentication
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
    responses:
      200:
        description: Key is valid.
        content:
          application/json:
            schema:
              type: object
              properties:
                valid:
                  type: boolean
                  example: true
                role:
                  type: string
                  example: "admin"
      401:
        description: Unauthorized, invalid or missing key/header.
    """
    return jsonify(valid=True, role=g.current_user.role.value)


@bp.get("/user")
@login_required
def get_user_info():
    """
    Get Current User Info
    Returns the profile of the user associated with the current session.
    ---
    tags:
      - Authentication
    security:
      - ApiKeyAuth: []
    parameters:
      - $ref: '#/components/parameters/usernameHeader'
    responses:
      200:
        description: User profile data.
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  example: 1
                role:
                  type: string
                  example: "admin"
                username:
                  type: string
                  example: "admin"
                display_name:
                  type: string
                  example: "Administrator"
                created_at:
                  type: string
    """
    u: User = g.current_user
    return jsonify(
        id=u.id,
        role=u.role.value,
        username=u.username,
        display_name=u.display_name,
        created_at=u.created_at.isoformat(),
    )
