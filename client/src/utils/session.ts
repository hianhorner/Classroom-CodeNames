import { LOCAL_SESSION_KEY, type SessionIdentity } from '@classroom-codenames/shared';

type SessionStore = Record<string, SessionIdentity>;

function isSessionIdentity(value: unknown): value is SessionIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionIdentity>;
  return (
    typeof candidate.roomCode === 'string' &&
    typeof candidate.playerId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.isTeacher === 'boolean'
  );
}

function readSessionStore(): SessionStore {
  const rawValue = window.localStorage.getItem(LOCAL_SESSION_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (isSessionIdentity(parsed)) {
      return { [parsed.roomCode]: parsed };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.entries(parsed as Record<string, unknown>).reduce<SessionStore>((sessions, [roomCode, value]) => {
      if (isSessionIdentity(value) && value.roomCode === roomCode) {
        sessions[roomCode] = value;
      }

      return sessions;
    }, {});
  } catch {
    return {};
  }
}

export function getStoredSession(roomCode?: string): SessionIdentity | null {
  const sessions = readSessionStore();

  if (roomCode) {
    return sessions[roomCode] ?? null;
  }

  return Object.values(sessions)[0] ?? null;
}

export function saveSession(session: SessionIdentity) {
  const sessions = readSessionStore();
  sessions[session.roomCode] = session;
  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessions));
}

export function clearSession(roomCode?: string) {
  if (!roomCode) {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }

  const sessions = readSessionStore();
  delete sessions[roomCode];
  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessions));
}
