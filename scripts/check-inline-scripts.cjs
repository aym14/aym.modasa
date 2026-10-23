'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const temporaryFiles = [];
const inlineScripts = [];
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

for (const match of html.matchAll(scriptPattern)) {
  const [, attributes, source] = match;
  if (/\bsrc\s*=/i.test(attributes) || !source.trim()) {
    continue;
  }
  inlineScripts.push(source);
}

if (inlineScripts.length === 0) {
  console.error(`No inline scripts found in ${htmlPath}`);
  process.exitCode = 1;
} else {
  for (const [index, source] of inlineScripts.entries()) {
    const temporaryPath = path.join(os.tmpdir(), `smart-ledger-inline-${process.pid}-${index + 1}.js`);
    temporaryFiles.push(temporaryPath);
    fs.writeFileSync(temporaryPath, source, 'utf8');
    const result = spawnSync(process.execPath, ['--check', temporaryPath], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`Inline script ${index + 1} failed syntax validation:`);
      if (result.stderr) {console.error(result.stderr.trim());}
      if (result.error) {console.error(result.error.message);}
      process.exitCode = 1;
    }
  }

  if (!process.exitCode) {
    console.log(`Syntax OK: ${inlineScripts.length} inline scripts in index.html`);
  }
}

for (const temporaryPath of temporaryFiles) {
  try {
    fs.unlinkSync(temporaryPath);
  } catch (_) {
    // Best-effort cleanup of temporary syntax-check files.
  }
}
