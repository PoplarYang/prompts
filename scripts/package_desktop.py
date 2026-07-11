#!/usr/bin/env python3
"""Package the pp macOS desktop app for distribution."""

from __future__ import annotations

import shutil
import subprocess
import platform
import tempfile
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
    if shutil.which("codesign") is None:
        return fail("Missing macOS codesign command")

    DIST.mkdir(exist_ok=True)
    run(["codesign", "--force", "--deep", "--sign", "-", "--timestamp=none", str(APP)])
    run(["codesign", "--verify", "--deep", "--strict", str(APP)])
    run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(APP), str(ZIP)])
    with tempfile.TemporaryDirectory(prefix="pp-dmg-") as directory:
        staging = Path(directory)
        shutil.copytree(APP, staging / "pp.app", symlinks=True)
        (staging / "Applications").symlink_to("/Applications", target_is_directory=True)
        (staging / "README-MACOS.txt").write_text(
            "pp macOS 安装说明 / macOS Installation\n\n"
            "1. 将 pp.app 拖到 Applications。\n"
            "2. 在 Applications 中右键点击 pp.app，选择‘打开’。\n"
            "3. 如果 macOS 阻止启动，请查看‘系统设置 → 隐私与安全性’。\n"
            "4. 如果仍无法打开，在终端执行：\n\n"
            "   xattr -cr /Applications/pp.app\n"
            "   open /Applications/pp.app\n\n"
            "This build is not notarized. The first launch may require manual approval.\n",
            encoding="utf-8",
        )
        run(["hdiutil", "create", "-volname", "pp", "-srcfolder", str(staging), "-ov", "-format", "UDZO", str(DMG)])

    print(f"OK: wrote {ZIP.relative_to(ROOT)}")
    print(f"OK: wrote {DMG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from error
