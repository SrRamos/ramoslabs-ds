/* sj-{{name}}: generated from src/_template. Tokens only (stylelint sj/* rules enforce it).
   Names come from the contract anatomy: class sj-{{name}}__<part> plus data-part="<part>".
   State is exposed as data-state, data-active, data-disabled, data-invalid; never as generated classes.
   Layers: structure in sj.component, axes in sj.variant, state and focus in sj.state. */

@layer sj.component {
{{#parts}}
  .sj-{{name}}__{{part}} {
    /* TODO({{name}}/{{part}}): layout, spacing, type and radius from var(--space-*), var(--font-*), var(--radius-*) */
  }

{{/parts}}
}

/* Axes: map data-variant x data-tone x data-size to tokens. Pairings must follow RECIPE in
   packages/testing/contrast/matrix.js so the build-time contrast matrix covers this component. */
@layer sj.variant {
  .sj-{{name}}__{{rootPart}}[data-variant='solid'][data-tone='primary'] {
    /* TODO({{name}}): color: var(--color-white); background-color: var(--color-primary); */
  }
}

/* State. Focus ring comes from base/focus.css; do not set outline or box-shadow for focus here. */
@layer sj.state {
{{#parts}}
  .sj-{{name}}__{{part}}[data-state] {
    /* TODO({{name}}/{{part}}): data-state values from the contract */
  }

  .sj-{{name}}__{{part}}[data-disabled]:not([data-disabled='false']) {
    cursor: not-allowed;
  }

  .sj-{{name}}__{{part}}[data-invalid]:not([data-invalid='false']) {
    /* TODO({{name}}/{{part}}): invalid affordance; never color alone (add an icon or text) */
  }

{{/parts}}
}
