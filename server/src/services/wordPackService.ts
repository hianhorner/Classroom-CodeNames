import XLSX from 'xlsx';
import type { OwnerColor, Team, WordPackConfig, WordPackSourceType, WordPackSummary } from '@classroom-codenames/shared';
import { db } from '../db/database';
import { AppError } from '../utils/AppError';
import { createId } from '../utils/ids';

type RoomWordPackRow = {
  id: string;
  room_code: string;
  status: 'lobby' | 'in_progress' | 'finished';
  selected_word_pack_id: string | null;
  selected_word_pack_config_json: string | null;
};

type PlayerTeacherRow = {
  id: string;
  room_id: string;
  is_teacher: number;
};

type WordPackRow = {
  id: string;
  name: string;
  source_type: WordPackSourceType;
  config_json: string;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function shuffle<T>(items: T[]) {
  const output = [...items];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

function getRoomRow(roomCode: string): RoomWordPackRow {
  const room = db
    .prepare(
      `
        SELECT id, room_code, status, selected_word_pack_id, selected_word_pack_config_json
        FROM rooms
        WHERE room_code = ?
      `
    )
    .get(roomCode) as RoomWordPackRow | undefined;

  if (!room) {
    throw new AppError('Room not found.', 404);
  }

  return room;
}

function assertTeacher(roomId: string, playerId: string) {
  const player = db
    .prepare('SELECT id, room_id, is_teacher FROM players WHERE room_id = ? AND id = ?')
    .get(roomId, playerId) as PlayerTeacherRow | undefined;

  if (!player) {
    throw new AppError('Player not found in this room.', 404);
  }

  if (!player.is_teacher) {
    throw new AppError('Only the teacher can manage word packs.', 403);
  }
}

function assertLobbyEditable(room: RoomWordPackRow) {
  if (room.status !== 'lobby') {
    throw new AppError('Word packs can only be changed while the room is still in the lobby.', 400);
  }
}

function normalizeWord(word: string) {
  return word.trim();
}

function parseDelimitedWords(input: string) {
  return input
    .split(/[\n,\r]+/)
    .map(normalizeWord)
    .filter(Boolean);
}

function ensureUniqueWords(words: string[]) {
  const seen = new Map<string, string>();

  for (const word of words) {
    const key = word.toLocaleLowerCase();

    if (seen.has(key)) {
      throw new AppError(`Duplicate word detected: "${word}".`, 400);
    }

    seen.set(key, word);
  }
}

function buildWordPackSummary(row: WordPackRow, config: WordPackConfig): WordPackSummary {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    randomWordCount: config.randomWords.length,
    redWordCount: config.redWords.length,
    blueWordCount: config.blueWords.length,
    hasAssassinWord: Boolean(config.assassinWord),
    forcedStartingTeam: config.forcedStartingTeam,
    updatedAt: row.updated_at
  };
}

function validateWordPackConfig(config: WordPackConfig): WordPackConfig {
  const name = config.name.trim();
  const randomWords = config.randomWords.map(normalizeWord).filter(Boolean);
  const redWords = config.redWords.map(normalizeWord).filter(Boolean);
  const blueWords = config.blueWords.map(normalizeWord).filter(Boolean);
  const assassinWord = config.assassinWord ? normalizeWord(config.assassinWord) : null;
  const allWords = [...randomWords, ...redWords, ...blueWords, ...(assassinWord ? [assassinWord] : [])];

  if (!name) {
    throw new AppError('Enter a word-pack name before saving or applying it.', 400);
  }

  ensureUniqueWords(allWords);

  if (config.sourceType === 'manual') {
    if (allWords.length !== 25 || randomWords.length !== 25 || redWords.length || blueWords.length || assassinWord) {
      throw new AppError('Manual word packs must contain exactly 25 unique comma-separated words.', 400);
    }

    return {
      ...config,
      name,
      randomWords,
      redWords: [],
      blueWords: [],
      assassinWord: null,
      forcedStartingTeam: null
    };
  }

  if (!assassinWord) {
    throw new AppError('Spreadsheet word packs must include exactly one assassin word.', 400);
  }

  if (redWords.length > 9) {
    throw new AppError('Spreadsheet word packs can include at most 9 forced red words.', 400);
  }

  if (blueWords.length > 9) {
    throw new AppError('Spreadsheet word packs can include at most 9 forced blue words.', 400);
  }

  const totalWords = allWords.length;
  if (totalWords !== 25) {
    throw new AppError(`Spreadsheet word packs must contain exactly 25 unique words. Found ${totalWords}.`, 400);
  }

  let forcedStartingTeam: Team | null = null;
  if (redWords.length === 9 && blueWords.length === 9) {
    throw new AppError('A board cannot force 9 red words and 9 blue words at the same time.', 400);
  }

  if (redWords.length === 9) {
    forcedStartingTeam = 'red';
  } else if (blueWords.length === 9) {
    forcedStartingTeam = 'blue';
  } else if (redWords.length > 8 || blueWords.length > 8) {
    throw new AppError('Only the team that starts the game may force 9 words. Use at most 8 forced words for the other team.', 400);
  }

  return {
    ...config,
    name,
    randomWords,
    redWords,
    blueWords,
    assassinWord,
    forcedStartingTeam
  };
}

export function parseManualWordPackInput(name: string, wordsInput: string): WordPackConfig {
  return validateWordPackConfig({
    name,
    sourceType: 'manual',
    randomWords: parseDelimitedWords(wordsInput),
    redWords: [],
    blueWords: [],
    assassinWord: null,
    forcedStartingTeam: null
  });
}

export function parseSpreadsheetWordPackBuffer(buffer: Buffer): WordPackConfig {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new AppError('The spreadsheet could not be read. Upload a valid .xlsx file.', 400);
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;

  if (!sheet) {
    throw new AppError('The spreadsheet does not contain a readable sheet.', 400);
  }

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  const name = String(rows[0]?.[1] ?? '').trim();
  const randomWords: string[] = [];
  const redWords: string[] = [];
  const blueWords: string[] = [];
  const assassinWords: string[] = [];

  rows.slice(3).forEach((row) => {
    const [randomWord, redWord, blueWord, assassinWord] = row;
    if (String(randomWord ?? '').trim()) {
      randomWords.push(String(randomWord).trim());
    }

    if (String(redWord ?? '').trim()) {
      redWords.push(String(redWord).trim());
    }

    if (String(blueWord ?? '').trim()) {
      blueWords.push(String(blueWord).trim());
    }

    if (String(assassinWord ?? '').trim()) {
      assassinWords.push(String(assassinWord).trim());
    }
  });

  if (assassinWords.length !== 1) {
    throw new AppError('Spreadsheet word packs must include exactly one assassin word in the Assassin Word column.', 400);
  }

  return validateWordPackConfig({
    name,
    sourceType: 'spreadsheet',
    randomWords,
    redWords,
    blueWords,
    assassinWord: assassinWords[0] ?? null,
    forcedStartingTeam: null
  });
}

function storeWordPack(config: WordPackConfig): WordPackSummary {
  const timestamp = nowIso();
  const id = createId();

  db.prepare(
    `
      INSERT INTO word_packs (id, name, source_type, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(id, config.name, config.sourceType, JSON.stringify(config), timestamp, timestamp);

  return {
    id,
    name: config.name,
    sourceType: config.sourceType,
    randomWordCount: config.randomWords.length,
    redWordCount: config.redWords.length,
    blueWordCount: config.blueWords.length,
    hasAssassinWord: Boolean(config.assassinWord),
    forcedStartingTeam: config.forcedStartingTeam,
    updatedAt: timestamp
  };
}

function applyConfigToRoom(room: RoomWordPackRow, config: WordPackConfig, savedWordPackId: string | null) {
  db.prepare(
    `
      UPDATE rooms
      SET selected_word_pack_id = ?,
          selected_word_pack_config_json = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(savedWordPackId, JSON.stringify(config), nowIso(), room.id);
}

function getWordPackRow(wordPackId: string): WordPackRow {
  const row = db
    .prepare(
      `
        SELECT id, name, source_type, config_json, created_at, updated_at
        FROM word_packs
        WHERE id = ?
      `
    )
    .get(wordPackId) as WordPackRow | undefined;

  if (!row) {
    throw new AppError('That saved word pack could not be found.', 404);
  }

  return row;
}

export function listWordPacks(roomCode: string, actorPlayerId: string): WordPackSummary[] {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);

  const rows = db
    .prepare(
      `
        SELECT id, name, source_type, config_json, created_at, updated_at
        FROM word_packs
        ORDER BY updated_at DESC, name COLLATE NOCASE ASC
      `
    )
    .all() as WordPackRow[];

  return rows.map((row) => buildWordPackSummary(row, JSON.parse(row.config_json) as WordPackConfig));
}

export function saveManualWordPack(roomCode: string, actorPlayerId: string, name: string, wordsInput: string) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  return storeWordPack(parseManualWordPackInput(name, wordsInput));
}

export function applyManualWordPack(roomCode: string, actorPlayerId: string, name: string, wordsInput: string) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  applyConfigToRoom(room, parseManualWordPackInput(name, wordsInput), null);
}

export function saveSpreadsheetWordPack(roomCode: string, actorPlayerId: string, buffer: Buffer) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  return storeWordPack(parseSpreadsheetWordPackBuffer(buffer));
}

export function applySpreadsheetWordPack(roomCode: string, actorPlayerId: string, buffer: Buffer) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  applyConfigToRoom(room, parseSpreadsheetWordPackBuffer(buffer), null);
}

export function applySavedWordPack(roomCode: string, actorPlayerId: string, wordPackId: string) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  const row = getWordPackRow(wordPackId);
  applyConfigToRoom(room, JSON.parse(row.config_json) as WordPackConfig, row.id);
}

export function deleteSavedWordPack(roomCode: string, actorPlayerId: string, wordPackId: string) {
  const room = getRoomRow(roomCode);
  assertTeacher(room.id, actorPlayerId);
  assertLobbyEditable(room);
  getWordPackRow(wordPackId);

  const timestamp = nowIso();
  db.transaction(() => {
    const result = db.prepare('DELETE FROM word_packs WHERE id = ?').run(wordPackId);

    if (!result.changes) {
      throw new AppError('That saved word pack could not be found.', 404);
    }

    db.prepare(
      `
        UPDATE rooms
        SET selected_word_pack_id = NULL,
            updated_at = ?
        WHERE selected_word_pack_id = ?
      `
    ).run(timestamp, wordPackId);
  })();
}

export function getAppliedWordPackConfig(roomCode: string): WordPackConfig | null {
  const room = getRoomRow(roomCode);

  if (!room.selected_word_pack_config_json) {
    return null;
  }

  try {
    return JSON.parse(room.selected_word_pack_config_json) as WordPackConfig;
  } catch {
    throw new AppError('The selected word pack could not be read.', 500);
  }
}

function getColorBag(startingTeam: Team): OwnerColor[] {
  return [
    ...Array.from({ length: startingTeam === 'red' ? 9 : 8 }, () => 'red' as const),
    ...Array.from({ length: startingTeam === 'blue' ? 9 : 8 }, () => 'blue' as const),
    ...Array.from({ length: 7 }, () => 'neutral' as const),
    'assassin' as const
  ];
}

export function getStartingTeamForWordPack(config: WordPackConfig): Team | null {
  return config.forcedStartingTeam;
}

export function createWordPackEntries(
  config: WordPackConfig,
  startingTeam: Team
): Array<{ word: string; ownerColor: OwnerColor }> {
  if (config.sourceType === 'manual') {
    const colors = shuffle(getColorBag(startingTeam));
    const words = shuffle(config.randomWords);

    if (words.length !== 25) {
      throw new AppError('The manual word pack no longer contains exactly 25 words.', 400);
    }

    return words.map((word, index) => ({
      word,
      ownerColor: colors[index]!
    }));
  }

  const colorBag = getColorBag(startingTeam);
  const fixedEntries: Array<{ word: string; ownerColor: OwnerColor }> = [
    ...config.redWords.map((word) => ({ word, ownerColor: 'red' as const })),
    ...config.blueWords.map((word) => ({ word, ownerColor: 'blue' as const })),
    ...(config.assassinWord ? [{ word: config.assassinWord, ownerColor: 'assassin' as const }] : [])
  ];

  const remainingColors = [...colorBag];
  const removeColor = (ownerColor: OwnerColor) => {
    const index = remainingColors.findIndex((color) => color === ownerColor);

    if (index === -1) {
      throw new AppError('The selected word pack requests more forced colors than fit on a legal Codenames board.', 400);
    }

    remainingColors.splice(index, 1);
  };

  fixedEntries.forEach((entry) => removeColor(entry.ownerColor));

  if (config.randomWords.length !== remainingColors.length) {
    throw new AppError('The selected word pack does not have the right number of randomized words to fill the board.', 400);
  }

  const shuffledRemainingColors = shuffle(remainingColors);
  const randomizedEntries = shuffle(config.randomWords).map((word, index) => ({
    word,
    ownerColor: shuffledRemainingColors[index]!
  }));

  return shuffle([...fixedEntries, ...randomizedEntries]);
}

export function getTemplateWorkbookBuffer() {
  const rows: Array<Array<string>> = [
    ['Pack Name', 'My Classroom Pack', '', '', '', 'Instructions'],
    ['', '', '', '', '', '1. Put the reusable pack name in cell B1.'],
    ['Random Words', 'Red Words', 'Blue Words', 'Assassin Word', '', '2. Add one word per cell starting on row 4.'],
    ['TREE', 'APPLE', 'OCEAN', 'SHADOW', '', '3. Use Random Words alone for a fully randomized 25-word pack.'],
    ['BRIDGE', '', '', '', '', '4. Or mix Random Words with Red/Blue/Assassin overrides.'],
    ['PLANET', '', '', '', '', '5. Total unique words across all four columns must equal 25.'],
    ['', '', '', '', '', '6. Include exactly one Assassin Word.'],
    ['', '', '', '', '', '7. Force 9 red or 9 blue words only if that color should start.']
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 4 },
    { wch: 62 }
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Wordpack Template');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });
}
