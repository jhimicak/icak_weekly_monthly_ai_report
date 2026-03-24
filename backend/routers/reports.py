from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Report, Department, DeptStatus, SubmitStatus
from schemas import ReportCreate, ReportRead, DeptStatusRead, SubmitPayload

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _ensure_dept_statuses(report: Report, db: Session):
    """보고서 생성 시 모든 부서에 대해 draft 상태 레코드를 생성한다."""
    existing_ids = {ds.dept_id for ds in report.dept_statuses}
    depts = db.query(Department).all()
    for dept in depts:
        if dept.id not in existing_ids:
            db.add(DeptStatus(report_id=report.id, dept_id=dept.id))
    db.commit()
    db.refresh(report)


@router.get("", response_model=list[ReportRead])
def list_reports(db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.start_date.desc()).all()


@router.post("", response_model=ReportRead, status_code=201)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    report = Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    _ensure_dept_statuses(report, db)
    return report


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, detail="보고서를 찾을 수 없습니다.")
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, detail="보고서를 찾을 수 없습니다.")
    db.delete(report)
    db.commit()


# ── 부서 제출 상태 ───────────────────────────────────────────────────────────────

@router.get("/{report_id}/statuses", response_model=list[DeptStatusRead])
def get_statuses(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, detail="보고서를 찾을 수 없습니다.")
    result = []
    for ds in report.dept_statuses:
        r = DeptStatusRead.model_validate(ds)
        r.dept_name = ds.department.name
        r.report_title = report.title
        result.append(r)
    return result


@router.post("/{report_id}/submit/{dept_id}", response_model=DeptStatusRead)
def submit_report(report_id: int, dept_id: int, payload: SubmitPayload = None, db: Session = Depends(get_db)):
    ds = db.query(DeptStatus).filter_by(
        report_id=report_id, dept_id=dept_id
    ).first()
    if not ds:
        raise HTTPException(404, detail="해당 부서 상태를 찾을 수 없습니다.")
    
    ds.status = SubmitStatus.submitted
    if payload:
        ds.submission_type = payload.submission_type
        ds.file_url = payload.file_url

    db.commit()
    db.refresh(ds)
    r = DeptStatusRead.model_validate(ds)
    r.dept_name = ds.department.name
    r.report_title = ds.report.title
    return r


@router.post("/{report_id}/recall/{dept_id}", response_model=DeptStatusRead)
def recall_report(report_id: int, dept_id: int, db: Session = Depends(get_db)):
    """제출 취소 (draft로 되돌리기)"""
    ds = db.query(DeptStatus).filter_by(
        report_id=report_id, dept_id=dept_id
    ).first()
    if not ds:
        raise HTTPException(404, detail="해당 부서 상태를 찾을 수 없습니다.")
    ds.status = SubmitStatus.draft
    db.commit()
    db.refresh(ds)
    r = DeptStatusRead.model_validate(ds)
    r.dept_name = ds.department.name
    r.report_title = ds.report.title
    return r
