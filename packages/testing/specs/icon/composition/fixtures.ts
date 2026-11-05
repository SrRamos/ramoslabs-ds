// SJIcon x SJButton composition fixtures (W1-C12.f, PLAN-ICONS decision 8). The button is `beta` and frozen:
// it gets no new prop, slot or part. An icon goes in the existing `icon` part (a decorative, aria-hidden box),
// and a button without visible text is named by the button's own `label` (lint contract/icon-only-name).
// No Node imports: the browser bundle imports this file too.
import type { IconData } from '@ramoslabs/core/icon';
import { ChevronRight } from '../../../../icons/src/generated/icons/chevron-right';
import { Plus } from '../../../../icons/src/generated/icons/plus';
import { X } from '../../../../icons/src/generated/icons/x';

export interface CompositionProps {
  /** Visible button text (absent for an icon-only button). */
  text?: string;
  iconOnly?: boolean;
  /** The BUTTON's accessible name for an icon-only button. */
  label?: string;
  href?: string;
  icon: IconData;
  /** A `label` on the SJIcon itself. Inside the button's icon part it must be ignored. */
  iconLabel?: string;
}

export const COMPOSITIONS: Record<string, CompositionProps> = {
  // SJButton with an SJIcon (size fit) in its icon slot and visible text.
  'button-icon': { text: 'Add item', icon: Plus },
  // Icon-only SJButton: `label` names the button, the SJIcon stays decorative.
  'icon-only': { iconOnly: true, label: 'Close dialog', icon: X },
  // The mistake the docs warn about: an SJIcon `label` inside the button's icon part. aria-hidden wins.
  'icon-label-ignored': { iconOnly: true, label: 'Close dialog', icon: X, iconLabel: 'Dismiss' },
  // `link` variant: the same icon part on an <a>.
  link: { href: '#activated', text: 'Read the documentation', icon: ChevronRight },
};

/** The accessible name each composition must expose. */
export const EXPECTED_NAME: Record<string, string> = {
  'button-icon': 'Add item',
  'icon-only': 'Close dialog',
  'icon-label-ignored': 'Close dialog',
  link: 'Read the documentation',
};
