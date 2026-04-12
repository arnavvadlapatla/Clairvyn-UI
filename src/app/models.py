from datetime import datetime
import uuid

from sqlalchemy import Enum as SAEnum
from sqlalchemy import CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID

from src.app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.BigInteger, primary_key=True)
    firebase_uid = db.Column(db.Text, unique=True, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)
    display_name = db.Column(db.Text, nullable=True)
    photo_url = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    has_paid = db.Column(db.Boolean, nullable=False, default=False)

    # track when the user last logged in/out via our API
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_logout_at = db.Column(db.DateTime(timezone=True), nullable=True)

    chat_sessions = db.relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    profile = db.relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


message_sender_enum = SAEnum("user", "assistant", "system", name="message_sender")


class ChatSession(db.Model):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("idx_chat_sessions_user_created_at", "user_id", "created_at"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = db.Column(db.Text, nullable=True)
    chat_metadata = db.Column("metadata", db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = db.relationship("User", back_populates="chat_sessions")
    messages = db.relationship("Message", back_populates="chat_session", cascade="all, delete-orphan")


class Message(db.Model):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "sender_type <> 'user' OR user_id IS NOT NULL",
            name="messages_user_id_required_for_user_sender",
        ),
        Index("idx_messages_chat_created_at", "chat_id", "created_at"),
    )

    id = db.Column(db.BigInteger, primary_key=True)
    chat_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_type = db.Column(message_sender_enum, nullable=False)
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    content = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.Text, nullable=True)
    extra_data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    chat_session = db.relationship("ChatSession", back_populates="messages")
    user = db.relationship("User")


class ChatFeedback(db.Model):
    __tablename__ = "chat_feedback"
    __table_args__ = (
        Index("idx_chat_feedback_chat_created_at", "chat_id", "created_at"),
        Index("idx_chat_feedback_message_created_at", "message_id", "created_at"),
        Index("idx_chat_feedback_user_created_at", "user_id", "created_at"),
        db.UniqueConstraint("message_id", "user_id", name="uq_chat_feedback_message_user"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id = db.Column(
        db.BigInteger,
        db.ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feedback_type = db.Column(db.Text, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    feedback_metadata = db.Column("metadata", db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    chat_session = db.relationship("ChatSession")
    message = db.relationship("Message")
    user = db.relationship("User")


class Attachment(db.Model):
    __tablename__ = "attachments"

    id = db.Column(db.BigInteger, primary_key=True)
    message_id = db.Column(
        db.BigInteger,
        db.ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = db.Column(db.Text, nullable=False)
    type = db.Column(db.Text, nullable=True)
    attachment_metadata = db.Column("metadata", db.JSON, nullable=True)

    message = db.relationship("Message", backref=db.backref("attachments", cascade="all, delete-orphan"))


class UserProfile(db.Model):
    __tablename__ = "user_profiles"

    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    university = db.Column(db.Text, nullable=True)
    city = db.Column(db.Text, nullable=True)
    country = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = db.relationship("User", back_populates="profile")


class FloorPlan(db.Model):
    __tablename__ = "floor_plans"
    __table_args__ = (
        Index("idx_floor_plans_user_created_at", "user_id", "created_at"),
        Index("idx_floor_plans_chat_created_at", "chat_session_id", "created_at"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    total_area_sqm = db.Column(db.Float, nullable=True)
    room_count = db.Column(db.Integer, nullable=True)
    room_types = db.Column(db.JSON, nullable=True)
    assets_used = db.Column(db.JSON, nullable=True)
    validation_passed = db.Column(db.Boolean, nullable=True)
    fix_iterations = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class PromptMetric(db.Model):
    __tablename__ = "prompt_metrics"
    __table_args__ = (
        Index("idx_prompt_metrics_chat_created_at", "chat_session_id", "created_at"),
        Index("idx_prompt_metrics_user_created_at", "user_id", "created_at"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = db.Column(
        db.BigInteger,
        db.ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chat_session_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prompt_type = db.Column(db.Text, nullable=False)
    model_name = db.Column(db.Text, nullable=True)
    api_key_label = db.Column(db.Text, nullable=True)
    tokens_input = db.Column(db.Integer, nullable=True)
    tokens_output = db.Column(db.Integer, nullable=True)
    latency_ms = db.Column(db.Integer, nullable=True)
    success = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AINodeMetric(db.Model):
    __tablename__ = "ai_node_metrics"
    __table_args__ = (
        Index("idx_ai_node_metrics_chat_created_at", "chat_session_id", "created_at"),
        Index("idx_ai_node_metrics_node_created_at", "node_name", "created_at"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_session_id = db.Column(
        db.BigInteger,
        db.ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    node_name = db.Column(db.Text, nullable=False)
    model_name = db.Column(db.Text, nullable=True)
    api_key_label = db.Column(db.Text, nullable=True)
    tokens_input = db.Column(db.Integer, nullable=True)
    tokens_output = db.Column(db.Integer, nullable=True)
    latency_ms = db.Column(db.Integer, nullable=True)
    retry_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Task(db.Model):
    __tablename__ = "tasks"

    task_id = db.Column(db.Text, primary_key=True)
    chat_id = db.Column(db.BigInteger, nullable=True, index=True)
    status = db.Column(db.Text, nullable=False, default="PENDING")
    result = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class WaitlistEntry(db.Model):
    __tablename__ = "waitlist"

    id = db.Column(db.BigInteger, primary_key=True)
    email = db.Column(db.Text, unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, nullable=False)

