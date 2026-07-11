#!/usr/bin/env python3
"""Verify pp macOS desktop distribution artifacts."""

from __future__ import annotations

import plistlib
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "desktop/src-tauri/target/release/bundle/macos/pp.app"
DIST = ROOT / "dist"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def verify_adhoc_signature(app: Path) -> None:
    if shutil.which("codesign") is None:
        raise ValueError("Missing macOS codesign command")
    verified = subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], capture_output=True, text=True)
    if verified.returncode != 0:
        raise ValueError(f"macOS app code signature is invalid: {verified.stderr.strip()}")
    details = subprocess.run(["codesign", "-dv", "--verbose=4", str(app)], capture_output=True, text=True)
    signature_output = f"{details.stdout}\n{details.stderr}"
    if "Signature=adhoc" not in signature_output and "flags=0x20002(adhoc" not in signature_output:
        raise ValueError("macOS app is not ad-hoc signed")


def verify_zip(artifact: Path) -> None:
    with zipfile.ZipFile(artifact) as archive:
        if archive.testzip() is not None:
            raise ValueError("Desktop zip contains a corrupt file")
        names = set(archive.namelist())
        required = {
            "pp.app/Contents/MacOS/pp",
            "pp.app/Contents/Info.plist",
            "pp.app/Contents/Resources/icon.icns",
        }
        missing = required - names
        if missing:
            raise ValueError(f"Desktop zip is missing: {', '.join(sorted(missing))}")
        executable_entry = archive.getinfo("pp.app/Contents/MacOS/pp")
        if ((executable_entry.external_attr >> 16) & 0o111) == 0:
            raise ValueError("Desktop zip does not preserve executable permissions")

        with tempfile.TemporaryDirectory(prefix="pp-verify-") as directory:
            root = Path(directory)
            archive.extractall(root)
            extracted_app = root / "pp.app"
            extracted_executable = extracted_app / "Contents/MacOS/pp"
            with (extracted_app / "Contents/Info.plist").open("rb") as file:
                extracted_info = plistlib.load(file)
            if extracted_info.get("CFBundleIdentifier") != "com.poplaryang.pp":
                raise ValueError("Extracted app has an unexpected bundle identifier")
            if shutil.which("file"):
                result = subprocess.run(["file", str(extracted_executable)], capture_output=True, text=True)
                if result.returncode != 0 or "Mach-O" not in result.stdout:
                    raise ValueError("Extracted pp executable is not a Mach-O binary")


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
    try:
        verify_adhoc_signature(APP)
    except ValueError as error:
        return fail(str(error))

    if zip_artifact.stat().st_size < 1_000_000:
        return fail("Desktop zip is unexpectedly small")
    if dmg_artifact.stat().st_size < 1_000_000:
        return fail("Desktop DMG is unexpectedly small")

    try:
        verify_zip(zip_artifact)
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        return fail(str(error))

    print("OK: verified pp desktop distribution artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
