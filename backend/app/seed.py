"""seed.py — optional demo data so you can see the system working immediately.
Run with: python -m app.seed  (from the backend/ directory, inside the container
or with DATABASE_URL pointed at your Postgres instance)
"""
from .database import SessionLocal, engine, Base
from . import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Clear existing demo data (idempotent re-seed)
db.query(models.Allocation).delete()
db.query(models.ExamRegistration).delete()
db.query(models.Student).delete()
db.query(models.ExamSession).delete()
db.query(models.Seat).delete()
db.query(models.Bench).delete()
db.query(models.Hall).delete()
db.query(models.CourseCodeMapping).delete()
db.query(models.Paper).delete()
db.commit()

# Papers (one shared paper written by multiple departments)
db.add_all([
    models.Paper(paper_id="PAPER_DBMS", paper_name="Database Management Systems"),
    models.Paper(paper_id="PAPER_OS", paper_name="Operating Systems"),
    models.Paper(paper_id="PAPER_MATHS", paper_name="Engineering Mathematics"),
])
db.commit()

db.add_all([
    models.CourseCodeMapping(course_code="CS301", department="CSE", paper_id="PAPER_DBMS"),
    models.CourseCodeMapping(course_code="IT305", department="IT", paper_id="PAPER_DBMS"),
    models.CourseCodeMapping(course_code="CS302", department="CSE", paper_id="PAPER_OS"),
    models.CourseCodeMapping(course_code="MA101", department="CSE", paper_id="PAPER_MATHS"),
    models.CourseCodeMapping(course_code="MA151", department="ECE", paper_id="PAPER_MATHS"),
])
db.commit()

# Halls: 3 halls, 4 rows x 5 columns, 2 seats/bench = 40 seats each = 120 total
for name, block in [("B426", "B-Workshop"), ("B427", "B-Workshop"), ("B428", "B-Workshop")]:
    hall = models.Hall(hall_name=name, block=block, rows_count=4, cols_count=5, seats_per_bench=2)
    db.add(hall)
    db.flush()
    for r in range(1, 5):
        for c in range(1, 6):
            bench = models.Bench(hall_id=hall.hall_id, row_number=r, column_number=c)
            db.add(bench)
            db.flush()
            db.add(models.Seat(bench_id=bench.bench_id, seat_label="A"))
            db.add(models.Seat(bench_id=bench.bench_id, seat_label="B"))
db.commit()

exam = models.ExamSession(exam_name="CAT-I", exam_date="2026-09-10", session_type="FN", exam_time="09:30 AM - 12:30 PM")
db.add(exam)
db.commit()


def make_students(prefix, count, class_name, course_code):
    for i in range(1, count + 1):
        reg_no = f"{prefix}{str(i).zfill(3)}"
        student = db.query(models.Student).filter_by(register_no=reg_no).first()
        if not student:
            student = models.Student(register_no=reg_no, name=f"Student {reg_no}", year="III",
                                      class_name=class_name, course_code=course_code)
            db.add(student)
            db.flush()
        db.add(models.ExamRegistration(exam_id=exam.exam_id, student_id=student.student_id, status="Registered"))


make_students("CSE21CS", 18, "CSE-A", "CS301")
make_students("IT21IT", 12, "IT-A", "IT305")
make_students("CSE21OS", 20, "CSE-B", "CS302")
make_students("CSE21MA", 15, "CSE-C", "MA101")
make_students("ECE21MA", 10, "ECE-A", "MA151")
db.commit()

print(f'Seed data inserted. Exam session "CAT-I" (id={exam.exam_id}) created with 75 registered students across 3 halls (120 seats).')
db.close()
