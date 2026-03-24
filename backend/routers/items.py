from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Report, ReportItem, Category
from schemas import (
    ReportItemCreate, ReportItemUpdate, ReportItemRead, ReorderPayload
)

router = APIRouter(tags=["items"])


def _get_report_or_404(report_id: int, db: Session) -> Report:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, detail="보고서를 찾을 수 없습니다.")
    return report


# ── 항목 조회 ─────────────────────────────────────────────────────────────────

@router.get("/api/reports/{report_id}/items", response_model=list[ReportItemRead])
def list_items(
    report_id: int,
    dept_id: int | None = None,
    category: Category | None = None,
    db: Session = Depends(get_db),
):
    _get_report_or_404(report_id, db)
    q = db.query(ReportItem).filter(ReportItem.report_id == report_id)
    if dept_id is not None:
        q = q.filter(ReportItem.dept_id == dept_id)
    if category is not None:
        q = q.filter(ReportItem.category == category)
    return q.order_by(ReportItem.display_order).all()


# ── 항목 생성 ─────────────────────────────────────────────────────────────────

@router.post(
    "/api/reports/{report_id}/items",
    response_model=ReportItemRead,
    status_code=201,
)
def create_item(
    report_id: int,
    payload: ReportItemCreate,
    db: Session = Depends(get_db),
):
    _get_report_or_404(report_id, db)
    # display_order 자동 결정 (해당 report+dept+category 내 마지막+1)
    max_order = (
        db.query(ReportItem)
        .filter_by(report_id=report_id, dept_id=payload.dept_id, category=payload.category)
        .count()
    )
    item = ReportItem(
        report_id=report_id,
        **payload.model_dump(exclude={"display_order"}),
        display_order=max_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ── 항목 수정 ─────────────────────────────────────────────────────────────────

@router.put("/api/items/{item_id}", response_model=ReportItemRead)
def update_item(
    item_id: int,
    payload: ReportItemUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(ReportItem, item_id)
    if not item:
        raise HTTPException(404, detail="항목을 찾을 수 없습니다.")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


# ── 항목 삭제 ─────────────────────────────────────────────────────────────────

@router.delete("/api/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ReportItem, item_id)
    if not item:
        raise HTTPException(404, detail="항목을 찾을 수 없습니다.")
    db.delete(item)
    db.commit()


# ── 부서 리포트 전체 삭제 (초기화) ──────────────────────────────────────────

@router.delete("/api/reports/{report_id}/items/{dept_id}", status_code=204)
def delete_department_items(report_id: int, dept_id: int, db: Session = Depends(get_db)):
    from models import DeptStatus, SubmitStatus

    _get_report_or_404(report_id, db)

    # 1. 해당 부서의 모든 항목 삭제 (synchronize_session=False 로 세션 충돌 방지)
    db.query(ReportItem).filter(
        ReportItem.report_id == report_id,
        ReportItem.dept_id == dept_id,
    ).delete(synchronize_session=False)

    # 2. 상태를 draft으로 롤백
    status = db.query(DeptStatus).filter(
        DeptStatus.report_id == report_id,
        DeptStatus.dept_id == dept_id,
    ).first()
    if status:
        status.status = SubmitStatus.draft

    db.commit()


# ── 순서 일괄 업데이트 (드래그 앤 드롭 후) ──────────────────────────────────────

@router.post("/api/items/reorder", status_code=200)
def reorder_items(payload: ReorderPayload, db: Session = Depends(get_db)):
    """
    페이로드 예시:
    {"items": [{"id": 3, "display_order": 0, "category": "achievement"}, ...]}
    """
    for entry in payload.items:
        item = db.get(ReportItem, entry["id"])
        if item:
            item.display_order = entry["display_order"]
            if "category" in entry:
                item.category = Category(entry["category"])
    db.commit()
    return {"ok": True}


# ── 자동 이월 (Rollover) ─────────────────────────────────────────────────────────

@router.post(
    "/api/reports/{report_id}/rollover/{dept_id}",
    response_model=list[ReportItemRead],
)
def rollover(report_id: int, dept_id: int, db: Session = Depends(get_db)):
    """
    이전 보고서의 [추진 계획] 항목을 현재 보고서의 [추진 실적]으로 복사한다.
    - '이전 보고서' = 현재 보고서보다 start_date가 가장 가까운 이전 보고서 (같은 type)
    """
    current = _get_report_or_404(report_id, db)

    # 이전 보고서 탐색
    prev_report: Report | None = (
        db.query(Report)
        .filter(
            Report.type == current.type,
            Report.start_date < current.start_date,
        )
        .order_by(Report.start_date.desc())
        .first()
    )
    if not prev_report:
        raise HTTPException(404, detail="이전 보고서가 없습니다.")

    # 이전 계획 항목 조회
    prev_plans = (
        db.query(ReportItem)
        .filter_by(report_id=prev_report.id, dept_id=dept_id, category=Category.plan)
        .order_by(ReportItem.display_order)
        .all()
    )
    if not prev_plans:
        raise HTTPException(404, detail="이전 보고서에 계획 항목이 없습니다.")

    # 현재 실적 항목의 마지막 순서 파악
    current_max = (
        db.query(ReportItem)
        .filter_by(report_id=report_id, dept_id=dept_id, category=Category.achievement)
        .count()
    )

    # 복사 생성
    new_items = []
    for i, src in enumerate(prev_plans):
        new_item = ReportItem(
            report_id=report_id,
            dept_id=dept_id,
            category=Category.achievement,
            level=src.level,
            content=src.content,
            display_order=current_max + i,
        )
        db.add(new_item)
        new_items.append(new_item)

    db.commit()
    for item in new_items:
        db.refresh(item)
    return new_items


# ── 관리자: 전체 취합 ──────────────────────────────────────────────────────────

@router.get("/api/reports/{report_id}/aggregate", response_model=dict)
def aggregate_report(report_id: int, db: Session = Depends(get_db)):
    """
    제출된 모든 부서의 항목을 부서 순서대로 취합하여 반환.
    반환 구조: { "report": {...}, "sections": [ {"dept": {...}, "items": [...]} ] }
    """
    from models import DeptStatus, SubmitStatus, Department

    report = _get_report_or_404(report_id, db)

    # 제출 완료된 부서만
    submitted = (
        db.query(DeptStatus)
        .filter_by(report_id=report_id, status=SubmitStatus.submitted)
        .all()
    )
    submitted_dept_ids = {ds.dept_id for ds in submitted}

    sections = []
    depts = (
        db.query(Department)
        .filter(Department.id.in_(submitted_dept_ids))
        .order_by(Department.id)
        .all()
    )
    for dept in depts:
        # 해당 부서의 상태(제출 방식 등) 조회
        dept_status = next((ds for ds in submitted if ds.dept_id == dept.id), None)
        
        items = (
            db.query(ReportItem)
            .filter_by(report_id=report_id, dept_id=dept.id)
            .order_by(ReportItem.category, ReportItem.display_order)
            .all()
        )
        sections.append({
            "dept": {
                "id": dept.id, 
                "name": dept.name,
                "submission_type": dept_status.submission_type if dept_status else "direct",
                "file_url": dept_status.file_url if dept_status else None,
            },
            "items": [
                {
                    "id": item.id,
                    "category": item.category.value,
                    "level": item.level,
                    "content": item.content,
                    "display_order": item.display_order,
                }
                for item in items
            ],
        })

    return {
        "report": {
            "id": report.id,
            "title": report.title,
            "start_date": str(report.start_date),
            "end_date": str(report.end_date),
            "type": report.type.value,
        },
        "sections": sections,
    }
