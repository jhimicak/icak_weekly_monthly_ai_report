# 🚀 Smart Report Hub (스마트 리포트 허브)

**업무보고의 디지털 전환: HWP 기반 행정 업무를 웹 기반 협업 및 AI 분석 체계로 혁신합니다.**

Smart Report Hub는 공공기관, 협회 등에서 관행적으로 이루어지는 HWP(한글) 기반의 주간/월간 업무보고 프로세스를 웹으로 전환하고, 생성형 AI(Groq Llama 3)를 통해 부서별 실적과 계획을 자동으로 요약하여 고품질의 PDF 보고서를 생성해주는 차세대 리포팅 솔루션입니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 지능형 AI 총괄 요약
- **Groq Llama-3-70b 연동**: 수십 개 부서의 방대한 추진 실적과 계획을 단 몇 초 만에 고도로 정제된 요약본으로 생성합니다.
- **데이터 영속성 (Persistence)**: 생성된 AI 요약은 DB에 안전하게 저장되어 토큰 낭비를 방지하고, 필요시에만 재생성할 수 있습니다.
- **가로형 2단 레이아웃**: 많은 정보를 한눈에 볼 수 있도록 최적화된 Landscape A4 2단 컬럼 디자인을 제공합니다.

### 2. 강력한 PDF 통합 엔진
- **가로형(Landscape) 최적화**: 보고서 표지, AI 요약, 부서별 실적표를 모두 가로형 A4 규격에 맞춰 전문적인 디자인으로 출력합니다.
- **멀티 포맷 병합**: 웹에서 직접 작성한 데이터뿐만 아니라, 부서에서 개별 제출한 PDF/HWP(변환본) 파일들을 하나의 통합 보고서 파일로 병합합니다.
- **HWP 자동 변환**: CloudConvert API를 연동하여 업로드된 HWP 파일을 즉시 PDF로 변환 및 통합 프로세스에 편입시킵니다.

### 3. 유연한 업무보조 에디터
- **드래그 앤 드롭 (DnD)**: 항목 간 순서 변경 및 실적/계획 간 이동을 직관적인 드래그로 처리합니다.
- **레벨 기반 자동 기호**: `Tab` / `Shift+Tab`을 통해 하위/상위 레벨을 조정하며, 레벨에 맞춰 기호(ㅁ, ㅇ, -)가 자동 변경됩니다.
- **컨텍스트 기능**: 항목 복제(Ctrl+Drag 또는 우클릭) 기능을 통해 반복적인 업무 작성을 획기적으로 단축합니다.

### 4. 관리자 대시보드
- **실시간 제출 현황**: 부서별 제출 여부를 신호등 형태(제출/미제출)로 모니터링합니다.
- **보고서 라이프사이클 관리**: 주간/월간 보고서 생성, 기간 설정, 데이터 롤오버(지난 계획 불러오기)를 지원합니다.

---

## 🛠 기술 스택 (Tech Stack)

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Interactions**: @hello-pangea/dnd (Drag & Drop)
- **PDF Generation**: jspdf, html2canvas, pdf-lib

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **ORM/DB**: SQLAlchemy, SQLite (Local) / PostgreSQL (Production)
- **AI Engine**: Groq SDK (Llama-3-70b-8192)
- **File Conversion**: CloudConvert API

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 설정 (.env)

`backend/.env` 파일을 생성하고 다음 정보를 입력합니다:
```env
DATABASE_URL=sqlite:///./report.db  # 또는 PostgreSQL URL
GROQ_API_KEY=your_groq_api_key
CLOUDCONVERT_API_KEY=your_cloudconvert_api_key
```

### 2. 백엔드 실행
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py            # 초기 부서 데이터 생성
uvicorn main:app --reload
```

### 3. 프론트엔드 실행
```bash
cd frontend
npm install
npm run dev
```
접속 주소: [http://localhost:3000](http://localhost:3000)

---

## 📐 프로젝트 구조
```text
icak_weekly_monthly_ai_report/
├── backend/
│   ├── routers/          # API 엔드포인트 분리 (ai, reports, items 등)
│   ├── models.py         # SQLAlchemy DB 모델
│   └── main.py           # FastAPI 진입점 및 자동 마이그레이션
└── frontend/
    ├── src/app/          # Next.js App Router (Home, Admin, Editor)
    ├── src/components/   # 재사용 가능한 UI 컴포넌트
    └── src/lib/          # API 클라이언트 및 PDF 빌더 유틸리티
```

---

## 📄 라이선스 (License)
본 프로젝트는 [MIT License](LICENSE)를 따릅니다.