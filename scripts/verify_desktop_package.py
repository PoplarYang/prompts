#!/usr/bin/env python3
"""Verify pp macOS desktop distribution artifacts."""

from __future__ import annotations

import plistlib
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "desktop/src-tauri/target/release/bundle/macos/pp.app"
DIST = ROOT / "dist"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def main() -> int:
    zip_artifacts = sorted(DIST.glob("pp-desktop-macos-*.zip"))
    dmg_artifacts = sorted(DIST.glob("pp-desktop-macos-*.dmg"))
    if not zip_artifacts:
        return fail("Missing desktop package artifact: dist/pp-desktop-macos-*.zip")
    if not dmg_artifacts:
        return fail("Missing desktop package artifact: dist/pp-desktop-macos-*.dmg")
    zip_artifact = zip_artifacts[-1]
    dmg_artifact = dmg_artifacts[-1]

    executable = APP / "Contents/MacOS/pp"
    plist = APP / "Contents/Info.plist"
    icon = APP / "Contents/Resources/icon.icns"
    for path in [APP, executable, plist, icon, zip_artifact, dmg_artifact]:
        if not path.exists():
            return fail(f"Missing desktop package artifact: {path.relative_to(ROOT)}")
    if not executable.stat().st_mode & 0o111:
        return fail("Packaged pp executable is not executable")

    with plist.open("rb") as file:
        info = plistlib.load(file)
    if info.get("CFBundleName") != "pp":
        return fail("CFBundleName should be pp")
    if info.get("CFBundleIdentifier") != "com.poplaryang.pp":
        return fail("CFBundleIdentifier should be com.poplaryang.pp")

    if zip_artifact.stat().st_size < 1_000_000:
        return fail("Desktop zip is unexpectedly small")
    if dmg_artifact.stat().st_size < 1_000_000:
        return fail("Desktop DMG is unexpectedly small")

    with zipfile.ZipFile(zip_artifact) as archive:
        names = set(archive.namelist())
    if "pp.app/Contents/MacOS/pp" not in names:
        return fail("Desktop zip does not contain pp.app executable")
    if "pp.app/Contents/Info.plist" not in names:
        return fail("Desktop zip does not contain Info.plist")

    print("OK: verified pp desktop distribution artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
