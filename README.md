# RoomCraft

**RoomCraft** is a web-based architectural floorplan studio with interactive 2D drafting and real-time 3D walkthroughs.

## Features
- **Interactive 2D Floorplan Drafting**: Trace exterior boundaries, draw interior walls with rotational and grid snapping, and place doors and windows.
- **Smart Room Detection**: Automatically detects enclosed rooms, calculates areas, and lets you assign room types, colors, and custom names.
- **AutoCAD DXF & DWG Support**:
  - Export and import standard AutoCAD DXF files.
  - Automatically heals wall junctions: extends CAD double-line centerlines to exterior wall boundaries (accounting for differences between exterior and interior wall thicknesses), resolves T-junctions & L-junctions, and eliminates double-node corner artifacts.
- **Live 3D Dollhouse & First-Person Walkthrough**:
  - Smooth animation between 2D and 3D views.
  - Real architectural heights: configurable wall heights, door heights, and window sill/height limits.
  - Directional mouse-look controls with customizable pitch inversion.
- **Procedural Interior Furnishing**: Automatically generates furniture layouts tailored to room types with customizable style palettes.
- **3D GLB & 2D Image Export**: Download 3D models as `.glb` for Blender/game engines or save PNG screenshots of your blueprints.
