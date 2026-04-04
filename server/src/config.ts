import 'dotenv/config';

function normalizeUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}

function expandLoopbackOrigins(urlValue: string | null): string[] {
  if (!urlValue) {
    return [];
  }

  try {
    const parsed = new URL(urlValue);
    const output = new Set([urlValue]);

    if (parsed.hostname === 'localhost') {
      output.add(`${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ''}`);
    }

    if (parsed.hostname === '127.0.0.1') {
      output.add(`${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ''}`);
    }

    return [...output];
  } catch {
    return [urlValue];
  }
}

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST?.trim() || '0.0.0.0';
const serveClient = process.env.SERVE_CLIENT === 'true';
const appBaseUrl = normalizeUrl(process.env.APP_BASE_URL);
const clientUrl = normalizeUrl(process.env.CLIENT_URL) ?? 'http://localhost:5173';
const publicAppUrl = appBaseUrl ?? (serveClient ? `http://localhost:${port}` : clientUrl);
const allowedOrigins = [...new Set([...expandLoopbackOrigins(clientUrl), ...expandLoopbackOrigins(appBaseUrl)])];

export const config = {
  port,
  host,
  serveClient,
  clientUrl,
  appBaseUrl,
  publicAppUrl,
  allowedOrigins,
  databasePath: process.env.DATABASE_PATH ?? './server/data/classroom-codenames.sqlite',
  isOriginAllowed(origin?: string | null) {
    if (!origin) {
      return true;
    }

    return allowedOrigins.includes(origin.replace(/\/+$/, ''));
  }
};
