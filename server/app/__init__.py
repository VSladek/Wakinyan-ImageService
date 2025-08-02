from flasgger import Swagger
from flask import Flask, redirect, request
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()


def create_app() -> Flask:
    from .config import Config

    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)

    app.config['SWAGGER'] = {
        'title': 'Wakinyans ImageStorageService v1',
        'uiversion': 3,
        'openapi': '3.0.2',
        'specs_route': '/'
    }
    Swagger(app, template={
        "info": {
            "version": "1.0"
        },
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Enter your Admin or Consumer API key here."
                }
            },
            "parameters": {
                "usernameHeader": {
                    "name": "X-Username",
                    "in": "header",
                    "required": True,
                    "schema": {
                        "type": "string"
                    },
                    "description": "The username for the current session (e.g., 'admin' or a consumer's name)."
                }
            }
        }
    })

    @app.before_request
    def https_redirect():
        scheme = request.headers.get('X-Forwarded-Proto')
        if scheme and scheme == 'https':
            return

        if request.is_secure:
            return

        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

    db.init_app(app)
    migrate.init_app(app, db)
    with app.app_context():
        db.create_all()

    # blueprints
    from .routes import register_blueprints
    register_blueprints(app)

    return app
