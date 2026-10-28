import { describe, expect, it } from 'vitest';
import { Search } from '../src/generated/index.js';
import type { IconData } from '../src/types.js';

// Structural shape the core `icon` module accepts (ADR-016). The packages never import each other,
// so the contract is restated here and assignability is checked by the compiler (`typecheck`).
interface CoreIconData {
  readonly name: string;
  readonly nodes: readonly (readonly [string, Readonly<Record<string, string>>])[];
  readonly mirror?: boolean;
}

describe('structural compatibility with the core IconData', () => {
  it('icon data is assignable to the core shape and back', () => {
    const toCore: CoreIconData = Search satisfies IconData;
    const back: IconData = { name: toCore.name, nodes: toCore.nodes };
    expect(back.name).toBe('search');
  });
});
