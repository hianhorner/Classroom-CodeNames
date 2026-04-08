# Classroom CodeNames

Phase 1 of a locally runnable classroom Codenames system with:

- teacher-created rooms and room-code join flow
- teacher lobby with drag-and-drop team assignment and captain order
- presentation screen with manual teacher reveal
- private guesser and spymaster views
- live active/passive voting, round summaries, subgroup chat, timer controls, word packs, and SQLite persistence

## Stack

- React + Vite + React Router
- Node.js + Express
- Socket.IO
- SQLite via `better-sqlite3`
- `dnd-kit` for lobby assignment

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start client and server together while developing:

```bash
npm run dev
```

3. Open the app on the same computer:

- Client: `http://localhost:5173`
- Server API: `http://localhost:4000/api`

If you need to customize local settings, copy `.env.example` to `.env`.

## LAN Preview

Use the LAN preview when you want other computers, phones, or tablets on the same network to join the room:

```bash
npm run preview:lan
```

That command:

- builds the client
- serves the built app and API from one local-network URL
- prints the LAN URL clearly
- opens the local browser to that same URL on macOS

For the double-click flow, use [Open Classroom Codenames.command](./Open%20Classroom%20Codenames.command) and [Close Classroom Codenames.command](./Close%20Classroom%20Codenames.command).

Notes:

- all devices must be on the same Wi-Fi or wired LAN
- the first run may prompt macOS to allow incoming network connections
- the LAN URL changes if your computer gets a different local IP address

## Useful Scripts

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run preview:lan
npm run validate:lan
npm run typecheck
npm run build
npm run build:prod
npm run native:node
npm run native:electron
npm run desktop:dev
npm run package:mac
npm run package:win
npm run reset:room -- ABCD12
```

## Desktop Host Packaging

The installable desktop host app is named **Classroom CodeNames**. It bundles the server, the built client, Electron, and SQLite so the destination computer does not need Node.js, npm, or terminal setup.

Production packaging flow:

```bash
npm install
npm run build:prod
npm run desktop:dev
```

That local desktop-host run will:

- start the embedded local server on `0.0.0.0`
- save data under the operating system app-data directory
- open a dedicated host control window
- open the teacher screen automatically once the server is healthy
- generate LAN join links that other devices on the same network can use

Installer commands:

```bash
npm run package:mac
npm run package:win
```

Output installers are written to `dist-installers/`.

Current installer targets:

- Windows: `x64`
- macOS: `universal`

Until signing certificates are configured, installer outputs are intentionally labeled as **unsigned**.

GitHub Actions packaging:

- The workflow at [`.github/workflows/build-installers.yml`](/Users/ianhorner/Desktop/Codex%20Projects/Codenames1/.github/workflows/build-installers.yml) builds installers on native runners:
  - macOS installer on `macos-14`
  - Windows installer on `windows-latest`
- You can run it manually from the GitHub Actions tab with `workflow_dispatch`.
- It also runs automatically for tags that start with `v`.
- Finished installers are uploaded as workflow artifacts for download.

Native runtime note:

- `npm run native:node` restores the SQLite native module for the existing Node/LAN workflow
- `npm run native:electron` rebuilds that module for the packaged Electron desktop host
- `preview:lan` and `validate:lan` now restore the Node build automatically before they run

Runtime data locations:

- macOS: `~/Library/Application Support/Classroom CodeNames/`
- Windows: `%AppData%/Classroom CodeNames/`

The desktop host stores the SQLite database, logs, and runtime state there so the packaged app can be copied to another computer and used as a self-contained host.

## Phase 1 Flow

1. Teacher opens `/` and starts a session.
2. Students join with room code and name only.
3. Teacher drags players into:
   - Red Guessers
   - Red Spymasters
   - Blue Guessers
   - Blue Spymasters
4. Teacher reorders guessers inside each guesser bucket to define captain rotation.
5. Teacher optionally configures the timer and starts the game.
6. Students are auto-routed into guesser or spymaster screens once the room leaves the lobby.
7. The active spymaster captain enters a one-word clue and guess count.
8. The active guesser team votes, the inactive guesser team can place passive prediction votes, and the teacher reveals cards from the presentation screen.
9. Each clue cycle pauses on a summary modal before the teacher continues to the next round.

## Data Persistence

- SQLite database path defaults to `server/data/classroom-codenames.sqlite`
- Room state survives refresh and reconnect while the server stays running
- Chat history is stored per subgroup channel in SQLite
- Saved word packs persist in SQLite and can be reused in later rooms

## Validation

Run the automated smoke validator with:

```bash
npm run validate:lan
```

It starts a local single-origin preview server, runs a multi-role room flow, and writes a report to `output/validation/lan-smoke-report.json`.

For real-device validation on the same network, use the checklist in [docs/lan-validation-checklist.md](./docs/lan-validation-checklist.md).

## Reference Assets

Private design references live under [`reference`](./reference):

- `reference/stitch-screens`
- `reference/stitch-code`
- `reference/design-system.md`
- `reference/ui-page-map.md`
- `reference/design-notes.md`

## Current Scope Notes

- Clue entry is typed into the app for classroom coordination, but spoken discussion is still part of the game flow.
- The teacher remains on the control/lobby or presentation path after game start; student participants are the ones auto-routed into role pages.
- Production deployment hardening is still separate from this local-network preview setup.
