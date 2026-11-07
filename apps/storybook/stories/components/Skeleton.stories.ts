import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { SJSkeleton, SJState } from '@ramoslabs/vue';
import { SJButton } from '@ramoslabs/vue/button';
import { SJProvider, about, tryIt } from './_shared';
import './skeleton-stories.css';

const shapes = ['group', 'text', 'circle', 'rect', 'block'] as const;
const ratios = ['1/1', '4/3', '3/2', '16/9', '21/9'] as const;
const sizes = ['sm', 'md', 'lg', 'xl'] as const;

const meta: Meta<typeof SJSkeleton> = {
  title: 'Components/Skeleton',
  component: SJSkeleton,
  tags: ['autodocs'],
  parameters: about(`
SJSkeleton is a placeholder for content that is on its way. The shapes (\`text\`, \`circle\`, \`rect\`, \`block\`) are decorative and hidden from assistive technology. The \`group\` is the container: it shows the \`#skeleton\` slot while \`loading\` and the default slot once loaded. It lays the placeholder out at once but keeps it invisible for \`delay\` (token, 300ms), so a fast load never flashes, then keeps it visible at least \`minDuration\` (token, 500ms). The group carries \`aria-busy\`; \`announce\` is the one polite announcement.
Colour is deliberately quiet and never carries meaning. Under reduced motion the shimmer is removed and the fill is flat.
  `),
  argTypes: {
    shape: { control: 'select', options: shapes },
    lines: { control: { type: 'number', min: 1, max: 12 } },
    ratio: { control: 'select', options: ratios },
    size: { control: 'select', options: sizes },
    animation: { control: 'select', options: ['shimmer', 'none'] },
    loading: { control: 'boolean' },
    delay: { control: 'number' },
    minDuration: { control: 'number' },
    announce: { control: 'text' },
  },
  args: {
    shape: 'group',
    lines: 3,
    ratio: '16/9',
    size: 'md',
    loading: true,
    announce: 'Loading activity',
  },
  decorators: [
    (story) => ({
      components: { story, SJProvider },
      template: `<SJProvider><story /></SJProvider>`,
    }),
  ],
};
export default meta;
type Story = StoryObj<typeof SJSkeleton>;

/** Reactive simulated load: `start()` sets loading for `duration()` ms. All timers are cleared on unmount. */
const useSimLoad = (duration: () => number, autoStart = true) => {
  const loading = ref(false);
  const elapsed = ref(0);
  let done: ReturnType<typeof setTimeout> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  const clear = () => {
    clearTimeout(done);
    clearInterval(tick);
  };
  const start = () => {
    clear();
    loading.value = true;
    elapsed.value = 0;
    const t0 = performance.now();
    tick = setInterval(() => void (elapsed.value = Math.round(performance.now() - t0)), 50);
    done = setTimeout(() => {
      clear();
      elapsed.value = duration();
      loading.value = false;
    }, duration());
  };
  onMounted(() => autoStart && start());
  onBeforeUnmount(clear);
  return { loading, elapsed, start };
};

/** Watches the first skeleton group under `root`: its data-state now, and how many times it became visible. */
const useGroupWatch = (root: Ref<HTMLElement | null>) => {
  const state = ref('-');
  const shown = ref(0);
  let mo: MutationObserver | undefined;
  onMounted(() => {
    const el = root.value?.querySelector<HTMLElement>('[data-shape="group"]');
    if (!el) return;
    let prev = '';
    const read = () => {
      const s = el.getAttribute('data-state') ?? '-';
      if (s === prev) return;
      if (s === 'visible') shown.value += 1;
      prev = s;
      state.value = s;
    };
    read();
    mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['data-state'] });
  });
  onBeforeUnmount(() => mo?.disconnect());
  return { state, shown };
};

const durations = [100, 400, 2000, 5000];

// Shared markup. The skeleton and the loaded card use the same boxes so swapping them shifts nothing.
const activitySkeleton = `
  <div class="sbx-sk-head">
    <SJSkeleton shape="circle" size="md" />
    <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
    <SJSkeleton shape="block" class="sbx-sk-time" />
  </div>
  <SJSkeleton shape="text" :lines="3" />
  <SJSkeleton shape="rect" ratio="16/9" />
  <div class="sbx-sk-actions">
    <SJSkeleton v-for="n in 3" :key="n" shape="block" class="sbx-sk-action" />
  </div>`;
const activityLoaded = `
  <div class="sbx-sk-head">
    <div class="sbx-sk-avatar">MF</div>
    <div class="sbx-sk-who">
      <div class="sbx-sk-line sbx-sk-line--strong">Maria Fernandez</div>
      <div class="sbx-sk-line sbx-sk-line--muted">@mfernandez</div>
    </div>
    <div class="sbx-sk-line sbx-sk-line--muted sbx-sk-time">2h ago</div>
  </div>
  <div class="sbx-sk-body">
    <div class="sbx-sk-line">Shipped the new onboarding flow to everyone today.</div>
    <div class="sbx-sk-line">Early numbers look good: activation is up across</div>
    <div class="sbx-sk-line">every segment we track.</div>
  </div>
  <div class="sbx-sk-media">Photo</div>
  <div class="sbx-sk-actions">
    <div v-for="a in ['Like', 'Reply', 'Share']" :key="a" class="sbx-sk-action">{{ a }}</div>
  </div>`;

const people = [
  ['Maria Fernandez', 'Merged the release branch'],
  ['Luis Ortega', 'Commented on the design review'],
  ['Ana Torres', 'Uploaded three new screenshots'],
  ['Jon Park', 'Closed the accessibility audit'],
  ['Priya Rao', 'Started a draft for the roadmap'],
];

export const Playground: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { SJSkeleton },
    setup: () => ({ args }),
    template: `
      <div class="sbx-stack">
        <SJSkeleton v-if="args.shape === 'group'" v-bind="args" class="sbx-card sbx-sk-activity">
          <template #skeleton>
            <div class="sbx-sk-head">
              <SJSkeleton shape="circle" :size="args.size" />
              <SJSkeleton shape="text" :lines="args.lines" class="sbx-sk-fill" :animation="args.animation" />
            </div>
          </template>
          <p class="sbx-prose">Loaded content. Turn <strong>loading</strong> back on to see the placeholder again.</p>
        </SJSkeleton>
        <SJSkeleton v-else v-bind="args" />
        <p class="sbx-note">With shape = group the placeholder shows after the delay; any other shape renders standalone and is always visible.</p>
      </div>`,
  }),
  parameters: tryIt(`
Qué probar: cambia \`shape\` y ajusta \`lines\`, \`ratio\`, \`size\` y \`animation\`. Con \`group\`, apaga y enciende \`loading\`: el placeholder aparece tras \`delay\` (300 ms por defecto) y se mantiene al menos \`minDuration\` (500 ms). Pon \`delay\` en 0 para verlo de inmediato. Con un lector de pantalla, \`announce\` se anuncia una sola vez de forma educada; las formas sueltas no se anuncian.
  `),
};

export const Text: Story = {
  render: () => ({
    components: { SJSkeleton },
    setup: () => ({ counts: [1, 2, 3, 5] }),
    template: `<div class="sbx-grid sbx-sk-top">
      <div v-for="n in counts" :key="n" class="sbx-card sbx-cell">
        <p class="sbx-sk-label">{{ n }} {{ n === 1 ? 'line' : 'lines' }}</p>
        <SJSkeleton shape="text" :lines="n" />
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: compara 1, 2, 3 y 5 líneas. Con más de una línea, la última es más corta (60 %); con una sola, ocupa todo el ancho. Las líneas son decorativas: un lector de pantalla no debe leer nada aquí.
  `),
};

export const Avatar: Story = {
  render: () => ({
    components: { SJSkeleton },
    setup: () => ({ sizes }),
    template: `<div class="sbx-stack">
      <div class="sbx-row sbx-row--end">
        <div v-for="s in sizes" :key="s" class="sbx-cell">
          <SJSkeleton shape="circle" :size="s" />
          <span class="sbx-note">{{ s }}</span>
        </div>
      </div>
      <div class="sbx-card sbx-sk-head">
        <SJSkeleton shape="circle" size="lg" />
        <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: los cuatro tamaños (sm 32, md 40, lg 48, xl 64 px) son círculos perfectos. En la fila de abajo, avatar y texto quedan centrados verticalmente y el texto toma el ancho restante.
  `),
};

export const Media: Story = {
  render: () => ({
    components: { SJSkeleton },
    setup: () => ({ ratios }),
    template: `<div class="sbx-grid sbx-sk-top">
      <div v-for="r in ratios" :key="r" class="sbx-card sbx-cell">
        <p class="sbx-sk-label">{{ r }}</p>
        <SJSkeleton shape="rect" :ratio="r" style="inline-size: 100%" />
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: cada caja reserva su altura según la proporción (1/1, 4/3, 3/2, 16/9, 21/9) antes de que llegue la imagen. Reduce el ancho de la ventana: la altura se recalcula con el ancho y nunca se desborda.
  `),
};

export const CardSkeletonToLoaded: Story = {
  name: 'Card skeleton to loaded',
  render: () => ({
    components: { SJSkeleton, SJButton },
    setup() {
      const ms = ref(2000);
      const { loading, elapsed, start } = useSimLoad(() => ms.value);
      const root = ref<HTMLElement | null>(null);
      const { state } = useGroupWatch(root);
      return { ms, loading, elapsed, start, root, state, durations };
    },
    template: `<div class="sbx-stack" ref="root">
      <div class="sbx-row">
        <SJButton @click="start">Start a new load</SJButton>
        <label class="sbx-note">Simulated load
          <select v-model.number="ms" class="sbx-sk-select" data-testid="duration">
            <option v-for="d in durations" :key="d" :value="d">{{ d }} ms</option>
          </select>
        </label>
      </div>
      <p class="sbx-sk-readout" data-testid="readout">Loading: {{ loading ? 'yes' : 'no' }} · skeleton state: {{ state }} · elapsed: {{ elapsed }} ms</p>
      <div class="sbx-card sbx-sk-card">
        <SJSkeleton shape="group" :loading="loading" announce="Loading activity" class="sbx-sk-activity" data-testid="group">
          <template #skeleton>${activitySkeleton}</template>
          ${activityLoaded}
        </SJSkeleton>
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: pulsa "Start a new load" con 2000 ms: el esqueleto aparece tras 300 ms y luego se cambia por la tarjeta sin que nada se mueva (mismos paddings, alturas de línea y proporción de medio). Con 100 ms o 400 ms mira el estado: con 100 ms nunca se ve el esqueleto; con 400 ms aparece y se mantiene 500 ms como mínimo. Con un lector de pantalla se anuncia "Loading activity" una sola vez.
  `),
};

export const ListFeed: Story = {
  render: () => ({
    components: { SJSkeleton, SJButton },
    setup() {
      const { loading, start } = useSimLoad(() => 2000);
      return { loading, start, people };
    },
    template: `<div class="sbx-stack">
      <div class="sbx-row"><SJButton @click="start">Reload feed</SJButton></div>
      <div class="sbx-card sbx-sk-list">
        <SJSkeleton shape="group" :loading="loading" announce="Loading feed">
          <template #skeleton>
            <div v-for="n in 5" :key="n" class="sbx-sk-row">
              <SJSkeleton shape="circle" size="md" />
              <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
            </div>
          </template>
          <div v-for="p in people" :key="p[0]" class="sbx-sk-row">
            <div class="sbx-sk-avatar">{{ p[0].slice(0, 1) }}</div>
            <div class="sbx-sk-who">
              <div class="sbx-sk-line sbx-sk-line--strong">{{ p[0] }}</div>
              <div class="sbx-sk-line sbx-sk-line--muted">{{ p[1] }}</div>
            </div>
          </div>
        </SJSkeleton>
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: la lista carga sola (2 s) y se puede recargar con "Reload feed". Cinco filas de esqueleto (avatar y dos líneas) se sustituyen por cinco filas reales con la misma altura, así que la lista no salta. Un lector de pantalla anuncia "Loading feed" una vez, no una vez por fila.
  `),
};

export const InsideSJState: Story = {
  name: 'Inside SJState',
  render: () => ({
    components: { SJSkeleton, SJState, SJButton },
    setup() {
      const { loading, start } = useSimLoad(() => 2500);
      return { loading, start };
    },
    template: `<div class="sbx-stack">
      <p class="sbx-sk-label">1. The skeleton slot of a loading SJState</p>
      <div class="sbx-card">
        <SJState variant="loading" heading="Loading activity">
          <template #skeleton>
            <div class="sbx-sk-head">
              <SJSkeleton shape="circle" size="md" />
              <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
            </div>
          </template>
        </SJState>
      </div>
      <p class="sbx-sk-label">2. Loading, then loaded</p>
      <div class="sbx-row"><SJButton @click="start">Reload</SJButton></div>
      <div class="sbx-card">
        <SJState v-if="loading" variant="loading" heading="Loading activity">
          <template #skeleton>
            <div class="sbx-sk-head">
              <SJSkeleton shape="circle" size="md" />
              <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
            </div>
          </template>
        </SJState>
        <div v-else class="sbx-sk-head">
          <div class="sbx-sk-avatar">MF</div>
          <div class="sbx-sk-who">
            <div class="sbx-sk-line sbx-sk-line--strong">Maria Fernandez</div>
            <div class="sbx-sk-line sbx-sk-line--muted">@mfernandez</div>
          </div>
        </div>
      </div>
      <p class="sbx-note">The shapes here are plain decoration with no group and no announce. The SJState heading is the single announcement.</p>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: en el primer ejemplo el estado de carga muestra su encabezado "Loading activity" como texto visible, con las formas del esqueleto debajo. En el segundo, pulsa "Reload": el encabezado se anuncia una sola vez (las formas no anuncian nada) y al terminar se muestra el contenido. El lector de pantalla no debe repetir el anuncio por cada forma.
  `),
};

export const FastLoad: Story = {
  render: () => ({
    components: { SJSkeleton, SJButton },
    setup() {
      const good = useSimLoad(() => 150);
      const bad = useSimLoad(() => 150);
      const goodRoot = ref<HTMLElement | null>(null);
      const badRoot = ref<HTMLElement | null>(null);
      const goodWatch = useGroupWatch(goodRoot);
      const badWatch = useGroupWatch(badRoot);
      const run = () => {
        good.start();
        bad.start();
      };
      return { good, bad, goodRoot, badRoot, goodWatch, badWatch, run, people };
    },
    template: `<div class="sbx-stack sbx-sk-wide">
      <div class="sbx-row"><SJButton @click="run">Run a 150 ms load again</SJButton></div>
      <div class="sbx-sk-cols">
        <div class="sbx-cell" ref="goodRoot">
          <p class="sbx-sk-label">Default delay (300 ms): correct</p>
          <p class="sbx-sk-readout" data-testid="good-count">Times the skeleton became visible: {{ goodWatch.shown.value }}</p>
          <div class="sbx-card sbx-sk-card">
            <SJSkeleton shape="group" :loading="good.loading.value" class="sbx-sk-activity">
              <template #skeleton>
                <div class="sbx-sk-head"><SJSkeleton shape="circle" /><SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" /></div>
              </template>
              <div class="sbx-sk-head">
                <div class="sbx-sk-avatar">MF</div>
                <div class="sbx-sk-who"><div class="sbx-sk-line sbx-sk-line--strong">Maria Fernandez</div><div class="sbx-sk-line sbx-sk-line--muted">@mfernandez</div></div>
              </div>
            </SJSkeleton>
          </div>
        </div>
        <div class="sbx-cell" ref="badRoot">
          <p class="sbx-sk-label">delay = 0: bad example, it flashes</p>
          <p class="sbx-sk-readout" data-testid="bad-count">Times the skeleton became visible: {{ badWatch.shown.value }}</p>
          <div class="sbx-card sbx-sk-card">
            <SJSkeleton shape="group" :loading="bad.loading.value" :delay="0" class="sbx-sk-activity">
              <template #skeleton>
                <div class="sbx-sk-head"><SJSkeleton shape="circle" /><SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" /></div>
              </template>
              <div class="sbx-sk-head">
                <div class="sbx-sk-avatar">MF</div>
                <div class="sbx-sk-who"><div class="sbx-sk-line sbx-sk-line--strong">Maria Fernandez</div><div class="sbx-sk-line sbx-sk-line--muted">@mfernandez</div></div>
              </div>
            </SJSkeleton>
          </div>
        </div>
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: pulsa "Run a 150 ms load again" varias veces. A la izquierda (retardo por defecto de 300 ms) el contador se queda en 0: el esqueleto nunca aparece, no hay parpadeo. A la derecha (delay = 0, mal ejemplo) el contador sube en cada carga: el esqueleto aparece y desaparece en un parpadeo. Recargar la historia reinicia los contadores.
  `),
};

export const ReducedMotion: Story = {
  render: () => ({
    components: { SJSkeleton },
    setup: () => ({}),
    template: `<div class="sbx-stack sbx-sk-wide">
      <p class="sbx-note">Both panes use standalone shapes, so they are always visible.</p>
      <div class="sbx-sk-cols">
        <div class="sbx-cell">
          <p class="sbx-sk-label">Live: follows the OS setting</p>
          <div class="sbx-card sbx-sk-card sbx-sk-activity">
            <div class="sbx-sk-head"><SJSkeleton shape="circle" /><SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" /></div>
            <SJSkeleton shape="rect" ratio="21/9" />
          </div>
        </div>
        <div class="sbx-cell">
          <p class="sbx-sk-label">Forced static: animation = none</p>
          <div class="sbx-card sbx-sk-card sbx-sk-activity">
            <div class="sbx-sk-head"><SJSkeleton shape="circle" animation="none" /><SJSkeleton shape="text" :lines="2" animation="none" class="sbx-sk-fill" /></div>
            <SJSkeleton shape="rect" ratio="21/9" animation="none" />
          </div>
        </div>
      </div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: una historia no puede cambiar el ajuste del sistema, así que hay dos paneles. El de la izquierda sigue tu sistema: con el movimiento normal brilla; con "reducir movimiento" queda plano. El de la derecha siempre es estático (animation = none), tal como se ve con el ajuste activado. Para emular el ajuste: en macOS, Ajustes del Sistema > Accesibilidad > Pantalla > Reducir movimiento; o en Chrome DevTools, Rendering > Emulate CSS media feature prefers-reduced-motion. En ambos casos los dos paneles deben verse iguales y sin brillo.
  `),
};

export const RTL: Story = {
  render: () => ({
    components: { SJSkeleton },
    template: `<div dir="rtl" class="sbx-stack sbx-sk-wide">
      <div class="sbx-card sbx-cell">
        <SJSkeleton shape="text" :lines="3" />
      </div>
      <div class="sbx-card sbx-sk-head">
        <SJSkeleton shape="circle" size="lg" />
        <SJSkeleton shape="text" :lines="2" class="sbx-sk-fill" />
      </div>
      <div class="sbx-card sbx-sk-card sbx-sk-activity">${activitySkeleton}</div>
    </div>`,
  }),
  parameters: tryIt(`
Qué probar: en un contenedor \`dir="rtl"\` el diseño se refleja: el avatar queda a la derecha, la marca de tiempo a la izquierda, la última línea de texto se acorta hacia la izquierda y el brillo recorre la forma en sentido contrario (de izquierda a derecha).
  `),
};
