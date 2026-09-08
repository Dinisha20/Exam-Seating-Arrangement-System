"""solver.py — the constraint engine, built on Google OR-Tools CP-SAT.

Hard constraints enforced (formally, not heuristically):
  1) Two students writing the SAME PAPER never share a bench.
  2) Two students writing the SAME PAPER never sit "adjacent", where
     "adjacent" is configurable per generation (see adjacency_mode below).
  3) Every paper's registered student count is fully seated (or the solver
     reports infeasibility with a clear reason) — capacity is enforced
     implicitly by the seat count available.

Adjacency modes (admin-selectable at generate time):
  - "bench_only":  only same-bench pairs are restricted.
  - "left_right":  same-bench + left/right neighbouring bench in the same
                    row. Default — matches 2-per-bench exam hall setup.
  - "full_grid":   left_right, plus front/back neighbouring bench in the
                    same column across rows. Strictest.

Two ways to call the solver:
  - solve(...)            — single arrangement, tightly packed (minimizes
                              halls used). This is what a normal "Generate"
                              click uses.
  - solve_candidates(...) — returns up to `num_candidates` genuinely
                              different valid arrangements: the tightly
                              packed one, plus one or more diversified
                              alternatives (found by dropping the packing
                              objective and varying the solver's random
                              seed, so search explores a different part of
                              the feasible space instead of converging on
                              the same optimum). Used by the "generate
                              multiple options" flow so an admin can compare
                              and pick.

Encoding: for each seat i and each paper p, a boolean x[i][p] = 1 iff that
seat is assigned a student writing paper p. See _build_model for the
constraint set; see _decode for turning a solved model into assignments.
"""
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
from ortools.sat.python import cp_model

ADJACENCY_MODES = ("bench_only", "left_right", "full_grid")


@dataclass
class SeatSlot:
    seat_id: int
    bench_id: int
    hall_id: int
    row_number: int
    column_number: int
    seat_label: str


def _build_adjacent_pairs(seats: List[SeatSlot], adjacency_mode: str = "left_right") -> List[Tuple[int, int]]:
    """Returns index pairs (into `seats`) that must not carry the same paper,
    per the chosen adjacency_mode (see module docstring)."""
    if adjacency_mode not in ADJACENCY_MODES:
        adjacency_mode = "left_right"

    pairs = []

    by_bench: Dict[int, List[int]] = {}
    for idx, s in enumerate(seats):
        by_bench.setdefault(s.bench_id, []).append(idx)

    # Same-bench pairs — always restricted, in every mode.
    for idxs in by_bench.values():
        for a in range(len(idxs)):
            for b in range(a + 1, len(idxs)):
                pairs.append((idxs[a], idxs[b]))

    if adjacency_mode == "bench_only":
        return pairs

    bench_meta = {}
    for s in seats:
        bench_meta[s.bench_id] = (s.hall_id, s.row_number, s.column_number)

    rows: Dict[Tuple[int, int], List[int]] = {}
    for bench_id, (hall_id, row, _col) in bench_meta.items():
        rows.setdefault((hall_id, row), []).append(bench_id)

    for (hall_id, row), bench_ids in rows.items():
        bench_ids_sorted = sorted(bench_ids, key=lambda bid: bench_meta[bid][2])
        for a in range(len(bench_ids_sorted) - 1):
            col_a = bench_meta[bench_ids_sorted[a]][2]
            col_b = bench_meta[bench_ids_sorted[a + 1]][2]
            if col_b - col_a != 1:
                continue
            for i in by_bench[bench_ids_sorted[a]]:
                for j in by_bench[bench_ids_sorted[a + 1]]:
                    pairs.append((i, j))

    if adjacency_mode == "left_right":
        return pairs

    columns: Dict[Tuple[int, int], List[int]] = {}
    for bench_id, (hall_id, _row, col) in bench_meta.items():
        columns.setdefault((hall_id, col), []).append(bench_id)

    for (hall_id, col), bench_ids in columns.items():
        bench_ids_sorted = sorted(bench_ids, key=lambda bid: bench_meta[bid][1])
        for a in range(len(bench_ids_sorted) - 1):
            row_a = bench_meta[bench_ids_sorted[a]][1]
            row_b = bench_meta[bench_ids_sorted[a + 1]][1]
            if row_b - row_a != 1:
                continue
            for i in by_bench[bench_ids_sorted[a]]:
                for j in by_bench[bench_ids_sorted[a + 1]]:
                    pairs.append((i, j))

    return pairs


def _build_model(seats: List[SeatSlot], paper_ids: List[str], counts: Dict[str, int], adjacency_mode: str):
    model = cp_model.CpModel()
    num_seats = len(seats)
    num_papers = len(paper_ids)

    x = {}
    for i in range(num_seats):
        for p in range(num_papers):
            x[i, p] = model.NewBoolVar(f"x_{i}_{p}")

    for i in range(num_seats):
        model.Add(sum(x[i, p] for p in range(num_papers)) <= 1)

    for p, paper_id in enumerate(paper_ids):
        model.Add(sum(x[i, p] for i in range(num_seats)) == counts[paper_id])

    adjacent_pairs = _build_adjacent_pairs(seats, adjacency_mode)
    for (i, j) in adjacent_pairs:
        for p in range(num_papers):
            model.Add(x[i, p] + x[j, p] <= 1)

    return model, x


def _decode(seats, paper_ids, students_by_paper, solver, x, num_seats, num_papers):
    queues = {p: list(students_by_paper[p]) for p in paper_ids}
    assignments = []
    used_halls = set()
    for i in range(num_seats):
        for p_idx, paper_id in enumerate(paper_ids):
            if solver.Value(x[i, p_idx]) == 1:
                student = queues[paper_id].pop(0)
                assignments.append((seats[i], student, paper_id))
                used_halls.add(seats[i].hall_id)
                break
    all_halls = {s.hall_id for s in seats}
    freed_halls = sorted(all_halls - used_halls)
    return assignments, freed_halls


def solve(
    seats: List[SeatSlot], students_by_paper: Dict[str, list],
    time_limit_seconds: float = 15.0, adjacency_mode: str = "left_right",
):
    """
    Single, tightly-packed arrangement (minimizes halls used).

    Returns: (status_str, assignments, message, freed_hall_ids)
      assignments: list of (seat, student, paper_id)
      status_str: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN"
    """
    paper_ids = list(students_by_paper.keys())
    counts = {p: len(students_by_paper[p]) for p in paper_ids}
    total_students = sum(counts.values())

    if total_students > len(seats):
        return "INFEASIBLE", [], (
            f"{total_students} students registered but only {len(seats)} seats "
            f"available in the selected halls."
        ), []

    num_seats = len(seats)
    num_papers = len(paper_ids)
    model, x = _build_model(seats, paper_ids, counts, adjacency_mode)

    # Packing objective — prefer filling earlier halls completely before
    # touching later ones, so unused capacity concentrates into whole free
    # halls rather than scattering thin gaps across every room.
    hall_order = sorted({s.hall_id for s in seats})
    hall_rank = {h: rank for rank, h in enumerate(hall_order)}
    HALL_WEIGHT = num_seats + 1
    seat_weights = [hall_rank[s.hall_id] * HALL_WEIGHT + idx for idx, s in enumerate(seats)]
    model.Minimize(sum(seat_weights[i] * x[i, p] for i in range(num_seats) for p in range(num_papers)))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)
    status_name = solver.StatusName(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return status_name, [], (
            "No valid seating arrangement satisfies the constraints — likely "
            "too many students from one paper concentrated in too few benches, "
            "or the adjacency strictness chosen is too tight for the available "
            "capacity. Try adding more halls, spreading the paper across more "
            "benches, or loosening the adjacency setting."
        ), []

    assignments, freed_halls = _decode(seats, paper_ids, students_by_paper, solver, x, num_seats, num_papers)
    return status_name, assignments, "OK", freed_halls


def solve_candidates(
    seats: List[SeatSlot], students_by_paper: Dict[str, list],
    time_limit_seconds: float = 12.0, adjacency_mode: str = "left_right",
    num_candidates: int = 2,
):
    """
    Returns up to `num_candidates` genuinely different valid arrangements for
    the admin to compare and choose between, instead of committing to one
    automatically.

    Candidate 1 is always the tightly-packed arrangement (same as solve()).
    Further candidates drop the packing objective and use a different random
    seed each time, so the solver's search explores a different part of the
    feasible space — then only ones that differ meaningfully from earlier
    candidates (different hall usage pattern) are kept.

    Returns: (status_str, candidates, message)
      candidates: list of dicts: {
        "assignments": [(seat, student, paper_id), ...],
        "freed_halls": [hall_id, ...],
        "seated_per_hall": {hall_id: count, ...},
        "packed": bool,   # True for the tightly-packed candidate
      }
    """
    paper_ids = list(students_by_paper.keys())
    counts = {p: len(students_by_paper[p]) for p in paper_ids}
    total_students = sum(counts.values())

    if total_students > len(seats):
        return "INFEASIBLE", [], (
            f"{total_students} students registered but only {len(seats)} seats "
            f"available in the selected halls."
        )

    num_seats = len(seats)
    num_papers = len(paper_ids)

    def seated_per_hall(assignments):
        counts_by_hall: Dict[int, int] = {}
        for seat, _student, _paper in assignments:
            counts_by_hall[seat.hall_id] = counts_by_hall.get(seat.hall_id, 0) + 1
        return counts_by_hall

    def fingerprint(assignments):
        # A cheap signature of "which halls got how many seats" — good
        # enough to tell whether two candidates are meaningfully different
        # without doing a full seat-by-seat diff.
        return tuple(sorted(seated_per_hall(assignments).items()))

    candidates = []
    seen_fingerprints = set()
    any_feasible = False
    last_message = "OK"

    # Candidate 1: tightly packed (same as solve()).
    status, assignments, message, freed_halls = solve(
        seats, students_by_paper, time_limit_seconds=time_limit_seconds, adjacency_mode=adjacency_mode,
    )
    if status in ("OPTIMAL", "FEASIBLE"):
        any_feasible = True
        fp = fingerprint(assignments)
        seen_fingerprints.add(fp)
        candidates.append({
            "assignments": assignments, "freed_halls": freed_halls,
            "seated_per_hall": seated_per_hall(assignments), "packed": True,
        })
    else:
        last_message = message

    # Further candidates: no packing objective, varied random seed — lets
    # CP-SAT's search land on a different feasible corner of the space.
    attempts = 0
    max_attempts = max(num_candidates * 3, 4)  # a few retries in case of duplicate fingerprints
    seed = 1000
    while len(candidates) < num_candidates and attempts < max_attempts:
        attempts += 1
        seed += 1
        model, x = _build_model(seats, paper_ids, counts, adjacency_mode)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_search_workers = 1  # single worker so random_seed actually varies the path
        solver.parameters.random_seed = seed
        solver.parameters.randomize_search = True
        status = solver.Solve(model)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            continue
        any_feasible = True
        alt_assignments, alt_freed = _decode(seats, paper_ids, students_by_paper, solver, x, num_seats, num_papers)
        fp = fingerprint(alt_assignments)
        if fp in seen_fingerprints:
            continue  # not meaningfully different from a candidate we already have
        seen_fingerprints.add(fp)
        candidates.append({
            "assignments": alt_assignments, "freed_halls": alt_freed,
            "seated_per_hall": seated_per_hall(alt_assignments), "packed": False,
        })

    if not any_feasible:
        return "INFEASIBLE", [], last_message

    return "OK", candidates, (
        "OK" if len(candidates) > 1 else
        "Only one distinct valid arrangement was found within the search budget — "
        "the constraints likely leave little room for alternative layouts."
    )