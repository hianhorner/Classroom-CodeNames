import { resetRoomForDevelopment } from '../services/roomService';

const roomCode = process.argv[2]?.toUpperCase();

if (!roomCode) {
  throw new Error('Usage: npm run reset:room --workspace server -- <ROOM_CODE>');
}

resetRoomForDevelopment(roomCode);
console.log(`Room ${roomCode} reset to lobby state.`);
