// Placeholder for a gate that a later task implements. It is explicit, never silent:
// it prints which task owns the real check and exits 0 so the root script names stay stable.
const [, , name = 'check', task = 'a later task'] = process.argv;
console.log(`${name}: not implemented yet (owned by ${task}); nothing to verify.`);
