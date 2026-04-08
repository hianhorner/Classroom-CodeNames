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

export const config = {
  get port() {
    return Number(process.env.PORT ?? 4000);
  },
  get host() {
    return process.env.HOST?.trim() || '0.0.0.0';
  },
  get serveClient() {
    return process.env.SERVE_CLIENT === 'true';
  },
  get appBaseUrl() {
    return normalizeUrl(process.env.APP_BASE_URL);
  },
  get clientUrl() {
    return normalizeUrl(process.env.CLIENT_URL) ?? 'http://localhost:5173';
  },
  get publicAppUrl() {
    return this.appBaseUrl ?? (this.serveClient ? `http://localhost:${this.port}` : this.clientUrl);
  },
  get allowedOrigins() {
    return [...new Set([...expandLoopbackOrigins(this.clientUrl), ...expandLoopbackOrigins(this.appBaseUrl)])];
  },
  get databasePath() {
    return process.env.DATABASE_PATH ?? './server/data/classroom-codenames.sqlite';
  },
  isOriginAllowed(origin?: string | null) {
    if (!origin) {
      return true;
    }

    return this.allowedOrigins.includes(origin.replace(/\/+$/, ''));
  }
};
