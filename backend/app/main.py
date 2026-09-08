"""main.py — Exam Seating Arrangement System (Phase 1), FastAPI backend."""
import os
import shutil
import tempfile
from typing import List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas
from .database import engine, get_db
from .solver import solve, solve_candidates, SeatSlot
from .excel_helper import parse_hall_plan_workbook, export_allocation_to_excel, list_sheet_names

# Schema is managed by Alembic migrations (see alembic/ and docker-compose.yml,
# which runs `alembic upgrade head` before starting the server). Run
# `alembic upgrade head` manually first if starting this app outside Docker.

app = FastAPI(title="Exam Seating Arrangement System", version="1.0.0")

# Auto-create tables if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# PAPERS & COURSE CODE MAPPING
# ---------------------------------------------------------------------------
@app.get("/api/papers")
def list_papers(db: Session = Depends(get_db)):
    papers = db.query(models.Paper).order_by(models.Paper.paper_name).all()
    mappings = db.query(models.CourseCodeMapping).order_by(models.CourseCodeMapping.course_code).all()
    return {
        "papers": [{"paper_id": p.paper_id, "paper_name": p.paper_name} for p in papers],
        "mappings": [
            {"course_code": m.course_code, "department": m.department, "paper_id": m.paper_id}
            for m in mappings
        ],
    }


@app.post("/api/papers/bulk-upload")
def bulk_upload_papers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accept a CSV with columns: course_code, department, paper_name.
    paper_id is auto-generated from paper_name if not supplied.
    Rows sharing the same paper_name are mapped to the same paper."""
    import csv, io, re

    try:
        raw_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(400, f"Could not read uploaded file: {e}")

    # Try several encodings
    content = None
    for enc in ("utf-8-sig", "utf-8", "cp1252", "iso-8859-1", "latin-1"):
        try:
            content = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    if content is None:
        content = raw_bytes.decode("utf-8-sig", errors="replace")

    # Detect delimiter
    sample = content[:4096]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
        delimiter = dialect.delimiter
    except Exception:
        pass

    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    try:
        header_row = next(reader)
    except StopIteration:
        raise HTTPException(400, "Empty CSV file")

    # Map column synonyms
    synonym_map = {
        "course_code": "course_code", "coursecode": "course_code", "course code": "course_code", "course": "course_code", "code": "course_code",
        "paper_name": "paper_name", "papername": "paper_name", "paper name": "paper_name", "paper": "paper_name", "subject": "paper_name", "subject_name": "paper_name", "subject name": "paper_name",
        "department": "department", "dept": "department", "dept_name": "department", "dept name": "department", "branch": "department",
        "paper_id": "paper_id", "paperid": "paper_id", "paper id": "paper_id", "subject_id": "paper_id", "subject id": "paper_id",
    }

    col_map = {}
    for idx, col in enumerate(header_row):
        if col:
            normalized = col.strip().lower().replace("-", "_").replace(" ", "_")
            matched_key = synonym_map.get(col.strip().lower()) or synonym_map.get(normalized)
            if matched_key:
                col_map[idx] = matched_key

    inv_map = set(col_map.values())
    if "course_code" not in inv_map or "paper_name" not in inv_map:
        missing = []
        if "course_code" not in inv_map:
            missing.append("course_code")
        if "paper_name" not in inv_map:
            missing.append("paper_name")
        raise HTTPException(400, f"CSV is missing required columns: {', '.join(missing)}")

    def make_paper_id(name: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().upper()).strip("_")
        if not slug:
            slug = "DEFAULT"
        return f"PAPER_{slug[:40]}"

    # Load existing records into in-memory caches to prevent duplicate PK issues when autoflush is disabled
    existing_papers = {p.paper_id: p for p in db.query(models.Paper).all()}
    existing_mappings = {m.course_code: m for m in db.query(models.CourseCodeMapping).all()}
    name_to_paper_id = {p.paper_name.strip().lower(): p.paper_id for p in existing_papers.values()}

    papers_created, papers_updated, mappings_created, mappings_updated, errors = 0, 0, 0, 0, []
    new_paper_ids_in_batch = set()
    new_mappings_in_batch = set()

    for i, row in enumerate(reader, start=2):
        if not row or not any(cell.strip() for cell in row):
            continue

        row_dict = {}
        for idx, cell in enumerate(row):
            if idx in col_map:
                row_dict[col_map[idx]] = cell.strip()

        course_code = row_dict.get("course_code", "").strip()
        paper_name = row_dict.get("paper_name", "").strip()
        department = row_dict.get("department", "").strip()
        paper_id = row_dict.get("paper_id", "").strip()

        if not course_code or not paper_name:
            errors.append(f"Row {i}: course_code and paper_name are required — skipped")
            continue

        # If paper_id was not explicitly supplied, check if paper_name matches an existing paper
        if not paper_id:
            cleaned_name = paper_name.lower()
            if cleaned_name in name_to_paper_id:
                paper_id = name_to_paper_id[cleaned_name]
            else:
                paper_id = make_paper_id(paper_name)
                name_to_paper_id[cleaned_name] = paper_id

        # Upsert paper
        if paper_id in existing_papers:
            p = existing_papers[paper_id]
            if p.paper_name != paper_name:
                p.paper_name = paper_name
                if paper_id not in new_paper_ids_in_batch:
                    papers_updated += 1
        else:
            new_p = models.Paper(paper_id=paper_id, paper_name=paper_name)
            db.add(new_p)
            existing_papers[paper_id] = new_p
            new_paper_ids_in_batch.add(paper_id)
            papers_created += 1

        # Upsert mapping
        if course_code in existing_mappings:
            m = existing_mappings[course_code]
            m.department = department
            m.paper_id = paper_id
            if course_code not in new_mappings_in_batch:
                mappings_updated += 1
        else:
            new_m = models.CourseCodeMapping(course_code=course_code, department=department, paper_id=paper_id)
            db.add(new_m)
            existing_mappings[course_code] = new_m
            new_mappings_in_batch.add(course_code)
            mappings_created += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Database error while saving papers: {e}")

    return {
        "ok": True,
        "papers_created": papers_created,
        "papers_updated": papers_updated,
        "mappings_created": mappings_created,
        "mappings_updated": mappings_updated,
        "errors": errors,
    }


@app.post("/api/papers")
def create_paper(payload: schemas.PaperCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Paper).filter_by(paper_id=payload.paper_id).first()
    if existing:
        existing.paper_name = payload.paper_name
    else:
        db.add(models.Paper(paper_id=payload.paper_id, paper_name=payload.paper_name))
    db.commit()
    return {"ok": True}



@app.post("/api/course-mapping")
def create_mapping(payload: schemas.CourseMappingCreate, db: Session = Depends(get_db)):
    paper = db.query(models.Paper).filter_by(paper_id=payload.paper_id).first()
    if not paper:
        raise HTTPException(400, f'Unknown paper_id "{payload.paper_id}" — create the paper first')
    existing = db.query(models.CourseCodeMapping).filter_by(course_code=payload.course_code).first()
    if existing:
        existing.department = payload.department or ""
        existing.paper_id = payload.paper_id
    else:
        db.add(models.CourseCodeMapping(
            course_code=payload.course_code, department=payload.department or "", paper_id=payload.paper_id,
        ))
    db.commit()
    return {"ok": True}


@app.delete("/api/course-mapping/{code}")
def delete_mapping(code: str, db: Session = Depends(get_db)):
    student_count = db.query(models.Student).filter_by(course_code=code).count()
    if student_count:
        raise HTTPException(
            409,
            f'Cannot remove mapping "{code}" — {student_count} imported student(s) are still using this course code. '
            "Delete the exam registrations that use this code first.",
        )
    db.query(models.CourseCodeMapping).filter_by(course_code=code).delete()
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# HALLS & BENCHES
# ---------------------------------------------------------------------------
def _locked_hall_ids_for_exam(db: Session, exam: models.ExamSession):
    """Halls already used by a sibling session (same date, opposite FN/AN
    session_type) — these must not be double-booked for this exam."""
    if not exam.exam_date:
        return {}  # no date set — can't determine same-day conflicts, allow all

    siblings = (
        db.query(models.ExamSession)
        .filter(
            models.ExamSession.exam_date == exam.exam_date,
            models.ExamSession.session_type != exam.session_type,
            models.ExamSession.exam_id != exam.exam_id,
        )
        .all()
    )
    if not siblings:
        return {}

    sibling_ids = [s.exam_id for s in siblings]
    sibling_by_id = {s.exam_id: s for s in siblings}

    rows = (
        db.query(models.Allocation.exam_id, models.Bench.hall_id)
        .join(models.Seat, models.Seat.seat_id == models.Allocation.seat_id)
        .join(models.Bench, models.Bench.bench_id == models.Seat.bench_id)
        .filter(models.Allocation.exam_id.in_(sibling_ids))
        .distinct()
        .all()
    )

    locked = {}  # hall_id -> reason string
    for alloc_exam_id, hall_id in rows:
        sibling = sibling_by_id[alloc_exam_id]
        locked[hall_id] = f"Already used for {sibling.session_type} session \"{sibling.exam_name}\" on {sibling.exam_date}"
    return locked


@app.get("/api/halls")
def list_halls(for_exam_id: int = None, db: Session = Depends(get_db)):
    halls = db.query(models.Hall).order_by(models.Hall.hall_name).all()

    locked = {}
    if for_exam_id is not None:
        exam = db.query(models.ExamSession).filter_by(exam_id=for_exam_id).first()
        if exam:
            locked = _locked_hall_ids_for_exam(db, exam)

    result = []
    for h in halls:
        bench_count = db.query(func.count(models.Bench.bench_id)).filter_by(hall_id=h.hall_id).scalar()
        result.append({
            "hall_id": h.hall_id, "hall_name": h.hall_name, "block": h.block,
            "rows_count": h.rows_count, "cols_count": h.cols_count, "seats_per_bench": h.seats_per_bench,
            "bench_count": bench_count, "capacity": bench_count * h.seats_per_bench,
            "locked": h.hall_id in locked, "locked_reason": locked.get(h.hall_id),
        })
    return result


@app.post("/api/halls")
def create_hall(payload: schemas.HallCreate, db: Session = Depends(get_db)):
    hall = models.Hall(
        hall_name=payload.hall_name, block=payload.block or "",
        rows_count=payload.rows_count, cols_count=payload.cols_count,
        seats_per_bench=payload.seats_per_bench or 2,
    )
    db.add(hall)
    db.flush()  # get hall.hall_id

    labels_for = {1: ["A"], 2: ["A", "B"]}
    seat_labels = labels_for.get(hall.seats_per_bench, [chr(65 + i) for i in range(hall.seats_per_bench)])

    for r in range(1, payload.rows_count + 1):
        for c in range(1, payload.cols_count + 1):
            bench = models.Bench(hall_id=hall.hall_id, row_number=r, column_number=c)
            db.add(bench)
            db.flush()
            for label in seat_labels:
                db.add(models.Seat(bench_id=bench.bench_id, seat_label=label))

    db.commit()
    return {"ok": True, "hall_id": hall.hall_id}


@app.delete("/api/halls/{hall_id}")
def delete_hall(hall_id: int, db: Session = Depends(get_db)):
    bench_ids = [b.bench_id for b in db.query(models.Bench).filter_by(hall_id=hall_id).all()]
    for bid in bench_ids:
        db.query(models.Seat).filter_by(bench_id=bid).delete()
    db.query(models.Bench).filter_by(hall_id=hall_id).delete()
    db.query(models.Hall).filter_by(hall_id=hall_id).delete()
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# EXAM SESSIONS
# ---------------------------------------------------------------------------
@app.get("/api/exams")
def list_exams(db: Session = Depends(get_db)):
    exams = db.query(models.ExamSession).order_by(models.ExamSession.exam_id.desc()).all()
    return [
        {
            "exam_id": e.exam_id, "exam_name": e.exam_name, "exam_date": e.exam_date,
            "session_type": e.session_type, "exam_time": e.exam_time,
        }
        for e in exams
    ]


@app.post("/api/exams")
def create_exam(payload: schemas.ExamCreate, db: Session = Depends(get_db)):
    exam = models.ExamSession(
        exam_name=payload.exam_name, exam_date=payload.exam_date or "",
        session_type=payload.session_type or "FN", exam_time=payload.exam_time or "",
    )
    db.add(exam)
    db.commit()
    return {"ok": True, "exam_id": exam.exam_id}


@app.put("/api/exams/{exam_id}")
def update_exam(exam_id: int, payload: schemas.ExamUpdate, db: Session = Depends(get_db)):
    exam = db.query(models.ExamSession).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(400, "Unknown exam_id")

    if payload.exam_name is not None:
        exam.exam_name = payload.exam_name
    if payload.exam_date is not None:
        exam.exam_date = payload.exam_date
    if payload.session_type is not None:
        exam.session_type = payload.session_type
    if payload.exam_time is not None:
        exam.exam_time = payload.exam_time

    db.commit()
    return {"ok": True}


@app.delete("/api/exams/{exam_id}")
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(models.ExamSession).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(400, "Unknown exam_id")

    # Manually cascade — no DB-level ON DELETE CASCADE is defined on these FKs.
    db.query(models.Allocation).filter_by(exam_id=exam_id).delete()
    db.query(models.ExamRegistration).filter_by(exam_id=exam_id).delete()
    db.query(models.ExamSession).filter_by(exam_id=exam_id).delete()
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# STUDENT IMPORT
# ---------------------------------------------------------------------------
@app.post("/api/upload/{exam_id}/inspect")
def inspect_workbook(exam_id: int, file: UploadFile = File(...)):
    """Returns the sheet names found in the uploaded workbook, without
    importing anything. A single workbook (like the real COE export) often
    bundles multiple sessions together in separate sheets (e.g. one FN sheet,
    one AN sheet) — this lets the admin pick which sheet(s) actually belong
    to this exam session before anything is imported."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        sheets = list_sheet_names(tmp_path)
    except Exception as e:
        raise HTTPException(400, f"Failed to read Excel file: {e}")
    finally:
        os.unlink(tmp_path)

    if not sheets:
        raise HTTPException(400, "No hall-plan-style sheet (with a 'Register Nos.' column) found in this file")

    return {"sheets": sheets}


@app.post("/api/upload/{exam_id}")
def upload_students(
    exam_id: int, db: Session = Depends(get_db), file: UploadFile = File(...),
    sheets: str = Form(None),
):
    exam = db.query(models.ExamSession).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(400, "Unknown exam_id")

    sheet_names = [s.strip() for s in sheets.split(",") if s.strip()] if sheets else None

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        parsed = parse_hall_plan_workbook(tmp_path, sheet_names=sheet_names)
    except Exception as e:
        raise HTTPException(400, f"Failed to read Excel file: {e}")
    finally:
        os.unlink(tmp_path)

    valid_course_codes = {m.course_code for m in db.query(models.CourseCodeMapping).all()}
    unmapped = set()
    imported = 0

    for s in parsed.students:
        if s.course_code not in valid_course_codes:
            unmapped.add(s.course_code)
            continue
        student = db.query(models.Student).filter_by(register_no=s.register_no).first()
        if not student:
            student = models.Student(
                register_no=s.register_no, name=s.name, year=s.year,
                class_name=s.class_name, course_code=s.course_code,
            )
            db.add(student)
            db.flush()
        existing_reg = db.query(models.ExamRegistration).filter_by(
            exam_id=exam_id, student_id=student.student_id
        ).first()
        if not existing_reg:
            db.add(models.ExamRegistration(exam_id=exam_id, student_id=student.student_id, status="Registered"))
            imported += 1

    db.commit()

    return {
        "ok": True, "imported": imported, "total_parsed": len(parsed.students),
        "parse_errors": parsed.errors, "unmapped_course_codes": list(unmapped),
    }


# ---------------------------------------------------------------------------
# SEATING GENERATION (CP-SAT constraint engine)
# ---------------------------------------------------------------------------
def _gather_generation_inputs(exam_id: int, hall_ids: List[int], db: Session):
    """Shared setup for generate/preview/suggest: validates the exam and
    halls, checks for FN/AN double-booking, and returns (seats,
    students_by_paper) ready for the solver."""
    exam = db.query(models.ExamSession).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(400, "Unknown exam_id")
    if not hall_ids:
        raise HTTPException(400, "Select at least one hall")

    locked = _locked_hall_ids_for_exam(db, exam)
    conflicting = [hid for hid in hall_ids if hid in locked]
    if conflicting:
        conflicting_halls = db.query(models.Hall).filter(models.Hall.hall_id.in_(conflicting)).all()
        names = ", ".join(f"{h.hall_name} ({locked[h.hall_id]})" for h in conflicting_halls)
        raise HTTPException(400, f"These halls are already booked for the other session on this date: {names}")

    registrations = (
        db.query(models.ExamRegistration, models.Student, models.CourseCodeMapping)
        .join(models.Student, models.Student.student_id == models.ExamRegistration.student_id)
        .join(models.CourseCodeMapping, models.CourseCodeMapping.course_code == models.Student.course_code)
        .filter(models.ExamRegistration.exam_id == exam_id)
        .all()
    )
    if not registrations:
        raise HTTPException(400, "No registered students with valid paper mapping for this exam")

    benches = db.query(models.Bench).filter(models.Bench.hall_id.in_(hall_ids)).all()
    seats: List[SeatSlot] = []
    for b in benches:
        for seat in db.query(models.Seat).filter_by(bench_id=b.bench_id).all():
            seats.append(SeatSlot(
                seat_id=seat.seat_id, bench_id=b.bench_id, hall_id=b.hall_id,
                row_number=b.row_number, column_number=b.column_number, seat_label=seat.seat_label,
            ))

    students_by_paper = {}
    for reg, student, mapping in registrations:
        students_by_paper.setdefault(mapping.paper_id, []).append({
            "registration_id": reg.registration_id, "register_no": student.register_no,
        })

    return seats, students_by_paper


@app.get("/api/suggest-adjacency/{exam_id}")
def suggest_adjacency(exam_id: int, hall_ids: str, db: Session = Depends(get_db)):
    """Auto-suggests the strictest adjacency mode that's likely still
    feasible, based on how concentrated the largest paper is relative to
    selected hall capacity. This is a recommendation only — the admin
    chooses the actual mode on the Generate page, same as always."""
    hall_id_list = [int(h) for h in hall_ids.split(",") if h.strip()]
    seats, students_by_paper = _gather_generation_inputs(exam_id, hall_id_list, db)

    total_seats = len(seats)
    total_students = sum(len(v) for v in students_by_paper.values())
    largest_paper_count = max((len(v) for v in students_by_paper.values()), default=0)
    largest_paper_pct = (largest_paper_count / total_seats * 100) if total_seats else 0

    # These thresholds come from empirical testing of this solver on
    # 2-per-bench, left/right + front/back adjacency: above roughly 45% a
    # single paper generally can't be packed under full_grid, and above
    # roughly 60% even left_right becomes tight.
    if largest_paper_pct <= 30:
        suggestion = "full_grid"
        reason = f"The largest paper is only {largest_paper_pct:.0f}% of selected capacity — there's enough room for the strictest anti-cheating rule."
    elif largest_paper_pct <= 45:
        suggestion = "left_right"
        reason = f"The largest paper is {largest_paper_pct:.0f}% of selected capacity — front/back strictness (full_grid) may not fit; left/right is a safer default."
    else:
        suggestion = "bench_only"
        reason = f"The largest paper is {largest_paper_pct:.0f}% of selected capacity — this is tight. Bench-only is recommended, or add more halls/benches."

    return {
        "suggested_adjacency_mode": suggestion, "reason": reason,
        "total_seats": total_seats, "total_students": total_students,
        "largest_paper_percent": round(largest_paper_pct, 1),
    }


@app.post("/api/generate-preview/{exam_id}")
def generate_preview(exam_id: int, payload: schemas.GenerateRequest, db: Session = Depends(get_db)):
    """Returns 1–2 distinct valid candidate arrangements WITHOUT saving
    anything, so the admin can compare and pick one via /generate-confirm."""
    seats, students_by_paper = _gather_generation_inputs(exam_id, payload.hall_ids, db)

    adjacency_mode = payload.adjacency_mode or "left_right"
    if adjacency_mode not in ("bench_only", "left_right", "full_grid"):
        raise HTTPException(400, 'adjacency_mode must be one of "bench_only", "left_right", "full_grid"')

    status, candidates, message = solve_candidates(seats, students_by_paper, adjacency_mode=adjacency_mode, num_candidates=2)

    if status != "OK":
        total_students = sum(len(v) for v in students_by_paper.values())
        total_seats = len(seats)
        if total_students > total_seats:
            error_msg = (
                f"Not enough seats: {total_students} students registered but only "
                f"{total_seats} seats available across the selected halls. "
                f"Please select more halls or reduce the number of registered students."
            )
        else:
            error_msg = (
                "Constraint conflict: could not seat all students without violating "
                "the same-paper adjacency rule. Try selecting more halls or loosening "
                "the adjacency setting."
            )
        raise HTTPException(409, detail={
            "error": error_msg,
            "hint": message,
        })


    hall_names = {h.hall_id: h.hall_name for h in db.query(models.Hall).filter(models.Hall.hall_id.in_(payload.hall_ids)).all()}

    response_candidates = []
    for idx, c in enumerate(candidates):
        response_candidates.append({
            "candidate_id": idx,
            "packed": c["packed"],
            "students_seated": len(c["assignments"]),
            "total_seats": len(seats),
            "seated_per_hall": {hall_names.get(hid, hid): count for hid, count in c["seated_per_hall"].items()},
            "freed_halls": [hall_names.get(hid, hid) for hid in c["freed_halls"]],
            # seat_id + registration_id pairs — enough for the client to send
            # back verbatim to /generate-confirm without the server needing
            # to hold any session state in between.
            "assignments": [
                {"seat_id": seat.seat_id, "registration_id": student["registration_id"]}
                for seat, student, _paper in c["assignments"]
            ],
        })

    return {"ok": True, "note": message if message != "OK" else None, "candidates": response_candidates}


@app.post("/api/generate-confirm/{exam_id}")
def generate_confirm(exam_id: int, payload: dict, db: Session = Depends(get_db)):
    """Commits a candidate arrangement returned by /generate-preview.
    Expects: { "assignments": [{"seat_id": ..., "registration_id": ...}, ...] }"""
    exam = db.query(models.ExamSession).filter_by(exam_id=exam_id).first()
    if not exam:
        raise HTTPException(400, "Unknown exam_id")

    assignments = payload.get("assignments")
    if not assignments:
        raise HTTPException(400, "No assignments provided")

    db.query(models.Allocation).filter_by(exam_id=exam_id).delete()
    for a in assignments:
        db.add(models.Allocation(
            exam_id=exam_id, registration_id=a["registration_id"], seat_id=a["seat_id"], status="Allocated",
        ))
    db.commit()

    return {"ok": True, "students_seated": len(assignments)}


@app.post("/api/generate/{exam_id}")
def generate_seating(exam_id: int, payload: schemas.GenerateRequest, db: Session = Depends(get_db)):
    seats, students_by_paper = _gather_generation_inputs(exam_id, payload.hall_ids, db)

    adjacency_mode = payload.adjacency_mode or "left_right"
    if adjacency_mode not in ("bench_only", "left_right", "full_grid"):
        raise HTTPException(400, 'adjacency_mode must be one of "bench_only", "left_right", "full_grid"')

    status, assignments, message, freed_halls = solve(seats, students_by_paper, adjacency_mode=adjacency_mode)

    if status not in ("OPTIMAL", "FEASIBLE"):
        total_students = sum(len(v) for v in students_by_paper.values())
        total_seats = len(seats)
        if total_students > total_seats:
            error_msg = (
                f"Not enough seats: {total_students} students registered but only "
                f"{total_seats} seats available across the selected halls. "
                f"Please select more halls or reduce the number of registered students."
            )
        else:
            error_msg = (
                "Constraint conflict: could not seat all students without violating "
                "the same-paper adjacency rule. Try selecting more halls or loosening "
                "the adjacency setting (e.g. switch from 'Bench + all neighbours' to "
                "'Bench + left/right neighbour', or 'Bench only')."
            )
        raise HTTPException(409, detail={
            "error": error_msg,
            "solverStatus": status, "hint": message,
        })


    db.query(models.Allocation).filter_by(exam_id=exam_id).delete()
    for seat, student, paper_id in assignments:
        db.add(models.Allocation(
            exam_id=exam_id, registration_id=student["registration_id"], seat_id=seat.seat_id, status="Allocated",
        ))
    db.commit()

    freed_hall_names = []
    if freed_halls:
        halls_lookup = {h.hall_id: h.hall_name for h in db.query(models.Hall).filter(models.Hall.hall_id.in_(freed_halls)).all()}
        freed_hall_names = [halls_lookup[hid] for hid in freed_halls if hid in halls_lookup]

    return {
        "ok": True, "total_seats": len(seats), "students_seated": len(assignments),
        "solver_status": status, "freed_halls": freed_hall_names,
    }


# ---------------------------------------------------------------------------
# ALLOCATION RESULTS / SEAT MAP
# ---------------------------------------------------------------------------
@app.get("/api/allocation/{exam_id}")
def get_allocation(exam_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.Allocation, models.Seat, models.Bench, models.Hall,
                 models.ExamRegistration, models.Student, models.CourseCodeMapping)
        .join(models.Seat, models.Seat.seat_id == models.Allocation.seat_id)
        .join(models.Bench, models.Bench.bench_id == models.Seat.bench_id)
        .join(models.Hall, models.Hall.hall_id == models.Bench.hall_id)
        .join(models.ExamRegistration, models.ExamRegistration.registration_id == models.Allocation.registration_id)
        .join(models.Student, models.Student.student_id == models.ExamRegistration.student_id)
        .outerjoin(models.CourseCodeMapping, models.CourseCodeMapping.course_code == models.Student.course_code)
        .filter(models.Allocation.exam_id == exam_id)
        .all()
    )
    return [
        {
            "hall_id": hall.hall_id, "hall_name": hall.hall_name,
            "row_number": bench.row_number, "column_number": bench.column_number, "seat_label": seat.seat_label,
            "register_no": student.register_no, "class_name": student.class_name,
            "course_code": student.course_code, "paper_id": mapping.paper_id if mapping else None,
        }
        for _alloc, seat, bench, hall, _reg, student, mapping in rows
    ]


@app.get("/api/seat-lookup/{exam_id}/{register_no}")
def seat_lookup(exam_id: int, register_no: str, db: Session = Depends(get_db)):
    row = (
        db.query(models.Allocation, models.Seat, models.Bench, models.Hall, models.Student)
        .join(models.Seat, models.Seat.seat_id == models.Allocation.seat_id)
        .join(models.Bench, models.Bench.bench_id == models.Seat.bench_id)
        .join(models.Hall, models.Hall.hall_id == models.Bench.hall_id)
        .join(models.ExamRegistration, models.ExamRegistration.registration_id == models.Allocation.registration_id)
        .join(models.Student, models.Student.student_id == models.ExamRegistration.student_id)
        .filter(models.Allocation.exam_id == exam_id, models.Student.register_no == register_no)
        .first()
    )
    if not row:
        raise HTTPException(404, "No seat found for this register number in this exam")
    _alloc, seat, bench, hall, student = row
    return {
        "hall_name": hall.hall_name, "block": hall.block, "row_number": bench.row_number,
        "column_number": bench.column_number, "seat_label": seat.seat_label,
        "register_no": student.register_no, "name": student.name,
        "class_name": student.class_name, "course_code": student.course_code,
    }


# ---------------------------------------------------------------------------
# EXPORT
# ---------------------------------------------------------------------------
@app.get("/api/export/{exam_id}")
def export_excel(exam_id: int, db: Session = Depends(get_db)):
    rows = get_allocation(exam_id, db)
    if not rows:
        raise HTTPException(404, "No allocation found for this exam")

    out_path = os.path.join(EXPORT_DIR, f"seating_exam_{exam_id}.xlsx")
    export_allocation_to_excel(rows, out_path)
    return FileResponse(out_path, filename=f"seating_plan_exam_{exam_id}.xlsx")


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built React frontend (mounted last so /api/* routes above take
# priority). In Docker, the multi-stage build produces this at ../frontend_dist.
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend_dist")
if os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")