#!/usr/bin/env python3
"""Package the pp macOS desktop app for distribution."""

from __future__ import annotations

import shutil
import subprocess
import platform
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "desktop/src-tauri/target/release/bundle/macos/pp.app"
DIST = ROOT / "dist"


def macos_arch() -> str:
    machine = platform.machine().lower()
    if machine in {"arm64", "aarch64"}:
        return "aarch64"
    if machine in {"x86_64", "amd64"}:
        return "x64"
    return machine or "unknown"


ARCH = macos_arch()
ZIP = DIST / f"pp-desktop-macos-{ARCH}.zip"
DMG = DIST / f"pp-desktop-macos-{ARCH}.dmg"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def run(command: list[str]) -> None:
    print("$ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    if not APP.exists():
        return fail(
            "Missing pp.app. Build it first with: cd desktop && npm run tauri build -- --bundles app"
        )
    if not (APP / "Contents/MacOS/pp").exists():
        return fail("Missing packaged pp executable")
    if shutil.which("ditto") is None:
        return fail("Missing macOS ditto command")
    if shutil.which("hdiutil") is None:
        return fail("Missing macOS hdiutil command")

    DIST.mkdir(exist_ok=True)
    run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(APP), str(ZIP)])
    run(
        [
            "hdiutil",
            "create",
            "-volname",
            "pp",
            "-srcfolder",
            str(APP),
            "-ov",
            "-format",
            "UDZO",
            str(DMG),
        ]
    )

    print(f"OK: wrote {ZIP.relative_to(ROOT)}")
    print(f"OK: wrote {DMG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from error
