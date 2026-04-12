from dotenv import load_dotenv
import os
import psycopg2

load_dotenv()

db_url = os.getenv("DATABASE_URL")
conn = psycopg2.connect(db_url)

# test the connection
print(conn.status)