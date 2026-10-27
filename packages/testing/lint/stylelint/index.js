// @ts-check
// Stylelint token rules (W1-202). Use as `"plugins": ["<path>/index.js"]` plus the rules below.
import { plugins } from './rules.js';

/** Stylelint config enabling every `sj/*` rule. */
export const config = {
  plugins: [new URL('./index.js', import.meta.url).pathname],
  rules: Object.fromEntries(plugins.map((p) => [/** @type {any} */ (p).ruleName, true])),
};

export { plugins };
export default plugins;
