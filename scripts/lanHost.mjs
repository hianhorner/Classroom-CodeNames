import os from 'node:os';
import { fileURLToPath } from 'node:url';

function isPrivateIpv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

export function getLanIpv4Address() {
  const networkInterfaces = os.networkInterfaces();
  const fallbackAddresses = [];

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      if (isPrivateIpv4(entry.address)) {
        return entry.address;
      }

      fallbackAddresses.push(entry.address);
    }
  }

  return fallbackAddresses[0] ?? '127.0.0.1';
}

export function getLanPreviewUrl(port = 4173) {
  return `http://${getLanIpv4Address()}:${port}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const portArgumentIndex = process.argv.indexOf('--port');
  const requestedPort =
    portArgumentIndex >= 0 && process.argv[portArgumentIndex + 1]
      ? Number(process.argv[portArgumentIndex + 1])
      : 4173;

  if (process.argv.includes('--host')) {
    console.log(getLanIpv4Address());
  } else {
    console.log(getLanPreviewUrl(requestedPort));
  }
}
