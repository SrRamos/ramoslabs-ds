export type CssContractFinding = { value: string; issue: string; suggestion: string; rule: string };
export type ComponentLike = {
  slug: string;
  anatomy: Array<{ part: string }>;
  state: { machine: string[] };
};
export function selectorsOf(css: string): string[];
export function lintCssContract(css: string, components: ComponentLike[]): CssContractFinding[];
