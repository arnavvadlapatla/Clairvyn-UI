import boto3
from dotenv import load_dotenv
import os

load_dotenv()

s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_S3_REGION")
)

bucket = os.getenv("AWS_S3_BUCKET")
file_path = "test.png"
key = "test.png"

s3.upload_file(
    file_path,
    bucket,
    key,
    ExtraArgs={"ContentType": "image/jpeg"}
)

print("Upload successful")