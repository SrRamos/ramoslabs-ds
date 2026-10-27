// The probe (W1-316): contract, reducer and one wrapper per adapter, for the SSR runner (W1-114)
// and the reducer harness (W1-308b) to import. Nothing here is wired into those tools.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import contract from './probe.contract.json' with { type: 'json' };

export { contract };
const here = dirname(fileURLToPath(import.meta.url));
export const contractsDir: string = here;
export const contractPath: string = join(here, 'probe.contract.json');
export const cssPath: string = join(here, 'probe.css');
export { reducerEvents, reduce, storeReducer, probeFields, rootAttrs, stateOf } from './reducer';
export type { ProbeEvent, ProbeSnapshot, ProbeState } from './reducer';
export { SJProbe as ReactProbe } from './react/index';
export { SJProbe as VueProbe } from './vue/index';
export { mountProbe, probeSpec } from './vanilla/index';
export type { ProbeProps } from './vanilla/index';
