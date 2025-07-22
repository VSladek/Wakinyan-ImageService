from functools import wraps

from flask import current_app, g, jsonify, request

from .models import User, UserRole, db


def get_or_create_user_by_role(role: UserRole, username: str | None) -> User:
    """
    Finds a user by their role Enum, creating them if they don't exist.
    """
    user = User.query.filter_by(role=role, username=username).first()
    if user is None:
        user = User(
            role=role,
            username=username or role.value.capitalize(),
            display_name=username or f"{role.value.capitalize()} User",
        )
        db.session.add(user)
        db.session.commit()
    return user


def login_required(func):
    """
    Checks for a valid API key and attaches the user with the correct role Enum.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        username_header = request.headers.get("X-Username", "")
        admin_key = current_app.config["ADMIN_API_KEY"]
        consumer_key = current_app.config["CONSUMER_API_KEY"]

        if not auth_header.startswith("Bearer "):
            return jsonify(error="Bearer token required"), 401

        token = auth_header[7:]
        user_role_enum: UserRole | None = None

        if token == admin_key:
            user_role_enum = UserRole.ADMIN
        elif token == consumer_key:
            user_role_enum = UserRole.CONSUMER
        else:
            return jsonify(error="Invalid API Key"), 401

        g.current_user = get_or_create_user_by_role(
            user_role_enum, username_header)
        return func(*args, **kwargs)

    return wrapper


def admin_required(func):
    """
    A decorator that ensures the logged-in user has the ADMIN role.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not g.current_user or g.current_user.role != UserRole.ADMIN:
            return jsonify(error="Admin privileges required"), 403
        return func(*args, **kwargs)

    return wrapper
