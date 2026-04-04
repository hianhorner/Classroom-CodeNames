# UI Page Map

## Phase 1 Routes

- `/`
  - public start page for teacher creation and student join
- `/room/:roomCode/lobby`
  - teacher lobby with live roster, drag-and-drop assignment, captain ordering, and timer setup
  - student waiting room before the game starts
- `/room/:roomCode/presentation`
  - projector/public board
  - teacher can reveal cards, control the timer, and advance turns here when opened with the teacher session
- `/room/:roomCode/guesser`
  - private guesser board for the assigned team
  - live vote counts and captain confirm flow
- `/room/:roomCode/spymaster`
  - private spymaster board with hidden ownership colors visible
  - subgroup chat only

## Deferred

- word-pack settings page from the Stitch references is intentionally omitted from the live route map for Phase 1
