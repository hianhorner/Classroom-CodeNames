import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

const serverPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectRoot = path.resolve(serverPackageRoot, '..');
const databasePath = path.isAbsolute(config.databasePath)
  ? config.databasePath
  : path.resolve(projectRoot, config.databasePath);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL UNIQUE,
    created_by_player_id TEXT NOT NULL,
    status TEXT NOT NULL,
    game_phase TEXT NOT NULL,
    current_turn_team TEXT,
    turn_number INTEGER NOT NULL DEFAULT 1,
    timer_enabled INTEGER NOT NULL DEFAULT 0,
    timer_seconds INTEGER NOT NULL DEFAULT 120,
    timer_remaining_seconds INTEGER NOT NULL DEFAULT 120,
    timer_state TEXT NOT NULL DEFAULT 'idle',
    current_clue_text TEXT,
    current_clue_count INTEGER NOT NULL DEFAULT 1,
    current_clue_reveals_remaining INTEGER NOT NULL DEFAULT 0,
    current_round_summary_json TEXT,
    current_game_result_summary_json TEXT,
    selected_word_pack_id TEXT,
    selected_word_pack_config_json TEXT,
    winning_team TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS word_packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    socket_id TEXT,
    is_teacher INTEGER NOT NULL DEFAULT 0,
    is_connected INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    player_id TEXT NOT NULL UNIQUE,
    team TEXT,
    role TEXT,
    captain_order INTEGER,
    is_current_captain INTEGER NOT NULL DEFAULT 0,
    is_current_spymaster_captain INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL UNIQUE,
    seed TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS board_tiles (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    word TEXT NOT NULL,
    owner_color TEXT NOT NULL,
    is_revealed INTEGER NOT NULL DEFAULT 0,
    is_locked INTEGER NOT NULL DEFAULT 0,
    locked_by_team TEXT,
    locked_at TEXT,
    revealed_at TEXT,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    tile_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (tile_id) REFERENCES board_tiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    channel_key TEXT NOT NULL,
    player_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_events (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_room_id ON assignments(room_id);
  CREATE INDEX IF NOT EXISTS idx_board_tiles_board_id ON board_tiles(board_id);
  CREATE INDEX IF NOT EXISTS idx_votes_room_turn ON votes(room_id, turn_number);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_room_channel ON chat_messages(room_id, channel_key, created_at);
`);

function ensureColumn(tableName: string, columnName: string, columnDefinition: string) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

ensureColumn('rooms', 'current_clue_text', 'TEXT');
ensureColumn('rooms', 'current_clue_count', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('rooms', 'current_clue_reveals_remaining', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('rooms', 'current_round_summary_json', 'TEXT');
ensureColumn('rooms', 'current_game_result_summary_json', 'TEXT');
ensureColumn('rooms', 'selected_word_pack_id', 'TEXT');
ensureColumn('rooms', 'selected_word_pack_config_json', 'TEXT');
ensureColumn('assignments', 'is_current_spymaster_captain', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('votes', 'scope', "TEXT NOT NULL DEFAULT 'active'");
db.exec(`UPDATE rooms SET current_clue_count = 1 WHERE current_clue_count IS NULL;`);
db.exec(
  `UPDATE rooms SET current_clue_reveals_remaining = 0 WHERE current_clue_reveals_remaining IS NULL;`
);
db.exec(`UPDATE votes SET scope = 'active' WHERE scope IS NULL;`);
db.exec(
  `UPDATE assignments SET is_current_spymaster_captain = 0 WHERE is_current_spymaster_captain IS NULL;`
);
