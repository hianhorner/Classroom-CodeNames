# LAN Validation Checklist

Use this checklist after starting the LAN preview server with `npm run preview:lan` or the launcher script.

## Devices

- Teacher laptop on the lobby page
- Presentation/projector display on the presentation page
- One red guesser device
- One blue guesser device
- One spymaster device
- Optional phone or tablet spot checks

## Network Readiness

1. Confirm all devices are on the same Wi-Fi or wired LAN.
2. Open the printed LAN URL from a second device.
3. If the page does not load, confirm the host computer allowed incoming connections through the firewall.

## Core Room Flow

1. Create a room from the teacher device.
2. Open the student join link from two or more other devices.
3. Confirm each student can enter a name and land on the waiting view.
4. Confirm the teacher lobby updates immediately as students join.
5. Assign students to all four role buckets.
6. Refresh a student device and confirm the assignment remains intact.
7. Disconnect one student device briefly and reconnect it; confirm the assignment still exists.

## Gameplay Roles

1. Start the game.
2. Confirm each student device routes to the correct guesser or spymaster page.
3. Confirm the presentation screen opens and updates separately from teacher lobby control.
4. Confirm only the active spymaster captain can enter the clue.
5. Confirm inactive spymasters see the passive captain message instead of an editable clue form.

## Votes, Reveal, and Summary

1. Enter a clue and count from the active spymaster captain.
2. Cast active votes from the active guesser team.
3. Cast passive prediction votes from the inactive guesser team.
4. Confirm only the passive guesser team can see its own passive tallies live; active guessers and both spymaster groups should not.
5. Confirm the presentation screen shows only the active-team tallies by default.
6. Reveal a correct card and confirm the same clue cycle stays active.
7. When only the bonus reveal remains, confirm `End Turn` becomes available on the presentation screen.
8. Confirm `End Guessing Early` requires confirmation before ending the round.
9. Reveal a wrong card or end the round and confirm every device pauses on the summary modal.
10. Confirm the summary modal shows the passive percentage when passive voting occurred.
11. Confirm only the presentation screen has the `Continue` control for non-winning summaries.
12. Continue to the next round and confirm the next team becomes active.

## Victory Flow

1. Finish a game and confirm all screens move directly to the victory page.
2. Confirm the winning-team background color applies across presentation and player screens.
3. Confirm the victory page shows the expanded recap data, including round-by-round history and best guesser.
4. Confirm `Rematch` and `Start Over` are available only where teacher control is expected.

## Join and Responsive Checks

1. Confirm the homepage student entry form still works with name plus room code.
2. Confirm the copied student join link uses the canonical `/join/:roomCode` route.
3. Check presentation vote toggle styling and confirm the selected state looks pressed/greyed.
4. Spot-check lobby, game, and victory views on a phone or tablet for layout regressions.

## Chat and Persistence

1. Send a message from one guesser subgroup.
2. Confirm only that subgroup sees the message.
3. Send a message from a spymaster subgroup.
4. Refresh a device and confirm the chat history is still present.

## Word Packs

1. From the teacher lobby, open `Wordpack`.
2. Save a manual 25-word pack and apply it.
3. Refresh the lobby and confirm the selected pack is still shown.
4. Upload a spreadsheet pack and apply it.
5. Start a new game and confirm the chosen words and any forced starting team match the selected pack.
