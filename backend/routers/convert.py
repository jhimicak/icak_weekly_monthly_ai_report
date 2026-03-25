import asyncio
import os
import tempfile
import uuid
import shutil
import subprocess

from fastapi import APIRouter, File, HTTPException, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
from pypdf import PdfReader, PdfWriter

router = APIRouter(prefix="/api/convert", tags=["convert"])

def cleanup_temp_dir(dir_path: str):
    """임시 작업 디렉토리 삭제 유틸리티 (BackgroundTasks 연동용)"""
    try:
        if os.path.exists(dir_path):
            shutil.rmtree(dir_path, ignore_errors=True)
    except Exception as e:
        print(f"[Cleanup Error] {e}")


@router.post("/hwp2pdf")
async def convert_hwp_to_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    HWP/HWPX 파일을 LibreOffice를 사용해 PDF로 변환하고
    첫 페이지만 추출하여 반환합니다. 
    (Docker 기반 컨테이너 환경 배포 필수)
    """
    filename = file.filename or "uploaded.hwp"
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in [".hwp", ".hwpx", ".doc", ".docx"]:
        raise HTTPException(status_code=400, detail="지원되지 않는 파일 형식입니다. (HWP, HWPX 권장)")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일은 변환할 수 없습니다.")

    # 안정적인 변환을 위해 고유한 임시 작업 디렉토리 생성
    work_dir = tempfile.mkdtemp(prefix="hwp_convert_")
    
    # 응답 완료 후 임시 디렉토리를 찌꺼기 없이 삭제하도록 백그라운드 태스크 등록
    background_tasks.add_task(cleanup_temp_dir, work_dir)

    try:
        # 1. 입력 파일 쓰기
        input_filename = f"input_{uuid.uuid4().hex[:8]}{ext}"
        input_path = os.path.join(work_dir, input_filename)
        
        with open(input_path, "wb") as f:
            f.write(content)

        # 2. LibreOffice headless 변환 실행
        # 각 변환마다 고유한 UserInstallation 경로를 지정하여 프로필 락 충돌 방지
        profile_dir = os.path.join(work_dir, "lo_profile")
        
        command = [
            "soffice",
            f"-env:UserInstallation=file://{profile_dir}",
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--convert-to", "pdf",
            "--outdir", work_dir,
            input_path
        ]

        # 환경변수 HOME을 임시 디렉토리로 설정하여 쓰기 권한 오류 방지
        env = os.environ.copy()
        env["HOME"] = work_dir

        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env
        )

        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60.0)
        except asyncio.TimeoutError:
            process.kill()
            await process.communicate()
            raise HTTPException(status_code=504, detail="LibreOffice 변환 시간 초과 (60초)")

        if process.returncode != 0:
            err_msg = stderr.decode('utf-8', errors='ignore').strip()
            out_msg = stdout.decode('utf-8', errors='ignore').strip()
            print(f"[LibreOffice Error] return_code: {process.returncode}\nSTDOUT: {out_msg}\nSTDERR: {err_msg}")
            
            # 파일 로드 실패인 경우 상세 메시지 
            if "source file could not be loaded" in err_msg.lower() or "source file could not be loaded" in out_msg.lower():
                raise HTTPException(
                    status_code=500, 
                    detail=f"PDF 변환 실패: LibreOffice가 파일을 읽을 수 없습니다. (Docker 환경인지 확인하세요) 상세: {err_msg}"
                )
            
            raise HTTPException(status_code=500, detail=f"PDF 변환 실패 ({process.returncode}): {err_msg or out_msg}")

        # 3. 변환된 PDF 결과물 확인
        output_filename = os.path.splitext(input_filename)[0] + ".pdf"
        output_path = os.path.join(work_dir, output_filename)

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="PDF 변환 후 파일을 찾을 수 없습니다. (Crash 발생 가능성)")

        # 4. 첫 페이지만 추출 (빈 페이지 방지)
        final_pdf_path = os.path.join(work_dir, f"final_{uuid.uuid4().hex[:8]}.pdf")
        
        reader = PdfReader(output_path)
        writer = PdfWriter()
        
        if len(reader.pages) > 0:
            writer.add_page(reader.pages[0])
            with open(final_pdf_path, "wb") as out_f:
                writer.write(out_f)
        else:
            raise HTTPException(status_code=500, detail="생성된 PDF가 비어있습니다.")

        # 원래 파일명을 바탕으로 전송될 파일명 생성
        pdf_filename = os.path.splitext(filename)[0] + ".pdf"

        return FileResponse(
            path=final_pdf_path,
            media_type="application/pdf",
            filename=pdf_filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Conversion Error] {e}")
        raise HTTPException(status_code=500, detail="변환 중 알 수 없는 서버 오류가 발생했습니다.")
