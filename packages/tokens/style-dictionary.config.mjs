/**
 * Style Dictionary v5 config for @ramoslabs/tokens.
 *
 * The DTCG JSON in src/tokens is the single source of truth. This compiles it
 * to CSS variables, a TypeScript module, and a flat JSON map. DTCG format
 * ($value / $type) is auto-detected by Style Dictionary v5.
 *
 * We build an explicit transform list per platform instead of the stock
 * transformGroups so that the "size/rem" transform never runs: our dimension
 * tokens mix units (rem, px, em) and size/rem would rewrite every one of them
 * to rem. Passing dimensions through untouched keeps 576px as 576px.
 */

const valueTransforms = [
  'attribute/cti',
  'color/hex',
  'fontFamily/css',
  'cubicBezier/css',
  'shadow/css/shorthand',
];

export default {
  source: ['src/tokens/**/*.json'],
  platforms: {
    css: {
      transforms: ['name/kebab', ...valueTransforms],
      buildPath: 'dist/',
      options: { outputReferences: false },
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
        },
      ],
    },
    ts: {
      transforms: ['name/pascal', ...valueTransforms],
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'javascript/es6',
        },
      ],
    },
    json: {
      transforms: ['name/kebab', ...valueTransforms],
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.json',
          format: 'json/flat',
        },
      ],
    },
  },
};
