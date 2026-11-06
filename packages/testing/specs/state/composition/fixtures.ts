// SJState x SJIcon composition fixtures (W1-C11.f). The state's icon part is a decorative, aria-hidden box: an
// SJIcon goes there and nothing about the icon may change what a screen reader hears. Each composition names a
// base fixture and the props laid over it. No Node imports: the browser bundle may import this file too.
import { Folder } from '../../../../icons/src/generated/icons/folder';
import { LoaderCircle } from '../../../../icons/src/generated/icons/loader-circle';
import { CircleAlert } from '../../../../icons/src/generated/icons/circle-alert';
import type { FixtureProps } from '../fixtures';

export interface Composition {
  base: string;
  /** Props laid over the base fixture. */
  props: Partial<FixtureProps>;
}

export const COMPOSITIONS: Record<string, Composition> = {
  // The plain case: a decorative SJIcon in the icon part.
  'icon-decorative': { base: 'first-use', props: { icon: { data: Folder } } },
  // The mistake the docs warn about: an SJIcon `label` inside the icon part. aria-hidden on the part wins.
  'icon-label-ignored': { base: 'error', props: { icon: { data: CircleAlert, label: 'Alert' } } },
  // The loading spinner: an SJIcon with data-spin; announced by the heading, never by the glyph.
  'icon-spinner': {
    base: 'loading',
    props: { icon: { data: LoaderCircle, spin: true, label: 'Spinner' } },
  },
};
