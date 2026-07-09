# Desktop Development Prerequisites

This document lists the real dependencies needed before building the Tauri desktop app.

## Current Machine Check

Checked on this workspace:

| Tool | Status |
| --- | --- |
| Xcode Command Line Tools | Installed |
| Node.js | Missing |
| npm | Missing |
| Rust `rustc` | Missing |
| Cargo | Missing |
| Homebrew | Missing from current PATH |
| pnpm | Codex runtime copy exists, but not a system development install |

Because Node.js and Rust are missing, do not scaffold the Tauri app yet. Install the dependencies below first.

## Required Tools

- Node.js LTS
- npm, included with Node.js
- Rust toolchain, including `rustc` and `cargo`
- Xcode Command Line Tools
- Tauri CLI, installed inside the future `desktop/` project

## Recommended macOS Installation

### 1. Install Node.js LTS

Use the official installer:

```txt
https://nodejs.org/
```

Download the LTS version for macOS and install it.

Verify:

```sh
node --version
npm --version
```

Expected:

```txt
node v20+ or v22+
npm version prints successfully
```

### 2. Install Rust

Use the official Rust installer:

```txt
https://rustup.rs/
```

The installer command from rustup usually looks like:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart the terminal or reload the shell profile.

Verify:

```sh
rustc --version
cargo --version
```

Expected:

```txt
rustc version prints successfully
cargo version prints successfully
```

### 3. Confirm Xcode Command Line Tools

Already installed on this machine:

```txt
/Library/Developer/CommandLineTools
```

Verify:

```sh
xcode-select -p
```

If missing on another machine:

```sh
xcode-select --install
```

### 4. Optional: Install pnpm

`npm` is enough for the first desktop scaffold. If we choose pnpm later:

```sh
npm install -g pnpm
pnpm --version
```

## Optional Homebrew Route

If you prefer Homebrew, install Homebrew first from:

```txt
https://brew.sh/
```

Then:

```sh
brew install node rust
node --version
npm --version
rustc --version
cargo --version
```

## After Installation

Send me the output of:

```sh
node --version
npm --version
rustc --version
cargo --version
xcode-select -p
```

Once these pass, the next step is to scaffold:

```sh
desktop/
```

with Tauri 2, Vite, React, and TypeScript.

## Why These Dependencies Are Needed

- Node.js runs the TypeScript/Vite frontend toolchain.
- npm installs desktop project dependencies.
- Rust builds the Tauri native shell.
- Cargo builds and packages Rust dependencies.
- Xcode Command Line Tools provide the macOS compiler/linker toolchain.

