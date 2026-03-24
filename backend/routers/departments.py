from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Department
from schemas import DepartmentCreate, DepartmentRead

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentRead])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.id).all()


@router.post("", response_model=DepartmentRead, status_code=201)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    if db.query(Department).filter_by(name=payload.name).first():
        raise HTTPException(400, detail="이미 존재하는 부서명입니다.")
    dept = Department(name=payload.name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DepartmentRead)
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, detail="부서를 찾을 수 없습니다.")
    return dept


@router.delete("/{dept_id}", status_code=204)
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(404, detail="부서를 찾을 수 없습니다.")
    db.delete(dept)
    db.commit()
