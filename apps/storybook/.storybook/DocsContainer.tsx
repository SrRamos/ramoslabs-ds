import React from 'react';
import { DocsContainer as BaseDocsContainer } from '@storybook/addon-docs/blocks';
import type { DocsContainerProps } from '@storybook/addon-docs/blocks';

// Global docs footer, rendered once at the bottom of every docs page by wrapping
// Storybook's DocsContainer (set as parameters.docs.container in preview.ts).
// All values come from the RamosLabs token contract (@ramoslabs/tokens/css).
// The .sb-unstyled root plus explicit font-size/line-height keep sbdocs from
// inflating the text into a hero-sized block.

const repoUrl = 'https://github.com/SrRamos/ramoslabs-ds';
const licenseUrl = 'https://github.com/SrRamos/ramoslabs-ds/blob/main/LICENSE';
const siteUrl = 'https://ramoslabs.com';

const footerStyles = `
  .rl-docs-footer {
    margin-top: var(--space-16, 4rem);
    padding: var(--space-6) 0 var(--space-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-family-sans, 'Rubik', system-ui, sans-serif);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-muted);
    text-align: center;
  }
  .rl-docs-footer__brand {
    font-family: var(--font-family-display, 'Red Hat Display', system-ui, sans-serif);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text-heading, #0f172a);
    margin: 0 0 var(--space-2, 0.5rem);
  }
  .rl-docs-footer__line {
    margin: 0;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }
  .rl-docs-footer__links {
    margin-top: var(--space-3, 0.75rem);
    font-size: var(--font-size-xs);
  }
  .rl-docs-footer__sep {
    margin: 0 var(--space-2, 0.5rem);
    color: var(--color-text-muted);
  }
  .rl-docs-footer__link {
    color: var(--color-primary);
    font-weight: 500;
    text-decoration: none;
    border-radius: var(--radius-sm, 4px);
  }
  .rl-docs-footer__link:hover {
    text-decoration: underline;
  }
  .rl-docs-footer__link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    text-decoration: underline;
  }
`;

const DocsFooter = () => (
  <footer className="sb-unstyled rl-docs-footer">
    <style>{footerStyles}</style>
    <p className="rl-docs-footer__brand">RamosLabs Design System</p>
    <p className="rl-docs-footer__line">&copy; 2026 RAMOS SOLUTIONS S.A.S.</p>
    <p className="rl-docs-footer__line">
      Free to use with attribution under the MIT License.
    </p>
    <p className="rl-docs-footer__links">
      <a
        className="rl-docs-footer__link"
        href={siteUrl}
        target="_blank"
        rel="noreferrer"
      >
        ramoslabs.com
      </a>
      <span className="rl-docs-footer__sep" aria-hidden="true">
        &middot;
      </span>
      <a
        className="rl-docs-footer__link"
        href={licenseUrl}
        target="_blank"
        rel="noreferrer"
      >
        View the license
      </a>
      <span className="rl-docs-footer__sep" aria-hidden="true">
        &middot;
      </span>
      <a
        className="rl-docs-footer__link"
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
      >
        Repository
      </a>
    </p>
  </footer>
);

export const DocsContainer = ({
  children,
  context,
}: React.PropsWithChildren<DocsContainerProps>) => (
  <BaseDocsContainer context={context}>
    {children}
    <DocsFooter />
  </BaseDocsContainer>
);
