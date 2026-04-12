from functools import wraps
from typing import Optional, Any

from flask import jsonify, g, request
from firebase_admin import auth as firebase_auth

from src.app.extensions import db
from src.app.models import User

from datetime import datetime


def _infer_university_from_email(email: str) -> Optional[str]:
    if not email or "@" not in email:
        return None
    domain = email.split("@", 1)[1].strip().lower()
    if not domain:
        return None
    if domain.endswith(".edu") or domain.endswith(".ac.in"):
        return domain
    return None


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _upsert_user_from_firebase(decoded_token: dict) -> User:
    firebase_uid = decoded_token["uid"]
    email = decoded_token.get("email")
    display_name = decoded_token.get("name")
    photo_url = decoded_token.get("picture")

    # With email/password login, Firebase should always provide an email claim.
    if not email:
        raise ValueError("Email missing from Firebase token")

    user = User.query.filter_by(firebase_uid=firebase_uid).one_or_none()
    if user is None and email:
        # Handle existing DB rows keyed by email from prior auth/provider flows.
        user = User.query.filter_by(email=email).one_or_none()

    now = datetime.utcnow()
    if user is None:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            display_name=display_name,
            photo_url=photo_url,
            last_login_at=now,
        )
        db.session.add(user)
    else:
        # Keep identity/profile data in sync with Firebase.
        if firebase_uid and user.firebase_uid != firebase_uid:
            user.firebase_uid = firebase_uid
        if email and user.email != email:
            user.email = email
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        if photo_url and user.photo_url != photo_url:
            user.photo_url = photo_url
        # update login timestamp each authenticated request
        user.last_login_at = now

    # Create/update a one-to-one user profile used for onboarding analytics.
    from src.app.models import UserProfile

    profile = UserProfile.query.filter_by(user_id=user.id).one_or_none()
    inferred_university = _infer_university_from_email(email)
    onboarding_university = _clean_text(
        decoded_token.get("university") or decoded_token.get("college")
    )
    onboarding_city = _clean_text(decoded_token.get("city"))
    onboarding_country = _clean_text(decoded_token.get("country"))
    if profile is None:
        profile = UserProfile(
            user_id=user.id,
            university=onboarding_university or inferred_university,
            city=onboarding_city,
            country=onboarding_country,
        )
        db.session.add(profile)
    else:
        updated = False
        if not profile.university and (onboarding_university or inferred_university):
            # Backfill for pre-existing users with empty profile fields.
            profile.university = onboarding_university or inferred_university
            updated = True
        if not profile.city and onboarding_city:
            profile.city = onboarding_city
            updated = True
        if not profile.country and onboarding_country:
            profile.country = onboarding_country
            updated = True
        if updated:
            db.session.add(profile)

    db.session.commit()
    return user


def firebase_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get("Authorization", "")

        if not header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = header.split(" ", 1)[1].strip()

        try:
            decoded = firebase_auth.verify_id_token(token)
        except Exception:
            return jsonify({"error": "Invalid or expired token"}), 401

        # Persist / sync user in Postgres and attach to context
        user = _upsert_user_from_firebase(decoded)
        g.current_user = user
        g.firebase_token = decoded

        return f(*args, **kwargs)

    return decorated