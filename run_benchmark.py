"""run_benchmark.py — Root entrypoint to run the exam seating benchmark suite.

Ensures the backend directory is in sys.path and runs the benchmark with
reproducible seeding, statistical trials, and automatic report regeneration.
"""
import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path so app.* modules import cleanly
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.benchmark import run_benchmark

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Exam Seating Benchmark Runner")
    parser.add_argument(
        "--trials",
        type=int,
        default=3,
        help="Number of trials per scenario for statistical runtime reporting (default: 3)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Custom output directory for benchmark datasets and report",
    )
    args = parser.parse_args()

    run_benchmark(output_dir=args.output_dir, trials=args.trials)
