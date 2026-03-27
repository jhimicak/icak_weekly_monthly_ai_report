from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from database import Base, engine
from routers import departments, reports, items, ai, convert

# DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)

# ai_summary 컬럼 마이그레이션 (기존 DB 에 해당 컬럼이 없을 경우 자동 추가)
try:
    with engine.connect() as conn:
        db_url = str(engine.url)
        if db_url.startswith("sqlite"):
            result = conn.execute(text("PRAGMA table_info(reports)"))
            cols = [row[1] for row in result]
        else:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='reports' AND column_name='ai_summary'"
            ))
            cols = [row[0] for row in result]
        if "ai_summary" not in cols:
            conn.execute(text("ALTER TABLE reports ADD COLUMN ai_summary TEXT"))
            conn.commit()
except Exception as e:
    print(f"[마이그레이션 주의] ai_summary 컬럼 추가 중 오류 (이미 존재하면 무시): {e}")


app = FastAPI(
    title="Smart Report Hub API",
    description="주간/월간 업무보고 웹 기반 시스템",
    version="0.1.0",
)

# CORS - Next.js 각종 배포 도메인(Vercel 등) 접속 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 500 에러 발생 시에도 CORS 헤더를 포함시켜 브라우저 CORS 오류로 오인하지 않도록 처리
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


# 라우터 등록
app.include_router(departments.router)
app.include_router(reports.router)
app.include_router(items.router)
app.include_router(ai.router)
app.include_router(convert.router)


@app.get("/")
def root():
    return {"message": "Smart Report Hub API is running 🚀"}
