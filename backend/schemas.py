from datetime import date
from pydantic import BaseModel, ConfigDict
from models import ReportType, Category, SubmitStatus


# ── Department ─────────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


# ── Report ─────────────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    title: str
    start_date: date
    end_date: date
    type: ReportType = ReportType.weekly


class ReportUpdate(BaseModel):
    title: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    type: ReportType | None = None


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    start_date: date
    end_date: date
    type: ReportType
    ai_summary: str | None = None


class AiSummaryUpdate(BaseModel):
    ai_summary: str | None = None


# ── ReportItem ─────────────────────────────────────────────────────────────────

class ReportItemCreate(BaseModel):
    dept_id: int
    category: Category = Category.plan
    level: int = 1
    content: str = ""
    display_order: int = 0


class ReportItemUpdate(BaseModel):
    category: Category | None = None
    level: int | None = None
    content: str | None = None
    display_order: int | None = None


class ReportItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    dept_id: int
    category: Category
    level: int
    content: str
    display_order: int


# ── Reorder ────────────────────────────────────────────────────────────────────

class ReorderPayload(BaseModel):
    """드래그 앤 드롭 후 순서 저장 페이로드"""
    # list of {id, display_order, category} dicts
    items: list[dict]


# ── DeptStatus ─────────────────────────────────────────────────────────────────

class DeptStatusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    report_id: int
    dept_id: int
    status: SubmitStatus
    submission_type: str
    file_url: str | None = None
    dept_name: str = ""
    report_title: str = ""


class SubmitPayload(BaseModel):
    submission_type: str = "direct"
    file_url: str | None = None


# ── AI ─────────────────────────────────────────────────────────────────────────

class AIRequest(BaseModel):
    report_id: int
    dept_id: int
    text: str


class AIResponse(BaseModel):
    summary: str

class SummarizeSection(BaseModel):
    dept_name: str
    text: str = ""
    file_url: str | None = None

class SummarizeReportRequest(BaseModel):
    sections: list[SummarizeSection]

class SummarizeReportResponse(BaseModel):
    summary: str
