from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import Base, engine
from routers import departments, reports, items, ai

# DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)

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


@app.get("/")
def root():
    return {"message": "Smart Report Hub API is running 🚀"}
