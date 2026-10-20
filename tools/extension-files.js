// The files that make up the add-on. Builds copy only these, so whatever else is lying around in
// the checkout (a PDF, a download, benchmarks) never gets packaged.

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROOT_ENTRIES = [
  'background.js', 'content-audio.js', 'content-bridge.js', 'content-transcribe.js', 'content.js',
  'popup.html', 'popup.js', 'styles.css', 'manifest.json', 'LICENSE', 'NOTICE', 'README.md',
  'fonts', 'icons', 'lib', 'tests'
];
const SKIPPED_FILES = new Set(['icons/build-icons.js', 'icons/mark.svg']);
// Only the debug harness ships from tests/
const HARNESS_FILES = ['tests/debug-harness.html', 'tests/debug-harness.js'];

// --out=DIR, or dist/<defaultName>. The build empties it first, so it must be a folder of its own
// directly inside dist/.
function outputDir(defaultName) {
  const outArg = (process.argv.find(a => a.startsWith('--out=')) || '').slice('--out='.length);
  const outDir = path.resolve(ROOT, outArg || path.join('dist', defaultName));
  if (path.dirname(outDir) !== path.join(ROOT, 'dist')) {
    throw new Error(`--out must be a folder directly inside dist/, not ${outDir}`);
  }
  return outDir;
}

// Empties outDir and copies the add-on into it, plus any browser-specific root entries and test files
async function copyExtension(outDir, { rootEntries = [], testFiles = [] } = {}) {
  const shippedRoot = new Set([...ROOT_ENTRIES, ...rootEntries]);
  const keptTests = new Set([...HARNESS_FILES, ...testFiles]);

  async function copyDirectory(sourceDir, targetDir, isRoot) {
    await fs.mkdir(targetDir, { recursive: true });
    for (const entry of await fs.readdir(sourceDir, { withFileTypes: true })) {
      if (isRoot && !shippedRoot.has(entry.name)) continue;
      if (entry.name.startsWith('.') || entry.name.endsWith('.csv')) continue;
      const sourcePath = path.join(sourceDir, entry.name);
      const relativePath = path.relative(ROOT, sourcePath).split(path.sep).join('/');
      if (SKIPPED_FILES.has(relativePath)) continue;
      if (relativePath.startsWith('tests/') && (entry.isDirectory() || !keptTests.has(relativePath))) continue;
      if (entry.isDirectory()) await copyDirectory(sourcePath, path.join(targetDir, entry.name), false);
      else if (entry.isFile()) await fs.copyFile(sourcePath, path.join(targetDir, entry.name));
    }
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await copyDirectory(ROOT, outDir, true);
}

module.exports = { ROOT, outputDir, copyExtension };
