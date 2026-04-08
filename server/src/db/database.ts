import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

type SqliteDatabase = InstanceType<typeof BetterSqlite3>;

const serverPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectRoot = path.resolve(serverPackageRoot, '..');

let dbInstance: SqliteDatabase | null = null;

function resolveDatabasePath() {
  const configuredPath = config.databasePath;

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const resolvedPath = path.resolve(projectRoot, configuredPath);

  if (
    !process.env.DATABASE_PATH &&
    (resolvedPath.includes('app.asar') || resolvedPath.includes(`${path.sep}Contents${path.sep}Resources${path.sep}`))
  ) {
    throw new Error(
      'Packaged Classroom CodeNames requires DATABASE_PATH to point to a writable user-data folder.'
    );
  }

  return resolvedPath;
}

function ensureColumn(database: SqliteDatabase, tableName: string, columnName: string, columnDefinition: string) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function initializeDatabase(database: SqliteDatabase) {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
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

  ensureColumn(database, 'rooms', 'current_clue_text', 'TEXT');
  ensureColumn(database, 'rooms', 'current_clue_count', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(database, 'rooms', 'current_clue_reveals_remaining', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'rooms', 'current_round_summary_json', 'TEXT');
  ensureColumn(database, 'rooms', 'current_game_result_summary_json', 'TEXT');
  ensureColumn(database, 'rooms', 'selected_word_pack_id', 'TEXT');
  ensureColumn(database, 'rooms', 'selected_word_pack_config_json', 'TEXT');
  ensureColumn(database, 'assignments', 'is_current_spymaster_captain', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'votes', 'scope', "TEXT NOT NULL DEFAULT 'active'");
  database.exec(`UPDATE rooms SET current_clue_count = 1 WHERE current_clue_count IS NULL;`);
  database.exec(
    `UPDATE rooms SET current_clue_reveals_remaining = 0 WHERE current_clue_reveals_remaining IS NULL;`
  );
  database.exec(`UPDATE votes SET scope = 'active' WHERE scope IS NULL;`);
  database.exec(
    `UPDATE assignments SET is_current_spymaster_captain = 0 WHERE is_current_spymaster_captain IS NULL;`
  );
}

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  dbInstance = new BetterSqlite3(databasePath);
  initializeDatabase(dbInstance);
  return dbInstance;
}

export const db = new Proxy({} as SqliteDatabase, {
  get(_target, property) {
    const database = getDb();
    const value = Reflect.get(database as object, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
  set(_target, property, value) {
    const database = getDb();
    return Reflect.set(database as object, property, value, database);
  }
});
