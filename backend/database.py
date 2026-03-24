import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv() # .env 파일 로드

# 로컬 SQLite를 기본값으로 하되, 환경 변수에 설정된 값이 있으면 (Supabase 등) 그것을 사용합니다.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./report.db")

# PostgreSQL을 쓸 때 SQLite 전용 옵션(check_same_thread)이 들어가면 에러가 나므로 분기 처리합니다.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Supabase (PostgreSQL) 용 엔진
    # (선택) 연결 풀 속성을 조금 더 부드럽게 가져가려면 pool_pre_ping=True 추가 권장
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
