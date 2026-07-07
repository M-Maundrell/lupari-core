# Lupari Ops

Lupari Ops is a mobile-friendly checklist app for daily operative workflows. The current implementation keeps the canonical production behavior from the July 5 reference and rebuilds it as a split between presentation markup and JavaScript logic.

## Structure

- [lupari-checklist.html](lupari-checklist.html): presentation shell with the HTML structure, styles, Firebase includes, Odoo session gate, and the script entry point.
- [lupari-ops.js](lupari-ops.js): runtime logic for state, rendering, phase progression, notes, admin controls, Firebase sync, and voice interactions.
- [lupari-checklist-05Julio.html](lupari-checklist-05Julio.html): canonical production reference used to preserve behavior.

## Key behaviors preserved

- Three operative phases: Prep. Moto, Apertura, and Cierre.
- Daily date and point-of-sale selection.
- Progress and wizard state updates.
- Notes and incident logging by phase.
- Firebase Realtime Database persistence under the existing path structure.
- Odoo session validation and user role detection.
- Admin controls for task/category management and history handling.

## Notes

The HTML file is intentionally a thin shell. All business logic should live in [lupari-ops.js](lupari-ops.js) so the UI markup can be updated without rewriting the workflow runtime.
