import React, { useEffect, useState } from 'react';
import { themes } from 'storybook/theming';
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
    font-family: var(--font-family-sans, 'Plus Jakarta Sans', system-ui, sans-serif);
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-muted);
    text-align: center;
  }
  .rl-docs-footer__brand {
    font-family: var(--font-family-display, 'Plus Jakarta Sans', system-ui, sans-serif);
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
  [data-theme='dark'] .rl-docs-footer {
    border-top-color: var(--color-border-dark);
    color: var(--color-text-muted-dark);
  }
  [data-theme='dark'] .rl-docs-footer__brand {
    color: var(--color-text-heading-dark);
  }
  [data-theme='dark'] .rl-docs-footer__line,
  [data-theme='dark'] .rl-docs-footer__sep {
    color: var(--color-text-muted-dark);
  }
  [data-theme='dark'] .rl-docs-footer__link {
    color: var(--color-primary-text-dark);
  }
  [data-theme='dark'] .rl-docs-footer__link:focus-visible {
    outline-color: var(--color-focus-dark);
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

/** The theme toolbar value in the iframe URL (`globals=theme:dark`), the first paint before any channel event. */
const themeFromUrl = (): 'light' | 'dark' =>
  /(^|;)theme:dark(;|$)/.test(new URLSearchParams(window.location.search).get('globals') ?? '')
    ? 'dark'
    : 'light';

/**
 * Only the Components docs (their stories, their review guide) are built from the dark roles. The Foundations and Patterns
 * pages are long hand-styled MDX with their own light palette, so they stay light whatever the toolbar says.
 */
const followsToolbar = (): boolean =>
  (new URLSearchParams(window.location.search).get('id') ?? '').startsWith('components-');

export const DocsContainer = ({
  children,
  context,
}: React.PropsWithChildren<DocsContainerProps>) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(themeFromUrl);
  useEffect(() => {
    const onGlobals = ({ globals }: { globals?: { theme?: string } }) =>
      setTheme(globals?.theme === 'dark' ? 'dark' : 'light');
    context.channel.on('globalsUpdated', onGlobals);
    return () => context.channel.off('globalsUpdated', onGlobals);
  }, [context]);
  const dark = theme === 'dark' && followsToolbar();
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.style.backgroundColor = dark
      ? 'var(--color-background-dark)'
      : 'var(--color-background)';
  }, [dark]);
  return (
    <BaseDocsContainer context={context} theme={dark ? themes.dark : themes.light}>
      {children}
      <DocsFooter />
    </BaseDocsContainer>
  );
};
