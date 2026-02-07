#!/usr/bin/env node

const { runCli } = require('../dist/src/index.js');
let redactSensitiveText = (message) => message;

try {
  ({ redactSensitiveText } = require('../dist/src/utils/url.js'));
} catch {
  redactSensitiveText = (message) => message;
}

runCli(process.argv).catch((error) => {
  const message = redactSensitiveText(error instanceof Error ? error.message : String(error));
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
