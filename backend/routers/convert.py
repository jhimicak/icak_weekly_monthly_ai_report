import asyncio
import os
import tempfile

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/convert", tags=["convert"])

CLOUDCONVERT_API_KEY = os.environ.get("CLOUDCONVERT_API_KEY", "")
CLOUDCONVERT_BASE = "https://api.cloudconvert.com/v2"


@router.post("/hwp2pdf")
async def convert_hwp_to_pdf(file: UploadFile = File(...)):
    """
    HWP 파일을 CloudConvert API를 사용해 PDF로 변환하여 반환합니다.
    환경변수 CLOUDCONVERT_API_KEY 가 Render에 설정되어 있어야 합니다.
    """
    if not CLOUDCONVERT_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="CloudConvert API 키가 서버에 설정되어 있지 않습니다. 관리자에게 문의하세요.",
        )

    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".hwp", ".hwpx"):
        raise HTTPException(status_code=400, detail="HWP 또는 HWPX 파일만 업로드 가능합니다.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일은 변환할 수 없습니다.")

    headers = {
        "Authorization": f"Bearer {CLOUDCONVERT_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. 변환 Job 생성
        job_payload = {
            "tasks": {
                "upload-hwp": {
                    "operation": "import/upload",
                },
                "convert-to-pdf": {
                    "operation": "convert",
                    "input": "upload-hwp",
                    "output_format": "pdf",
                    "input_format": ext.lstrip("."),
                    "page_range": "1",
                },
                "export-pdf": {
                    "operation": "export/url",
                    "input": "convert-to-pdf",
                },
            }
        }
        job_resp = await client.post(
            f"{CLOUDCONVERT_BASE}/jobs",
            headers=headers,
            json=job_payload,
        )
        if job_resp.status_code != 201:
            raise HTTPException(
                status_code=502,
                detail=f"CloudConvert job 생성 실패: {job_resp.text}",
            )
        job_data = job_resp.json()["data"]
        job_id = job_data["id"]

        # 2. 업로드 Task에서 presigned URL 가져오기
        upload_task = next(
            t for t in job_data["tasks"] if t["name"] == "upload-hwp"
        )
        upload_url = upload_task["result"]["form"]["url"]
        upload_params = upload_task["result"]["form"]["parameters"]

        # 3. HWP 파일 업로드 (multipart form-data)
        upload_params["file"] = (filename, content, "application/octet-stream")
        upload_resp = await client.post(
            upload_url,
            files=upload_params,
        )
        if upload_resp.status_code not in (200, 201, 204):
            raise HTTPException(
                status_code=502,
                detail=f"CloudConvert 파일 업로드 실패: {upload_resp.text}",
            )

        # 4. Job 완료까지 폴링 (최대 90초)
        for _ in range(90):
            await asyncio.sleep(1)
            status_resp = await client.get(
                f"{CLOUDCONVERT_BASE}/jobs/{job_id}",
                headers=headers,
            )
            status_data = status_resp.json()["data"]
            job_status = status_data["status"]

            if job_status == "finished":
                break
            elif job_status == "error":
                task_errors = [
                    t.get("message", "")
                    for t in status_data.get("tasks", [])
                    if t.get("status") == "error"
                ]
                raise HTTPException(
                    status_code=500,
                    detail=f"CloudConvert 변환 오류: {' / '.join(task_errors)}",
                )
        else:
            raise HTTPException(status_code=504, detail="CloudConvert 변환 시간 초과 (90초)")

        # 5. 변환된 PDF URL 추출
        export_task = next(
            t for t in status_data["tasks"] if t["name"] == "export-pdf"
        )
        pdf_url = export_task["result"]["files"][0]["url"]

        # 6. PDF 다운로드 후 클라이언트에 반환
        pdf_resp = await client.get(pdf_url)
        if pdf_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="CloudConvert PDF 다운로드 실패")

        pdf_filename = os.path.splitext(filename)[0] + ".pdf"
        output_path = os.path.join(
            tempfile.gettempdir(), f"converted_{os.urandom(8).hex()}.pdf"
        )
        with open(output_path, "wb") as f:
            f.write(pdf_resp.content)

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename=pdf_filename,
    )
