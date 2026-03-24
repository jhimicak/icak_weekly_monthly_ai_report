# 스마트 리포트 허브 (Smart Report Hub)

주간·월간 업무보고를 HWP에서 웹으로 전환하는 파일럿 시스템입니다.

## 폴더 구조

```
icak_weekly_monthly_ai_report/
├── backend/          ← FastAPI + SQLAlchemy + SQLite
└── frontend/         ← Next.js 15 + Tailwind CSS + @hello-pangea/dnd
```

---

## 🚀 실행 방법

### 1. 백엔드

```powershell
# backend 폴더 이동 후 venv 생성 및 활성화
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1

# 패키지 설치
pip install -r requirements.txt

# 초기 데이터 시딩 (최초 1회)
python seed.py

# 서버 기동 (http://localhost:8000)
uvicorn main:app --reload --port 8000
```

> FastAPI 자동 문서: http://localhost:8000/docs

### 2. 프론트엔드

```powershell
# frontend 폴더에서
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 📐 주요 기능

| 기능 | 위치 |
|------|------|
| 부서 선택 | `/` (홈) |
| 부서 에디터 (2단 DnD) | `/editor/{reportId}/{deptId}` |
| 관리자 대시보드 | `/admin` |
| API 문서 | `http://localhost:8000/docs` |

### 에디터 단축키
| 키 | 동작 |
|----|------|
| `Tab` | 하위 단계로 (ㅁ → ㅇ → -) |
| `Shift+Tab` | 상위 단계로 |
| 드래그 | 순서 변경, 컬럼 간 이동 |

---

## 🔌 AI 연동 확장

`backend/routers/ai.py`의 `summarize` 함수 내부에 LLM 호출 코드를 추가하면 됩니다.

```python
# 예시: Gemini API 연동
response = await gemini_client.generate_content(payload.text)
return AIResponse(summary=response.text)
```