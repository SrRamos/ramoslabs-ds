// React wrapper for the SSR runner: react-dom/server, then a real hydrateRoot. No fresh createRoot pass:
// React's client-only `useId` format and counter differ from the server's by design.
// Ids come from `useId`; the root `idPrefix` is React's `identifierPrefix` (ADR-003: prefix '' to baseId).
import { act, createElement, useId, type ReactElement, type ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { baseId } from '@ramoslabs/core/ids';
import { SJProvider, useMachine } from '@ramoslabs/react/runtime';
import type { MountHandle, RootSpec, SsrWrapper } from '../runner';
import {
  PROBE_KEYS,
  captureConsole,
  probeInitial,
  probeReduce,
  probeTree,
  type Node,
  type ProbeEvent,
  type ProbeState,
} from './tree';

export interface ReactProbeProps {
  readonly keys?: readonly string[];
  /** Seeded nondeterminism: replaces `useId` as the id source. */
  readonly idSource?: () => string;
}

function toReact(node: Node | string, key?: number): ReactNode {
  if (typeof node === 'string') return node;
  const props: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(node.attrs)) props[k === 'for' ? 'htmlFor' : k] = v;
  return createElement(node.tag, props, ...node.children.map((c, i) => toReact(c, i)));
}

/** Test-only component built with the real React runtime (`useMachine`). */
export function ReactProbe({ keys = PROBE_KEYS, idSource }: ReactProbeProps): ReactElement {
  const rid = useId();
  const base = baseId(undefined, idSource ?? (() => rid), '');
  const m = useMachine<ProbeState, ProbeEvent, never, Record<string, never>>({
    initial: () => probeInitial(keys),
    reduce: probeReduce,
    props: {},
    fields: {},
  });
  return toReact(probeTree(base, m.state, keys)) as ReactElement;
}

const tree = (root: RootSpec, props: ReactProbeProps, target: 'server' | 'client') =>
  createElement(
    SJProvider,
    {
      idPrefix: root.idPrefix,
      target,
      // No live-region nodes in <body>: the runner compares containers, not the whole document.
      liveHost: () => ({ create: () => ({ setText: () => undefined }) }),
    },
    createElement(ReactProbe, props),
  );

export function createReactWrapper(props: ReactProbeProps = {}): SsrWrapper {
  const mount = async (root: RootSpec, make: (errors: string[]) => Root): Promise<MountHandle> => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const errors: string[] = [];
    let handle!: Root;
    const { messages } = await captureConsole(() =>
      act(async () => {
        handle = make(errors);
      }),
    );
    void root;
    return {
      diagnostics: [...errors, ...messages],
      unmount: () => void act(() => handle.unmount()),
    };
  };
  return {
    name: 'react',
    renderServer: (root) =>
      renderToString(tree(root, props, 'server'), { identifierPrefix: root.idPrefix }),
    hydrate: (container, root) =>
      mount(root, (errors) =>
        hydrateRoot(container, tree(root, props, 'client'), {
          identifierPrefix: root.idPrefix,
          onRecoverableError: (e) => void errors.push(`recoverable: ${String(e)}`.split('\n')[0]!),
        }),
      ),
  };
}
