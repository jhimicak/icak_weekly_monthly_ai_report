from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine
from routers import departments, reports, items, ai

# DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Report Hub API",
    description="주간/월간 업무보고 웹 기반 시스템",
    version="0.1.0",
)

# CORS - Next.js 개발 서버 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(departments.router)
app.include_router(reports.router)
app.include_router(items.router)
app.include_router(ai.router)


@app.get("/")
def root():
    return {"message": "Smart Report Hub API is running 🚀"}
