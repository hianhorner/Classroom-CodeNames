import {
  formatRoleLabel,
  getChannelKey,
  getRouteForRole,
  otherTeam,
  type AssignmentSummary,
  type AssignmentUpdateInput,
  type BoardTileView,
  type ChannelKey,
  type ChatMessageView,
  type GameResultSummary,
  type GamePhase,
  type OwnerColor,
  type RoundSummary,
  type RoundSummaryReason,
  type RoundSummaryReveal,
  type Role,
  type RoomStateView,
  type RoomStatus,
  type RoomViewState,
  type Team,
  type TeamStatusSummary,
  type TimerState,
  type VoteScope
} from '@classroom-codenames/shared';
import { config } from '../config';
import { DEFAULT_WORD_BANK } from '../constants/words';
import { db } from '../db/database';
import { createWordPackEntries, getAppliedWordPackConfig } from './wordPackService';
import { AppError } from '../utils/AppError';
import { createId, createRoomCode } from '../utils/ids';

type RoomRow = {
  id: string;
  room_code: string;
  created_by_player_id: string;
  status: RoomStatus;
  game_phase: GamePhase;
  current_turn_team: Team | null;
  turn_number: number;
  timer_enabled: number;
  timer_seconds: number;
  timer_remaining_seconds: number;
  timer_state: TimerState;
  current_clue_text: string | null;
  current_clue_count: number;
  current_clue_reveals_remaining: number;
  current_round_summary_json: string | null;
  current_game_result_summary_json: string | null;
  selected_word_pack_id: string | null;
  selected_word_pack_config_json: string | null;
  winning_team: Team | null;
  created_at: string;
  updated_at: string;
};

type PlayerRow = {
  id: string;
  room_id: string;
  name: string;
  socket_id: string | null;
  is_teacher: number;
  is_connected: number;
  joined_at: string;
  last_seen_at: string;
};

type AssignmentRow = {
  id: string;
  room_id: string;
  player_id: string;
  team: Team | null;
  role: Role | null;
  captain_order: number | null;
  is_current_captain: number;
  is_current_spymaster_captain: number;
  created_at: string;
  updated_at: string;
};

type BoardRow = {
  id: string;
  room_id: string;
  seed: string;
  created_at: string;
};

type TileRow = {
  id: string;
  board_id: string;
  position: number;
  word: string;
  owner_color: OwnerColor;
  is_revealed: number;
  is_locked: number;
  locked_by_team: Team | null;
  locked_at: string | null;
  revealed_at: string | null;
};

type VoteRow = {
  id: string;
  room_id: string;
  turn_number: number;
  tile_id: string;
  player_id: string;
  team: Team;
  scope: VoteScope;
  created_at: string;
};

type GameEventRow = {
  event_type: string;
  payload_json: string;
  created_at: string;
};

type ClueUpdatedEventPayload = {
  playerId: string;
  text: string;
  count: number;
  team: Team;
};

type VoteCastEventPayload = {
  playerId: string;
  tileId: string;
  turnNumber: number;
  scope: VoteScope;
};

type RevealEventPayload = {
  turnNumber: number;
  tileId: string;
  word: string;
  ownerColor: OwnerColor;
  activeVotesOnTile: number;
  activeVotesTotal: number;
  passiveVotesOnTile: number;
  passiveVotesTotal: number;
};

type RoundSummaryCreatedEventPayload = {
  turnNumber: number;
  endReason: RoundSummaryReason;
  nextTeam: Team | null;
  winningTeam: Team | null;
};

type ChatRow = {
  id: string;
  room_id: string;
  channel_key: ChannelKey;
  player_id: string;
  message: string;
  created_at: string;
  player_name: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function shuffle<T>(items: T[]): T[] {
  const output = [...items];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

function getRoomRow(roomCode: string): RoomRow {
  const room = db
    .prepare('SELECT * FROM rooms WHERE room_code = ?')
    .get(roomCode) as RoomRow | undefined;

  if (!room) {
    throw new AppError('Room not found.', 404);
  }

  return room;
}

function getPlayerRow(roomId: string, playerId: string): PlayerRow {
  const player = db
    .prepare('SELECT * FROM players WHERE room_id = ? AND id = ?')
    .get(roomId, playerId) as PlayerRow | undefined;

  if (!player) {
    throw new AppError('Player not found in this room.', 404);
  }

  return player;
}

function getAssignmentRow(roomId: string, playerId: string): AssignmentRow {
  const assignment = db
    .prepare('SELECT * FROM assignments WHERE room_id = ? AND player_id = ?')
    .get(roomId, playerId) as AssignmentRow | undefined;

  if (!assignment) {
    throw new AppError('Assignment not found for this player.', 404);
  }

  return assignment;
}

function assertTeacher(room: RoomRow, playerId: string): PlayerRow {
  const player = getPlayerRow(room.id, playerId);

  if (!player.is_teacher) {
    throw new AppError('Only the teacher can perform that action.', 403);
  }

  return player;
}

function touchRoom(roomId: string): void {
  db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(nowIso(), roomId);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function recordEvent(roomId: string, eventType: string, payload: Record<string, unknown>): void {
  db.prepare(
    `
      INSERT INTO game_events (id, room_id, event_type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
  ).run(createId(), roomId, eventType, JSON.stringify(payload), nowIso());
}

function getPlayers(roomId: string): PlayerRow[] {
  return db
    .prepare('SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC')
    .all(roomId) as PlayerRow[];
}

function getAssignments(roomId: string): AssignmentRow[] {
  return db
    .prepare('SELECT * FROM assignments WHERE room_id = ? ORDER BY updated_at ASC')
    .all(roomId) as AssignmentRow[];
}

function getBoard(roomId: string): BoardRow | undefined {
  return db.prepare('SELECT * FROM boards WHERE room_id = ?').get(roomId) as BoardRow | undefined;
}

function getTiles(boardId: string): TileRow[] {
  return db
    .prepare('SELECT * FROM board_tiles WHERE board_id = ? ORDER BY position ASC')
    .all(boardId) as TileRow[];
}

function getVotes(roomId: string, turnNumber: number): VoteRow[] {
  return db
    .prepare('SELECT * FROM votes WHERE room_id = ? AND turn_number = ? ORDER BY created_at ASC')
    .all(roomId, turnNumber) as VoteRow[];
}

function clearVotes(roomId: string, turnNumber: number): void {
  db.prepare('DELETE FROM votes WHERE room_id = ? AND turn_number = ?').run(roomId, turnNumber);
}

function clearVotesForTile(roomId: string, turnNumber: number, tileId: string): void {
  db.prepare('DELETE FROM votes WHERE room_id = ? AND turn_number = ? AND tile_id = ?').run(roomId, turnNumber, tileId);
}

function getVoteScopeForAssignment(room: RoomRow, assignment: AssignmentRow): VoteScope | null {
  if (assignment.role !== 'guesser' || !assignment.team || !room.current_turn_team) {
    return null;
  }

  return assignment.team === room.current_turn_team ? 'active' : 'passive';
}

function getGameEvents(roomId: string, eventType: string): GameEventRow[] {
  return db
    .prepare(
      `
        SELECT event_type, payload_json, created_at
        FROM game_events
        WHERE room_id = ?
          AND event_type = ?
        ORDER BY created_at ASC
      `
    )
    .all(roomId, eventType) as GameEventRow[];
}

function getRevealEventsForTurn(roomId: string, turnNumber: number): RevealEventPayload[] {
  return getGameEvents(roomId, 'tile_revealed')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as RevealEventPayload;
      } catch {
        return null;
      }
    })
    .filter((payload): payload is RevealEventPayload => payload !== null && payload.turnNumber === turnNumber);
}

function getVoteCastEventsForTurn(roomId: string, turnNumber: number): VoteCastEventPayload[] {
  return getGameEvents(roomId, 'vote_cast')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as VoteCastEventPayload;
      } catch {
        return null;
      }
    })
    .filter(
      (payload): payload is VoteCastEventPayload =>
        payload !== null &&
        payload.turnNumber === turnNumber &&
        typeof payload.playerId === 'string' &&
        (payload.scope === 'active' || payload.scope === 'passive')
    );
}

function getVoteCastEvents(roomId: string): VoteCastEventPayload[] {
  return getGameEvents(roomId, 'vote_cast')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as VoteCastEventPayload;
      } catch {
        return null;
      }
    })
    .filter(
      (payload): payload is VoteCastEventPayload =>
        payload !== null &&
        typeof payload.playerId === 'string' &&
        typeof payload.tileId === 'string' &&
        typeof payload.turnNumber === 'number' &&
        (payload.scope === 'active' || payload.scope === 'passive')
    );
}

function parseRoundSummary(rawValue: string | null): RoundSummary | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as RoundSummary;
  } catch {
    return null;
  }
}

function parseGameResultSummary(rawValue: string | null): GameResultSummary | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as GameResultSummary;
  } catch {
    return null;
  }
}

function clearLocks(boardId: string): void {
  db.prepare(
    `
      UPDATE board_tiles
      SET is_locked = 0,
          locked_by_team = NULL,
          locked_at = NULL
      WHERE board_id = ?
    `
  ).run(boardId);
}

function normalizeCaptainOrders(roomId: string): void {
  (['red', 'blue'] as Team[]).forEach((team) => {
    const guessers = db
      .prepare(
        `
          SELECT assignments.id
          FROM assignments
          JOIN players ON players.id = assignments.player_id
          WHERE assignments.room_id = ?
            AND assignments.team = ?
            AND assignments.role = 'guesser'
            AND players.is_teacher = 0
            AND players.is_connected = 1
          ORDER BY
            CASE WHEN assignments.captain_order IS NULL THEN 9999 ELSE assignments.captain_order END ASC,
            players.joined_at ASC
        `
      )
      .all(roomId, team) as Array<{ id: string }>;

    guessers.forEach((row, index) => {
      db.prepare('UPDATE assignments SET captain_order = ? WHERE id = ?').run(index + 1, row.id);
    });
  });
}

function resetCurrentCaptains(roomId: string): void {
  db.prepare(
    `
      UPDATE assignments
      SET is_current_captain = 0,
          is_current_spymaster_captain = 0
      WHERE room_id = ?
    `
  ).run(roomId);

  (['red', 'blue'] as Team[]).forEach((team) => {
    const firstGuesser = db
      .prepare(
        `
          SELECT assignments.id
          FROM assignments
          JOIN players ON players.id = assignments.player_id
          WHERE assignments.room_id = ?
            AND assignments.team = ?
            AND assignments.role = 'guesser'
            AND players.is_teacher = 0
            AND players.is_connected = 1
          ORDER BY
            CASE WHEN assignments.captain_order IS NULL THEN 9999 ELSE assignments.captain_order END ASC,
            players.joined_at ASC
          LIMIT 1
        `
      )
      .get(roomId, team) as { id: string } | undefined;

    if (firstGuesser) {
      db.prepare('UPDATE assignments SET is_current_captain = 1 WHERE id = ?').run(firstGuesser.id);
    }

    const firstSpymaster = db
      .prepare(
        `
          SELECT assignments.id
          FROM assignments
          JOIN players ON players.id = assignments.player_id
          WHERE assignments.room_id = ?
            AND assignments.team = ?
            AND assignments.role = 'spymaster'
            AND players.is_teacher = 0
            AND players.is_connected = 1
          ORDER BY players.joined_at ASC
          LIMIT 1
        `
      )
      .get(roomId, team) as { id: string } | undefined;

    if (firstSpymaster) {
      db.prepare('UPDATE assignments SET is_current_spymaster_captain = 1 WHERE id = ?').run(firstSpymaster.id);
    }
  });
}

function rotateCaptain(roomId: string, team: Team): void {
  const guessers = db
    .prepare(
      `
        SELECT assignments.id, assignments.captain_order, assignments.is_current_captain, players.joined_at
        FROM assignments
        JOIN players ON players.id = assignments.player_id
        WHERE assignments.room_id = ?
          AND assignments.team = ?
          AND assignments.role = 'guesser'
          AND players.is_teacher = 0
          AND players.is_connected = 1
        ORDER BY
          CASE WHEN assignments.captain_order IS NULL THEN 9999 ELSE assignments.captain_order END ASC,
          players.joined_at ASC
      `
    )
    .all(roomId, team) as Array<{ id: string; captain_order: number | null; is_current_captain: number; joined_at: string }>;

  if (!guessers.length) {
    return;
  }

  const currentIndex = guessers.findIndex((row) => row.is_current_captain === 1);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % guessers.length;

  db.prepare(
    `
      UPDATE assignments
      SET is_current_captain = CASE WHEN id = ? THEN 1 ELSE 0 END
      WHERE room_id = ?
        AND team = ?
        AND role = 'guesser'
    `
  ).run(guessers[nextIndex].id, roomId, team);
}

function rotateSpymasterCaptain(roomId: string, team: Team): void {
  const spymasters = db
    .prepare(
      `
        SELECT assignments.id, assignments.is_current_spymaster_captain, players.joined_at
        FROM assignments
        JOIN players ON players.id = assignments.player_id
        WHERE assignments.room_id = ?
          AND assignments.team = ?
          AND assignments.role = 'spymaster'
          AND players.is_teacher = 0
          AND players.is_connected = 1
        ORDER BY players.joined_at ASC
      `
    )
    .all(roomId, team) as Array<{ id: string; is_current_spymaster_captain: number; joined_at: string }>;

  if (!spymasters.length) {
    return;
  }

  const currentIndex = spymasters.findIndex((row) => row.is_current_spymaster_captain === 1);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % spymasters.length;

  db.prepare(
    `
      UPDATE assignments
      SET is_current_spymaster_captain = CASE WHEN id = ? THEN 1 ELSE 0 END
      WHERE room_id = ?
        AND team = ?
        AND role = 'spymaster'
    `
  ).run(spymasters[nextIndex].id, roomId, team);
}

function createBoardTiles(
  startingTeam: Team,
  selectedWordPack: ReturnType<typeof getAppliedWordPackConfig>
): Array<{ position: number; word: string; ownerColor: OwnerColor }> {
  const entries = selectedWordPack
    ? createWordPackEntries(selectedWordPack, startingTeam)
    : (() => {
        const words = shuffle(DEFAULT_WORD_BANK).slice(0, 25);

        if (words.length < 25) {
          throw new AppError('The default word bank does not contain enough words.', 500);
        }

        const colors: OwnerColor[] = shuffle([
          ...Array.from({ length: startingTeam === 'red' ? 9 : 8 }, () => 'red' as const),
          ...Array.from({ length: startingTeam === 'blue' ? 9 : 8 }, () => 'blue' as const),
          ...Array.from({ length: 7 }, () => 'neutral' as const),
          'assassin' as const
        ]);

        return words.map((word, index) => ({
          word,
          ownerColor: colors[index]!
        }));
      })();

  return entries.map((entry, position) => ({
    position,
    word: entry.word,
    ownerColor: entry.ownerColor
  }));
}

function getChatHistory(roomId: string, channelKey: ChannelKey | null): ChatMessageView[] {
  if (!channelKey) {
    return [];
  }

  const rows = db
    .prepare(
      `
        SELECT chat_messages.id, chat_messages.room_id, chat_messages.channel_key, chat_messages.player_id,
               chat_messages.message, chat_messages.created_at, players.name AS player_name
        FROM chat_messages
        JOIN players ON players.id = chat_messages.player_id
        WHERE chat_messages.room_id = ?
          AND chat_messages.channel_key = ?
        ORDER BY chat_messages.created_at DESC
      `
    )
    .all(roomId, channelKey) as ChatRow[];

  return rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    message: row.message,
    createdAt: row.created_at
  }));
}

function getRoomJoinLink(roomCode: string): string {
  return `${config.publicAppUrl}/join/${roomCode}`;
}

function formatAccuracy(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildRoundOutcome(
  endReason: RoundSummaryReason,
  activeTeam: Team,
  nextTeam: Team | null,
  winningTeam: Team | null
): { outcomeLabel: string; outcomeDetail: string } {
  const activeTeamLabel = activeTeam === 'red' ? 'Red Team' : 'Blue Team';
  const nextTeamLabel = nextTeam ? (nextTeam === 'red' ? 'Red Team' : 'Blue Team') : null;
  const winningTeamLabel = winningTeam ? (winningTeam === 'red' ? 'Red Team' : 'Blue Team') : null;

  switch (endReason) {
    case 'teacher_ended':
      return {
        outcomeLabel: 'Teacher Ended Round Early',
        outcomeDetail: nextTeamLabel
          ? `The teacher ended the round early. ${nextTeamLabel} is up next.`
          : 'The teacher ended the round early.'
      };
    case 'turn_completed':
      return {
        outcomeLabel: 'Round Complete',
        outcomeDetail: nextTeamLabel
          ? `${activeTeamLabel} completed the standard clue guesses and ended the turn. ${nextTeamLabel} is up next.`
          : `${activeTeamLabel} completed the standard clue guesses and ended the turn.`
      };
    case 'allowance_exhausted':
      return {
        outcomeLabel: 'Great Round',
        outcomeDetail: nextTeamLabel
          ? `${activeTeamLabel} used the full clue allowance. ${nextTeamLabel} is up next.`
          : `${activeTeamLabel} used the full clue allowance.`
      };
    case 'wrong_reveal':
      return {
        outcomeLabel: 'Turn Ends',
        outcomeDetail: nextTeamLabel
          ? `${activeTeamLabel} hit the wrong card. ${nextTeamLabel} takes the next turn.`
          : `${activeTeamLabel} hit the wrong card.`
      };
    case 'assassin':
      return {
        outcomeLabel: 'Assassin Revealed',
        outcomeDetail: winningTeamLabel
          ? `${winningTeamLabel} wins the game immediately.`
          : 'The assassin ended the game.'
      };
    case 'team_completed':
      return {
        outcomeLabel: `${activeTeamLabel} Wins`,
        outcomeDetail: `${activeTeamLabel} revealed every remaining word.`
      };
    case 'opponent_completed':
      return {
        outcomeLabel: winningTeamLabel ? `${winningTeamLabel} Wins` : 'Game Over',
        outcomeDetail: winningTeamLabel
          ? `${winningTeamLabel} completed their board during the reveal sequence.`
          : 'The reveal completed the board.'
      };
  }
}

function isBonusRevealAvailable(room: RoomRow): boolean {
  return (
    room.status === 'in_progress' &&
    room.game_phase === 'guessing' &&
    Boolean(room.current_clue_text) &&
    room.current_clue_reveals_remaining === 1
  );
}

function computeActiveAccuracy(
  activeTeam: Team,
  activeVotes: VoteRow[],
  tileMap: Map<string, TileRow>
): number | null {
  if (!activeVotes.length) {
    return null;
  }

  const correctVotes = activeVotes.filter((vote) => tileMap.get(vote.tile_id)?.owner_color === activeTeam).length;
  return formatAccuracy((correctVotes / activeVotes.length) * 100);
}

function computePassiveAccuracyFromTileIds(
  passiveVoteTileIds: string[],
  revealEvents: RevealEventPayload[]
): number | null {
  if (!passiveVoteTileIds.length) {
    return null;
  }

  const revealedTileIds = new Set(revealEvents.map((event) => event.tileId));
  const correctVotes = passiveVoteTileIds.filter((tileId) => revealedTileIds.has(tileId)).length;
  return formatAccuracy((correctVotes / passiveVoteTileIds.length) * 100);
}

function buildRoundSummary(
  room: RoomRow,
  activeTeam: Team,
  votesSnapshot: VoteRow[],
  tiles: TileRow[],
  endReason: RoundSummaryReason,
  nextTeam: Team | null,
  winningTeam: Team | null
): RoundSummary {
  const revealEvents = getRevealEventsForTurn(room.id, room.turn_number);
  const activeVotes = votesSnapshot.filter((vote) => vote.scope === 'active');
  const passiveVotes = votesSnapshot.filter((vote) => vote.scope === 'passive');
  const tileMap = new Map(tiles.map((tile) => [tile.id, tile]));
  const voteCastEvents = getVoteCastEventsForTurn(room.id, room.turn_number);
  const passiveVoteTileIdsForSummary =
    passiveVotes.length > 0
      ? passiveVotes.map((vote) => vote.tile_id)
      : voteCastEvents.filter((event) => event.scope === 'passive').map((event) => event.tileId);
  const activeVoterIds = new Set(
    voteCastEvents.filter((event) => event.scope === 'active').map((event) => event.playerId)
  );
  const passiveVoterIds = new Set(
    voteCastEvents.filter((event) => event.scope === 'passive').map((event) => event.playerId)
  );
  const reveals: RoundSummaryReveal[] = revealEvents.map((event) => ({
    tileId: event.tileId,
    word: event.word,
    ownerColor: event.ownerColor,
    activeVotesOnTile: event.activeVotesOnTile,
    passiveVotesOnTile: event.passiveVotesOnTile
  }));
  const wordsRevealed = reveals.filter((reveal) => reveal.ownerColor === activeTeam).length;
  const { outcomeLabel, outcomeDetail } = buildRoundOutcome(endReason, activeTeam, nextTeam, winningTeam);

  return {
    activeTeam,
    nextTeam,
    winningTeam,
    clueText: room.current_clue_text ?? '',
    clueCount: room.current_clue_count || 1,
    endReason,
    outcomeLabel,
    outcomeDetail,
    wordsRevealed,
    activeVoteAccuracy: computeActiveAccuracy(activeTeam, activeVotes, tileMap),
    passiveVoteAccuracy: computePassiveAccuracyFromTileIds(passiveVoteTileIdsForSummary, revealEvents),
    activeVoterCount: activeVoterIds.size,
    passiveVoterCount: passiveVoterIds.size,
    revealSequence: reveals
  };
}

function getStartingTeamForRoom(roomId: string): Team | null {
  const payload = getGameEvents(roomId, 'game_started')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as { startingTeam?: Team };
      } catch {
        return null;
      }
    })
    .find((entry): entry is { startingTeam: Team } => entry !== null && (entry.startingTeam === 'red' || entry.startingTeam === 'blue'));

  return payload?.startingTeam ?? null;
}

function getClueEventsByTurn(roomId: string): Map<number, ClueUpdatedEventPayload> {
  const clueEvents = getGameEvents(roomId, 'clue_updated')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as ClueUpdatedEventPayload;
      } catch {
        return null;
      }
    })
    .filter((payload): payload is ClueUpdatedEventPayload => payload !== null);

  return new Map(clueEvents.map((payload, index) => [index + 1, payload]));
}

function getRoundSummaryEventsByTurn(roomId: string): Map<number, RoundSummaryCreatedEventPayload> {
  const summaryEvents = getGameEvents(roomId, 'round_summary_created')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as RoundSummaryCreatedEventPayload;
      } catch {
        return null;
      }
    })
    .filter(
      (payload): payload is RoundSummaryCreatedEventPayload =>
        payload !== null &&
        typeof payload.turnNumber === 'number' &&
        (payload.endReason === 'teacher_ended' ||
          payload.endReason === 'turn_completed' ||
          payload.endReason === 'allowance_exhausted' ||
          payload.endReason === 'wrong_reveal' ||
          payload.endReason === 'assassin' ||
          payload.endReason === 'team_completed' ||
          payload.endReason === 'opponent_completed')
    );

  return new Map(summaryEvents.map((payload) => [payload.turnNumber, payload]));
}

function buildGameResultSummary(
  room: RoomRow,
  tiles: TileRow[],
  finalRoundSummary: RoundSummary
): GameResultSummary | null {
  const winningTeam = finalRoundSummary.winningTeam;

  if (!winningTeam) {
    return null;
  }

  const startingTeam = getStartingTeamForRoom(room.id);

  if (!startingTeam) {
    return null;
  }

  const players = getPlayers(room.id);
  const assignments = getAssignments(room.id);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const assignmentByPlayerId = new Map(assignments.map((assignment) => [assignment.player_id, assignment]));
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
  const revealEvents = getGameEvents(room.id, 'tile_revealed')
    .map((event) => {
      try {
        return JSON.parse(event.payload_json) as RevealEventPayload;
      } catch {
        return null;
      }
    })
    .filter((payload): payload is RevealEventPayload => payload !== null);
  const voteCastEvents = getVoteCastEvents(room.id);
  const revealsByTurn = new Map<number, RevealEventPayload[]>();
  const clueByTurn = getClueEventsByTurn(room.id);
  const roundSummaryByTurn = getRoundSummaryEventsByTurn(room.id);
  const voteEventsByTurn = new Map<number, VoteCastEventPayload[]>();

  revealEvents.forEach((payload) => {
    const existing = revealsByTurn.get(payload.turnNumber) ?? [];
    existing.push(payload);
    revealsByTurn.set(payload.turnNumber, existing);
  });

  voteCastEvents.forEach((payload) => {
    const existing = voteEventsByTurn.get(payload.turnNumber) ?? [];
    existing.push(payload);
    voteEventsByTurn.set(payload.turnNumber, existing);
  });

  let winningTurnRevealCount = 0;
  let winningActiveHitReveals = 0;
  let winningPassiveHitReveals = 0;
  let winningCorrectReveals = 0;
  const mistakeCounts = {
    neutral: 0,
    opponent: 0,
    assassin: 0,
    total: 0
  };
  let bestRead: GameResultSummary['bestRead'] = null;
  let bestGuesser: GameResultSummary['bestGuesser'] = null;
  let mostContestedWord: GameResultSummary['mostContestedWord'] = null;
  let sharpestPrediction: GameResultSummary['sharpestPrediction'] = null;
  let cleanestRound: GameResultSummary['cleanestRound'] = null;
  const roundHistory: GameResultSummary['roundHistory'] = [];
  const roundNumbers = Array.from(
    new Set([...clueByTurn.keys(), ...revealsByTurn.keys(), ...voteEventsByTurn.keys(), ...roundSummaryByTurn.keys()])
  ).sort((left, right) => left - right);
  const teamActiveTotals: Record<Team, { correct: number; total: number }> = {
    red: { correct: 0, total: 0 },
    blue: { correct: 0, total: 0 }
  };
  const teamPassiveTotals: Record<Team, { correct: number; total: number }> = {
    red: { correct: 0, total: 0 },
    blue: { correct: 0, total: 0 }
  };
  const playerActiveTotals = new Map<string, { correct: number; total: number; playerName: string; team: Team; joinedAt: string }>();
  const contestedWords = new Map<string, { word: string; activeVotes: number; passiveVotes: number; totalVotes: number }>();

  const orderedUniqueWords = (events: VoteCastEventPayload[]) => {
    const seen = new Set<string>();
    const words: string[] = [];

    events.forEach((event) => {
      const word = tileById.get(event.tileId)?.word;

      if (!word || seen.has(word)) {
        return;
      }

      seen.add(word);
      words.push(word);
    });

    return words;
  };

  revealsByTurn.forEach((turnReveals, turnNumber) => {
    const activeTeam = turnNumber % 2 === 1 ? startingTeam : otherTeam(startingTeam);

    if (activeTeam !== winningTeam) {
      return;
    }

    const turnRevealCount = turnReveals.length;
    let turnHitReveals = 0;
    let turnCorrectReveals = 0;
    winningTurnRevealCount += turnRevealCount;

    turnReveals.forEach((reveal) => {
      if (reveal.passiveVotesOnTile > 0) {
        winningPassiveHitReveals += 1;
      }

      if (reveal.ownerColor === winningTeam && reveal.activeVotesOnTile > 0) {
        winningActiveHitReveals += 1;
        turnHitReveals += 1;
      }

      if (reveal.ownerColor === winningTeam) {
        winningCorrectReveals += 1;
        turnCorrectReveals += 1;
      } else if (reveal.ownerColor === 'neutral') {
        mistakeCounts.neutral += 1;
        mistakeCounts.total += 1;
      } else if (reveal.ownerColor === 'assassin') {
        mistakeCounts.assassin += 1;
        mistakeCounts.total += 1;
      } else {
        mistakeCounts.opponent += 1;
        mistakeCounts.total += 1;
      }
    });

    const turnAccuracy = turnRevealCount > 0 ? formatAccuracy((turnHitReveals / turnRevealCount) * 100) : null;
    const currentBestAccuracy = bestRead?.activeVoteAccuracy ?? -1;
    const nextBestAccuracy = turnAccuracy ?? -1;

    if (
      !bestRead ||
      nextBestAccuracy > currentBestAccuracy ||
      (nextBestAccuracy === currentBestAccuracy && turnCorrectReveals > bestRead.correctReveals)
    ) {
      bestRead = {
        turnNumber,
        clueText: clueByTurn.get(turnNumber)?.text ?? null,
        activeVoteAccuracy: turnAccuracy,
        correctReveals: turnCorrectReveals
      };
    }
  });

  roundNumbers.forEach((turnNumber) => {
    const clue = clueByTurn.get(turnNumber) ?? null;
    const turnReveals = revealsByTurn.get(turnNumber) ?? [];
    const turnVotes = voteEventsByTurn.get(turnNumber) ?? [];
    const summaryEvent = roundSummaryByTurn.get(turnNumber);
    const activeTeam = clue?.team ?? (turnNumber % 2 === 1 ? startingTeam : otherTeam(startingTeam));
    const passiveTeam = otherTeam(activeTeam);
    const endReason = summaryEvent?.endReason ?? (turnNumber === room.turn_number ? finalRoundSummary.endReason : 'allowance_exhausted');
    const nextTeam = summaryEvent?.nextTeam ?? (turnNumber === room.turn_number ? finalRoundSummary.nextTeam : otherTeam(activeTeam));
    const roundWinningTeam = summaryEvent?.winningTeam ?? (turnNumber === room.turn_number ? finalRoundSummary.winningTeam : null);
    const { outcomeLabel } = buildRoundOutcome(endReason, activeTeam, nextTeam, roundWinningTeam);
    const turnActiveVotes = turnVotes.filter((vote) => vote.scope === 'active');
    const turnPassiveVotes = turnVotes.filter((vote) => vote.scope === 'passive');
    const revealedTileIds = new Set(turnReveals.map((reveal) => reveal.tileId));
    const turnActiveCorrectVotes = turnActiveVotes.filter((vote) => tileById.get(vote.tileId)?.owner_color === activeTeam).length;
    const turnPassiveCorrectVotes = turnPassiveVotes.filter((vote) => revealedTileIds.has(vote.tileId)).length;
    const activeVoteAccuracy =
      turnActiveVotes.length > 0 ? formatAccuracy((turnActiveCorrectVotes / turnActiveVotes.length) * 100) : null;
    const passiveVoteAccuracy =
      turnPassiveVotes.length > 0 ? formatAccuracy((turnPassiveCorrectVotes / turnPassiveVotes.length) * 100) : null;
    const activeVoterCount = new Set(turnActiveVotes.map((vote) => vote.playerId)).size;
    const passiveVoterCount = new Set(turnPassiveVotes.map((vote) => vote.playerId)).size;
    const correctReveals = turnReveals.filter((reveal) => reveal.ownerColor === activeTeam).length;
    const mistakeCount = turnReveals.filter((reveal) => reveal.ownerColor !== activeTeam).length;

    turnActiveVotes.forEach((vote) => {
      teamActiveTotals[activeTeam].total += 1;
      if (tileById.get(vote.tileId)?.owner_color === activeTeam) {
        teamActiveTotals[activeTeam].correct += 1;
      }

      const assignment = assignmentByPlayerId.get(vote.playerId);
      const player = playerById.get(vote.playerId);

      if (!assignment?.team || assignment.role !== 'guesser' || !player) {
        return;
      }

      const current = playerActiveTotals.get(vote.playerId) ?? {
        correct: 0,
        total: 0,
        playerName: player.name,
        team: assignment.team,
        joinedAt: player.joined_at
      };

      current.total += 1;
      if (tileById.get(vote.tileId)?.owner_color === activeTeam) {
        current.correct += 1;
      }

      playerActiveTotals.set(vote.playerId, current);
    });

    turnPassiveVotes.forEach((vote) => {
      const assignment = assignmentByPlayerId.get(vote.playerId);
      const passiveVoteTeam = assignment?.team ?? passiveTeam;

      teamPassiveTotals[passiveVoteTeam].total += 1;
      if (revealedTileIds.has(vote.tileId)) {
        teamPassiveTotals[passiveVoteTeam].correct += 1;
      }
    });

    [...turnActiveVotes, ...turnPassiveVotes].forEach((vote) => {
      const existing = contestedWords.get(vote.tileId) ?? {
        word: tileById.get(vote.tileId)?.word ?? '',
        activeVotes: 0,
        passiveVotes: 0,
        totalVotes: 0
      };

      if (vote.scope === 'active') {
        existing.activeVotes += 1;
      } else {
        existing.passiveVotes += 1;
      }

      existing.totalVotes += 1;
      contestedWords.set(vote.tileId, existing);
    });

    if (
      passiveVoteAccuracy !== null &&
      (!sharpestPrediction ||
        passiveVoteAccuracy > (sharpestPrediction.passiveVoteAccuracy ?? -1) ||
        (passiveVoteAccuracy === (sharpestPrediction.passiveVoteAccuracy ?? -1) && turnPassiveVotes.length > 0))
    ) {
      sharpestPrediction = {
        turnNumber,
        team: passiveTeam,
        clueText: clue?.text ?? null,
        passiveVoteAccuracy
      };
    }

    if (
      mistakeCount === 0 &&
      (!cleanestRound ||
        (activeVoteAccuracy ?? -1) > (cleanestRound.activeVoteAccuracy ?? -1) ||
        ((activeVoteAccuracy ?? -1) === (cleanestRound.activeVoteAccuracy ?? -1) && correctReveals > cleanestRound.correctReveals))
    ) {
      cleanestRound = {
        turnNumber,
        team: activeTeam,
        clueText: clue?.text ?? null,
        activeVoteAccuracy,
        correctReveals
      };
    }

    roundHistory.push({
      turnNumber,
      activeTeam,
      clueText: clue?.text ?? null,
      clueCount: clue?.count ?? null,
      endReason,
      outcomeLabel,
      activeVoteAccuracy,
      passiveVoteAccuracy,
      activeVoterCount,
      passiveVoterCount,
      activeVotedWords: orderedUniqueWords(turnActiveVotes),
      passiveVotedWords: orderedUniqueWords(turnPassiveVotes),
      revealSequence: turnReveals.map((reveal) => ({
        tileId: reveal.tileId,
        word: reveal.word,
        ownerColor: reveal.ownerColor,
        activeVotesOnTile: reveal.activeVotesOnTile,
        passiveVotesOnTile: reveal.passiveVotesOnTile
      })),
      correctReveals,
      mistakeCount
    });
  });

  playerActiveTotals.forEach((playerTotals, playerId) => {
    const accuracy = playerTotals.total > 0 ? formatAccuracy((playerTotals.correct / playerTotals.total) * 100) : null;
    const bestAccuracy = bestGuesser?.activeVoteAccuracy ?? -1;
    const joinedAtWins =
      bestGuesser &&
      playerTotals.joinedAt < (playerById.get(bestGuesser.playerId)?.joined_at ?? playerTotals.joinedAt);

    if (
      !bestGuesser ||
      (accuracy ?? -1) > bestAccuracy ||
      ((accuracy ?? -1) === bestAccuracy && playerTotals.correct > bestGuesser.correctActiveVotes) ||
      ((accuracy ?? -1) === bestAccuracy &&
        playerTotals.correct === bestGuesser.correctActiveVotes &&
        playerTotals.total > bestGuesser.totalActiveVotes) ||
      ((accuracy ?? -1) === bestAccuracy &&
        playerTotals.correct === bestGuesser.correctActiveVotes &&
        playerTotals.total === bestGuesser.totalActiveVotes &&
        joinedAtWins)
    ) {
      bestGuesser = {
        playerId,
        playerName: playerTotals.playerName,
        team: playerTotals.team,
        activeVoteAccuracy: accuracy,
        correctActiveVotes: playerTotals.correct,
        totalActiveVotes: playerTotals.total
      };
    }
  });

  contestedWords.forEach((entry) => {
    if (
      !entry.word ||
      (mostContestedWord &&
        (entry.totalVotes < mostContestedWord.totalVotes ||
          (entry.totalVotes === mostContestedWord.totalVotes && entry.word.localeCompare(mostContestedWord.word) >= 0)))
    ) {
      return;
    }

    mostContestedWord = {
      word: entry.word,
      totalVotes: entry.totalVotes,
      activeVotes: entry.activeVotes,
      passiveVotes: entry.passiveVotes
    };
  });

  const losingTeam = otherTeam(winningTeam);
  const winningTiles = tiles.filter((tile) => tile.owner_color === winningTeam);
  const losingTiles = tiles.filter((tile) => tile.owner_color === losingTeam);

  return {
    winningTeam,
    endReason: finalRoundSummary.endReason,
    outcomeLabel: finalRoundSummary.outcomeLabel,
    outcomeDetail: finalRoundSummary.outcomeDetail,
    winningVoteAccuracy:
      winningTurnRevealCount > 0 ? formatAccuracy((winningActiveHitReveals / winningTurnRevealCount) * 100) : null,
    passiveVoteAccuracy:
      winningTurnRevealCount > 0 ? formatAccuracy((winningPassiveHitReveals / winningTurnRevealCount) * 100) : null,
    roundsPlayed: Math.max(room.turn_number, clueByTurn.size, revealsByTurn.size),
    winningCorrectReveals,
    mistakeCounts,
    finalRevealSequence: finalRoundSummary.revealSequence,
    winningTeamProgress: {
      revealed: winningTiles.filter((tile) => Boolean(tile.is_revealed)).length,
      total: winningTiles.length
    },
    losingTeamProgress: {
      revealed: losingTiles.filter((tile) => Boolean(tile.is_revealed)).length,
      total: losingTiles.length
    },
    roundHistory,
    teamAccuracyTotals: {
      red: {
        activeVoteAccuracy:
          teamActiveTotals.red.total > 0 ? formatAccuracy((teamActiveTotals.red.correct / teamActiveTotals.red.total) * 100) : null,
        passiveVoteAccuracy:
          teamPassiveTotals.red.total > 0 ? formatAccuracy((teamPassiveTotals.red.correct / teamPassiveTotals.red.total) * 100) : null
      },
      blue: {
        activeVoteAccuracy:
          teamActiveTotals.blue.total > 0 ? formatAccuracy((teamActiveTotals.blue.correct / teamActiveTotals.blue.total) * 100) : null,
        passiveVoteAccuracy:
          teamPassiveTotals.blue.total > 0 ? formatAccuracy((teamPassiveTotals.blue.correct / teamPassiveTotals.blue.total) * 100) : null
      }
    },
    bestRead,
    bestGuesser,
    mostContestedWord,
    sharpestPrediction,
    cleanestRound
  };
}

function enterSummaryState(
  room: RoomRow,
  summary: RoundSummary,
  status: RoomStatus,
  winningTeam: Team | null,
  gameResultSummary: GameResultSummary | null = null
): void {
  db.prepare(
    `
      UPDATE rooms
      SET status = ?,
          game_phase = ?,
          current_clue_reveals_remaining = 0,
          current_round_summary_json = ?,
          current_game_result_summary_json = ?,
          winning_team = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(
    status,
    status === 'finished' ? 'finished' : 'summary',
    JSON.stringify(summary),
    gameResultSummary ? JSON.stringify(gameResultSummary) : null,
    winningTeam,
    nowIso(),
    room.id
  );
}

function enterFinishedState(
  room: RoomRow,
  summary: RoundSummary,
  winningTeam: Team,
  gameResultSummary: GameResultSummary
): void {
  db.prepare(
    `
      UPDATE rooms
      SET status = 'finished',
          game_phase = 'finished',
          current_clue_reveals_remaining = 0,
          current_round_summary_json = ?,
          current_game_result_summary_json = ?,
          winning_team = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(JSON.stringify(summary), JSON.stringify(gameResultSummary), winningTeam, nowIso(), room.id);
}

function buildTeamStatus(
  tiles: TileRow[],
  players: PlayerRow[],
  assignments: AssignmentRow[]
): Record<Team, TeamStatusSummary> {
  const createStatus = (team: Team): TeamStatusSummary => {
    const teamTiles = tiles.filter((tile) => tile.owner_color === team);
    const currentCaptain = assignments.find(
      (assignment) => assignment.team === team && assignment.role === 'guesser' && assignment.is_current_captain === 1
    );
    const captainPlayer = currentCaptain ? players.find((player) => player.id === currentCaptain.player_id) : undefined;
    const currentSpymasterCaptain = assignments.find(
      (assignment) =>
        assignment.team === team && assignment.role === 'spymaster' && assignment.is_current_spymaster_captain === 1
    );
    const spymasterCaptainPlayer = currentSpymasterCaptain
      ? players.find((player) => player.id === currentSpymasterCaptain.player_id)
      : undefined;

    return {
      remainingWords: teamTiles.filter((tile) => tile.is_revealed === 0).length,
      totalWords: teamTiles.length,
      currentCaptainPlayerId: currentCaptain?.player_id ?? null,
      currentCaptainName: captainPlayer?.name ?? null,
      currentSpymasterCaptainPlayerId: currentSpymasterCaptain?.player_id ?? null,
      currentSpymasterCaptainName: spymasterCaptainPlayer?.name ?? null,
      guesserCount: assignments.filter((assignment) => assignment.team === team && assignment.role === 'guesser').length,
      spymasterCount: assignments.filter((assignment) => assignment.team === team && assignment.role === 'spymaster').length
    };
  };

  return {
    red: createStatus('red'),
    blue: createStatus('blue')
  };
}

function getViewerRoute(
  room: RoomRow,
  view: RoomStateView,
  isTeacher: boolean,
  role: Role | null
): 'lobby' | 'presentation' | 'guesser' | 'spymaster' {
  if (view === 'presentation') {
    return 'presentation';
  }

  if (room.status === 'lobby' || !role || isTeacher) {
    return 'lobby';
  }

  return getRouteForRole(role);
}

function advanceToNextTurnState(room: RoomRow, currentTurnTeam: Team): Team {
  const nextTeam = otherTeam(currentTurnTeam);
  const board = getBoard(room.id);

  if (board) {
    clearLocks(board.id);
  }

  clearVotes(room.id, room.turn_number);
  rotateCaptain(room.id, currentTurnTeam);
  rotateSpymasterCaptain(room.id, currentTurnTeam);

  db.prepare(
    `
      UPDATE rooms
      SET current_turn_team = ?,
          turn_number = ?,
          game_phase = 'guessing',
          timer_remaining_seconds = timer_seconds,
          timer_state = 'idle',
          current_clue_text = NULL,
          current_clue_count = 1,
          current_clue_reveals_remaining = 0,
          current_round_summary_json = NULL,
          current_game_result_summary_json = NULL,
          updated_at = ?
      WHERE id = ?
    `
  ).run(nextTeam, room.turn_number + 1, nowIso(), room.id);

  return nextTeam;
}

export function createRoom(teacherName: string) {
  const trimmedName = teacherName.trim() || 'Teacher';
  const timestamp = nowIso();
  const roomId = createId();
  const playerId = createId();

  let roomCode = createRoomCode();
  while (db.prepare('SELECT 1 FROM rooms WHERE room_code = ?').get(roomCode)) {
    roomCode = createRoomCode();
  }

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO rooms (
          id, room_code, created_by_player_id, status, game_phase, current_turn_team,
          turn_number, timer_enabled, timer_seconds, timer_remaining_seconds, timer_state,
          winning_team, created_at, updated_at
        )
        VALUES (?, ?, ?, 'lobby', 'lobby', NULL, 1, 0, 120, 120, 'idle', NULL, ?, ?)
      `
    ).run(roomId, roomCode, playerId, timestamp, timestamp);

    db.prepare(
      `
        INSERT INTO players (
          id, room_id, name, socket_id, is_teacher, is_connected, joined_at, last_seen_at
        )
        VALUES (?, ?, ?, NULL, 1, 0, ?, ?)
      `
    ).run(playerId, roomId, trimmedName, timestamp, timestamp);

    db.prepare(
      `
        INSERT INTO assignments (
          id, room_id, player_id, team, role, captain_order, is_current_captain, is_current_spymaster_captain, created_at, updated_at
        )
        VALUES (?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)
      `
    ).run(createId(), roomId, playerId, timestamp, timestamp);

    recordEvent(roomId, 'room_created', { playerId, teacherName: trimmedName });
  })();

  return {
    roomCode,
    playerId,
    isTeacher: true,
    name: trimmedName
  };
}

export function joinRoom(roomCode: string, name: string, requestedPlayerId?: string) {
  const room = getRoomRow(roomCode);
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new AppError('A display name is required.', 400);
  }

  const normalizedName = normalizeName(trimmedName);
  const players = getPlayers(room.id);
  const requestedPlayer =
    requestedPlayerId
      ? players.find((player) => player.id === requestedPlayerId && player.is_teacher === 0)
      : undefined;

  if (requestedPlayer) {
    db.transaction(() => {
      const assignment = db
        .prepare('SELECT 1 FROM assignments WHERE room_id = ? AND player_id = ? LIMIT 1')
        .get(room.id, requestedPlayer.id);

      if (!assignment) {
        db.prepare(
          `
            INSERT INTO assignments (
              id, room_id, player_id, team, role, captain_order, is_current_captain, is_current_spymaster_captain, created_at, updated_at
            )
            VALUES (?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)
          `
        ).run(createId(), room.id, requestedPlayer.id, nowIso(), nowIso());
      }

      touchRoom(room.id);
      recordEvent(room.id, 'player_rejoined', {
        playerId: requestedPlayer.id,
        name: requestedPlayer.name,
        method: 'session'
      });
    })();

    return {
      roomCode: room.room_code,
      playerId: requestedPlayer.id,
      isTeacher: false,
      name: requestedPlayer.name
    };
  }

  const hasConnectedNameConflict = players.some(
    (player) => player.is_connected === 1 && normalizeName(player.name) === normalizedName
  );

  if (hasConnectedNameConflict) {
    throw new AppError('That name is already in use by a connected player. Try your original name or wait for them to disconnect.', 400);
  }

  const offlineNameMatches = players.filter(
    (player) =>
      player.is_teacher === 0 &&
      player.is_connected === 0 &&
      normalizeName(player.name) === normalizedName
  );

  if (offlineNameMatches.length > 1) {
    throw new AppError('Multiple offline players share that name. Rejoin from your original device/session.', 400);
  }

  if (offlineNameMatches.length === 1) {
    const reclaimPlayer = offlineNameMatches[0];

    db.transaction(() => {
      touchRoom(room.id);
      recordEvent(room.id, 'player_rejoined', {
        playerId: reclaimPlayer.id,
        name: reclaimPlayer.name,
        method: 'name'
      });
    })();

    return {
      roomCode: room.room_code,
      playerId: reclaimPlayer.id,
      isTeacher: false,
      name: reclaimPlayer.name
    };
  }

  if (room.status === 'in_progress') {
    throw new AppError('This game is already in progress. Rejoin with your original name/session.', 400);
  }

  const playerId = createId();
  const timestamp = nowIso();

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO players (
          id, room_id, name, socket_id, is_teacher, is_connected, joined_at, last_seen_at
        )
        VALUES (?, ?, ?, NULL, 0, 0, ?, ?)
      `
    ).run(playerId, room.id, trimmedName, timestamp, timestamp);

    db.prepare(
      `
        INSERT INTO assignments (
          id, room_id, player_id, team, role, captain_order, is_current_captain, is_current_spymaster_captain, created_at, updated_at
        )
        VALUES (?, ?, ?, NULL, NULL, NULL, 0, 0, ?, ?)
      `
    ).run(createId(), room.id, playerId, timestamp, timestamp);

    touchRoom(room.id);
    recordEvent(room.id, 'player_joined', { playerId, name: trimmedName });
  })();

  return {
    roomCode: room.room_code,
    playerId,
    isTeacher: false,
    name: trimmedName
  };
}

export function setPlayerConnection(playerId: string, socketId: string | null, isConnected: boolean): void {
  db.prepare(
    `
      UPDATE players
      SET socket_id = ?, is_connected = ?, last_seen_at = ?
      WHERE id = ?
    `
  ).run(socketId, isConnected ? 1 : 0, nowIso(), playerId);
}

export function updateAssignments(roomCode: string, actorPlayerId: string, assignments: AssignmentUpdateInput[]): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);
  const validPlayerIds = new Set(getPlayers(room.id).map((player) => player.id));

  assignments.forEach((assignment) => {
    if (!validPlayerIds.has(assignment.playerId)) {
      throw new AppError('One or more assignment updates target a player outside this room.', 400);
    }
  });

  db.transaction(() => {
    const timestamp = nowIso();

    db.prepare(
      `
        UPDATE assignments
        SET team = NULL,
            role = NULL,
            captain_order = NULL,
            is_current_captain = 0,
            is_current_spymaster_captain = 0,
            updated_at = ?
        WHERE room_id = ?
      `
    ).run(timestamp, room.id);

    assignments.forEach((assignment) => {
      db.prepare(
        `
          UPDATE assignments
          SET team = ?,
              role = ?,
              captain_order = ?,
              updated_at = ?
          WHERE room_id = ?
            AND player_id = ?
        `
      ).run(
        assignment.team,
        assignment.role,
        assignment.role === 'guesser' ? assignment.captainOrder ?? null : null,
        timestamp,
        room.id,
        assignment.playerId
      );
    });

    normalizeCaptainOrders(room.id);
    resetCurrentCaptains(room.id);
    touchRoom(room.id);
    recordEvent(room.id, 'assignment_update', { actorPlayerId, assignments });
  })();
}

export function updateTimerConfig(roomCode: string, actorPlayerId: string, enabled: boolean, seconds: number): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  const safeSeconds = Math.max(30, Math.min(60 * 15, Math.round(seconds)));

  db.transaction(() => {
    db.prepare(
      `
        UPDATE rooms
        SET timer_enabled = ?,
            timer_seconds = ?,
            timer_remaining_seconds = ?,
            timer_state = 'idle',
            updated_at = ?
        WHERE id = ?
      `
    ).run(enabled ? 1 : 0, safeSeconds, safeSeconds, nowIso(), room.id);

    recordEvent(room.id, 'timer_config_updated', { actorPlayerId, enabled, seconds: safeSeconds });
  })();
}

export function startGame(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);
  const assignments = getAssignments(room.id);
  const players = getPlayers(room.id);
  const selectedWordPack = getAppliedWordPackConfig(roomCode);
  const connectedStudentIds = new Set(
    players.filter((player) => player.is_teacher === 0 && player.is_connected === 1).map((player) => player.id)
  );

  (['red', 'blue'] as Team[]).forEach((team) => {
    const guessers = assignments.filter(
      (assignment) =>
        assignment.team === team &&
        assignment.role === 'guesser' &&
        connectedStudentIds.has(assignment.player_id)
    );
    const spymasters = assignments.filter(
      (assignment) =>
        assignment.team === team &&
        assignment.role === 'spymaster' &&
        connectedStudentIds.has(assignment.player_id)
    );

    if (!guessers.length || !spymasters.length) {
      throw new AppError(
        `${formatRoleLabel(team, 'guesser')} and ${formatRoleLabel(team, 'spymaster')} must each have at least one player before the game can start.`,
        400
      );
    }
  });

  const startingTeam = selectedWordPack?.forcedStartingTeam ?? (Math.random() > 0.5 ? 'red' : 'blue');
  const tiles = createBoardTiles(startingTeam, selectedWordPack);
  const boardId = createId();
  const seed = createId();

  db.transaction(() => {
    db.prepare('DELETE FROM boards WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM votes WHERE room_id = ?').run(room.id);

    normalizeCaptainOrders(room.id);
    resetCurrentCaptains(room.id);

    db.prepare(
      `
        INSERT INTO boards (id, room_id, seed, created_at)
        VALUES (?, ?, ?, ?)
      `
    ).run(boardId, room.id, seed, nowIso());

    const tileStatement = db.prepare(
      `
        INSERT INTO board_tiles (
          id, board_id, position, word, owner_color, is_revealed, is_locked, locked_by_team, locked_at, revealed_at
        )
        VALUES (?, ?, ?, ?, ?, 0, 0, NULL, NULL, NULL)
      `
    );

    tiles.forEach((tile) => {
      tileStatement.run(createId(), boardId, tile.position, tile.word, tile.ownerColor);
    });

    db.prepare(
      `
        UPDATE rooms
        SET status = 'in_progress',
            game_phase = 'guessing',
            current_turn_team = ?,
            turn_number = 1,
            timer_remaining_seconds = timer_seconds,
            timer_state = 'idle',
            current_clue_text = NULL,
            current_clue_count = 1,
            current_clue_reveals_remaining = 0,
            current_round_summary_json = NULL,
            current_game_result_summary_json = NULL,
            winning_team = NULL,
            updated_at = ?
        WHERE id = ?
      `
    ).run(startingTeam, nowIso(), room.id);

    recordEvent(room.id, 'game_started', { actorPlayerId, startingTeam, seed });
  })();
}

export function castVote(roomCode: string, playerId: string, tileId: string): void {
  const room = getRoomRow(roomCode);
  const assignment = getAssignmentRow(room.id, playerId);

  if (room.status !== 'in_progress' || room.game_phase !== 'guessing') {
    throw new AppError('Votes are only accepted during an active guessing phase.', 400);
  }

  if (!room.current_clue_text) {
    throw new AppError('Wait for the spymaster to submit a clue before voting.', 400);
  }

  const voteScope = getVoteScopeForAssignment(room, assignment);

  if (!voteScope || !assignment.team) {
    throw new AppError('Only assigned guessers can vote right now.', 403);
  }

  const board = getBoard(room.id);
  if (!board) {
    throw new AppError('The board has not been created yet.', 400);
  }

  const tile = db
    .prepare('SELECT * FROM board_tiles WHERE board_id = ? AND id = ?')
    .get(board.id, tileId) as TileRow | undefined;

  if (!tile || tile.is_revealed) {
    throw new AppError('That tile is not available for voting.', 400);
  }

  db.transaction(() => {
    const existingVotes = db
      .prepare('SELECT * FROM votes WHERE room_id = ? AND turn_number = ? AND player_id = ? AND scope = ?')
      .all(room.id, room.turn_number, playerId, voteScope) as VoteRow[];
    const voteLimit = Math.max(1, room.current_clue_count || 1);

    if (existingVotes.some((vote) => vote.tile_id === tileId)) {
      return;
    }

    if (existingVotes.length >= voteLimit) {
      throw new AppError(`Each guesser can only keep ${voteLimit} active vote${voteLimit === 1 ? '' : 's'} this turn.`, 400);
    }

    db.prepare(
      `
        INSERT INTO votes (id, room_id, turn_number, tile_id, player_id, team, scope, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(createId(), room.id, room.turn_number, tileId, playerId, assignment.team, voteScope, nowIso());

    touchRoom(room.id);
    recordEvent(room.id, 'vote_cast', { playerId, tileId, turnNumber: room.turn_number, scope: voteScope });
  })();
}

export function removeVote(roomCode: string, playerId: string, tileId: string): void {
  const room = getRoomRow(roomCode);
  const assignment = getAssignmentRow(room.id, playerId);

  if (room.status !== 'in_progress' || room.game_phase !== 'guessing' || !room.current_clue_text) {
    throw new AppError('Votes can only be removed during an active clue cycle.', 400);
  }

  const voteScope = getVoteScopeForAssignment(room, assignment);

  if (!voteScope) {
    throw new AppError('Only assigned guessers can remove votes right now.', 403);
  }

  db.transaction(() => {
    db.prepare('DELETE FROM votes WHERE room_id = ? AND turn_number = ? AND player_id = ? AND tile_id = ? AND scope = ?').run(
      room.id,
      room.turn_number,
      playerId,
      tileId,
      voteScope
    );

    touchRoom(room.id);
    recordEvent(room.id, 'vote_removed', { playerId, tileId, turnNumber: room.turn_number, scope: voteScope });
  })();
}

export function updateClue(roomCode: string, playerId: string, text: string, count: number): void {
  const room = getRoomRow(roomCode);
  const assignment = getAssignmentRow(room.id, playerId);
  const clueText = text.trim();
  const clueCount = Math.max(1, Math.min(9, Math.round(count)));

  if (room.status !== 'in_progress' || room.game_phase !== 'guessing') {
    throw new AppError('Clues can only be updated during an active guessing phase.', 400);
  }

  if (assignment.role !== 'spymaster' || assignment.team !== room.current_turn_team) {
    throw new AppError('Only the active team spymaster can update the clue.', 403);
  }

  if (!assignment.is_current_spymaster_captain) {
    throw new AppError('Only the captain spymaster for the active team can update the clue.', 403);
  }

  if (room.current_clue_text) {
    throw new AppError('The clue is already locked for this round.', 400);
  }

  if (!clueText) {
    throw new AppError('Enter a clue before updating the turn.', 400);
  }

  if (/\s/.test(clueText)) {
    throw new AppError('The clue must be a single word.', 400);
  }

  const board = getBoard(room.id);

  db.transaction(() => {
    if (board) {
      clearLocks(board.id);
    }

    clearVotes(room.id, room.turn_number);

    db.prepare(
      `
        UPDATE rooms
        SET current_clue_text = ?,
            current_clue_count = ?,
            current_clue_reveals_remaining = ?,
            game_phase = 'guessing',
            updated_at = ?
        WHERE id = ?
      `
    ).run(clueText, clueCount, clueCount + 1, nowIso(), room.id);

    recordEvent(room.id, 'clue_updated', { playerId, text: clueText, count: clueCount, team: assignment.team });
  })();
}

export function revealTile(roomCode: string, actorPlayerId: string, tileId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);
  const board = getBoard(room.id);

  if (!board || room.status !== 'in_progress') {
    throw new AppError('The game is not ready for reveal actions.', 400);
  }

  if (!room.current_turn_team || !room.current_clue_text || room.current_clue_reveals_remaining <= 0) {
    throw new AppError('A reveal can only happen during an active clue cycle.', 400);
  }

  const activeTeam = room.current_turn_team;

  const tile = db
    .prepare('SELECT * FROM board_tiles WHERE board_id = ? AND id = ?')
    .get(board.id, tileId) as TileRow | undefined;

  if (!tile || tile.is_revealed) {
    throw new AppError('That tile has already been revealed.', 400);
  }

  const hasVote = db
    .prepare(
      `
        SELECT 1
        FROM votes
        WHERE room_id = ?
          AND turn_number = ?
          AND tile_id = ?
          AND scope = 'active'
        LIMIT 1
      `
    )
    .get(room.id, room.turn_number, tileId);

  if (!hasVote) {
    throw new AppError('The teacher can only reveal cards that currently have at least one vote.', 400);
  }

  db.transaction(() => {
    const votesSnapshot = getVotes(room.id, room.turn_number);
    const activeVotesTotal = votesSnapshot.filter((vote) => vote.scope === 'active').length;
    const passiveVotesTotal = votesSnapshot.filter((vote) => vote.scope === 'passive').length;
    const activeVotesOnTile = votesSnapshot.filter((vote) => vote.scope === 'active' && vote.tile_id === tileId).length;
    const passiveVotesOnTile = votesSnapshot.filter((vote) => vote.scope === 'passive' && vote.tile_id === tileId).length;

    db.prepare(
      `
        UPDATE board_tiles
        SET is_revealed = 1,
            is_locked = 0,
            locked_by_team = NULL,
            locked_at = NULL,
            revealed_at = ?
        WHERE id = ?
      `
    ).run(nowIso(), tileId);

    recordEvent(room.id, 'tile_revealed', {
      actorPlayerId,
      tileId,
      word: tile.word,
      ownerColor: tile.owner_color,
      turnNumber: room.turn_number,
      activeVotesOnTile,
      activeVotesTotal,
      passiveVotesOnTile,
      passiveVotesTotal
    });

    clearVotesForTile(room.id, room.turn_number, tileId);

    const updatedTiles = getTiles(board.id);
    const redRemaining = updatedTiles.filter((row) => row.owner_color === 'red' && row.is_revealed === 0).length;
    const blueRemaining = updatedTiles.filter((row) => row.owner_color === 'blue' && row.is_revealed === 0).length;

    let status: RoomStatus = room.status;
    let winningTeam: Team | null = null;
    let remainingReveals = room.current_clue_reveals_remaining;
    let endReason: RoundSummaryReason | null = null;
    let nextTeam: Team | null = otherTeam(activeTeam);

    if (tile.owner_color === 'assassin') {
      status = 'finished';
      winningTeam = otherTeam(activeTeam);
      nextTeam = null;
      endReason = 'assassin';
    } else if (redRemaining === 0) {
      status = 'finished';
      winningTeam = 'red';
      nextTeam = null;
      endReason = tile.owner_color === activeTeam ? 'team_completed' : 'opponent_completed';
    } else if (blueRemaining === 0) {
      status = 'finished';
      winningTeam = 'blue';
      nextTeam = null;
      endReason = tile.owner_color === activeTeam ? 'team_completed' : 'opponent_completed';
    } else if (tile.owner_color === activeTeam) {
      remainingReveals = Math.max(0, room.current_clue_reveals_remaining - 1);

      if (remainingReveals <= 0) {
        endReason = 'allowance_exhausted';
      } else {
        db.prepare(
          `
            UPDATE rooms
            SET current_clue_reveals_remaining = ?,
                updated_at = ?
            WHERE id = ?
          `
        ).run(remainingReveals, nowIso(), room.id);
      }
    } else {
      endReason = 'wrong_reveal';
    }

    if (endReason) {
      const summary = buildRoundSummary(room, activeTeam, votesSnapshot, updatedTiles, endReason, nextTeam, winningTeam);
      const gameResultSummary = status === 'finished' ? buildGameResultSummary(room, updatedTiles, summary) : null;
      clearVotes(room.id, room.turn_number);
      clearLocks(board.id);
      if (status === 'finished' && winningTeam && gameResultSummary) {
        enterFinishedState(room, summary, winningTeam, gameResultSummary);
      } else {
        enterSummaryState(room, summary, status, winningTeam, gameResultSummary);
      }
      recordEvent(room.id, 'round_summary_created', {
        turnNumber: room.turn_number,
        endReason,
        nextTeam,
        winningTeam
      });
    }
  })();
}

export function advanceTurn(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);
  const currentTurnTeam = room.current_turn_team;

  if (!currentTurnTeam && !(room.status === 'finished' && room.game_phase === 'summary')) {
    throw new AppError('The turn cannot be advanced right now.', 400);
  }

  db.transaction(() => {
    if (room.status === 'finished' && room.game_phase === 'summary') {
      db.prepare(
        `
          UPDATE rooms
          SET game_phase = 'finished',
              updated_at = ?
          WHERE id = ?
        `
      ).run(nowIso(), room.id);

      recordEvent(room.id, 'turn_advanced', {
        actorPlayerId,
        previousTeam: room.current_turn_team,
        nextTeam: null,
        reason: 'finished_summary_continue'
      });

      return;
    }

    if (room.status === 'in_progress' && room.game_phase === 'summary') {
      if (!currentTurnTeam) {
        throw new AppError('The turn cannot be advanced right now.', 400);
      }

      const turnTeam = currentTurnTeam;
      const nextTeam = advanceToNextTurnState(room, turnTeam);

      recordEvent(room.id, 'turn_advanced', {
        actorPlayerId,
        previousTeam: turnTeam,
        nextTeam,
        reason: 'summary_continue'
      });

      return;
    }

    if (room.status !== 'in_progress' || room.game_phase !== 'guessing' || !room.current_clue_text) {
      throw new AppError('The turn cannot be advanced right now.', 400);
    }

    if (!currentTurnTeam) {
      throw new AppError('The turn cannot be advanced right now.', 400);
    }

    if (!isBonusRevealAvailable(room)) {
      throw new AppError('The turn can only be ended after the standard clue guesses are complete.', 400);
    }

    const turnTeam = currentTurnTeam;
    const board = getBoard(room.id);
    const tiles = board ? getTiles(board.id) : [];
    const votesSnapshot = getVotes(room.id, room.turn_number);
    const nextTeam = otherTeam(turnTeam);
    const summary = buildRoundSummary(room, turnTeam, votesSnapshot, tiles, 'turn_completed', nextTeam, null);

    if (board) {
      clearLocks(board.id);
    }

    clearVotes(room.id, room.turn_number);
    enterSummaryState(room, summary, 'in_progress', null);

    recordEvent(room.id, 'turn_advanced', {
      actorPlayerId,
      previousTeam: turnTeam,
      nextTeam,
      reason: 'teacher_end_turn'
    });
    recordEvent(room.id, 'round_summary_created', {
      turnNumber: room.turn_number,
      endReason: 'turn_completed',
      nextTeam,
      winningTeam: null
    });
  })();
}

export function endGuessingEarly(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);
  const currentTurnTeam = room.current_turn_team;

  if (room.status !== 'in_progress' || room.game_phase !== 'guessing' || !room.current_clue_text || !currentTurnTeam) {
    throw new AppError('The round cannot be ended early right now.', 400);
  }

  db.transaction(() => {
    const turnTeam = currentTurnTeam;
    const board = getBoard(room.id);
    const tiles = board ? getTiles(board.id) : [];
    const votesSnapshot = getVotes(room.id, room.turn_number);
    const nextTeam = otherTeam(turnTeam);
    const summary = buildRoundSummary(room, turnTeam, votesSnapshot, tiles, 'teacher_ended', nextTeam, null);

    if (board) {
      clearLocks(board.id);
    }

    clearVotes(room.id, room.turn_number);
    enterSummaryState(room, summary, 'in_progress', null);

    recordEvent(room.id, 'turn_advanced', {
      actorPlayerId,
      previousTeam: turnTeam,
      nextTeam,
      reason: 'teacher_end_guessing_early'
    });
    recordEvent(room.id, 'round_summary_created', {
      turnNumber: room.turn_number,
      endReason: 'teacher_ended',
      nextTeam,
      winningTeam: null
    });
  });
}

export function rematchGame(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  if (room.status !== 'finished') {
    throw new AppError('A rematch is only available after the game ends.', 400);
  }

  const assignments = getAssignments(room.id);
  const selectedWordPack = getAppliedWordPackConfig(roomCode);

  (['red', 'blue'] as Team[]).forEach((team) => {
    const guessers = assignments.filter((assignment) => assignment.team === team && assignment.role === 'guesser');
    const spymasters = assignments.filter((assignment) => assignment.team === team && assignment.role === 'spymaster');

    if (!guessers.length || !spymasters.length) {
      throw new AppError('Both teams still need at least one guesser and one spymaster to rematch.', 400);
    }
  });

  const startingTeam = selectedWordPack?.forcedStartingTeam ?? (Math.random() > 0.5 ? 'red' : 'blue');
  const tiles = createBoardTiles(startingTeam, selectedWordPack);
  const boardId = createId();
  const seed = createId();

  db.transaction(() => {
    db.prepare('DELETE FROM boards WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM votes WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM game_events WHERE room_id = ?').run(room.id);

    normalizeCaptainOrders(room.id);
    resetCurrentCaptains(room.id);

    db.prepare(
      `
        INSERT INTO boards (id, room_id, seed, created_at)
        VALUES (?, ?, ?, ?)
      `
    ).run(boardId, room.id, seed, nowIso());

    const tileStatement = db.prepare(
      `
        INSERT INTO board_tiles (
          id, board_id, position, word, owner_color, is_revealed, is_locked, locked_by_team, locked_at, revealed_at
        )
        VALUES (?, ?, ?, ?, ?, 0, 0, NULL, NULL, NULL)
      `
    );

    tiles.forEach((tile) => {
      tileStatement.run(createId(), boardId, tile.position, tile.word, tile.ownerColor);
    });

    db.prepare(
      `
        UPDATE rooms
        SET status = 'in_progress',
            game_phase = 'guessing',
            current_turn_team = ?,
            turn_number = 1,
            timer_remaining_seconds = timer_seconds,
            timer_state = 'idle',
            current_clue_text = NULL,
            current_clue_count = 1,
            current_clue_reveals_remaining = 0,
            current_round_summary_json = NULL,
            current_game_result_summary_json = NULL,
            winning_team = NULL,
            updated_at = ?
        WHERE id = ?
      `
    ).run(startingTeam, nowIso(), room.id);

    recordEvent(room.id, 'game_started', { actorPlayerId, startingTeam, seed });
  })();
}

export function startOverRoom(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  db.transaction(() => {
    db.prepare('DELETE FROM boards WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM votes WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM game_events WHERE room_id = ?').run(room.id);

    db.prepare(
      `
        UPDATE rooms
        SET status = 'lobby',
            game_phase = 'lobby',
            current_turn_team = NULL,
            turn_number = 1,
            timer_remaining_seconds = timer_seconds,
            timer_state = 'idle',
            current_clue_text = NULL,
            current_clue_count = 1,
            current_clue_reveals_remaining = 0,
            current_round_summary_json = NULL,
            current_game_result_summary_json = NULL,
            winning_team = NULL,
            updated_at = ?
        WHERE id = ?
      `
    ).run(nowIso(), room.id);

    resetCurrentCaptains(room.id);
  })();
}

export function sendChatMessage(roomCode: string, playerId: string, message: string): void {
  const room = getRoomRow(roomCode);
  const assignment = getAssignmentRow(room.id, playerId);
  const player = getPlayerRow(room.id, playerId);
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new AppError('Message cannot be empty.', 400);
  }

  if (!assignment.team || !assignment.role) {
    throw new AppError('Only assigned players can use subgroup chat.', 403);
  }

  const channelKey = getChannelKey(assignment.team, assignment.role);

  db.transaction(() => {
    db.prepare(
      `
        INSERT INTO chat_messages (id, room_id, channel_key, player_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(createId(), room.id, channelKey, player.id, trimmedMessage, nowIso());

    touchRoom(room.id);
    recordEvent(room.id, 'chat_message', { playerId, channelKey });
  })();
}

export function startTimer(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  if (!room.timer_enabled) {
    throw new AppError('Enable the timer in the lobby before starting it.', 400);
  }

  db.prepare(
    `
      UPDATE rooms
      SET timer_state = 'running',
          timer_remaining_seconds = CASE WHEN timer_remaining_seconds <= 0 THEN timer_seconds ELSE timer_remaining_seconds END,
          updated_at = ?
      WHERE id = ?
    `
  ).run(nowIso(), room.id);
}

export function pauseTimer(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  db.prepare(
    `
      UPDATE rooms
      SET timer_state = 'paused',
          updated_at = ?
      WHERE id = ?
    `
  ).run(nowIso(), room.id);
}

export function resetTimer(roomCode: string, actorPlayerId: string): void {
  const room = getRoomRow(roomCode);
  assertTeacher(room, actorPlayerId);

  db.prepare(
    `
      UPDATE rooms
      SET timer_state = 'idle',
          timer_remaining_seconds = timer_seconds,
          updated_at = ?
      WHERE id = ?
    `
  ).run(nowIso(), room.id);
}

export function tickTimer(roomCode: string): RoomRow | null {
  const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode) as RoomRow | undefined;

  if (!room || room.timer_state !== 'running') {
    return null;
  }

  const nextRemainingSeconds = Math.max(0, room.timer_remaining_seconds - 1);
  const nextTimerState: TimerState = nextRemainingSeconds === 0 ? 'paused' : 'running';

  db.prepare(
    `
      UPDATE rooms
      SET timer_remaining_seconds = ?,
          timer_state = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(nextRemainingSeconds, nextTimerState, nowIso(), room.id);

  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(room.id) as RoomRow;
}

export function getChatHistoryForViewer(
  roomCode: string,
  playerId: string,
  channelKey: ChannelKey
): ChatMessageView[] {
  const room = getRoomRow(roomCode);
  const player = getPlayerRow(room.id, playerId);
  const assignment = getAssignmentRow(room.id, playerId);
  const viewerChannel = assignment.team && assignment.role ? getChannelKey(assignment.team, assignment.role) : null;

  if (!player.is_teacher && viewerChannel !== channelKey) {
    throw new AppError('You do not have access to that chat channel.', 403);
  }

  return getChatHistory(room.id, channelKey);
}

export function resetRoomForDevelopment(roomCode: string): void {
  const room = getRoomRow(roomCode);

  db.transaction(() => {
    db.prepare('DELETE FROM boards WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM votes WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(room.id);
    db.prepare('DELETE FROM game_events WHERE room_id = ?').run(room.id);

    db.prepare(
      `
        UPDATE rooms
        SET status = 'lobby',
            game_phase = 'lobby',
            current_turn_team = NULL,
            turn_number = 1,
            timer_remaining_seconds = timer_seconds,
            timer_state = 'idle',
            current_clue_text = NULL,
            current_clue_count = 1,
            current_clue_reveals_remaining = 0,
            current_round_summary_json = NULL,
            current_game_result_summary_json = NULL,
            winning_team = NULL,
            updated_at = ?
        WHERE id = ?
      `
    ).run(nowIso(), room.id);

    resetCurrentCaptains(room.id);
  })();
}

export function getRoomViewState(
  roomCode: string,
  options: { playerId?: string; view?: RoomStateView }
): RoomViewState {
  const room = getRoomRow(roomCode);
  const players = getPlayers(room.id);
  const assignments = getAssignments(room.id);
  const board = getBoard(room.id);
  const tiles = board ? getTiles(board.id) : [];
  const votes = getVotes(room.id, room.turn_number);
  const activeVoteCounts = votes
    .filter((vote) => vote.scope === 'active')
    .reduce<Record<string, number>>((accumulator, vote) => {
      accumulator[vote.tile_id] = (accumulator[vote.tile_id] ?? 0) + 1;
      return accumulator;
    }, {});
  const passiveVoteCounts = votes
    .filter((vote) => vote.scope === 'passive')
    .reduce<Record<string, number>>((accumulator, vote) => {
      accumulator[vote.tile_id] = (accumulator[vote.tile_id] ?? 0) + 1;
      return accumulator;
    }, {});

  const player = options.playerId ? players.find((entry) => entry.id === options.playerId) : undefined;
  const assignment = options.playerId ? assignments.find((entry) => entry.player_id === options.playerId) : undefined;
  const channelKey =
    assignment?.team && assignment.role ? getChannelKey(assignment.team, assignment.role) : null;
  const view = options.view ?? 'lobby';
  const route = getViewerRoute(room, view, Boolean(player?.is_teacher), assignment?.role ?? null);
  const showKey = route === 'spymaster' && assignment?.role === 'spymaster';
  const viewerVoteScope = assignment ? getVoteScopeForAssignment(room, assignment) : null;
  const viewerVoteIds = new Set(
    options.playerId
      ? votes
          .filter((vote) => vote.player_id === options.playerId && vote.scope === viewerVoteScope)
          .map((vote) => vote.tile_id)
      : []
  );
  const isClueCycleActive =
    room.status === 'in_progress' &&
    room.game_phase === 'guessing' &&
    Boolean(room.current_clue_text) &&
    room.current_clue_reveals_remaining > 0;
  const canViewerSeePassiveVotes =
    view === 'presentation' ||
    (assignment?.role === 'guesser' &&
      assignment.team !== null &&
      room.current_turn_team !== null &&
      assignment.team === otherTeam(room.current_turn_team));
  const visibleRedVoteCounts =
    room.current_turn_team === 'red'
      ? activeVoteCounts
      : room.current_turn_team === 'blue' && canViewerSeePassiveVotes
        ? passiveVoteCounts
        : {};
  const visibleBlueVoteCounts =
    room.current_turn_team === 'blue'
      ? activeVoteCounts
      : room.current_turn_team === 'red' && canViewerSeePassiveVotes
        ? passiveVoteCounts
        : {};

  const displayedVoteCounts =
    view === 'presentation'
      ? activeVoteCounts
      : assignment?.role === 'guesser' && viewerVoteScope === 'passive'
        ? passiveVoteCounts
        : activeVoteCounts;

  const boardView: BoardTileView[] = tiles.map((tile) => ({
    id: tile.id,
    position: tile.position,
    word: tile.word,
    ownerColor: tile.is_revealed || showKey ? tile.owner_color : null,
    isRevealed: Boolean(tile.is_revealed),
    voteCount: displayedVoteCounts[tile.id] ?? 0,
    redVoteCount: visibleRedVoteCounts[tile.id] ?? 0,
    blueVoteCount: visibleBlueVoteCounts[tile.id] ?? 0,
    isViewerVote: viewerVoteIds.has(tile.id),
    isRevealable: !tile.is_revealed && isClueCycleActive && (activeVoteCounts[tile.id] ?? 0) > 0
  }));

  const teamStatus = buildTeamStatus(tiles, players, assignments);
  const cluePanelState =
    assignment?.role === 'spymaster' &&
    assignment.team === room.current_turn_team &&
    assignment.is_current_spymaster_captain === 1
      ? room.current_clue_text
        ? 'done'
        : 'open'
      : 'inactive';
  const assignmentSummary: AssignmentSummary[] = assignments.map((entry) => ({
    playerId: entry.player_id,
    team: entry.team,
    role: entry.role,
    captainOrder: entry.captain_order,
    isCurrentCaptain: Boolean(entry.is_current_captain),
    isCurrentSpymasterCaptain: Boolean(entry.is_current_spymaster_captain)
  }));
  const selectedWordPack = (() => {
    if (!room.selected_word_pack_config_json) {
      return null;
    }

    try {
      return JSON.parse(room.selected_word_pack_config_json) as {
        name?: string;
        sourceType?: 'manual' | 'spreadsheet';
        forcedStartingTeam?: Team | null;
      };
    } catch {
      return null;
    }
  })();

  return {
    room: {
      roomCode: room.room_code,
      status: room.status,
      gamePhase: room.game_phase,
      currentTurnTeam: room.current_turn_team,
      turnNumber: room.turn_number,
      winningTeam: room.winning_team
    },
    timer: {
      enabled: Boolean(room.timer_enabled),
      seconds: room.timer_seconds,
      remainingSeconds: room.timer_remaining_seconds,
      state: room.timer_state
    },
    clue: {
      text: room.current_clue_text,
      count: room.current_clue_count || 1,
      remainingReveals: room.current_clue_reveals_remaining || 0,
      isActive: isClueCycleActive
    },
    wordPack: {
      selectedPackId: room.selected_word_pack_id,
      selectedPackName: selectedWordPack?.name ?? null,
      selectedPackSourceType: selectedWordPack?.sourceType ?? null,
      forcedStartingTeam: selectedWordPack?.forcedStartingTeam ?? null,
      usesDefaultPack: !room.selected_word_pack_config_json
    },
    viewer: {
      playerId: player?.id ?? null,
      name: player?.name ?? null,
      isTeacher: Boolean(player?.is_teacher),
      team: assignment?.team ?? null,
      role: assignment?.role ?? null,
      channelKey,
      isCurrentCaptain: Boolean(assignment?.is_current_captain),
      isCurrentSpymasterCaptain: Boolean(assignment?.is_current_spymaster_captain),
      cluePanelState,
      route,
      canEditAssignments: Boolean(player?.is_teacher) && room.status === 'lobby',
      canStartGame: Boolean(player?.is_teacher) && room.status === 'lobby',
      canReveal:
        Boolean(player?.is_teacher) &&
        view === 'presentation' &&
        room.status === 'in_progress' &&
        isClueCycleActive &&
        boardView.some((tile) => tile.isRevealable),
      canEndGuessing:
        Boolean(player?.is_teacher) &&
        view === 'presentation' &&
        room.status === 'in_progress' &&
        isClueCycleActive,
      canEndTurn:
        Boolean(player?.is_teacher) &&
        view === 'presentation' &&
        isBonusRevealAvailable(room),
      canEndGuessingEarly:
        Boolean(player?.is_teacher) &&
        view === 'presentation' &&
        room.status === 'in_progress' &&
        isClueCycleActive,
      canContinueSummary:
        Boolean(player?.is_teacher) &&
        view === 'presentation' &&
        room.status === 'in_progress' &&
        room.game_phase === 'summary' &&
        Boolean(room.current_round_summary_json),
      canVote:
        room.status === 'in_progress' &&
        room.game_phase === 'guessing' &&
        isClueCycleActive &&
        assignment?.role === 'guesser' &&
        assignment.team === room.current_turn_team,
      canPassiveVote:
        room.status === 'in_progress' &&
        room.game_phase === 'guessing' &&
        isClueCycleActive &&
        assignment?.role === 'guesser' &&
        assignment.team !== null &&
        room.current_turn_team !== null &&
        assignment.team === otherTeam(room.current_turn_team),
      canEditClue:
        room.status === 'in_progress' &&
        room.game_phase === 'guessing' &&
        !room.current_clue_text &&
        assignment?.role === 'spymaster' &&
        Boolean(assignment?.is_current_spymaster_captain) &&
        assignment.team === room.current_turn_team,
      canControlTimer: Boolean(player?.is_teacher),
      showKey
    },
    players: players.map((entry) => ({
      id: entry.id,
      name: entry.name,
      isTeacher: Boolean(entry.is_teacher),
      isConnected: Boolean(entry.is_connected),
      joinedAt: entry.joined_at
    })),
    assignments: assignmentSummary,
    board: boardView,
    teamStatus,
    chatMessages: getChatHistory(room.id, channelKey),
    roundSummary: parseRoundSummary(room.current_round_summary_json),
    gameResultSummary: parseGameResultSummary(room.current_game_result_summary_json),
    joinLink: getRoomJoinLink(room.room_code),
    presentationPath: `/room/${room.room_code}/presentation`
  };
}
