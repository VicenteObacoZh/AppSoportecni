import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const assetsDir = path.join(projectRoot, 'assets');
const wwwDir = path.join(projectRoot, 'www');

const textExtensions = new Set(['.html', '.css', '.js']);

function rewriteAssetPaths(content) {
  return content.replaceAll('../assets/', './assets/');
}

async function copyAndTransformDirectory(fromDir, toDir) {
  await mkdir(toDir, { recursive: true });
  const entries = await (await import('node:fs/promises')).readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(fromDir, entry.name);
    const targetPath = path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      await copyAndTransformDirectory(sourcePath, targetPath);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (textExtensions.has(extension)) {
      const content = await readFile(sourcePath, 'utf8');
      await writeFile(targetPath, rewriteAssetPaths(content), 'utf8');
    } else {
      await cp(sourcePath, targetPath, { force: true });
    }
  }
}

async function copyStaticDirectory(fromDir, toDir) {
  await mkdir(toDir, { recursive: true });
  const entries = await (await import('node:fs/promises')).readdir(fromDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(fromDir, entry.name);
    const targetPath = path.join(toDir, entry.name);

    if (entry.isDirectory()) {
      await copyStaticDirectory(sourcePath, targetPath);
      continue;
    }

    await cp(sourcePath, targetPath, { force: true });
  }
}

await rm(wwwDir, { recursive: true, force: true });
await mkdir(wwwDir, { recursive: true });

await copyAndTransformDirectory(srcDir, wwwDir);
await copyStaticDirectory(assetsDir, path.join(wwwDir, 'assets'));

console.log('www listo para Capacitor en', wwwDir);
