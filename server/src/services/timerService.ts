import { tickTimer } from './roomService';

type BroadcastFn = (roomCode: string) => void;

export class TimerService {
  private readonly intervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly broadcastRoomState: BroadcastFn) {}

  start(roomCode: string): void {
    if (this.intervals.has(roomCode)) {
      return;
    }

    const interval = setInterval(() => {
      const room = tickTimer(roomCode);

      if (!room || room.timer_state !== 'running') {
        this.stop(roomCode);
      }

      this.broadcastRoomState(roomCode);
    }, 1000);

    this.intervals.set(roomCode, interval);
  }

  stop(roomCode: string): void {
    const interval = this.intervals.get(roomCode);

    if (interval) {
      clearInterval(interval);
      this.intervals.delete(roomCode);
    }
  }

  stopAll(): void {
    Array.from(this.intervals.keys()).forEach((roomCode) => this.stop(roomCode));
  }
}
