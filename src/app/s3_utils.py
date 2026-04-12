import os
from typing import Optional
import boto3
from botocore.exceptions import ClientError

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_S3_REGION", "us-east-1"),
        )
    return _s3_client


def _get_bucket():
    bucket = os.getenv("AWS_S3_BUCKET")
    if not bucket:
        raise RuntimeError("AWS_S3_BUCKET environment variable is not set")
    return bucket


def upload_file_to_s3(local_path: str, s3_key: str, content_type: Optional[str] = None) -> str:
    """Upload a local file to S3 and return its public URL.

    Args:
        local_path: Absolute path to the file on disk.
        s3_key: The object key in the bucket (e.g. "generated/abc12_0.png").
        content_type: Optional MIME type override.

    Returns:
        The public URL of the uploaded object.
    """
    client = _get_s3_client()
    bucket = _get_bucket()
    region = os.getenv("AWS_S3_REGION", "us-east-1")

    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type

    client.upload_file(local_path, bucket, s3_key, ExtraArgs=extra_args)

    if region == "us-east-1":
        url = f"https://{bucket}.s3.amazonaws.com/{s3_key}"
    else:
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{s3_key}"

    return url


def upload_generated_png(local_path: str, document_id: str) -> str:
    """Upload a generated PNG floor plan image to S3."""
    s3_key = f"generated/{document_id}.png"
    return upload_file_to_s3(local_path, s3_key, content_type="image/png")


def upload_generated_dxf(local_path: str, document_id: str) -> str:
    """Upload a generated DXF floor plan file to S3."""
    s3_key = f"generated/{document_id}.dxf"
    return upload_file_to_s3(local_path, s3_key, content_type="application/dxf")


def delete_s3_objects(s3_keys: list[str]) -> None:
    """Delete a batch of objects from S3 by their keys.

    Silently ignores keys that don't exist. Raises on credential / permission
    errors so the caller can decide how to handle them.
    """
    if not s3_keys:
        return
    client = _get_s3_client()
    bucket = _get_bucket()
    objects = [{"Key": k} for k in s3_keys]
    # S3 delete_objects handles up to 1000 keys per call
    for i in range(0, len(objects), 1000):
        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": objects[i : i + 1000], "Quiet": True},
        )


def delete_generated_files(document_id: str) -> None:
    """Delete both PNG and DXF for a given document_id from S3."""
    delete_s3_objects([
        f"generated/{document_id}.png",
        f"generated/{document_id}.dxf",
    ])


def is_s3_configured() -> bool:
    """Return True if all required AWS S3 env vars are set."""
    return bool(
        os.getenv("AWS_ACCESS_KEY_ID")
        and os.getenv("AWS_SECRET_ACCESS_KEY")
        and os.getenv("AWS_S3_BUCKET")
    )
