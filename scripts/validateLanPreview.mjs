import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import XLSX from 'xlsx';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const workspaceDirectory = path.resolve(currentDirectory, '..');
const tsxBinary = path.resolve(workspaceDirectory, 'node_modules/.bin/tsx');
const serverEntrypoint = path.resolve(workspaceDirectory, 'server/src/index.ts');
const outputDirectory = path.resolve(workspaceDirectory, 'output/validation');
const reportPath = path.join(outputDirectory, 'lan-smoke-report.json');
const validationPort = process.env.VALIDATION_PORT?.trim() || '4273';
const baseUrl = process.env.VALIDATION_BASE_URL?.trim() || `http://127.0.0.1:${validationPort}`;
const apiBaseUrl = `${baseUrl}/api`;
const previewPort = new URL(baseUrl).port || '4173';

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  notes: []
};

let previewProcess = null;
const sockets = [];

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForHealth(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await wait(1000);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function apiRequest(pathname, init = {}) {
  const headers = new Headers(init.headers ?? {});

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;

    try {
      const payload = await response.json();
      message = payload?.message ?? message;
    } catch {}

    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 204) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function assert(condition, message, context = undefined) {
  if (!condition) {
    const error = new Error(message);
    error.context = context;
    throw error;
  }
}

function assertSocketHasNoErrors(session) {
  assert(session.errors.length === 0, `${session.label} received unexpected server errors.`, {
    errors: session.errors
  });
}

function assertTileVoteState(tile, expected, message) {
  assert(Boolean(tile), message, { tile });
  assert(tile.voteCount === expected.voteCount, `${message} Vote count mismatch.`, {
    tileId: tile?.id,
    expected,
    actual: tile
  });
  assert(tile.redVoteCount === expected.redVoteCount, `${message} Red tally mismatch.`, {
    tileId: tile?.id,
    expected,
    actual: tile
  });
  assert(tile.blueVoteCount === expected.blueVoteCount, `${message} Blue tally mismatch.`, {
    tileId: tile?.id,
    expected,
    actual: tile
  });
}

async function runCheck(name, action) {
  const check = {
    name,
    status: 'running'
  };

  report.checks.push(check);

  try {
    const details = await action();
    check.status = 'passed';
    if (details !== undefined) {
      check.details = details;
    }
    return details;
  } catch (error) {
    check.status = 'failed';
    check.error = error instanceof Error ? error.message : 'Unknown error';
    if (error && typeof error === 'object' && 'context' in error) {
      check.context = error.context;
    }
    throw error;
  }
}

function createSocketSession({ roomCode, playerId, view, label }) {
  const socket = io(baseUrl, {
    transports: ['websocket']
  });

  const session = {
    label,
    socket,
    latestState: null,
    errors: [],
    waitForState(predicate = () => true, timeoutMs = 8000) {
      if (session.latestState && predicate(session.latestState)) {
        return Promise.resolve(session.latestState);
      }

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          socket.off('room:state', onState);
          socket.off('server:error', onError);
          reject(new Error(`Timed out waiting for ${label} room state.`));
        }, timeoutMs);

        const onState = (state) => {
          session.latestState = state;
          if (!predicate(state)) {
            return;
          }

          clearTimeout(timeoutId);
          socket.off('room:state', onState);
          socket.off('server:error', onError);
          resolve(state);
        };

        const onError = (message) => {
          clearTimeout(timeoutId);
          socket.off('room:state', onState);
          socket.off('server:error', onError);
          reject(new Error(`${label} socket error: ${message}`));
        };

        socket.on('room:state', onState);
        socket.on('server:error', onError);
      });
    }
  };

  sockets.push(session);

  socket.on('room:state', (state) => {
    session.latestState = state;
  });

  socket.on('server:error', (message) => {
    session.errors.push(message);
  });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out connecting ${label} socket.`));
    }, 8000);

    socket.on('connect', () => {
      socket.emit('room:join', { roomCode, playerId, view });
    });

    session
      .waitForState(() => true, 8000)
      .then(() => {
        clearTimeout(timeoutId);
        resolve(session);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function emitAndWait(session, eventName, payload, predicate, timeoutMs = 8000) {
  const waitForStatePromise = session.waitForState(predicate, timeoutMs);
  session.socket.emit(eventName, payload);
  return waitForStatePromise;
}

function buildSpreadsheetBuffer() {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ['Pack Name', 'LAN Spreadsheet Pack'],
    ['Instructions', 'Fill one coherent 25-word board. Random words can be used anywhere, red and blue columns force ownership, and assassin must contain exactly one word.'],
    ['Random Words', 'Red Words', 'Blue Words', 'Assassin Word'],
    ['bridge', 'crimson', 'harbor', 'shadow'],
    ['anchor', 'ember', 'tide', ''],
    ['lantern', 'scarlet', 'signal', ''],
    ['comet', 'ruby', 'beacon', ''],
    ['meadow', 'rose', 'current', ''],
    ['river', 'coral', 'frost', ''],
    ['thunder', 'brick', 'glacier', ''],
    ['valley', 'garnet', '', ''],
    ['', 'maroon', '', '']
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Word Pack');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function saveReport(status, error = null) {
  report.finishedAt = new Date().toISOString();
  report.status = status;
  if (error) {
    report.error = error instanceof Error ? error.message : String(error);
  }

  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}

async function main() {
  previewProcess = spawn(tsxBinary, [serverEntrypoint], {
    cwd: workspaceDirectory,
    env: {
      ...process.env,
      PORT: previewPort,
      HOST: '127.0.0.1',
      SERVE_CLIENT: 'true',
      APP_BASE_URL: baseUrl
    },
    stdio: 'ignore'
  });

  await waitForHealth(`${baseUrl}/api/health`);

  const rootResponse = await fetch(baseUrl);
  const rootHtml = await rootResponse.text();

  await runCheck('Preview root and API health respond', async () => {
    assert(rootResponse.ok, 'Preview root did not return 200.');
    assert(rootHtml.includes('<!doctype html') || rootHtml.includes('<!DOCTYPE html'), 'Preview root did not return HTML.');
    const health = await apiRequest('/health');
    assert(health?.ok === true, 'Health endpoint did not report ok.');
    return { rootStatus: rootResponse.status, health };
  });

  const teacher = await apiRequest('/rooms', {
    method: 'POST',
    body: JSON.stringify({ teacherName: 'Teacher LAN' })
  });

  const alice = await apiRequest(`/rooms/${teacher.roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice' })
  });
  const bob = await apiRequest(`/rooms/${teacher.roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Bob' })
  });
  const clara = await apiRequest(`/rooms/${teacher.roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Clara' })
  });
  const dylan = await apiRequest(`/rooms/${teacher.roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Dylan' })
  });

  await runCheck('Room creation and teacher join link use preview base URL', async () => {
    const teacherLobbyState = await apiRequest(
      `/rooms/${teacher.roomCode}/state?${new URLSearchParams({ playerId: teacher.playerId, view: 'lobby' }).toString()}`
    );
    const canonicalJoinLink = `${baseUrl}/join/${teacher.roomCode}`;
    const legacyJoinLink = `${baseUrl}/room/${teacher.roomCode}/join`;
    assert(
      teacherLobbyState.joinLink === canonicalJoinLink || teacherLobbyState.joinLink === legacyJoinLink,
      'Join link does not use preview base URL.',
      {
        joinLink: teacherLobbyState.joinLink,
        canonicalJoinLink,
        legacyJoinLink
      }
    );
    assert(teacherLobbyState.joinLink === canonicalJoinLink, 'Join link is not using the canonical student route.', {
      joinLink: teacherLobbyState.joinLink
    });
    return {
      roomCode: teacher.roomCode,
      joinLink: teacherLobbyState.joinLink
    };
  });

  const teacherLobbySocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: teacher.playerId,
    view: 'lobby',
    label: 'teacher lobby'
  });
  const aliceLobbySocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: alice.playerId,
    view: 'player',
    label: 'alice lobby'
  });

  await apiRequest(`/rooms/${teacher.roomCode}/assignments`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: teacher.playerId,
      assignments: [
        { playerId: alice.playerId, team: 'red', role: 'guesser', captainOrder: 1 },
        { playerId: bob.playerId, team: 'blue', role: 'guesser', captainOrder: 1 },
        { playerId: clara.playerId, team: 'red', role: 'spymaster' },
        { playerId: dylan.playerId, team: 'blue', role: 'spymaster' }
      ]
    })
  });

  await teacherLobbySocket.waitForState((state) => state.assignments.some((entry) => entry.playerId === alice.playerId && entry.team === 'red' && entry.role === 'guesser'));

  await runCheck('Assignments survive lobby disconnect and reconnect', async () => {
    const beforeDisconnectState = teacherLobbySocket.latestState;
    const aliceAssignmentBefore = beforeDisconnectState.assignments.find((entry) => entry.playerId === alice.playerId);
    assert(aliceAssignmentBefore?.team === 'red' && aliceAssignmentBefore?.role === 'guesser', 'Alice assignment was not saved before disconnect.');

    aliceLobbySocket.socket.disconnect();
    await wait(500);

    const reconnectedAlice = await createSocketSession({
      roomCode: teacher.roomCode,
      playerId: alice.playerId,
      view: 'player',
      label: 'alice lobby reconnect'
    });

    const aliceRouteState = await apiRequest(
      `/rooms/${teacher.roomCode}/state?${new URLSearchParams({ playerId: alice.playerId, view: 'player' }).toString()}`
    );

    assert(aliceRouteState.viewer.route === 'lobby', 'Alice should still be in lobby before game start.');
    assert(aliceRouteState.viewer.team === 'red' && aliceRouteState.viewer.role === 'guesser', 'Alice role assignment changed after reconnect.');
    reconnectedAlice.socket.disconnect();

    return {
      aliceRoute: aliceRouteState.viewer.route,
      assignedRole: `${aliceRouteState.viewer.team}_${aliceRouteState.viewer.role}`
    };
  });

  const manualWords = [
    'atlas', 'bamboo', 'candle', 'delta', 'ember',
    'falcon', 'garden', 'harvest', 'island', 'jungle',
    'kernel', 'lagoon', 'meteor', 'nectar', 'orbit',
    'paddle', 'quartz', 'rocket', 'summit', 'temple',
    'utopia', 'violet', 'whistle', 'yonder', 'zenith'
  ];

  const savedManualPack = await apiRequest(`/rooms/${teacher.roomCode}/word-packs/manual/save`, {
    method: 'POST',
    body: JSON.stringify({
      playerId: teacher.playerId,
      name: 'LAN Manual Pack',
      words: manualWords.join(', ')
    })
  });

  await runCheck('Manual word pack saves and can be applied from the library', async () => {
    const listedPacks = await apiRequest(
      `/rooms/${teacher.roomCode}/word-packs?${new URLSearchParams({ playerId: teacher.playerId }).toString()}`
    );
    assert(listedPacks.some((entry) => entry.id === savedManualPack.id), 'Saved manual word pack did not appear in the library.');

    await apiRequest(`/rooms/${teacher.roomCode}/word-packs/${savedManualPack.id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ playerId: teacher.playerId })
    });

    const roomState = await apiRequest(
      `/rooms/${teacher.roomCode}/state?${new URLSearchParams({ playerId: teacher.playerId, view: 'lobby' }).toString()}`
    );
    assert(roomState.wordPack.selectedPackName === 'LAN Manual Pack', 'Applied manual word pack did not persist on room state.');
    assert(roomState.wordPack.selectedPackSourceType === 'manual', 'Manual pack source type did not persist.');

    return {
      selectedPackName: roomState.wordPack.selectedPackName,
      selectedPackSourceType: roomState.wordPack.selectedPackSourceType
    };
  });

  await runCheck('Spreadsheet word pack applies, persists, and forces the correct starting team', async () => {
    const spreadsheetBuffer = buildSpreadsheetBuffer();
    const formData = new FormData();
    formData.set('playerId', teacher.playerId);
    formData.set(
      'file',
      new Blob([spreadsheetBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      'lan-word-pack.xlsx'
    );

    await apiRequest(`/rooms/${teacher.roomCode}/word-packs/upload/apply`, {
      method: 'POST',
      body: formData
    });

    const roomState = await apiRequest(
      `/rooms/${teacher.roomCode}/state?${new URLSearchParams({ playerId: teacher.playerId, view: 'lobby' }).toString()}`
    );

    assert(roomState.wordPack.selectedPackName === 'LAN Spreadsheet Pack', 'Spreadsheet pack name did not persist on room state.');
    assert(roomState.wordPack.selectedPackSourceType === 'spreadsheet', 'Spreadsheet pack source type did not persist.');
    assert(roomState.wordPack.forcedStartingTeam === 'red', 'Spreadsheet forced starting team was not preserved.');

    return {
      selectedPackName: roomState.wordPack.selectedPackName,
      forcedStartingTeam: roomState.wordPack.forcedStartingTeam
    };
  });

  const redGuesserSocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: alice.playerId,
    view: 'player',
    label: 'red guesser'
  });
  const blueGuesserSocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: bob.playerId,
    view: 'player',
    label: 'blue guesser'
  });
  const redSpymasterSocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: clara.playerId,
    view: 'player',
    label: 'red spymaster'
  });
  const blueSpymasterSocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: dylan.playerId,
    view: 'player',
    label: 'blue spymaster'
  });

  await apiRequest(`/rooms/${teacher.roomCode}/start`, {
    method: 'POST',
    body: JSON.stringify({ playerId: teacher.playerId })
  });

  const presentationSocket = await createSocketSession({
    roomCode: teacher.roomCode,
    playerId: teacher.playerId,
    view: 'presentation',
    label: 'teacher presentation'
  });

  await runCheck('Role routing and word pack board generation are correct after game start', async () => {
    await redGuesserSocket.waitForState((state) => state.viewer.route === 'guesser');
    await blueGuesserSocket.waitForState((state) => state.viewer.route === 'guesser');
    await redSpymasterSocket.waitForState((state) => state.viewer.route === 'spymaster');
    await blueSpymasterSocket.waitForState((state) => state.viewer.route === 'spymaster');

    assert(redGuesserSocket.latestState.viewer.route === 'guesser', 'Red guesser route is incorrect.');
    assert(blueGuesserSocket.latestState.viewer.route === 'guesser', 'Blue guesser route is incorrect.');
    assert(redSpymasterSocket.latestState.viewer.route === 'spymaster', 'Red spymaster route is incorrect.');
    assert(blueSpymasterSocket.latestState.viewer.route === 'spymaster', 'Blue spymaster route is incorrect.');
    assert(redSpymasterSocket.latestState.room.currentTurnTeam === 'red', 'Spreadsheet pack did not force the red team to start.');

    const boardByWord = new Map(redSpymasterSocket.latestState.board.map((tile) => [tile.word, tile.ownerColor]));
    ['crimson', 'ember', 'scarlet', 'ruby', 'rose', 'coral', 'brick', 'garnet'].forEach((word) => {
      assert(boardByWord.get(word) === 'red', `Forced red word ${word} was not assigned to red.`);
    });
    ['harbor', 'tide', 'signal', 'beacon', 'current', 'frost', 'glacier'].forEach((word) => {
      assert(boardByWord.get(word) === 'blue', `Forced blue word ${word} was not assigned to blue.`);
    });
    assert(boardByWord.get('shadow') === 'assassin', 'Forced assassin word was not assigned correctly.');

    return {
      currentTurnTeam: redSpymasterSocket.latestState.room.currentTurnTeam,
      forcedWordsChecked: 16
    };
  });

  await runCheck('Spymaster captain permissions and clue entry are correct', async () => {
    assert(redSpymasterSocket.latestState.viewer.canEditClue === true, 'Active red captain spymaster should be able to edit the clue.');
    assert(blueSpymasterSocket.latestState.viewer.canEditClue === false, 'Inactive blue spymaster should not be able to edit the clue.');

    await emitAndWait(
      redSpymasterSocket,
      'clue:update',
      {
        roomCode: teacher.roomCode,
        playerId: clara.playerId,
        text: 'forest',
        count: 2
      },
      (state) => state.clue.text === 'forest' && state.clue.count === 2
    );

    assert(redSpymasterSocket.latestState.viewer.cluePanelState === 'done', 'Captain clue panel should lock to done after submission.');
    assert(blueSpymasterSocket.latestState.viewer.cluePanelState === 'inactive', 'Inactive spymaster clue panel should stay inactive.');

    return {
      clueText: redSpymasterSocket.latestState.clue.text,
      clueCount: redSpymasterSocket.latestState.clue.count
    };
  });

  const keyedBoard = redSpymasterSocket.latestState.board;
  const correctRedTile = keyedBoard.find((tile) => tile.ownerColor === 'red');
  const wrongRevealTile = keyedBoard.find((tile) => tile.ownerColor === 'blue' || tile.ownerColor === 'neutral');
  assert(correctRedTile, 'Could not find a red tile for validation.');
  assert(wrongRevealTile, 'Could not find a wrong tile for validation.');

  await runCheck('Subgroup chats stay isolated and persist per channel', async () => {
    redGuesserSocket.socket.emit('chat:send', {
      roomCode: teacher.roomCode,
      playerId: alice.playerId,
      message: 'Red guessers checking in'
    });
    redSpymasterSocket.socket.emit('chat:send', {
      roomCode: teacher.roomCode,
      playerId: clara.playerId,
      message: 'Red spymasters planning'
    });
    blueGuesserSocket.socket.emit('chat:send', {
      roomCode: teacher.roomCode,
      playerId: bob.playerId,
      message: 'Blue guessers checking in'
    });
    blueSpymasterSocket.socket.emit('chat:send', {
      roomCode: teacher.roomCode,
      playerId: dylan.playerId,
      message: 'Blue spymasters planning'
    });

    await wait(600);

    const redGuesserHistory = await apiRequest(
      `/rooms/${teacher.roomCode}/chat/red_guessers?${new URLSearchParams({ playerId: alice.playerId }).toString()}`
    );
    const redSpymasterHistory = await apiRequest(
      `/rooms/${teacher.roomCode}/chat/red_spymasters?${new URLSearchParams({ playerId: clara.playerId }).toString()}`
    );
    const blueGuesserHistory = await apiRequest(
      `/rooms/${teacher.roomCode}/chat/blue_guessers?${new URLSearchParams({ playerId: bob.playerId }).toString()}`
    );
    const blueSpymasterHistory = await apiRequest(
      `/rooms/${teacher.roomCode}/chat/blue_spymasters?${new URLSearchParams({ playerId: dylan.playerId }).toString()}`
    );

    assert(redGuesserHistory[0]?.message === 'Red guessers checking in', 'Red guesser chat history did not persist.');
    assert(redSpymasterHistory[0]?.message === 'Red spymasters planning', 'Red spymaster chat history did not persist.');
    assert(blueGuesserHistory[0]?.message === 'Blue guessers checking in', 'Blue guesser chat history did not persist.');
    assert(blueSpymasterHistory[0]?.message === 'Blue spymasters planning', 'Blue spymaster chat history did not persist.');
    assert(!blueGuesserHistory.some((entry) => entry.message === 'Red guessers checking in'), 'Blue guessers should not see red guesser chat.');
    assert(!blueSpymasterHistory.some((entry) => entry.message === 'Red guessers checking in'), 'Blue spymasters should not see red guesser chat.');
    assert(!redGuesserHistory.some((entry) => entry.message === 'Blue spymasters planning'), 'Red guessers should not see blue spymaster chat.');
    assert(!redSpymasterHistory.some((entry) => entry.message === 'Blue guessers checking in'), 'Red spymasters should not see blue guesser chat.');

    return {
      redGuesserTopMessage: redGuesserHistory[0]?.message,
      redSpymasterTopMessage: redSpymasterHistory[0]?.message,
      blueGuesserTopMessage: blueGuesserHistory[0]?.message,
      blueSpymasterTopMessage: blueSpymasterHistory[0]?.message
    };
  });

  await runCheck('Active and passive voting stay separated while presentation shows active tallies', async () => {
    await emitAndWait(
      redGuesserSocket,
      'vote:cast',
      {
        roomCode: teacher.roomCode,
        playerId: alice.playerId,
        tileId: correctRedTile.id
      },
      (state) => state.board.some((tile) => tile.id === correctRedTile.id && tile.isViewerVote)
    );

    await emitAndWait(
      redGuesserSocket,
      'vote:cast',
      {
        roomCode: teacher.roomCode,
        playerId: alice.playerId,
        tileId: wrongRevealTile.id
      },
      (state) => state.board.some((tile) => tile.id === wrongRevealTile.id && tile.isViewerVote)
    );

    await emitAndWait(
      blueGuesserSocket,
      'vote:cast',
      {
        roomCode: teacher.roomCode,
        playerId: bob.playerId,
        tileId: wrongRevealTile.id
      },
      (state) => state.board.some((tile) => tile.id === wrongRevealTile.id && tile.isViewerVote)
    );

    await Promise.all([
      redGuesserSocket.waitForState((state) => {
        const tile = state.board.find((entry) => entry.id === wrongRevealTile.id);
        return tile?.voteCount === 1 && tile?.redVoteCount === 1;
      }),
      blueGuesserSocket.waitForState((state) => {
        const tile = state.board.find((entry) => entry.id === wrongRevealTile.id);
        return tile?.voteCount === 1 && tile?.blueVoteCount === 1;
      }),
      redSpymasterSocket.waitForState((state) => {
        const tile = state.board.find((entry) => entry.id === wrongRevealTile.id);
        return tile?.voteCount === 1 && tile?.redVoteCount === 1;
      }),
      blueSpymasterSocket.waitForState((state) => {
        const tile = state.board.find((entry) => entry.id === wrongRevealTile.id);
        return tile?.voteCount === 1 && tile?.redVoteCount === 1;
      }),
      presentationSocket.waitForState((state) => {
        const tile = state.board.find((entry) => entry.id === wrongRevealTile.id);
        return tile?.voteCount === 1;
      })
    ]);

    const presentationWrongTile = presentationSocket.latestState.board.find((tile) => tile.id === wrongRevealTile.id);
    const redGuesserWrongTile = redGuesserSocket.latestState.board.find((tile) => tile.id === wrongRevealTile.id);
    const blueWrongTile = blueGuesserSocket.latestState.board.find((tile) => tile.id === wrongRevealTile.id);
    const redSpymasterWrongTile = redSpymasterSocket.latestState.board.find((tile) => tile.id === wrongRevealTile.id);
    const blueSpymasterWrongTile = blueSpymasterSocket.latestState.board.find((tile) => tile.id === wrongRevealTile.id);

    assert(presentationWrongTile?.voteCount === 1, 'Presentation should only show active-team tallies.');
    assertTileVoteState(
      redGuesserWrongTile,
      { voteCount: 1, redVoteCount: 1, blueVoteCount: 0 },
      'Red guesser should not see blue passive tallies.'
    );
    assertTileVoteState(
      redSpymasterWrongTile,
      { voteCount: 1, redVoteCount: 1, blueVoteCount: 0 },
      'Red spymaster should not see blue passive tallies.'
    );
    assertTileVoteState(
      blueSpymasterWrongTile,
      { voteCount: 1, redVoteCount: 1, blueVoteCount: 0 },
      'Blue spymaster should not see blue passive tallies.'
    );
    assertTileVoteState(
      blueWrongTile,
      { voteCount: 1, redVoteCount: 1, blueVoteCount: 1 },
      'Blue passive guesser should see its own passive tally without collapsing the active tally.'
    );
    assertTileVoteState(
      presentationWrongTile,
      { voteCount: 1, redVoteCount: 1, blueVoteCount: 0 },
      'Presentation state should keep only active tallies by default.'
    );

    [
      teacherLobbySocket,
      redGuesserSocket,
      blueGuesserSocket,
      redSpymasterSocket,
      blueSpymasterSocket,
      presentationSocket
    ].forEach(assertSocketHasNoErrors);

    return {
      presentationVoteCount: presentationWrongTile?.voteCount,
      redGuesserBlueVotesVisible: redGuesserWrongTile?.blueVoteCount,
      bluePassiveVoteCount: blueWrongTile?.blueVoteCount
    };
  });

  await runCheck('Teacher reveal flow, summary pause, and continue-to-next-turn all work', async () => {
    await emitAndWait(
      presentationSocket,
      'tile:reveal',
      {
        roomCode: teacher.roomCode,
        playerId: teacher.playerId,
        tileId: correctRedTile.id
      },
      (state) => state.board.some((tile) => tile.id === correctRedTile.id && tile.isRevealed)
    );

    assert(presentationSocket.latestState.room.gamePhase === 'guessing', 'Game should still be guessing after a correct reveal.');
    assert(presentationSocket.latestState.clue.remainingReveals === 2, 'Remaining reveals should decrement after a correct reveal.');

    blueGuesserSocket.socket.disconnect();
    await wait(500);
    const blueGuesserReconnect = await createSocketSession({
      roomCode: teacher.roomCode,
      playerId: bob.playerId,
      view: 'player',
      label: 'blue guesser reconnect'
    });
    assert(blueGuesserReconnect.latestState.viewer.route === 'guesser', 'Blue guesser did not return to the guesser route after reconnect.');
    assert(blueGuesserReconnect.latestState.viewer.canPassiveVote === true, 'Blue guesser should still be in passive voting mode during the red turn.');

    await emitAndWait(
      presentationSocket,
      'tile:reveal',
      {
        roomCode: teacher.roomCode,
        playerId: teacher.playerId,
        tileId: wrongRevealTile.id
      },
      (state) => state.room.gamePhase === 'summary'
    );

    await redGuesserSocket.waitForState((state) => state.room.gamePhase === 'summary');
    await redSpymasterSocket.waitForState((state) => state.room.gamePhase === 'summary');

    assert(presentationSocket.latestState.roundSummary?.endReason === 'wrong_reveal', 'Wrong reveal should create a summary pause.');
    assert(redGuesserSocket.latestState.room.gamePhase === 'summary', 'Guesser screen should also be paused in summary phase.');
    assert(redSpymasterSocket.latestState.room.gamePhase === 'summary', 'Spymaster screen should also be paused in summary phase.');

    await emitAndWait(
      presentationSocket,
      'turn:advance',
      {
        roomCode: teacher.roomCode,
        playerId: teacher.playerId
      },
      (state) => state.room.gamePhase === 'guessing' && state.room.currentTurnTeam === 'blue'
    );

    await redGuesserSocket.waitForState(
      (state) => state.room.gamePhase === 'guessing' && state.room.currentTurnTeam === 'blue'
    );
    await blueGuesserReconnect.waitForState(
      (state) => state.room.gamePhase === 'guessing' && state.room.currentTurnTeam === 'blue'
    );

    assert(presentationSocket.latestState.roundSummary === null, 'Summary should clear once the teacher continues.');
    assert(presentationSocket.latestState.room.currentTurnTeam === 'blue', 'Turn should advance to blue.');
    assert(redGuesserSocket.latestState.viewer.canPassiveVote === false, 'Red guesser should wait for the next clue before passive voting opens.');
    assert(blueGuesserReconnect.latestState.viewer.canVote === false, 'Blue guesser should wait for the blue clue before active voting opens.');
    assert(blueSpymasterSocket.latestState.viewer.canEditClue === true, 'Blue spymaster captain should be able to open the next clue after continue.');

    blueGuesserReconnect.socket.disconnect();

    [
      teacherLobbySocket,
      redGuesserSocket,
      redSpymasterSocket,
      blueSpymasterSocket,
      presentationSocket
    ].forEach(assertSocketHasNoErrors);

    return {
      postSummaryTurn: presentationSocket.latestState.room.currentTurnTeam,
      summaryReason: 'wrong_reveal',
      nextClueOwner: blueSpymasterSocket.latestState.viewer.name
    };
  });

  await runCheck('No unexpected socket runtime errors were emitted during validation', async () => {
    [
      teacherLobbySocket,
      redGuesserSocket,
      blueGuesserSocket,
      redSpymasterSocket,
      blueSpymasterSocket,
      presentationSocket
    ].forEach(assertSocketHasNoErrors);

    return {
      checkedSessions: [
        teacherLobbySocket.label,
        redGuesserSocket.label,
        blueGuesserSocket.label,
        redSpymasterSocket.label,
        blueSpymasterSocket.label,
        presentationSocket.label
      ]
    };
  });

  report.notes.push(`Automated validation artifact saved to ${reportPath}`);
}

main()
  .then(async () => {
    await saveReport('passed');
  })
  .catch(async (error) => {
    await saveReport('failed', error);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    sockets.forEach((session) => {
      try {
        session.socket.disconnect();
      } catch {}
    });

    if (previewProcess?.pid) {
      previewProcess.kill('SIGTERM');
    }
  });
