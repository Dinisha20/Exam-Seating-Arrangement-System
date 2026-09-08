"""schemas.py — Pydantic models for request/response validation."""
from typing import Optional, List
from pydantic import BaseModel


class PaperCreate(BaseModel):
    paper_id: str
    paper_name: str


class CourseMappingCreate(BaseModel):
    course_code: str
    department: Optional[str] = ""
    paper_id: str


class HallCreate(BaseModel):
    hall_name: str
    block: Optional[str] = ""
    rows_count: int
    cols_count: int
    seats_per_bench: Optional[int] = 2


class ExamCreate(BaseModel):
    exam_name: str
    exam_date: Optional[str] = ""
    session_type: Optional[str] = "FN"
    exam_time: Optional[str] = ""


class ExamUpdate(BaseModel):
    exam_name: Optional[str] = None
    exam_date: Optional[str] = None
    session_type: Optional[str] = None
    exam_time: Optional[str] = None


class GenerateRequest(BaseModel):
    hall_ids: List[int]
    adjacency_mode: Optional[str] = "left_right"