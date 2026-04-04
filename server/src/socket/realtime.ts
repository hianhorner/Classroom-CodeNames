import type { Server as HttpServer } from 'node:http';
import {
  type ClientToServerEvents,
  type RoomStateView,
  type ServerToClientEvents
} from '@classroom-codenames/shared';
import { Server, type Socket } from 'socket.io';
import { config } from '../config';
import {
  advanceTurn,
  castVote,
  endGuessingEarly,
  getRoomViewState,
  pauseTimer,
  rematchGame,
  removeVote,
  resetTimer,
  revealTile,
  sendChatMessage,
  setPlayerConnection,
  startOverRoom,
  updateClue,
  startTimer
} from '../services/roomService';
import { TimerService } from '../services/timerService';
import { AppError } from '../utils/AppError';

type SessionRegistration = {
  roomCode: string;
  playerId?: string;
  view: RoomStateView;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function createRealtimeLayer(server: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin(origin, callback) {
        if (config.isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin ?? 'unknown'} is not allowed.`));
      },
      credentials: true
    }
  });

  const sessions = new Map<string, SessionRegistration>();

  const broadcastRoomState = (roomCode: string) => {
    sessions.forEach((session, socketId) => {
      if (session.roomCode !== roomCode) {
        return;
      }

      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        return;
      }

      try {
        const state = getRoomViewState(roomCode, { playerId: session.playerId, view: session.view });
        socket.emit('room:state', state);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh room state.';
        socket.emit('server:error', message);
      }
    });
  };

  const timerService = new TimerService(broadcastRoomState);

  const emitError = (socket: AppSocket, error: unknown) => {
    const message = error instanceof AppError ? error.message : 'Something went wrong.';
    socket.emit('server:error', message);
  };

  const handleRoomAction = (socket: AppSocket, roomCode: string, action: () => void) => {
    try {
      action();
      broadcastRoomState(roomCode);
    } catch (error) {
      emitError(socket, error);
    }
  };

  const hasOtherActiveSocket = (playerId: string, currentSocketId: string): boolean => {
    return Array.from(sessions.entries()).some(
      ([socketId, session]) => socketId !== currentSocketId && session.playerId === playerId
    );
  };

  io.on('connection', (socket) => {
    socket.on('room:join', (payload) => {
      try {
        sessions.set(socket.id, {
          roomCode: payload.roomCode,
          playerId: payload.playerId,
          view: payload.view
        });

        socket.join(payload.roomCode);

        if (payload.playerId) {
          setPlayerConnection(payload.playerId, socket.id, true);
        }

        const state = getRoomViewState(payload.roomCode, {
          playerId: payload.playerId,
          view: payload.view
        });

        socket.emit('room:state', state);
        broadcastRoomState(payload.roomCode);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('vote:cast', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => castVote(payload.roomCode, payload.playerId, payload.tileId))
    );

    socket.on('vote:remove', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => removeVote(payload.roomCode, payload.playerId, payload.tileId))
    );

    socket.on('tile:reveal', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => revealTile(payload.roomCode, payload.playerId, payload.tileId))
    );

    socket.on('turn:advance', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => advanceTurn(payload.roomCode, payload.playerId))
    );

    socket.on('turn:end-early', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => endGuessingEarly(payload.roomCode, payload.playerId))
    );

    socket.on('game:rematch', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => rematchGame(payload.roomCode, payload.playerId))
    );

    socket.on('game:start-over', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => startOverRoom(payload.roomCode, payload.playerId))
    );

    socket.on('chat:send', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => sendChatMessage(payload.roomCode, payload.playerId, payload.message))
    );

    socket.on('clue:update', (payload) =>
      handleRoomAction(socket, payload.roomCode, () =>
        updateClue(payload.roomCode, payload.playerId, payload.text, payload.count)
      )
    );

    socket.on('timer:start', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => {
        startTimer(payload.roomCode, payload.playerId);
        timerService.start(payload.roomCode);
      })
    );

    socket.on('timer:pause', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => {
        pauseTimer(payload.roomCode, payload.playerId);
        timerService.stop(payload.roomCode);
      })
    );

    socket.on('timer:reset', (payload) =>
      handleRoomAction(socket, payload.roomCode, () => {
        resetTimer(payload.roomCode, payload.playerId);
        timerService.stop(payload.roomCode);
      })
    );

    socket.on('disconnect', () => {
      const session = sessions.get(socket.id);

      if (!session) {
        return;
      }

      if (session.playerId && !hasOtherActiveSocket(session.playerId, socket.id)) {
        setPlayerConnection(session.playerId, null, false);
      }

      sessions.delete(socket.id);
      broadcastRoomState(session.roomCode);
    });
  });

  return {
    io,
    timerService,
    broadcastRoomState
  };
}
