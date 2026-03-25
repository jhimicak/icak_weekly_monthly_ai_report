import os
import shutil
import subprocess
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/convert", tags=["convert"])


def _libreoffice_available() -> bool:
    """LibreOffice가 설치돼 있는지 확인"""
    return shutil.which("libreoffice") is not None or shutil.which("soffice") is not None


def _get_libreoffice_cmd() -> str:
    if shutil.which("libreoffice"):
        return "libreoffice"
    if shutil.which("soffice"):
        return "soffice"
    raise RuntimeError("LibreOffice가 서버에 설치되어 있지 않습니다.")


@router.post("/hwp2pdf")
async def convert_hwp_to_pdf(file: UploadFile = File(...)):
    """
    HWP 파일을 받아 LibreOffice로 PDF로 변환하여 반환합니다.
    Render 서버에 LibreOffice가 설치되어 있어야 합니다.
    """
    # 확장자 체크 (.hwp, .hwpx 모두 허용)
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".hwp", ".hwpx"):
        raise HTTPException(status_code=400, detail="HWP 또는 HWPX 파일만 업로드 가능합니다.")

    if not _libreoffice_available():
        raise HTTPException(
            status_code=503,
            detail="서버에 LibreOffice가 설치되어 있지 않습니다. 관리자에게 문의해주세요.",
        )

    # 임시 디렉터리에 파일 저장 후 변환
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_path = os.path.join(tmp_dir, filename)

        # 업로드된 파일 저장
        with open(input_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # LibreOffice로 PDF 변환
        lo_cmd = _get_libreoffice_cmd()
        result = subprocess.run(
            [lo_cmd, "--headless", "--convert-to", "pdf", "--outdir", tmp_dir, input_path],
            capture_output=True,
            text=True,
            timeout=60,  # 최대 60초
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"PDF 변환 실패: {result.stderr or result.stdout}",
            )

        # 변환된 PDF 경로
        pdf_filename = os.path.splitext(filename)[0] + ".pdf"
        pdf_path = os.path.join(tmp_dir, pdf_filename)

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF 변환 후 파일을 찾을 수 없습니다.")

        # 변환된 PDF를 응답으로 반환하기 위해 별도 경로로 복사
        # (TemporaryDirectory가 닫히기 전에 FileResponse가 읽어야 함)
        output_path = os.path.join(tempfile.gettempdir(), f"converted_{os.urandom(8).hex()}.pdf")
        shutil.copy2(pdf_path, output_path)

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename=pdf_filename,
        background=None,
    )
