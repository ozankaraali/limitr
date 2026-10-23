// Where the stream dataset's list lives: tests/fixtures/dataset.local.json, kept out of the
// repository (it names real streams and what a listener marked in them), or else the repository's
// tests/fixtures/dataset.json, an empty list in the same format.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCAL = path.join(ROOT, 'tests/fixtures/dataset.local.json');
const PUBLIC = path.join(ROOT, 'tests/fixtures/dataset.json');
const DATASET = fs.existsSync(LOCAL) ? LOCAL : PUBLIC;

module.exports = { DATASET };
