# pp macOS 发布指南

本文记录在没有 Apple Developer 账号时，pp 当前可用的 macOS 发布方案。

## 目标体验

当前目标不是让 macOS 完全信任 pp，这需要 Developer ID 签名和 notarization。免费方案的目标是：

```text
下载
-> 打开标准拖拽式 DMG
-> 将 pp 拖到“应用程序”
-> 右键点击 pp，选择“打开”
-> 如果系统提示，在“隐私与安全性”中允许
```

期望用户看到的是“未识别开发者/安全性提示”，而不是“应用已损坏”。

## 打包决策

- 对完整应用执行显式 deep ad-hoc 签名：

  ```sh
  codesign --force --deep --sign - --timestamp=none pp.app
  codesign --verify --deep --strict pp.app
  ```

- 使用 `create-dmg` 生成 DMG。它提供常见的 `pp.app -> Applications` 布局，以及背景和箭头。
- 保留 ZIP 作为备用格式，因为 ZIP 更容易下载和解压。
- 不把 ad-hoc 签名描述成 notarization。首次启动仍然需要用户手动允许。

## 本地构建

先安装 DMG 工具：

```sh
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm install --global create-dmg
```

构建和打包：

```sh
cd desktop
npm ci
npm run tauri build -- --bundles app
cd ..
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
```

`scripts/package_desktop.py` 会在生成 ZIP 和 DMG 前执行 ad-hoc 签名。

## 必须验证的内容

本地验证：

```sh
codesign -dv --verbose=4 desktop/src-tauri/target/release/bundle/macos/pp.app
python3 scripts/verify_all.py
```

预期签名信息包括：

```text
Signature=adhoc
TeamIdentifier=not set
```

DMG 挂载后应包含：

```text
pp.app
Applications（快捷方式）
```

CI 还会验证 Apple Silicon 和 Intel 构建、包内容、可执行权限、Mach-O 格式、Bundle ID、ad-hoc 签名和 DMG 布局。

## GitHub Actions

Release workflow 使用：

- `macos-14` 构建 Apple Silicon。
- `macos-15-intel` 构建 Intel。
- 每个 macOS runner 上安装 `create-dmg`。
- 打包前显式执行 deep ad-hoc 签名。
- 将 DMG 挂载到临时目录，验证拖拽安装布局。

Release 会先创建为 draft。只有在所有矩阵 job 和 `Publish GitHub release` 都成功，并且 draft 包含两个 macOS 架构、Windows 和静态包后，才算发布完成。

## 上一次验证失败的原因

之前构建和打包都成功，但验证脚本尝试解析 `hdiutil attach -nomount -plist` 的输出，并使用 `PlistBuddy` 获取设备路径。GitHub macOS runner 返回的 plist 结构中没有预期字段：

```text
Cannot parse a NULL or zero-length data
```

修复方式是避免解析设备号，直接挂载到临时目录：

```sh
hdiutil attach -nobrowse -readonly -mountpoint "$mountpoint" pp.dmg
```

这样更简单，也直接验证真正关心的安装布局。

## 首次启动说明

1. 下载与你的 Mac 架构对应的 ZIP 或 DMG。
2. 如果使用 DMG，将 pp 拖到“应用程序”。
3. 在“应用程序”中右键点击 pp，选择“打开”。
4. 如果 macOS 显示安全提示，在“系统设置 → 隐私与安全性”中允许 pp。
5. 如果仍提示应用已损坏，在终端执行：

   ```sh
   xattr -cr /Applications/pp.app
   open /Applications/pp.app
   ```

这条命令只是故障排查备用方案，不会由安装程序自动执行。

## 后续升级

Developer ID 签名、使用 `notarytool` notarization，以及 stapling 票据，仍然是消除普通用户首次手动允许步骤的完整方案。在此之前，应始终保留 ad-hoc 签名、清晰的发布说明、拖拽式 DMG、ZIP 备用包和 CI 验证。
