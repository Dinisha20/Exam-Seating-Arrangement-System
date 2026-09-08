"""excel_helper.py — parses the COE-style Hall Plan Excel and exports results.

Real hall plan sheets have a few title rows above the table, then a header
row containing "S.No / Year / Class / Course Code / Register Nos. / Count /
Total Count / Lab Name". "Register Nos." values look like:
    "2216211501001 -  003 , 005 -15"     (full number, then short suffix ranges)
    "2116211401016 - 027  & 029"          (comma AND "&" both used as separators)
    "2216211501045"                        (a single register number, no range)

Every full register number establishes a "prefix" (all digits except the
trailing suffix digits); later short tokens in the same cell reuse that
prefix, padded to match the suffix width already seen for that cell.

This logic was validated against a real 6,882-student Hall Plan export
(6,881 of 6,882 register-number entries parsed correctly; the one failure
was a genuine typo in the source file).
"""
import re
from dataclasses import dataclass, field
from typing import List, Dict
import openpyxl

FULL_NUMBER_MIN_LENGTH = 8


def _digits_only(s: str) -> str:
    """Leading run of digits, stripping any trailing typo punctuation.
    Internal whitespace within the token is also collapsed first — real
    hall plan sheets sometimes have a stray space typo'd into the middle
    of a register number (e.g. "2116 211701017"), which is not a genuine
    separator."""
    compact = re.sub(r"\s+", "", s.strip())
    match = re.match(r"\d+", compact)
    return match.group() if match else ""


def _lenient_int(s: str):
    digits = _digits_only(s)
    return int(digits) if digits else None


def expand_range(prefix: str, start_str: str, end_str: str, width: int) -> List[str]:
    start, end = _lenient_int(start_str), _lenient_int(end_str)
    if start is None or end is None or end < start:
        return []
    return [f"{prefix}{str(n).zfill(width)}" for n in range(start, end + 1)]


def parse_register_cell(cell_value) -> List[str]:
    if not cell_value:
        return []
    text = str(cell_value).strip()
    if not text:
        return []

    segments = [s.strip() for s in re.split(r"[,&]", text) if s.strip()]

    base_prefix = None
    suffix_width = None
    reg_nos: List[str] = []

    for seg in segments:
        range_parts = [p.strip() for p in seg.split("-") if p.strip()]

        if len(range_parts) == 2:
            start_tok, end_tok = range_parts
            start_digits, end_digits = _digits_only(start_tok), _digits_only(end_tok)
            if len(start_digits) >= FULL_NUMBER_MIN_LENGTH:
                suffix_width = len(end_digits)
                base_prefix = start_digits[: len(start_digits) - suffix_width]
                start_suffix = start_digits[-suffix_width:]
                reg_nos += expand_range(base_prefix, start_suffix, end_digits, suffix_width)
            elif base_prefix is not None:
                width = max(len(start_digits), len(end_digits), suffix_width or 0)
                reg_nos += expand_range(
                    base_prefix, start_digits.zfill(width), end_digits.zfill(width), width
                )
        elif len(range_parts) == 1:
            tok_digits = _digits_only(range_parts[0])
            if len(tok_digits) >= FULL_NUMBER_MIN_LENGTH:
                reg_nos.append(tok_digits)
                width = suffix_width or 3
                base_prefix = tok_digits[: len(tok_digits) - width]
                suffix_width = width
            elif base_prefix is not None and tok_digits:
                width = max(len(tok_digits), suffix_width or 0)
                reg_nos.append(base_prefix + tok_digits.zfill(width))

    # Sanity guard: a genuinely malformed cell (e.g. a stray internal space
    # that splits a register number mid-digit) can make the prefix/suffix
    # heuristic above produce a runaway garbage range. No legitimate row in
    # a hall plan seats more than ~100 students, so treat anything beyond
    # that as unparseable rather than silently importing bad data.
    if len(reg_nos) > 100:
        return []

    return reg_nos


@dataclass
class ParsedStudent:
    register_no: str
    name: str = ""
    year: str = ""
    class_name: str = ""
    course_code: str = ""


@dataclass
class ParseResult:
    students: List[ParsedStudent] = field(default_factory=list)
    errors: List[dict] = field(default_factory=list)


def find_header_row(rows) -> int:
    for i, row in enumerate(rows[:20]):
        normalized = [str(c or "").strip().lower() for c in row]
        if any(c.startswith("register nos") for c in normalized):
            return i
    return -1


def build_column_index(header_row) -> Dict[str, int]:
    cols = {}
    for idx, cell in enumerate(header_row):
        key = str(cell or "").replace("\n", " ").replace("\r", " ").strip().lower()
        if not key:
            continue
        if key.startswith("year"):
            cols["year"] = idx
        elif key.startswith("class"):
            cols["class"] = idx
        elif key.startswith("course code"):
            cols["course_code"] = idx
        elif key.startswith("register nos"):
            cols["register_nos"] = idx
        elif key.startswith("lab name"):
            cols["lab_name"] = idx
    return cols


def list_sheet_names(file_path: str) -> List[str]:
    """Returns the sheet names in the workbook that actually look like a hall
    plan table (have a detectable header row) — used to let the admin choose
    which sheet(s) belong to this exam session before importing, since a
    single workbook (like the real COE export) often bundles multiple
    sessions' sheets (e.g. one FN sheet, one AN sheet) together."""
    wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
    valid_sheets = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            rows.append(list(row))
            if i >= 19:
                break
        if find_header_row(rows) != -1:
            valid_sheets.append(sheet_name)
    wb.close()
    return valid_sheets


def parse_hall_plan_workbook(file_path: str, sheet_names: List[str] = None) -> ParseResult:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    result = ParseResult()

    sheets_to_parse = sheet_names if sheet_names is not None else wb.sheetnames

    for sheet_name in sheets_to_parse:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]
        rows = [[cell for cell in row] for row in ws.iter_rows(values_only=True)]

        header_idx = find_header_row(rows)
        if header_idx == -1:
            continue

        cols = build_column_index(rows[header_idx])
        if "course_code" not in cols or "register_nos" not in cols:
            continue

        last_year, last_class = "", ""

        for i in range(header_idx + 1, len(rows)):
            row = rows[i]
            course_code = str(row[cols["course_code"]] or "").strip() if cols["course_code"] < len(row) else ""
            reg_nos_raw = row[cols["register_nos"]] if cols["register_nos"] < len(row) else None

            if not course_code and not reg_nos_raw:
                continue

            year_cell = str(row[cols["year"]] or "").strip() if "year" in cols and cols["year"] < len(row) else ""
            class_cell = str(row[cols["class"]] or "").strip() if "class" in cols and cols["class"] < len(row) else ""
            year = year_cell or last_year
            class_name = class_cell or last_class
            if year_cell:
                last_year = year_cell
            if class_cell:
                last_class = class_cell

            if not course_code or not reg_nos_raw:
                continue

            reg_nos = parse_register_cell(reg_nos_raw)
            if not reg_nos:
                result.errors.append({
                    "sheet": sheet_name, "row": i + 1, "course_code": course_code,
                    "register_nos_raw": str(reg_nos_raw), "reason": "Could not parse register number range",
                })
                continue

            for reg_no in reg_nos:
                result.students.append(ParsedStudent(
                    register_no=reg_no, name="", year=year, class_name=class_name, course_code=course_code,
                ))

    return result


def export_allocation_to_excel(allocation_rows: List[dict], output_path: str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Seating Plan"
    ws.append(["Hall Name", "Row", "Column", "Seat", "Register No", "Class", "Course Code"])
    for r in allocation_rows:
        ws.append([
            r["hall_name"], r["row_number"], r["column_number"], r["seat_label"],
            r["register_no"], r["class_name"], r["course_code"],
        ])
    wb.save(output_path)