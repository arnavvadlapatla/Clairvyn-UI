from src.app import create_app
from src.app.extensions import db
from src.app.models import User, UserProfile


def infer_university_from_email(email: str):
    if not email or "@" not in email:
        return None
    domain = email.split("@", 1)[1].strip().lower()
    if domain.endswith(".edu") or domain.endswith(".ac.in"):
        return domain
    return None


def run_backfill():
    created = 0
    updated = 0
    users = User.query.all()
    for user in users:
        profile = UserProfile.query.filter_by(user_id=user.id).one_or_none()
        inferred = infer_university_from_email(user.email)

        if profile is None:
            db.session.add(
                UserProfile(
                    user_id=user.id,
                    university=inferred,
                )
            )
            created += 1
            continue

        if not profile.university and inferred:
            profile.university = inferred
            db.session.add(profile)
            updated += 1

    db.session.commit()
    print(f"Backfill complete. created={created}, updated={updated}, total_users={len(users)}")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run_backfill()
