# pp uTools Plugin

This directory is the uTools plugin implementation, isolated from the Tauri desktop application.

## Development

1. Run `npm install` once, then `npm run dev`.
2. In uTools Developer Tools, select `dist/plugin.json` as the project configuration and install it in development mode.
3. The development command continuously rebuilds `dist/`. The Developer Tool therefore loads local static assets rather than depending on an HTTP development server.

The setup follows uTools' documented project attachment model: the Developer Tool reads resources relative to the selected `plugin.json`. Vite copies the manifest, logo, and preload script from `public/` into `dist/` on every build.

`public/package.json` is copied to `dist/package.json` with `"type": "commonjs"`. This is required because uTools preload scripts use CommonJS and must not inherit the React project's ES module setting.

## Production build

Run `npm run build`. Vite copies the public manifest, logo, and preload script into `dist/`; `dist/plugin.json` references the static `index.html` output.

The production folder has not yet been packaged as a `.upx` file or verified in the uTools Developer Tool. Do not treat a browser preview as host integration verification.
