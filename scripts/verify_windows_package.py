#!/usr/bin/env python3
"""Verify the Windows installer artifact produced by Tauri/NSIS."""

from __future__ import annotations

import sys
from pathlib import Path


def verify_windows_installer(artifact: Path) -> None:
    if not artifact.exists():
        raise ValueError(f"Missing Windows installer: {artifact}")
    if artifact.stat().st_size < 1_000_000:
        raise ValueError("Windows installer is unexpectedly small")
    with artifact.open("rb") as file:
        if file.read(2) != b"MZ":
            raise ValueError("Windows installer is not a PE executable")


def main() -> int:
    artifacts = [Path(value) for value in sys.argv[1:]]
    if not artifacts:
        artifacts = sorted(Path("desktop/src-tauri/target/release/bundle/nsis").glob("*.exe"))
    if not artifacts:
        print("FAIL: no Windows installer found")
        return 1
    try:
        for artifact in artifacts:
            verify_windows_installer(artifact)
    except ValueError as error:
        print(f"FAIL: {error}")
        return 1
    print(f"OK: verified {len(artifacts)} Windows installer(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
