import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getLanPreviewUrl } from './lanHost.mjs';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const workspaceDirectory = path.resolve(currentDirectory, '..');
const tsxBinary = path.resolve(workspaceDirectory, 'node_modules/.bin/tsx');
const serverEntrypoint = path.resolve(workspaceDirectory, 'server/src/index.ts');
const previewPort = Number(process.env.PORT ?? 4173);
const previewUrl = process.env.APP_BASE_URL?.trim() || getLanPreviewUrl(previewPort);
const localUrl = `http://127.0.0.1:${previewPort}`;
const shouldOpenBrowser = !process.argv.includes('--no-open');

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForHealth(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await wait(1000);
  }

  throw new Error(`Preview server did not become ready at ${url} in time.`);
}

const child = spawn(tsxBinary, [serverEntrypoint], {
  cwd: workspaceDirectory,
  env: {
    ...process.env,
    PORT: String(previewPort),
    HOST: process.env.HOST?.trim() || '0.0.0.0',
    SERVE_CLIENT: 'true',
    APP_BASE_URL: previewUrl
  },
  stdio: 'inherit'
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (child.pid) {
    child.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});

waitForHealth(`${localUrl}/api/health`)
  .then(() => {
    console.log('');
    console.log('LAN preview is ready.');
    console.log(`LAN URL:   ${previewUrl}`);
    console.log(`Local URL: ${localUrl}`);
    console.log('');

    if (shouldOpenBrowser && process.platform === 'darwin') {
      const openProcess = spawn('open', [previewUrl], {
        stdio: 'ignore',
        detached: true
      });

      openProcess.unref();
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unable to start LAN preview.');
    shutdown('SIGTERM');
    process.exit(1);
  });
