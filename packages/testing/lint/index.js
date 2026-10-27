// @ramoslabs/testing/lint: project lint tooling. Boundary and hygiene rules (W1-006) today;
// the stylelint token rule (W1-202) and contract lint (W1-307) land in sibling folders.
export {
  boundariesConfigs,
  plugin as boundariesPlugin,
  rules as boundariesRules,
} from './boundaries/index.js';
