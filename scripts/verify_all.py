#!/usr/bin/env python3
"""Run all pp verification checks."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


COMMANDS = [
    ["python3", "scripts/build_prompt_index.py"],
    ["python3", "tests/test_prompt_index.py"],
    ["python3", "tests/test_release_artifacts.py"],
    ["python3", "scripts/verify_v0_1.py"],
    ["python3", "scripts/verify_v0_2.py"],
    ["python3", "scripts/verify_v1_0.py"],
    ["python3", "scripts/verify_desktop.py"],
]


def main() -> int:
    for command in COMMANDS:
        print("$ " + " ".join(command))
        result = subprocess.run(command, cwd=ROOT)
        if result.returncode != 0:
            return result.returncode
    print("OK: all verification checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
