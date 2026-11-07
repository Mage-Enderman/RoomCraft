# Architecture Overview

## FC Module Bus

The application exposes a single `FC.App` instance that acts as the state owner for the entire application. This module is the central hub that coordinates all other components.

## Load Order

In `index.html`, the script execution follows this load order:

1. **Script initialization** — `FC.app` is created and the window is set up
2. **Editor2D** — reads `app.plan`, `app.rooms`, and `app.furniture`
3. **UI** — reads `app.plan`, `app.saveStatus`, and `app.canUndo()`
4. **Viewer3D** — builds from `app.rooms` and `app.furniture`

Each stage polls `window.FC` until the three modules are all defined, retrying every 40 ms.

## Boot Flow

When `boot()` is called:

- It waits for `Editor2D`, `UI`, and `Viewer3D` to be defined.
- It constructs exactly one `FC.App` instance.
- It aliases `FC.App` as `window.roomcraft` and `window.floorcraft`.
- If the constructor throws, it leaves the app unconstructed and writes a failure message into `#statusHint`.

## Dependencies

- `js/app.js` defines `FC.App` and `FC.Plan`
- `js/editor.js` defines `Editor2D` and `app.rooms`
- `js/ui.js` defines `UI` and the tool routing
- `js/viewer3d.js` defines `Viewer3D` and 3D export
- `js/cad-io.js` handles CAD/DWG export
- `styles.css` controls visual styling

## Key State

- `projects` — array of normalized plans (stored in `localStorage`)
- `plan` — active plan instance (the single source of truth)
- `rooms` — runtime room objects (`app.rooms`)
- `furniture` — runtime furniture array (mirrored to `plan.furniture`)
- `ui` — transient interaction state (`step`, `tool`, `view3d`, etc.)
- `saveStatus` — `saved` | `saving` | `dirty` (persistence state)
