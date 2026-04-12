import firebase_admin
from firebase_admin import credentials

_firebase_app = None


def initialize_firebase() -> firebase_admin.App:
    """
    Initialize and return a singleton Firebase Admin app.

    This should be called once during application startup.
    """
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    if not firebase_admin._apps:
        cred = credentials.Certificate("firebase_key.json")
        _firebase_app = firebase_admin.initialize_app(cred)
    else:
        # Reuse existing app if already initialized elsewhere
        _firebase_app = next(iter(firebase_admin._apps.values()))

    return _firebase_app
