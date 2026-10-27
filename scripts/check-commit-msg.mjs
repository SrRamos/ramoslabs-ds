#!/usr/bin/env node
// Validates the subject line of a commit message against the conventional form
// `type(scope): subject`. Used by lefthook's commit-msg hook.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

const SUBJECT_RE = new RegExp(`^(${ALLOWED_TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: .{1,100}$`);

const PASSTHROUGH_PREFIXES = ['Merge ', 'Revert ', 'fixup! ', 'squash! '];

export function isValidCommitSubject(line) {
  if (PASSTHROUGH_PREFIXES.some((prefix) => line.startsWith(prefix))) {
    return true;
  }
  return SUBJECT_RE.test(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/check-commit-msg.mjs <commit-message-file>');
    process.exit(1);
  }

  const subject = readFileSync(file, 'utf8').split('\n')[0].replace(/\r$/, '');

  if (!isValidCommitSubject(subject)) {
    console.error(
      [
        'Invalid commit message subject:',
        `  ${subject}`,
        '',
        'Expected the form: type(scope): subject',
        `Allowed types: ${ALLOWED_TYPES.join(', ')}`,
        'Scope is optional and uses lowercase letters, digits, and . _ / -',
        'The subject must be 1 to 100 characters.',
        'Merge, Revert, fixup!, and squash! subjects are also accepted.',
      ].join('\n'),
    );
    process.exit(1);
  }
}
