import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const rcedit = require('rcedit');

const COMPANY_NAME = 'Classroom CodeNames';
const FILE_DESCRIPTION = 'Classroom CodeNames';
const LEGAL_COPYRIGHT = 'Copyright © 2026 Classroom CodeNames';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  if (process.platform !== 'win32') {
    const hasWine = spawnSync('which', ['wine64'], { stdio: 'ignore' }).status === 0;
    if (!hasWine) {
      console.warn('Skipping Windows executable metadata patch: wine64 is not available on this machine.');
      return;
    }
  }

  const executablePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  );

  await rcedit(executablePath, {
    'version-string': {
      CompanyName: COMPANY_NAME,
      FileDescription: FILE_DESCRIPTION,
      InternalName: context.packager.appInfo.productFilename,
      LegalCopyright: LEGAL_COPYRIGHT,
      OriginalFilename: `${context.packager.appInfo.productFilename}.exe`,
      ProductName: context.packager.appInfo.productName
    }
  });
}
