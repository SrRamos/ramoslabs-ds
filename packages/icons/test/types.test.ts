import { describe, expect, it } from 'vitest';
import { Search } from '../src/generated/index.js';
import type { IconData } from '../src/types.js';

// Structural shape the core `icon` module accepts (ADR-016), restated verbatim from
// `packages/core/src/icon/index.ts`; the packages never import each other, so the compiler
// (`typecheck`) checks that every generated icon is assignable to it. Keep the two in sync.
interface CoreIconData {
  readonly name?: string;
  readonly nodes: readonly (readonly [
    tag: string,
    attrs: Readonly<Record<string, string | number>>,
  ])[];
  readonly mirror?: boolean;
}

describe('structural compatibility with the core IconData', () => {
  it('generated icon data is assignable to the core shape', () => {
    const toCore: CoreIconData = Search satisfies IconData;
    expect(toCore.name).toBe('search');
  });
});
