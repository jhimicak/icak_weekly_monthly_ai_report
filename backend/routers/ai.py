import os
from fastapi import APIRouter, HTTPException
from schemas import AIRequest, AIResponse, SummarizeReportRequest, SummarizeReportResponse
from groq import AsyncGroq

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/summarize-report", response_model=SummarizeReportResponse)
async def summarize_report(payload: SummarizeReportRequest) -> SummarizeReportResponse:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY 환경 변수가 설정되지 않았습니다.")
        
    client = AsyncGroq(api_key=api_key)
    
    prompt = f"""당신은 공공기관 및 협회의 전문 보고서 작성자입니다.
주어진 전체 부서별 '추진 실적'과 '추진 계획'을 읽고 다음 형식의 총괄 요약본을 Markdown으로 작성해주세요.
어조는 격식 있는 개조식(합/임/함 형태)을 사용하세요.
불필요한 인사말 없이 바로 요약 결과만 출력하세요.

### 작성 형식
**1. 전체 핵심 요약**
- (전체 내용을 3~4줄로 핵심만 요약)

**2. 부서별 주요 성과**
- **[부서명]**: (주요 액션 한눈에 요약)
- **[부서명]**: (주요 액션 한눈에 요약)

---
데이터:
{payload.report_text}
"""
    try:
        completion = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2048
        )
        return SummarizeReportResponse(summary=completion.choices[0].message.content or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요약 중 오류 발생: {str(e)}")
