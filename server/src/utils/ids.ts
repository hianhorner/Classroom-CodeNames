import { randomBytes, randomUUID } from 'node:crypto';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createId(): string {
  return randomUUID();
}

export function createRoomCode(length = 6): string {
  let output = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = randomBytes(1)[0] % ROOM_CODE_CHARS.length;
    output += ROOM_CODE_CHARS[randomIndex];
  }

  return output;
}
