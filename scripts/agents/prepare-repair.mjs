import { readFileSync, writeFileSync } from 'node:fs';
import { repairPrompt } from './policy.mjs';
const issue = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!Number.isSafeInteger(issue.number) || issue.number <= 0) throw new Error('Invalid issue reference');
writeFileSync(process.argv[3], repairPrompt(issue), {mode:0o600});
