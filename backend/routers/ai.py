import os
import io
import httpx
from pypdf import PdfReader
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
    
    # 1. Fetch PDF text for file submissions and concatenate everything
    all_text = ""
    async with httpx.AsyncClient() as http_client:
        for sec in payload.sections:
            dept_content = ""
            if sec.file_url:
                try:
                    res = await http_client.get(sec.file_url)
                    if res.status_code == 200:
                        reader = PdfReader(io.BytesIO(res.content))
                        extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
                        dept_content = f"첨부 파일 내용:\n{extracted}"
                    else:
                        dept_content = f"(상태 코드 {res.status_code}으로 첨부 파일 다운로드 실패)"
                except Exception as e:
                    dept_content = f"(첨부 파일 읽기 실패: {str(e)})"
            else:
                dept_content = sec.text
            
            all_text += f"[{sec.dept_name}]\n{dept_content}\n\n"

    prompt = f"""당신은 공공기관 및 협회의 전문 보고서 작성자입니다.
주어진 전체 부서별 '추진 실적'과 '추진 계획'(직접 작성본 및 첨부문서 내용 포함)을 읽고 다음 형식의 총괄 요약본을 Markdown으로 작성해주세요.
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
{all_text}
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
