from src.app import create_app
from src.app.extensions import db, migrate

if __name__ == '__main__':
    app = create_app()
    migrate.init_app(app, db)
    host = '0.0.0.0'
    port = 5000
    print(f"Backend starting at http://127.0.0.1:{port}")
    app.run(debug=True, host=host, port=port)