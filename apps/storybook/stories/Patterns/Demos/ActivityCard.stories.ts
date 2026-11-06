import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import { PatIcon, SJIcon, TryNote, Verdict, tryIt, about } from './_demo';

/** One activity card. `flat` is the avoided version: one spacing value, equal-size numbers, location in the header. */
const ActivityCard = defineComponent({
  name: 'ActivityCard',
  components: { SJButton, PatIcon, SJIcon },
  props: { flat: { type: Boolean, default: false }, uid: { type: String, default: 'a' } },
  template: `
  <article class="pat-card" :class="{ 'pat-card--flat': flat }" :aria-labelledby="uid + '-t'">
    <header class="pat-card__head">
      <div class="pat-card__who">
        <h3 class="pat-card__title" :id="uid + '-t'">Carrera matutina</h3>
        <p class="pat-meta"><span>Laura Gómez</span><span class="pat-meta__sep" aria-hidden="true">•</span><time datetime="2026-11-05T06:42">hace 2 h</time><template v-if="flat"><span class="pat-meta__sep" aria-hidden="true">•</span><span>Parque Arví</span></template></p>
      </div>
      <SJButton variant="ghost" tone="neutral" size="xs" icon-only :label="'Más opciones de Carrera matutina'"><template #icon><PatIcon name="dots" /></template></SJButton>
    </header>
    <div class="pat-hero">
      <span class="pat-label">Tiempo</span>
      <p class="pat-num pat-num--hero"><span>35</span> <span class="pat-unit">min</span> <span>37</span> <span class="pat-unit">s</span></p>
    </div>
    <dl class="pat-metrics">
      <div class="pat-metric"><dt class="pat-label">Distancia</dt><dd class="pat-num pat-num--value"><span>7,0</span> <span class="pat-unit">km</span></dd></div>
      <div class="pat-metric"><dt class="pat-label">Ritmo</dt><dd class="pat-num pat-num--value"><span>5:05</span> <span class="pat-unit" dir="ltr">/km</span></dd></div>
      <div class="pat-metric"><dt class="pat-label">Desnivel</dt><dd class="pat-num pat-num--value"><span>84</span> <span class="pat-unit">m</span></dd></div>
    </dl>
    <div class="pat-map">
      <svg viewBox="0 0 320 144" preserveAspectRatio="none" role="img" aria-label="Mapa de la ruta">
        <path d="M16 118 C60 118 70 70 112 76 S168 126 208 92 S264 28 304 36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="pat-route" />
      </svg>
      <span v-if="!flat" class="pat-chip"><PatIcon name="pin" />Parque Arví</span>
    </div>
  </article>`,
});

const meta: Meta = {
  title: 'Patterns/Demos/Activity Card',
  parameters: about(`
An activity card with a clear information hierarchy: **one hero figure** (the time), a row of **label and value** metrics, then the **map** as the tertiary block. Units are smaller and muted (slate 500, the muted-text floor), numbers use \`font-variant-numeric: tabular-nums\` and sit on a shared baseline. Spacing follows proximity: \`--space-related\` inside a group, \`--space-group\` between groups. The location chip sits **on the map** it describes, not in the header. The overflow \`•••\` button is a compact 24 px SJButton whose hit area grows to 44 px on touch.
  `),
};
export default meta;
type Story = StoryObj;

export const SideBySide: Story = {
  render: () => ({
    components: { ActivityCard, Verdict, TryNote },
    template: `<div class="pat-stage">
      <TryNote>Compara las dos tarjetas. En la recomendada el ojo entra por un solo número (el tiempo), cada etiqueta queda pegada a su valor y hay más aire entre bloques que dentro de ellos. En la otra todo está a 16 px y todos los números pesan igual. Pasa Tab: el botón ••• muestra su foco. Con el emulador táctil de DevTools, su área activa crece a 44 px sin mover nada.</TryNote>
      <div class="pat-compare">
        <Verdict :ok="true" why="Una cifra principal, etiqueta junto al dato, más espacio entre grupos que dentro de ellos, ubicación sobre el mapa."><ActivityCard uid="ok" /></Verdict>
        <Verdict :ok="false" why="El mismo espacio en todas partes y números del mismo tamaño: nada agrupa, nada manda. La ubicación está lejos del mapa que describe."><ActivityCard flat uid="no" /></Verdict>
      </div></div>`,
  }),
  parameters: tryIt(`Compara la tarjeta recomendada con el contraejemplo de espaciado igual. Tab hasta el botón de tres puntos; con el emulador táctil su área activa mide 44 px.`),
};

export const Recommended: Story = {
  render: () => ({
    components: { ActivityCard, TryNote },
    template: `<div class="pat-stage"><TryNote>Selecciona el texto de un valor y de su unidad: el valor es negrita y oscuro, la unidad es menor y gris (4,8:1 sobre blanco). Cambia el zoom del navegador a 200 %: nada se corta.</TryNote><ActivityCard uid="rec" /></div>`,
  }),
  parameters: tryIt(`Solo la versión recomendada.`),
};

export const Rtl: Story = {
  render: () => ({
    components: { ActivityCard, TryNote },
    template: `<div class="pat-stage"><TryNote>Variante RTL (dir="rtl"): la tarjeta se refleja con propiedades lógicas. El botón ••• pasa al lado opuesto, la fila de métricas fluye de derecha a izquierda y el chip queda en la esquina inicial del mapa. El texto sigue en español: solo se comprueba el espejo.</TryNote><div dir="rtl"><ActivityCard uid="rtl" /></div></div>`,
  }),
  parameters: tryIt(`Verifica que el espejo de la tarjeta no rompe el orden de lectura ni mueve la unidad lejos de su cifra.`),
};
