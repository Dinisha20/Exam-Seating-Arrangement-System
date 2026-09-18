"""models.py — SQLAlchemy ORM models.

Mirrors the project's ER diagram (Phase 1 subset): PAPER, COURSE_CODE_MAPPING,
HALL, BENCH, SEAT, STUDENT, EXAM_SESSION, EXAM_REGISTRATION, ALLOCATION.
"""
from sqlalchemy import (
    Column, Integer, String, Date, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from .database import Base


class Paper(Base):
    __tablename__ = "paper"

    paper_id = Column(String, primary_key=True)
    paper_name = Column(String, nullable=False)

    mappings = relationship("CourseCodeMapping", back_populates="paper")


class CourseCodeMapping(Base):
    __tablename__ = "course_code_mapping"

    course_code = Column(String, primary_key=True)
    department = Column(String, default="")
    paper_id = Column(String, ForeignKey("paper.paper_id"), nullable=False)

    paper = relationship("Paper", back_populates="mappings")


class Hall(Base):
    __tablename__ = "hall"

    hall_id = Column(Integer, primary_key=True, autoincrement=True)
    hall_name = Column(String, nullable=False)
    block = Column(String, default="")
    rows_count = Column(Integer, nullable=False, default=1)
    cols_count = Column(Integer, nullable=False, default=1)
    seats_per_bench = Column(Integer, nullable=False, default=2)

    benches = relationship("Bench", back_populates="hall", cascade="all, delete-orphan")


class Bench(Base):
    __tablename__ = "bench"

    bench_id = Column(Integer, primary_key=True, autoincrement=True)
    hall_id = Column(Integer, ForeignKey("hall.hall_id"), nullable=False)
    row_number = Column(Integer, nullable=False)
    column_number = Column(Integer, nullable=False)

    hall = relationship("Hall", back_populates="benches")
    seats = relationship("Seat", back_populates="bench", cascade="all, delete-orphan")


class Seat(Base):
    __tablename__ = "seat"

    seat_id = Column(Integer, primary_key=True, autoincrement=True)
    bench_id = Column(Integer, ForeignKey("bench.bench_id"), nullable=False)
    seat_label = Column(String, nullable=False)  # 'A' / 'B' / ...

    bench = relationship("Bench", back_populates="seats")


class Student(Base):
    __tablename__ = "student"

    student_id = Column(Integer, primary_key=True, autoincrement=True)
    register_no = Column(String, unique=True, nullable=False)
    name = Column(String, default="")
    year = Column(String, default="")
    class_name = Column("class", String, default="")
    course_code = Column(String, ForeignKey("course_code_mapping.course_code"), nullable=False)

    course_mapping = relationship("CourseCodeMapping")


class ExamSession(Base):
    __tablename__ = "exam_session"

    exam_id = Column(Integer, primary_key=True, autoincrement=True)
    exam_name = Column(String, nullable=False)
    exam_date = Column(String, default="")  # kept as string for simplicity across sheets
    session_type = Column(String, default="FN")
    exam_time = Column(String, default="")  # e.g. "09:30 AM - 12:30 PM", set by admin


class ExamRegistration(Base):
    __tablename__ = "exam_registration"

    registration_id = Column(Integer, primary_key=True, autoincrement=True)
    exam_id = Column(Integer, ForeignKey("exam_session.exam_id"), nullable=False)
    student_id = Column(Integer, ForeignKey("student.student_id"), nullable=False)
    status = Column(String, default="Registered")

    student = relationship("Student")

    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_student"),)


class Allocation(Base):
    __tablename__ = "allocation"

    allocation_id = Column(Integer, primary_key=True, autoincrement=True)
    exam_id = Column(Integer, ForeignKey("exam_session.exam_id"), nullable=False)
    registration_id = Column(Integer, ForeignKey("exam_registration.registration_id"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seat.seat_id"), nullable=False)
    status = Column(String, default="Allocated")


class SessionPaper(Base):
    """Junction table linking papers to specific exam sessions."""
    __tablename__ = "session_paper"

    exam_id = Column(Integer, ForeignKey("exam_session.exam_id"), primary_key=True)
    paper_id = Column(String, ForeignKey("paper.paper_id"), primary_key=True)


class SessionMapping(Base):
    """Junction table linking course-code mappings to specific exam sessions."""
    __tablename__ = "session_mapping"

    exam_id = Column(Integer, ForeignKey("exam_session.exam_id"), primary_key=True)
    course_code = Column(String, ForeignKey("course_code_mapping.course_code"), primary_key=True)
