import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import iconGen from 'icon-gen';

const currentFilePath = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFilePath);
const projectRoot = path.resolve(scriptsDirectory, '..');
const sourceSvgPath = path.join(projectRoot, 'desktop', 'assets', 'icon.svg');
const outputDirectory = path.join(projectRoot, 'desktop', 'build');

await fs.mkdir(outputDirectory, { recursive: true });

await iconGen(sourceSvgPath, outputDirectory, {
  report: false,
  ico: {
    name: 'icon'
  },
  icns: {
    name: 'icon'
  }
});

console.log(`Desktop icons generated in ${outputDirectory}`);
