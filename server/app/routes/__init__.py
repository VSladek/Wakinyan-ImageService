def register_blueprints(app):
    from .albums import bp as albums_bp
    from .auth import bp as auth_bp
    from .comments import bp as comments_bp
    from .images import bp as images_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(albums_bp)
    app.register_blueprint(images_bp)
    app.register_blueprint(comments_bp)
