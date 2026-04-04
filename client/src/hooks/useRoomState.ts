import { type ClientToServerEvents, type RoomStateView, type RoomViewState, type ServerToClientEvents } from '@classroom-codenames/shared';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getRoomState, getServerUrl, startGame, updateAssignments, updateTimer } from '../services/api';
import { getStoredSession } from '../utils/session';

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useRoomState(roomCode: string, view: RoomStateView) {
  const session = getStoredSession(roomCode);
  const [state, setState] = useState<RoomViewState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<RoomSocket | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function refreshState(isSilent = false) {
      try {
        if (!isSilent) {
          setIsLoading(true);
        }

        const nextState = await getRoomState(roomCode, {
          playerId: session?.playerId,
          view
        });

        if (isMounted) {
          setState(nextState);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted && !isSilent) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load room state.');
        }
      } finally {
        if (isMounted && !isSilent) {
          setIsLoading(false);
        }
      }
    }

    refreshState();

    const socket = io(getServerUrl(), {
      transports: ['polling', 'websocket'],
      reconnection: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', {
        roomCode,
        playerId: session?.playerId,
        view
      });
    });

    socket.on('room:state', (nextState) => {
      if (!isMounted) {
        return;
      }

      setState(nextState);
      setIsLoading(false);
      setError(null);
    });

    socket.on('server:error', (message) => {
      if (isMounted) {
        setError(message);
      }
    });

    const refreshIntervalId = window.setInterval(() => {
      void refreshState(true);
    }, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshIntervalId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, session?.playerId, view]);

  async function saveAssignments(payload: Parameters<typeof updateAssignments>[1]) {
    await updateAssignments(roomCode, payload);
  }

  async function saveTimer(payload: Parameters<typeof updateTimer>[1]) {
    await updateTimer(roomCode, payload);
  }

  async function beginGame() {
    if (!session?.playerId) {
      throw new Error('Only the teacher session can start the game.');
    }

    await startGame(roomCode, session.playerId);
  }

  function emit<EventName extends keyof ClientToServerEvents>(
    eventName: EventName,
    payload: Parameters<ClientToServerEvents[EventName]>[0]
  ) {
    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit(eventName, ...( [payload] as Parameters<ClientToServerEvents[EventName]> ));
  }

  return {
    roomCode,
    session,
    state,
    isLoading,
    error,
    actions: {
      saveAssignments,
      saveTimer,
      beginGame,
      emit
    }
  };
}
