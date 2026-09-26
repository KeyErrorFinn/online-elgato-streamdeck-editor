# Online Elgato Stream Deck Editor

A browser-based editor for inspecting and modifying exported Elgato Stream Deck profiles and actions without requiring the Stream Deck desktop editor for every change.

## Features

- Open `.streamDeckProfile` and `.streamDeckAction` archives in the browser.
- Decode linked pages, folders, button states, titles, and images.
- Preview common Stream Deck device grids or a custom grid size.
- Navigate nested folders and edit buttons.
- Import installed plugin archives and browse their available actions.
- Preview supported plugin property inspectors.
- Use bundled Stream Deck built-in actions.
- Persist the current workspace and imported plugins in browser storage.
- Download the edited action/profile archive.

## How it works

The React/TypeScript application reads the selected archive entirely in the browser. Utilities under `src/utils/` decode manifests, profile graphs, plugin directories, images, and property inspectors. `ProfileTester.tsx` coordinates the editor state, page navigation, plugin library, previews, autosaved workspace, and archive export.

No backend is required. The generated site can therefore be deployed as static files. A sample `.streamDeckAction` in `public/` may be discovered at build time and offered as a starter project.

## Development

Requires a current Node.js release and npm.

```bash
npm install
npm run dev
```

Then open the Vite development URL shown in the terminal.

## Validation and production build

```bash
npm run lint
npm run build
npm run preview
```

The build compiles TypeScript and emits the static site to `dist/`. The workflow in `.github/workflows/static.yml` publishes that build.

## Supported files and limitations

- Input must be an exported `.streamDeckProfile` or `.streamDeckAction` archive.
- Plugin actions are easiest to edit when their plugin metadata and property inspector are available.
- Some property inspectors depend on Stream Deck desktop APIs or assumptions that a browser cannot reproduce; the editor marks unsupported or partial cases.
- Work is stored locally in the browser until an edited archive is downloaded. Keep backups of original exports.
- This is an independent project and is not affiliated with Elgato.
