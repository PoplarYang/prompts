#!/usr/bin/env python3
"""Unit tests for release artifact integrity checks."""

from __future__ import annotations

import importlib.util
import plistlib
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_windows_installer_signature():
    module = load_module("verify_windows_package", ROOT / "scripts/verify_windows_package.py")
    with tempfile.TemporaryDirectory() as directory:
        artifact = Path(directory) / "pp-setup.exe"
        artifact.write_bytes(b"MZ" + b"0" * 1_000_000)
        module.verify_windows_installer(artifact)


def test_macos_zip_contents_and_metadata():
    module = load_module("verify_desktop_package", ROOT / "scripts/verify_desktop_package.py")
    module.shutil.which = lambda _command: None
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        app = root / "pp.app/Contents"
        (app / "MacOS").mkdir(parents=True)
        (app / "Resources").mkdir()
        (app / "MacOS/pp").write_bytes(b"Mach-O test")
        (app / "MacOS/pp").chmod(0o755)
        (app / "Resources/icon.icns").write_bytes(b"icon")
        with (app / "Info.plist").open("wb") as file:
            plistlib.dump({"CFBundleIdentifier": "com.poplaryang.pp"}, file)
        artifact = root / "pp.zip"
        with zipfile.ZipFile(artifact, "w") as archive:
            for path in (root / "pp.app").rglob("*"):
                if path.is_file():
                    entry = zipfile.ZipInfo(str(path.relative_to(root)))
                    entry.create_system = 3
                    entry.external_attr = (path.stat().st_mode & 0xFFFF) << 16
                    archive.writestr(entry, path.read_bytes())
        module.verify_zip(artifact)


if __name__ == "__main__":
    test_windows_installer_signature()
    test_macos_zip_contents_and_metadata()
    print("OK: release artifact unit tests")
