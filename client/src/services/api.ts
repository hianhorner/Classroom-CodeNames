import type {
  ApplyManualWordPackRequest,
  ApplySavedWordPackRequest,
  ChatMessageView,
  CreateRoomRequest,
  CreateRoomResponse,
  GetRoomStateRequest,
  JoinRoomRequest,
  JoinRoomResponse,
  RoomViewState,
  SaveManualWordPackRequest,
  UpdateAssignmentsRequest,
  UpdateTimerRequest,
  WordPackSummary
} from '@classroom-codenames/shared';

function resolveServerUrl() {
  const envUrl = import.meta.env.VITE_SERVER_URL?.trim();

  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }

    return window.location.origin;
  }

  return 'http://localhost:4000';
}

const SERVER_URL = resolveServerUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SERVER_URL}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Request failed.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getServerUrl() {
  return SERVER_URL;
}

export function createRoom(payload: CreateRoomRequest) {
  return request<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function joinRoom(roomCode: string, payload: JoinRoomRequest) {
  return request<JoinRoomResponse>(`/rooms/${roomCode}/join`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getRoomState(roomCode: string, query: GetRoomStateRequest) {
  const search = new URLSearchParams();

  if (query.playerId) {
    search.set('playerId', query.playerId);
  }

  if (query.view) {
    search.set('view', query.view);
  }

  return request<RoomViewState>(`/rooms/${roomCode}/state?${search.toString()}`);
}

export function updateAssignments(roomCode: string, payload: UpdateAssignmentsRequest) {
  return request<void>(`/rooms/${roomCode}/assignments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function startGame(roomCode: string, playerId: string) {
  return request<void>(`/rooms/${roomCode}/start`, {
    method: 'POST',
    body: JSON.stringify({ playerId })
  });
}

export function updateTimer(roomCode: string, payload: UpdateTimerRequest) {
  return request<void>(`/rooms/${roomCode}/timer`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getChatHistory(roomCode: string, channelKey: string, playerId: string) {
  return request<ChatMessageView[]>(
    `/rooms/${roomCode}/chat/${channelKey}?${new URLSearchParams({ playerId }).toString()}`
  );
}

export function resetRoom(roomCode: string) {
  return request<void>(`/dev/reset-room/${roomCode}`, {
    method: 'POST'
  });
}

export function getWordPacks(roomCode: string, playerId: string) {
  return request<WordPackSummary[]>(
    `/rooms/${roomCode}/word-packs?${new URLSearchParams({ playerId }).toString()}`
  );
}

export function getWordPackTemplateUrl(roomCode: string, playerId: string) {
  return `${SERVER_URL}/api/rooms/${roomCode}/word-packs/template?${new URLSearchParams({ playerId }).toString()}`;
}

export function saveManualWordPack(roomCode: string, payload: SaveManualWordPackRequest) {
  return request<WordPackSummary>(`/rooms/${roomCode}/word-packs/manual/save`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function applyManualWordPack(roomCode: string, payload: ApplyManualWordPackRequest) {
  return request<void>(`/rooms/${roomCode}/word-packs/manual/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function uploadWordPackFile(path: string, file: File, playerId: string) {
  const formData = new FormData();
  formData.set('playerId', playerId);
  formData.set('file', file);

  const response = await fetch(`${SERVER_URL}/api${path}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Upload failed.');
  }

  if (response.status === 204) {
    return undefined;
  }

  return (await response.json()) as WordPackSummary;
}

export function saveSpreadsheetWordPack(roomCode: string, playerId: string, file: File) {
  return uploadWordPackFile(`/rooms/${roomCode}/word-packs/upload/save`, file, playerId) as Promise<WordPackSummary>;
}

export function applySpreadsheetWordPack(roomCode: string, playerId: string, file: File) {
  return uploadWordPackFile(`/rooms/${roomCode}/word-packs/upload/apply`, file, playerId) as Promise<void>;
}

export function applySavedWordPack(roomCode: string, wordPackId: string, payload: ApplySavedWordPackRequest) {
  return request<void>(`/rooms/${roomCode}/word-packs/${wordPackId}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
