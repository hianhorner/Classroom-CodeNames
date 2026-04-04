# Design Notes

These notes summarize how the implementation translates the Stitch references and the included design system into the Phase 1 app.

## Visual Direction

- warm paper-toned surfaces driven by CSS variables instead of generic app colors
- Manrope for headlines and tile emphasis, Inter for body and controls
- no hard divider lines defining major sections
- large pill actions for teacher controls
- white or tonal word tiles with soft hover lift and ambient shadow

## Layout Mapping

- Start page uses a split editorial layout with a board preview and separate teacher/student entry cards
- Lobby favors broad, readable assignment zones over dense controls
- Presentation screen keeps the board dominant and pushes teacher controls into a side rail
- Guesser and spymaster views share a consistent board-plus-chat layout

## Intentional Phase 1 Simplifications

- clue entry controls are not implemented
- word-pack creation/upload stays in the reference folder only
- teacher reveal is the only action that changes board truth state after a captain lock
- timer reaching zero pauses at zero without automatically forcing turn logic

## Implementation Notes

- room state is broadcast as personalized snapshots so guessers/public viewers do not receive hidden key colors
- spymaster viewers receive the full unrevealed key board
- subgroup chat is filtered by assignment channel and persisted in SQLite
