import os
from flask import Flask
from src.app.api.routes import main_bp
from src.app.ai.model_v2 import FloorPlanAgent
from firebase_init import initialize_firebase
from src.app.extensions import db, migrate
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    database_url = os.getenv("DATABASE_URL", "sqlite:///instance/local.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    # CORS — configurable via ALLOWED_ORIGINS env var (comma-separated)
    allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
    if allowed_origins_str:
        allowed_origins = [o.strip() for o in allowed_origins_str.split(",") if o.strip()]
    else:
        # Development defaults
        allowed_origins = [
            "http://localhost:3000", "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://localhost:5173", "http://127.0.0.1:5173",
        ]
    # Always ensure local dev origins are present
    for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
        if origin not in allowed_origins:
            allowed_origins.append(origin)
    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )
    # Firebase Admin SDK
    initialize_firebase()

    app.register_blueprint(main_bp)
    app.model = FloorPlanAgent()

    # Database setup
    db.init_app(app)

    # Import models so that Flask-Migrate can detect them
    from src.app import models  # noqa: F401

    migrate.init_app(app, db)

    # On every startup the ThreadPoolExecutor is brand-new and all previous
    # in-flight tasks are gone.  Any row still at PENDING or STARTED is
    # permanently orphaned — mark it FAILURE immediately so the frontend
    # gets a clean error on its next poll instead of waiting 5 minutes.
    with app.app_context():
        try:
            from src.app.models import Task
            stale = Task.query.filter(Task.status.in_(["PENDING", "STARTED"])).all()
            if stale:
                for t in stale:
                    t.status = "FAILURE"
                    t.result = {"error": "Server restarted — task was interrupted. Please try again."}
                db.session.commit()
                print(f"[startup] Marked {len(stale)} stale task(s) as FAILURE after restart.")
        except Exception as exc:
            try:
                db.session.rollback()
            except Exception:
                pass
            print(f"[startup] Could not clean stale tasks: {exc}")

    return app

if __name__ == '__main__':
    app = create_app()
    port = 5000
    print(f"Backend starting at http://127.0.0.1:{port}")
    app.run(debug=True, host='0.0.0.0', port=port)
    