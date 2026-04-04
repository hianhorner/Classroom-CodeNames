import { Router, type ErrorRequestHandler } from 'express';
import type { ChannelKey, GetRoomStateRequest, RoomStateView } from '@classroom-codenames/shared';
import multer from 'multer';
import {
  createRoom,
  getChatHistoryForViewer,
  getRoomViewState,
  joinRoom,
  resetRoomForDevelopment,
  startGame,
  updateAssignments,
  updateTimerConfig
} from '../services/roomService';
import type { TimerService } from '../services/timerService';
import {
  applyManualWordPack,
  applySavedWordPack,
  applySpreadsheetWordPack,
  getTemplateWorkbookBuffer,
  listWordPacks,
  saveManualWordPack,
  saveSpreadsheetWordPack
} from '../services/wordPackService';
import { AppError } from '../utils/AppError';

type BroadcastFn = (roomCode: string) => void;

export function createApiRouter(broadcastRoomState: BroadcastFn, timerService: TimerService) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage() });

  router.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  router.post('/rooms', (request, response, next) => {
    try {
      const payload = createRoom(String(request.body?.teacherName ?? 'Teacher'));
      response.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/join', (request, response, next) => {
    try {
      const payload = joinRoom(
        request.params.roomCode.toUpperCase(),
        String(request.body?.name ?? ''),
        typeof request.body?.playerId === 'string' ? request.body.playerId : undefined
      );
      response.status(201).json(payload);
      broadcastRoomState(payload.roomCode);
    } catch (error) {
      next(error);
    }
  });

  router.get('/rooms/:roomCode/state', (request, response, next) => {
    try {
      const query = request.query as GetRoomStateRequest;
      const payload = getRoomViewState(request.params.roomCode.toUpperCase(), {
        playerId: query.playerId,
        view: (query.view as RoomStateView | undefined) ?? 'lobby'
      });
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/assignments', (request, response, next) => {
    try {
      updateAssignments(
        request.params.roomCode.toUpperCase(),
        String(request.body?.playerId ?? ''),
        Array.isArray(request.body?.assignments) ? request.body.assignments : []
      );
      broadcastRoomState(request.params.roomCode.toUpperCase());
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/start', (request, response, next) => {
    try {
      const roomCode = request.params.roomCode.toUpperCase();
      startGame(roomCode, String(request.body?.playerId ?? ''));
      timerService.stop(roomCode);
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/timer', (request, response, next) => {
    try {
      const roomCode = request.params.roomCode.toUpperCase();
      updateTimerConfig(
        roomCode,
        String(request.body?.playerId ?? ''),
        Boolean(request.body?.enabled),
        Number(request.body?.seconds ?? 120)
      );
      timerService.stop(roomCode);
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/rooms/:roomCode/chat/:channelKey', (request, response, next) => {
    try {
      const messages = getChatHistoryForViewer(
        request.params.roomCode.toUpperCase(),
        String(request.query.playerId ?? ''),
        request.params.channelKey as ChannelKey
      );
      response.json(messages);
    } catch (error) {
      next(error);
    }
  });

  router.get('/rooms/:roomCode/word-packs', (request, response, next) => {
    try {
      const payload = listWordPacks(request.params.roomCode.toUpperCase(), String(request.query.playerId ?? ''));
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get('/rooms/:roomCode/word-packs/template', (request, response, next) => {
    try {
      listWordPacks(request.params.roomCode.toUpperCase(), String(request.query.playerId ?? ''));
      const buffer = getTemplateWorkbookBuffer();
      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      response.setHeader('Content-Disposition', 'attachment; filename="classroom-codenames-wordpack-template.xlsx"');
      response.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/word-packs/manual/save', (request, response, next) => {
    try {
      const payload = saveManualWordPack(
        request.params.roomCode.toUpperCase(),
        String(request.body?.playerId ?? ''),
        String(request.body?.name ?? ''),
        String(request.body?.words ?? '')
      );
      response.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/word-packs/manual/apply', (request, response, next) => {
    try {
      const roomCode = request.params.roomCode.toUpperCase();
      applyManualWordPack(
        roomCode,
        String(request.body?.playerId ?? ''),
        String(request.body?.name ?? ''),
        String(request.body?.words ?? '')
      );
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/word-packs/upload/save', upload.single('file'), (request, response, next) => {
    try {
      if (!request.file?.buffer) {
        throw new AppError('Upload a .xlsx file first.', 400);
      }

      const payload = saveSpreadsheetWordPack(
        String(request.params.roomCode).toUpperCase(),
        String(request.body?.playerId ?? ''),
        request.file.buffer
      );
      response.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/word-packs/upload/apply', upload.single('file'), (request, response, next) => {
    try {
      if (!request.file?.buffer) {
        throw new AppError('Upload a .xlsx file first.', 400);
      }

      const roomCode = String(request.params.roomCode).toUpperCase();
      applySpreadsheetWordPack(roomCode, String(request.body?.playerId ?? ''), request.file.buffer);
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/rooms/:roomCode/word-packs/:wordPackId/apply', (request, response, next) => {
    try {
      const roomCode = request.params.roomCode.toUpperCase();
      applySavedWordPack(roomCode, String(request.body?.playerId ?? ''), String(request.params.wordPackId ?? ''));
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/dev/reset-room/:roomCode', (request, response, next) => {
    try {
      const roomCode = request.params.roomCode.toUpperCase();
      resetRoomForDevelopment(roomCode);
      timerService.stop(roomCode);
      broadcastRoomState(roomCode);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    response.status(500).json({ message });
  };

  router.use(errorHandler);

  return router;
}
