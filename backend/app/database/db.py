from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Menggunakan SQLite, file database akan disimpan di root backend dengan nama texguard.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./texguard.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency untuk mengambil koneksi database
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
