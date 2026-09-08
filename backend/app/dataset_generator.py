"""dataset_generator.py — Synthetic Benchmark Dataset Generator for Exam Seating.

Generates reproducible, parameterized synthetic exam datasets for experimental
evaluation, academic benchmarking, and stress-testing constraint solvers.

Features:
  1. Parameterized generation of students, halls, benches, papers, and mappings.
  2. Multiple statistical paper distribution profiles:
     - "balanced": equal distribution across all papers.
     - "zipfian": realistic university power-law (large core subjects + small electives).
     - "stress_dominant": one dominant paper near mathematical capacity bound (~40-45%).
     - "cross_department": multiple course codes mapped to shared papers.
  3. Export to:
     - In-memory data structures (ready for CP-SAT and Greedy solvers).
     - Standard JSON benchmark instances.
     - COE-compatible Excel Hall Plan workbooks (.xlsx).
     - Subject mapping CSVs for bulk import.
"""
import os
import json
import random
import argparse
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple, Optional
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

@dataclass
class SeatSlot:
    seat_id: int
    bench_id: int
    hall_id: int
    row_number: int
    column_number: int
    seat_label: str


@dataclass
class GeneratedStudent:
    register_no: str
    name: str
    department: str
    class_name: str
    course_code: str
    paper_id: str


@dataclass
class GeneratedHall:
    hall_id: int
    hall_name: str
    block: str
    rows_count: int
    cols_count: int
    seats_per_bench: int
    capacity: int


@dataclass
class BenchmarkInstance:
    instance_id: str
    seed: int
    description: str
    profile: str
    total_students: int
    total_seats: int
    utilization_rate: float
    largest_paper_ratio: float
    halls: List[GeneratedHall]
    papers: Dict[str, str]  # paper_id -> paper_name
    course_mappings: Dict[str, Dict[str, str]]  # course_code -> {dept, paper_id}
    students: List[GeneratedStudent]


class BenchmarkDatasetGenerator:
    """Configurable synthetic dataset generator for exam seating benchmarks."""

    DEPARTMENTS = ["CSE", "ECE", "MECH", "CIVIL", "IT", "EEE", "AIDS", "CSBS"]

    SAMPLE_PAPERS = [
        ("PAPER_MATH", "Engineering Mathematics"),
        ("PAPER_DBMS", "Database Management Systems"),
        ("PAPER_OS", "Operating Systems"),
        ("PAPER_AI", "Artificial Intelligence & ML"),
        ("PAPER_NETWORKS", "Computer Networks"),
        ("PAPER_PHYSICS", "Applied Physics"),
        ("PAPER_CIRCUITS", "Electric Circuits & Networks"),
        ("PAPER_STRUCTURES", "Structural Analysis"),
        ("PAPER_THERMO", "Thermodynamics"),
        ("PAPER_SIGNALS", "Signals and Systems"),
    ]

    def __init__(self, seed: Optional[int] = 42):
        self.seed = seed
        if seed is not None:
            random.seed(seed)

    def generate_instance(
        self,
        instance_id: str,
        num_students: int,
        num_halls: int = 3,
        rows_per_hall: int = 5,
        cols_per_hall: int = 5,
        seats_per_bench: int = 2,
        num_papers: int = 4,
        profile: str = "zipfian",
        cross_department: bool = True,
    ) -> BenchmarkInstance:
        """Generates a complete benchmark instance with halls, papers, mappings, and students."""
        # 1. Generate Halls
        halls: List[GeneratedHall] = []
        for hid in range(1, num_halls + 1):
            block_letter = chr(65 + (hid - 1) // 4)
            hall_num = 100 + (hid - 1) % 4 + 1
            capacity = rows_per_hall * cols_per_hall * seats_per_bench
            halls.append(GeneratedHall(
                hall_id=hid,
                hall_name=f"Hall {block_letter}-{hall_num}",
                block=f"Block {block_letter}",
                rows_count=rows_per_hall,
                cols_count=cols_per_hall,
                seats_per_bench=seats_per_bench,
                capacity=capacity,
            ))

        total_seats = sum(h.capacity for h in halls)

        # 2. Select Papers
        selected_papers = self.SAMPLE_PAPERS[:num_papers]
        papers_dict = {pid: name for pid, name in selected_papers}

        # 3. Generate Course Code Mappings (including cross-department sharing)
        course_mappings: Dict[str, Dict[str, str]] = {}
        course_codes_by_paper: Dict[str, List[str]] = {}

        for idx, (pid, pname) in enumerate(selected_papers):
            dept_primary = self.DEPARTMENTS[idx % len(self.DEPARTMENTS)]
            code_primary = f"{dept_primary}{301 + idx}"
            course_mappings[code_primary] = {"department": dept_primary, "paper_id": pid}
            course_codes_by_paper.setdefault(pid, []).append(code_primary)

            # If cross-department is enabled, add a second department sharing this paper
            if cross_department and idx < len(self.DEPARTMENTS) - 1:
                dept_secondary = self.DEPARTMENTS[(idx + 4) % len(self.DEPARTMENTS)]
                code_secondary = f"{dept_secondary}{301 + idx}"
                course_mappings[code_secondary] = {"department": dept_secondary, "paper_id": pid}
                course_codes_by_paper[pid].append(code_secondary)

        # 4. Calculate Student Distribution per Paper
        counts_per_paper = self._distribute_students(num_students, num_papers, profile)

        # 5. Generate Students
        students: List[GeneratedStudent] = []
        reg_counter = 1

        for (pid, _), count in zip(selected_papers, counts_per_paper):
            available_codes = course_codes_by_paper[pid]
            for i in range(count):
                code = available_codes[i % len(available_codes)]
                dept = course_mappings[code]["department"]
                reg_no = f"2216{2000 + hash(dept)%500:04d}{reg_counter:04d}"
                reg_counter += 1
                students.append(GeneratedStudent(
                    register_no=reg_no,
                    name=f"Student_{reg_counter}",
                    department=dept,
                    class_name=f"{dept}-III-Year",
                    course_code=code,
                    paper_id=pid,
                ))

        largest_paper = max(counts_per_paper) if counts_per_paper else 0
        largest_ratio = (largest_paper / total_seats) if total_seats > 0 else 0.0

        return BenchmarkInstance(
            instance_id=instance_id,
            seed=self.seed if self.seed is not None else 42,
            description=f"{num_students} students, {num_halls} halls ({total_seats} seats), {num_papers} papers [{profile}]",
            profile=profile,
            total_students=len(students),
            total_seats=total_seats,
            utilization_rate=round((len(students) / total_seats * 100), 1) if total_seats else 0.0,
            largest_paper_ratio=round(largest_ratio * 100, 1),
            halls=halls,
            papers=papers_dict,
            course_mappings=course_mappings,
            students=students,
        )

    def _distribute_students(self, total: int, num_papers: int, profile: str) -> List[int]:
        """Calculates student counts per paper based on statistical profile."""
        if profile == "balanced":
            base = total // num_papers
            rem = total % num_papers
            return [base + (1 if i < rem else 0) for i in range(num_papers)]

        elif profile == "zipfian":
            # Power law / Zipf: frequency proportional to 1 / rank
            weights = [1.0 / (i + 1) for i in range(num_papers)]
            sum_w = sum(weights)
            counts = [int(round(total * (w / sum_w))) for w in weights]
            # Adjust rounding differences
            diff = total - sum(counts)
            counts[0] += diff
            return counts

        elif profile == "stress_dominant":
            # One dominant paper takes ~44% of capacity, others divide the rest
            dominant = int(total * 0.44)
            remaining = total - dominant
            sub_count = num_papers - 1
            if sub_count > 0:
                sub_base = remaining // sub_count
                sub_rem = remaining % sub_count
                subs = [sub_base + (1 if i < sub_rem else 0) for i in range(sub_count)]
                return [dominant] + subs
            return [total]

        else:
            return self._distribute_students(total, num_papers, "balanced")

    @staticmethod
    def to_solver_inputs(instance: BenchmarkInstance) -> Tuple[List[SeatSlot], Dict[str, List[dict]]]:
        """Converts benchmark instance into exact SeatSlot and students_by_paper formats."""
        seats: List[SeatSlot] = []
        seat_id_seq = 1
        bench_id_seq = 1

        for h in instance.halls:
            for r in range(1, h.rows_count + 1):
                for c in range(1, h.cols_count + 1):
                    bid = bench_id_seq
                    bench_id_seq += 1
                    for s_idx in range(h.seats_per_bench):
                        seats.append(SeatSlot(
                            seat_id=seat_id_seq,
                            bench_id=bid,
                            hall_id=h.hall_id,
                            row_number=r,
                            column_number=c,
                            seat_label=chr(65 + s_idx),
                        ))
                        seat_id_seq += 1

        students_by_paper: Dict[str, List[dict]] = {}
        for idx, s in enumerate(instance.students, start=1):
            students_by_paper.setdefault(s.paper_id, []).append({
                "registration_id": idx,
                "register_no": s.register_no,
            })

        return seats, students_by_paper

    @staticmethod
    def export_coe_excel(instance: BenchmarkInstance, filepath: str):
        """Exports the benchmark instance as a valid, multi-sheet COE-format Excel file (.xlsx)."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "FN_Session"

        # Title Rows
        ws["A1"] = "CONTROLLER OF EXAMINATIONS - HALL PLAN IMPORT"
        ws["A1"].font = Font(size=14, bold=True)
        ws["A2"] = f"Benchmark Instance: {instance.instance_id} | Total Students: {instance.total_students}"
        ws["A2"].font = Font(size=11, italic=True)

        # Header Row at row 4
        headers = ["S.No", "Year", "Class", "Course Code", "Register Nos.", "Count", "Total Count"]
        ws.append([])
        ws.append([])
        ws.append(headers)

        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        # Group students by course code
        grouped: Dict[str, List[GeneratedStudent]] = {}
        for s in instance.students:
            grouped.setdefault(s.course_code, []).append(s)

        s_no = 1
        current_row = 5
        for code, stud_list in grouped.items():
            sample_student = stud_list[0]
            # Compact register numbers into range notation (e.g. 22162001001-020)
            reg_list = [s.register_no for s in stud_list]
            if len(reg_list) > 1:
                reg_cell_str = f"{reg_list[0]}-{reg_list[-1][-3:]}"
            else:
                reg_cell_str = reg_list[0]

            ws.append([
                s_no,
                "III",
                sample_student.class_name,
                code,
                reg_cell_str,
                len(stud_list),
                len(stud_list),
            ])
            s_no += 1
            current_row += 1

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        wb.save(filepath)
        return filepath

    @staticmethod
    def export_subjects_csv(instance: BenchmarkInstance, filepath: str):
        """Exports the course mapping CSV ready for bulk upload in the UI."""
        lines = ["course_code,department,paper_name,paper_id\n"]
        for code, meta in instance.course_mappings.items():
            pid = meta["paper_id"]
            pname = instance.papers.get(pid, pid)
            dept = meta["department"]
            lines.append(f"{code},{dept},{pname},{pid}\n")

        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return filepath

    @staticmethod
    def export_json(instance: BenchmarkInstance, filepath: str):
        """Exports full benchmark instance metadata as JSON."""
        os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(asdict(instance), f, indent=2)
        return filepath


def generate_standard_benchmark_suite(output_dir: str = "benchmark_datasets"):
    """Generates a standardized collection of 6 benchmark instances for research evaluation."""
    gen = BenchmarkDatasetGenerator(seed=101)
    os.makedirs(output_dir, exist_ok=True)

    suite_configs = [
        ("INST_01_SMALL_BALANCED", 60, 2, 4, 5, 3, "balanced", "Small scale with 3 balanced papers"),
        ("INST_02_MEDIUM_ZIPFIAN", 160, 3, 6, 5, 5, "zipfian", "Medium scale with realistic Zipfian paper distribution"),
        ("INST_03_STRESS_DOMINANT", 90, 2, 5, 5, 4, "stress_dominant", "Stress-test with 44% concentration in 1 dominant paper"),
        ("INST_04_MULTI_DEPT_SHARED", 200, 4, 5, 5, 4, "zipfian", "Cross-departmental paper sharing across 8 course codes"),
        ("INST_05_LARGE_SCALE", 500, 8, 7, 5, 8, "zipfian", "Large scale exam session across 8 halls"),
        ("INST_06_CAMPUS_WIDE", 1000, 15, 8, 5, 10, "zipfian", "Ultra-large campus-wide exam with 1,000 students"),
    ]

    manifest = []
    for inst_id, n_stud, n_halls, r, c, n_pap, prof, desc in suite_configs:
        inst = gen.generate_instance(
            instance_id=inst_id,
            num_students=n_stud,
            num_halls=n_halls,
            rows_per_hall=r,
            cols_per_hall=c,
            num_papers=n_pap,
            profile=prof,
            cross_department=True,
        )

        json_path = os.path.join(output_dir, f"{inst_id}.json")
        xlsx_path = os.path.join(output_dir, f"{inst_id}_hall_plan.xlsx")
        csv_path = os.path.join(output_dir, f"{inst_id}_subjects.csv")

        gen.export_json(inst, json_path)
        gen.export_coe_excel(inst, xlsx_path)
        gen.export_subjects_csv(inst, csv_path)

        manifest.append({
            "instance_id": inst_id,
            "description": desc,
            "students": inst.total_students,
            "seats": inst.total_seats,
            "halls": len(inst.halls),
            "papers": len(inst.papers),
            "utilization": f"{inst.utilization_rate}%",
            "largest_paper": f"{inst.largest_paper_ratio}%",
            "files": {
                "json": json_path,
                "excel": xlsx_path,
                "csv": csv_path,
            }
        })
        print(f"Generated: {inst_id} ({inst.total_students} students, {inst.total_seats} seats) -> {output_dir}")

    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[+] Standard Benchmark Suite generated successfully in '{output_dir}/' with manifest.json")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Synthetic Benchmark Dataset Generator for Exam Seating")
    parser.add_argument("--generate-suite", action="store_true", help="Generate the standard 6-instance benchmark suite")
    parser.add_argument("--students", type=int, default=150, help="Number of students to generate")
    parser.add_argument("--halls", type=int, default=3, help="Number of halls")
    parser.add_argument("--profile", type=str, default="zipfian", choices=["balanced", "zipfian", "stress_dominant"])
    parser.add_argument("--output-dir", type=str, default="benchmark_datasets", help="Output directory")

    args = parser.parse_args()

    if args.generate_suite:
        generate_standard_benchmark_suite(args.output_dir)
    else:
        generator = BenchmarkDatasetGenerator()
        instance = generator.generate_instance(
            instance_id="CUSTOM_BENCHMARK",
            num_students=args.students,
            num_halls=args.halls,
            profile=args.profile,
        )
        out_excel = os.path.join(args.output_dir, "custom_hall_plan.xlsx")
        generator.export_coe_excel(instance, out_excel)
        print(f"Generated custom instance with {args.students} students across {args.halls} halls -> {out_excel}")
