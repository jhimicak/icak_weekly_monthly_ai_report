import enum
from datetime import date
from sqlalchemy import (
    Integer, String, Text, Date, Enum, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────

class ReportType(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class Category(str, enum.Enum):
    achievement = "achievement"   # 추진 실적
    plan = "plan"                 # 추진 계획


class SubmitStatus(str, enum.Enum):
    draft = "draft"           # 작성중
    submitted = "submitted"   # 제출완료


# ── Models ─────────────────────────────────────────────────────────────────────

class Department(Base):
    """부서"""
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # Relationships
    report_items: Mapped[list["ReportItem"]] = relationship(
        back_populates="department", cascade="all, delete-orphan"
    )
    dept_statuses: Mapped[list["DeptStatus"]] = relationship(
        back_populates="department", cascade="all, delete-orphan"
    )


class Report(Base):
    """보고서 (주/월간 단위)"""
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[ReportType] = mapped_column(
        Enum(ReportType), nullable=False, default=ReportType.weekly
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    items: Mapped[list["ReportItem"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )
    dept_statuses: Mapped[list["DeptStatus"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )



class ReportItem(Base):
    """보고 항목 (블록 단위)"""
    __tablename__ = "report_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    dept_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[Category] = mapped_column(
        Enum(Category), nullable=False, default=Category.plan
    )
    level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )  # 1=ㅁ, 2=ㅇ, 3=-
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    report: Mapped["Report"] = relationship(back_populates="items")
    department: Mapped["Department"] = relationship(back_populates="report_items")


class DeptStatus(Base):
    """부서별 보고서 제출 상태"""
    __tablename__ = "dept_statuses"
    __table_args__ = (
        UniqueConstraint("report_id", "dept_id", name="uq_report_dept"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    dept_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[SubmitStatus] = mapped_column(
        Enum(SubmitStatus), nullable=False, default=SubmitStatus.draft
    )
    submission_type: Mapped[str] = mapped_column(
        String, nullable=False, default="direct"
    )
    file_url: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    # Relationships
    report: Mapped["Report"] = relationship(back_populates="dept_statuses")
    department: Mapped["Department"] = relationship(back_populates="dept_statuses")
