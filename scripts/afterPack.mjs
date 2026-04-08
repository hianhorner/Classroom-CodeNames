import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rcedit = require('rcedit');

const COMPANY_NAME = 'IHateconomics';
const FILE_DESCRIPTION = 'Classroom Code Names';
const LEGAL_COPYRIGHT = 'Copyright © 2026 nonewhatsoever';

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
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
