import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';
import { PatIcon, TryNote, Verdict, about, tryIt } from './_demo';

/** Bottom navigation. `labels=false` and `colorOnly` build the avoided version. */
const BottomNav = defineComponent({
  name: 'BottomNav',
  components: { PatIcon },
  props: {
    center: { type: Boolean, default: false },
    labels: { type: Boolean, default: true },
    colorOnly: { type: Boolean, default: false },
    navLabel: { type: String, default: 'Principal' },
  },
  setup() {
    const active = ref('inicio');
    const tabs = [
      { id: 'inicio', label: 'Inicio', icon: 'home' },
      { id: 'retos', label: 'Retos', icon: 'bolt' },
      { id: 'rutas', label: 'Rutas', icon: 'pin' },
      { id: 'perfil', label: 'Perfil', icon: 'user' },
    ] as const;
    const go = (id: string, e: Event) => {
      e.preventDefault();
      active.value = id;
    };
    const created = ref('');
    return { active, tabs, go, created };
  },
  template: `
  <div class="pat-screen">
    <div class="pat-screen__body">
      <h3 class="pat-screen__title">{{ tabs.find((t) => t.id === active)?.label }}</h3>
      <p class="pat-verdict__why" role="status">{{ created || 'Toca una pestaña para cambiar de sección.' }}</p>
    </div>
    <nav class="pat-tabbar" :aria-label="navLabel">
      <ul class="pat-tabbar__list">
        <template v-for="(t, i) in tabs" :key="t.id">
          <li v-if="center && i === 2" class="pat-tab pat-tab--center">
            <button type="button" @click="created = 'Nueva actividad registrada.'">
              <span class="pat-tab__fab"><PatIcon name="plus" class="pat-tab__icon" /></span>
              <span class="pat-tab__label">Registrar</span>
            </button>
          </li>
          <li class="pat-tab">
            <a href="#" :aria-current="active === t.id ? 'page' : undefined" :aria-label="labels ? undefined : t.label" @click="go(t.id, $event)">
              <PatIcon :name="t.icon" :filled="!colorOnly && active === t.id" class="pat-tab__icon" />
              <span v-if="labels" class="pat-tab__label">{{ t.label }}</span>
            </a>
          </li>
        </template>
      </ul>
    </nav>
  </div>`,
});

const meta: Meta = {
  title: 'Patterns/Demos/Bottom Navigation',
  parameters: about(`
Bottom navigation for a phone: three to five destinations, each an **icon plus a visible label**. The active tab uses a **filled icon, the primary colour and a bold label** (never colour alone) and carries \`aria-current="page"\`. Every tab is at least 44 px wide and 64 px tall. An optional **centre action** is allowed only when it is THE primary action of the app; it needs a visible label and an accessible name.
  `),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    components: { BottomNav, TryNote },
    template: `<div class="pat-stage"><TryNote>Toca cada pestaña (o usa Tab y Enter): el icono activo se rellena, la etiqueta se pone en negrita y el color cambia. Con un lector de pantalla se anuncia "página actual". Probar en 375 px: nada se corta.</TryNote><BottomNav /></div>`,
  }),
  parameters: tryIt(`Cuatro destinos con etiqueta visible y estado activo por forma, color y peso.`),
};

export const WithCenterAction: Story = {
  render: () => ({
    components: { BottomNav, TryNote },
    template: `<div class="pat-stage"><TryNote>La acción central "Registrar" solo existe porque es LA acción principal de esta app. Tiene etiqueta visible y nombre accesible. Púlsala: el estado confirma en texto, no solo con un cambio visual.</TryNote><BottomNav center /></div>`,
  }),
  parameters: tryIt(`Acción central opcional. Úsala solo si es la acción principal de toda la app.`),
};

export const SideBySide: Story = {
  render: () => ({
    components: { BottomNav, Verdict, TryNote },
    template: `<div class="pat-stage"><TryNote>Compara las dos barras. Sin etiquetas, el significado de cada icono hay que adivinarlo, y si el activo solo cambia de color, quien no distingue colores no sabe dónde está.</TryNote>
      <div class="pat-compare">
        <Verdict :ok="true" why="Icono más etiqueta visible; el activo cambia de forma (relleno), color y peso."><BottomNav nav-label="Principal, recomendado" /></Verdict>
        <Verdict :ok="false" why="Solo iconos, y el activo se distingue únicamente por el color."><BottomNav :labels="false" color-only nav-label="Principal, a evitar" /></Verdict>
      </div></div>`,
  }),
  parameters: tryIt(`Recomendado frente a evitar: iconos sin etiqueta y activo solo por color.`),
};

export const Rtl: Story = {
  render: () => ({
    components: { BottomNav, TryNote },
    template: `<div class="pat-stage"><TryNote>Variante RTL: el orden de las pestañas se invierte (Inicio a la derecha) y la acción central sigue en el medio. El texto sigue en español: solo se comprueba el espejo.</TryNote><div dir="rtl"><BottomNav center /></div></div>`,
  }),
  parameters: tryIt(`Mismo componente con dir="rtl".`),
};
