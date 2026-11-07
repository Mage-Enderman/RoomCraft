# RoomCraft

RoomCraft is a web-based architectural floorplan studio with interactive 2D drafting and real-time 3D walkthroughs.

## Overview

RoomCraft provides a complete architectural design workflow from the initial floor plan to a finished 3D model. The application is built around a single `FC.App` state object that connects the 2D editor, UI, and 3D viewer.

## Architecture

The application is organized under `/openwiki/architecture/` with core modules:

- **App Controller** (`app-controller.md`) — manages plan, rooms, furniture, UI state, and persistence
- **Architecture Overview** (`overview.md`) — system map of the application
- **UI Shell** (`ui-shell.md`) — DOM chrome, data-action dispatch, sidebar steps, and modals

## Core Modules

### App Controller

The `FC.App` class in `js/app.js` is the sole owner of mutable application state. It coordinates three collaborators around one state container:

- **Projects** — array of normalized plans
- **Plan** — active plan, also a member of projects
- **Rooms** — runtime room objects and `detectedRoomsPreview` (non-destructive candidates)
- **Furniture** — runtime furniture array, mirrored into `plan.furniture`
- **UI** — shared transient interaction state (`step`, `tool`, `view3d`, `ortho`, `drawingFresh`, `selection`, `sidebarOpen`)
- **Save Status** — `saved`, `saving`, `dirty` plus internal state (`_saveTimer`, `_storageWarned`, etc.)

### Plan State

`_loadProjects()` reads localStorage, normalizes stored objects through `FC.normalizePlan`, and ensures at least one plan exists. `_syncPlan()` keeps the active plan and its slot in `projects`. `_preparePlanState()` derives the runtime state at boot and maps the stored plan to the workflow step.

### 3D Viewer

`Viewer3D` builds from `app.rooms` and `app.furniture`, with support for 3D GLB, DXF, and DWG exports. It handles the boot handshake that waits for Editor2D, UI, and Viewer3D to be defined.

## Files

- `/openwiki/architecture/app-controller.md` — detailed architecture of the App controller
- `/openwiki/architecture/overview.md` — system map and boot flow
- `/openwiki/architecture/ui-shell.md` — DOM chrome and tool routing

## Related Pages

- [Architecture Overview](../architecture/overview.md)
- [UI Shell](../architecture/ui-shell.md)
- [Plan Model](../concepts/plan-model.md)
- [Editor 2D](../concepts/editor-2d.md)
- [3D Viewer](../concepts/viewer-3d.md)
- [Export and Persistence](../workflows/export-and-persistence.md)
