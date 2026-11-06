// SJDisclosure conformance fixtures (W1-C06.f). One map from the contract's fixture names to props, shared by
// the browser host, every Playwright spec and the node-side tests. Props use the adapter-neutral vocabulary
// of the contract (`open`, `defaultOpen`, `disabled`, `name`, `id`) plus the visible `summary` (the trigger
// title) and the panel `content`, both plain text. A fixture is one member or, for a group, a list of members
// rendered side by side (the exclusive group). No Node imports: the browser bundle imports this file too.
export const ADAPTERS = ['react', 'vue', 'vanilla'] as const;
export type Adapter = (typeof ADAPTERS)[number];
export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;

export type DisclosureFixtureProps = {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  summary?: string;
  content?: string;
};
/** One disclosure, or a list of members mounted together (an exclusive group). */
export type Mount = DisclosureFixtureProps | DisclosureFixtureProps[];

export const SUMMARY = 'Shipping details';
export const CONTENT = 'Orders ship within two business days.';
/** Wraps over several lines at the 480 px viewport; the title must not change with state. */
export const LONG_SUMMARY =
  'Everything you need to know about shipping, returns, warranty claims, exchanges and the way ' +
  'we handle personal data when an order is placed from outside the country';

/** The group the exclusive fixtures use: three members, one native `name`. */
export const GROUP_NAME = 'faq';
export const GROUP_TITLES = ['Shipping', 'Returns', 'Warranty'] as const;
const member = (i: number, extra: DisclosureFixtureProps = {}): DisclosureFixtureProps => ({
  name: GROUP_NAME,
  summary: GROUP_TITLES[i]!,
  content: `${GROUP_TITLES[i]} panel`,
  ...extra,
});
/** All members closed; each is uncontrolled. */
export const groupClosed = (): DisclosureFixtureProps[] => [member(0), member(1), member(2)];
/** First member starts open (uncontrolled `defaultOpen`). */
export const groupFirstOpen = (): DisclosureFixtureProps[] => [
  member(0, { defaultOpen: true }),
  member(1),
  member(2),
];
/** Every member controlled by the owner; `open` flags say which is open. */
export const groupControlled = (open: [boolean, boolean, boolean]): DisclosureFixtureProps[] =>
  open.map((o, i) => member(i, { open: o }));

/** The contract's `fixtures` list, in order. */
export const FIXTURES: Record<string, Mount> = {
  closed: { summary: SUMMARY, content: CONTENT },
  open: { defaultOpen: true, summary: SUMMARY, content: CONTENT },
  disabled: { disabled: true, summary: SUMMARY, content: CONTENT },
  'exclusive-group': groupFirstOpen(),
  'long-title': { summary: LONG_SUMMARY, content: CONTENT },
};

/** The two machine positions as fixture props (the contract's `state.machine`). */
export const POSITIONS: Record<string, DisclosureFixtureProps> = {
  closed: { summary: SUMMARY, content: CONTENT },
  open: { defaultOpen: true, summary: SUMMARY, content: CONTENT },
};

/** Paths the Disclosure runs. `support[]` declares `details-name`, so besides real detection (`native`) the
 *  forced-false floor combination (`fallback:all`, which also forces `detailsName`) runs. */
export const DISCLOSURE_PATHS = ['native', 'fallback:all'] as const;

/**
 * The hydration cases (Fable ruling, SHOULD-1): the page is server-rendered, the user toggles the `<details>`
 * natively before any script runs, then the adapter hydrates (vanilla adopts). `report` is what the adapter must
 * tell the owner and `final` the open state afterwards. Controlled owners here keep their prop, so a rejected
 * pre-hydration toggle must be put back.
 */
export const HYDRATE_CASES: Record<
  string,
  {
    props: DisclosureFixtureProps;
    serverOpen: boolean;
    toggled: boolean;
    report: boolean[];
    /** Vanilla adopts author markup: with neither `open` nor `defaultOpen` the element's own state IS the
     *  initial state (a consumer's `<details open>`), so there is nothing to report. */
    vanillaReport?: boolean[];
    final: boolean;
  }
> = {
  'uncontrolled defaultOpen closed before hydration': {
    props: { defaultOpen: true, summary: SUMMARY, content: CONTENT },
    serverOpen: true,
    toggled: true,
    report: [false],
    final: false,
  },
  'controlled open rejects a pre-hydration close': {
    props: { open: true, summary: SUMMARY, content: CONTENT },
    serverOpen: true,
    toggled: true,
    report: [false],
    final: true,
  },
  'controlled closed rejects a pre-hydration open': {
    props: { open: false, summary: SUMMARY, content: CONTENT },
    serverOpen: false,
    toggled: true,
    report: [true],
    final: false,
  },
  'no prop opened before hydration': {
    props: { summary: SUMMARY, content: CONTENT },
    serverOpen: false,
    toggled: true,
    report: [true],
    vanillaReport: [],
    final: true,
  },
  'no toggle before hydration reports nothing': {
    props: { defaultOpen: true, summary: SUMMARY, content: CONTENT },
    serverOpen: true,
    toggled: false,
    report: [],
    final: true,
  },
};
