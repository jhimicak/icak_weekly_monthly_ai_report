from fastapi import APIRouter
from schemas import AIRequest, AIResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/summarize", response_model=AIResponse)
async def summarize(payload: AIRequest) -> AIResponse:
    """
    AI 요약 플레이스홀더.
    실제 구현 시 이 함수 내부에서 LLM API(예: Gemini, GPT)를 호출한다.

    TODO:
        1. payload.text를 LLM에 전달
        2. 요약 결과를 받아 AIResponse로 반환
        예시:
            response = await llm_client.summarize(payload.text)
            return AIResponse(summary=response.text)
    """
    # --- 플레이스홀더 응답 ---
    preview = payload.text[:80] + "..." if len(payload.text) > 80 else payload.text
    return AIResponse(
        summary=f"[AI 요약 준비중] 입력된 내용: {preview}"
    )
