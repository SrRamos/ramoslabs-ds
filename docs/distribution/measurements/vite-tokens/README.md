# Measurement: Vite builds against the published @ramoslabs/tokens

Reproduces the build test cited as `measured-vite` on `/answers/install-tokens-vue-react-html/`.
Run on 2026-10-27 with Vite 8.3.5 and `@ramoslabs/tokens@0.1.0` from the npm registry.

```
cd docs/distribution/measurements/vite-tokens
bun install
bunx vite build
grep -o 'color-primary:[^;]*' dist/assets/*.css
```

Expected output of the last command (recorded 2026-10-27):

```
color-primary:#4f46e5
```

The entry `src/main.ts` imports `@ramoslabs/tokens/css` and `{ colorIndigo600 }` from the package
root; the build succeeding shows both subpaths resolve in a bundler. `dist/` and `node_modules/`
are not committed.
