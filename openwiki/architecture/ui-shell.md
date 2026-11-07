# UI Shell

The UI shell is the layer that presents the design workflow to the user. It handles data-action dispatch, step navigation, tool options, and sidebar presentation.

## DOM Chrome

The UI shell is a set of DOM elements that render the application's workflow state. It includes:

- Stepper navigation (Outline, Walls, Rooms, Doors, Generate, Lighting, 3D)
- Tool rail with tool options
- Sidebar with step details
- Modal dialogs for complex operations

## Data Action Dispatch

When a user clicks or types in a field, the UI dispatches the action to the appropriate handler in `js/ui.js`. The action is then routed to the corresponding method in `app.js`.

## Step Navigation

`STEP_TOOL` maps a workflow step to a tool, and `TOOL_STEP` maps a tool to a step. The user can move between steps via `setStep()` and `goToStep()`.

### Tools

- **Outline** — generates and edits the 2D outline
- **Wall** — handles wall geometry and placement
- **Room** — manages room detection and layout
- **Door/Window/Opening** — handles door/window placement and circulation
- **Generate** — creates furniture and 3D models
- **Lighting** — controls lighting scenarios
- **3D** — activates or exits the 3D view

## Sidebar Presentation

The sidebar displays the current workflow step, tools available, and a history of previous steps. It can be toggled on/off and cleared with `updateSidebar()`, which also triggers UI re-renders.

## Modals

When a complex operation is needed, `openCADImportModal` opens a modal to import CAD files (DXF, DWG, JSON). The modal is then converted to a 3D model via `FC.CAD`.

## Key Events

- `data-action="step"` — triggers step navigation and tool selection
- `data-action="outline"` — generates and edits the outline
- `data-action="wall"` — places and removes walls
- `data-action="room"` — detects and applies rooms
- `data-action="generate"` — creates furniture and 3D models
- `data-action="save"` — writes the plan to disk

## 3D Integration

The UI shell communicates with the 3D viewer through `FC.Viewer3D`. The viewer handles 3D exports (GLB, DXF, DWG) and updates the 3D scene state after each render.
