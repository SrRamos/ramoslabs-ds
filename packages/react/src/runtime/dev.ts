// Dev-only guard (K2 convention): inline, never throws unbundled, strips under a bundler define.
declare const process: { env: { NODE_ENV?: string } } | undefined;

export const isDev = (): boolean =>
  typeof process === 'undefined' ? false : process.env.NODE_ENV !== 'production';
