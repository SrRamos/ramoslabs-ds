// Overlay behavior (ADR-005 steps 5-8): the nested-overlay stack synced from native `toggle` and
// `close` events, the explicit opener reference, Escape order, the two close tiers, capture
// `pointerdown` dismissal only where native light dismiss is absent, and the static listbox flag.
// Elements are structural so core touches no DOM globals; every call owns its closure.
import { restoreTarget, type FocusEl } from '../../focus/index';
import type { SupportsMap } from '../../runtime/index';

declare const Event: new (type: string, init?: { cancelable?: boolean }) => unknown;

/** `modal` = showModal; `auto`/`hint` = Popover with native light dismiss; `manual` = engine-controlled. */
export type OverlayKind = 'modal' | 'auto' | 'hint' | 'manual';

export interface OverlayEl extends FocusEl {
  /** Platform `open` of a dialog/popover; read after `requestClose()` to see if `cancel` was prevented. */
  readonly open?: boolean;
  contains?(n: unknown): boolean;
  showModal?(): void;
  showPopover?(): void;
  hidePopover?(): void;
  requestClose?(returnValue?: string): void;
  close?(): void;
  dispatchEvent?(e: unknown): boolean;
}

export interface OverlayEntry {
  readonly el: OverlayEl;
  readonly kind: OverlayKind;
  /** The explicit opener reference (focus return target). */
  readonly opener: FocusEl | undefined;
  /** The stack entry this one is nested in (ancestor chain), if any. */
  readonly parent: OverlayEntry | undefined;
}

export interface OverlayOptions {
  /** Adapter-detected capabilities; only `popover` and `dialogRequestClose` are read. */
  supports: Pick<SupportsMap, 'popover' | 'dialogRequestClose'>;
  /** Declared focus fallback when the opener is gone (same usability test). */
  fallback?: () => FocusEl | undefined;
  /** Runs once per closed entry with the focus target to restore (adapter focuses it). */
  onClose?(entry: OverlayEntry, restore: FocusEl | undefined): void;
  /** Hides a non-modal entry when the element has no `hidePopover` (popover-less fallback). */
  hide?(el: OverlayEl): void;
  /** Creates the cancelable `cancel` event for tier 2. Default: the platform `Event`. */
  cancelEvent?(): unknown;
}

export interface SyncOptions {
  opener?: FocusEl;
  /** The workflow deliberately moved focus on: suppress the restore. */
  advanced?: boolean;
}

export interface EscapeEvent {
  preventDefault(): void;
}

/** A corrective or requested native effect (`reconcile()` output, executed after commit). */
export interface OpenEffect {
  readonly type: string;
  readonly target?: string;
  readonly value?: unknown;
}

export interface OverlayStack {
  /** Entries in open order; the last is topmost. */
  readonly entries: readonly OverlayEntry[];
  readonly top: OverlayEntry | undefined;
  /** Mirror a native `toggle` (newState) or `close` event; idempotent. */
  sync(el: OverlayEl, kind: OverlayKind, open: boolean, o?: SyncOptions): void;
  /** The single close operation; tier 1 `requestClose()`, tier 2 cancelable `cancel` + `close()`. */
  close(el: OverlayEl): boolean;
  /** Escape order: closes the topmost entry the platform will not close itself. */
  escape(e?: EscapeEvent): OverlayEntry | undefined;
  /** Capture `pointerdown` dismissal for a `composedPath()`; returns the entries closed. */
  dismiss(path: readonly unknown[]): readonly OverlayEntry[];
  /** Install the capture listener on `document`; a no-op (returns a noop) when native light dismiss exists. */
  install(doc: DocLike): () => void;
  /** Register a key so `apply` can execute `open` effects for it. */
  register(key: string, el: OverlayEl, kind: OverlayKind): void;
  /** Execute a corrective/requested `open` effect (`value` true opens, false closes). */
  apply(effect: OpenEffect, o?: SyncOptions): void;
}

export interface DocLike {
  addEventListener(
    type: 'pointerdown',
    fn: (e: { composedPath(): unknown[] }) => void,
    opts: { capture: true; passive?: true },
  ): void;
  removeEventListener(
    type: 'pointerdown',
    fn: (e: { composedPath(): unknown[] }) => void,
    opts: { capture: true; passive?: true },
  ): void;
}

export function createOverlayStack(opts: OverlayOptions): OverlayStack {
  const { supports } = opts;
  let stack: OverlayEntry[] = [];
  const keys = new Map<string, [OverlayEl, OverlayKind]>();
  const find = (el: OverlayEl) => stack.find((x) => x.el === el);
  // HTML: `auto` and modal enter the top layer and are dismissed natively; `hint` follows `auto`.
  const nativeEscape = (k: OverlayKind) => k === 'modal' || (k !== 'manual' && supports.popover);
  const within = (ancestor: OverlayEntry, e: OverlayEntry) => {
    for (let p: OverlayEntry | undefined = e; p; p = p.parent) if (p === ancestor) return true;
    return false;
  };

  // The one internal close operation: both tiers end here (ADR-005 step 7).
  function finish(el: OverlayEl, advanced?: boolean) {
    const entry = find(el);
    if (!entry) return;
    const gone = stack.filter((x) => within(entry, x));
    stack = stack.filter((x) => !gone.includes(x));
    // Descendants first (innermost-out), then the entry; only the entry's opener is restored.
    for (const g of gone.reverse())
      opts.onClose?.(
        g,
        g === entry ? restoreTarget(g.opener, opts.fallback?.(), advanced) : undefined,
      );
  }

  const self: OverlayStack = {
    get entries() {
      return stack;
    },
    get top() {
      return stack[stack.length - 1];
    },
    sync(el, kind, open, o = {}) {
      if (!open) return finish(el, o.advanced);
      if (find(el)) return;
      const host = [...stack]
        .reverse()
        .find((x) => x.el.contains?.(el) || (o.opener && x.el.contains?.(o.opener)));
      stack.push({ el, kind, opener: o.opener, parent: host });
    },
    close(el) {
      const entry = find(el);
      if (!entry) return false;
      if (entry.kind === 'modal') {
        if (supports.dialogRequestClose && el.requestClose) {
          el.requestClose();
          // A consumer-prevented `cancel` leaves the dialog open: keep the entry, restore nothing.
          if (el.open === true) return false;
        } else {
          const ev = opts.cancelEvent
            ? opts.cancelEvent()
            : new Event('cancel', { cancelable: true });
          const ok = el.dispatchEvent ? el.dispatchEvent(ev) : true;
          if (!ok || (ev as { defaultPrevented?: boolean }).defaultPrevented) return false;
          el.close?.();
        }
      } else if (el.hidePopover) el.hidePopover();
      else opts.hide?.(el);
      finish(el);
      return true;
    },
    escape(e) {
      const top = stack[stack.length - 1];
      if (!top || nativeEscape(top.kind)) return undefined;
      e?.preventDefault();
      self.close(top.el);
      return top;
    },
    dismiss(path) {
      const closed: OverlayEntry[] = [];
      for (let t = stack[stack.length - 1]; t; t = stack[stack.length - 1]) {
        // Only auto/hint light-dismiss; a click inside the entry or on its opener is not outside.
        if (t.kind !== 'auto' && t.kind !== 'hint') break;
        if (path.includes(t.el) || (t.opener && path.includes(t.opener))) break;
        closed.push(t);
        self.close(t.el);
        if (stack[stack.length - 1] === t) break;
      }
      return closed;
    },
    install(doc) {
      if (supports.popover) return () => {};
      const fn = (e: { composedPath(): unknown[] }) => void self.dismiss(e.composedPath());
      doc.addEventListener('pointerdown', fn, { capture: true, passive: true });
      return () => doc.removeEventListener('pointerdown', fn, { capture: true });
    },
    register(key, el, kind) {
      keys.set(key, [el, kind]);
    },
    apply(effect, o) {
      const hit = effect.target === undefined ? undefined : keys.get(effect.target);
      if (!hit || effect.type !== 'open') return;
      const [el, kind] = hit;
      if (effect.value === false) {
        self.close(el);
        return;
      }
      if (find(el)) return;
      if (kind === 'modal') el.showModal?.();
      else el.showPopover?.();
      self.sync(el, kind, true, o);
    },
  };
  return self;
}

export type ListboxMount = 'top-layer' | 'inline';
export interface ListboxMountFlag {
  readonly default: ListboxMount;
  readonly byAnyPointer?: Partial<Record<'fine' | 'coarse', ListboxMount>>;
  readonly evidence?: readonly string[];
}

/** The capability class: `coarse` if any pointer is coarse (touch-capable), never the primary pointer. */
export function anyPointerClass(matches: (query: string) => boolean): 'fine' | 'coarse' {
  return matches('(any-pointer: coarse)') ? 'coarse' : 'fine';
}

/** `overlay.listboxMount` is a static contract flag keyed on the class; no UA sniffing, no runtime probing. */
export function listboxMount(flag: ListboxMountFlag, cls: 'fine' | 'coarse'): ListboxMount {
  return flag.byAnyPointer?.[cls] ?? flag.default;
}
