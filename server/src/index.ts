import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { getDb } from './db/database';
import { createApiRouter } from './routes/api';
import { createRealtimeLayer } from './socket/realtime';

export type ClassroomServerHandle = {
  close: () => Promise<void>;
  localUrl: string;
  publicUrl: string;
  clientDistPath: string;
};

function resolveClientDistPath() {
  const configuredPath = process.env.CLIENT_DIST_PATH?.trim();

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirectory = path.dirname(currentFilePath);
  return path.resolve(currentDirectory, '../../client/dist');
}

function createExpressApp(clientDistPath: string) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (config.isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin ?? 'unknown'} is not allowed.`));
      },
      credentials: true
    })
  );
  app.use(express.json());

  return app;
}

export async function startServer(): Promise<ClassroomServerHandle> {
  getDb();
  const clientDistPath = resolveClientDistPath();
  const app = createExpressApp(clientDistPath);
  const server = createServer(app);
  const realtime = createRealtimeLayer(server);

  app.use('/api', createApiRouter(realtime.broadcastRoomState, realtime.timerService));

  if (config.serveClient) {
    if (!existsSync(path.join(clientDistPath, 'index.html'))) {
      console.warn(`Client build not found at ${clientDistPath}. Run "npm run build:prod" before packaging or previewing.`);
    } else {
      app.use(express.static(clientDistPath));
      app.get(/^\/(?!api\/|socket\.io\/).*/, (_request, response) => {
        response.sendFile(path.join(clientDistPath, 'index.html'));
      });
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      console.log(`Classroom CodeNames server listening on ${config.publicAppUrl}`);
      console.log(`Host binding: ${config.host}:${config.port}`);

      if (config.serveClient) {
        console.log(`Serving built client from ${clientDistPath}`);
      } else {
        console.log(`Expecting client origin(s): ${config.allowedOrigins.join(', ')}`);
      }

      resolve();
    });
  });

  return {
    localUrl: `http://127.0.0.1:${config.port}`,
    publicUrl: config.publicAppUrl,
    clientDistPath,
    close: () =>
      new Promise((resolve) => {
        realtime.timerService.stopAll();
        server.close(() => {
          resolve();
        });
      })
  };
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  let activeServer: ClassroomServerHandle | null = null;

  const shutdown = async () => {
    if (!activeServer) {
      process.exit(0);
      return;
    }

    await activeServer.close();
    process.exit(0);
  };

  startServer()
    .then((handle) => {
      activeServer = handle;
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Unable to start Classroom CodeNames server.');
      process.exit(1);
    });
}
