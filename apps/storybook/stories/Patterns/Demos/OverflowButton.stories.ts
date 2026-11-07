import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, ref } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import { PatIcon, TryNote, about, tryIt } from './_demo';

const OverflowList = defineComponent({
  name: 'OverflowList',
  components: { SJButton, PatIcon },
  setup() {
    const rows = ['Carrera matutina', 'Ciclismo en Santa Elena', 'Caminata al parque'];
    const showHit = ref(false);
    const opened = ref('');
    return { rows, showHit, opened };
  },
  template: `
  <div class="pat-stage" :class="{ 'pat-show-hit': showHit }">
    <label class="pat-label"><input type="checkbox" v-model="showHit" /> Mostrar el área táctil (solo con puntero táctil)</label>
    <ul class="pat-list">
      <li v-for="r in rows" :key="r" class="pat-list__item">
        <span>{{ r }}</span>
        <SJButton variant="ghost" tone="neutral" size="xs" icon-only :label="'Más opciones de ' + r" @press="opened = r"><template #icon><PatIcon name="dots" /></template></SJButton>
      </li>
    </ul>
    <p class="pat-verdict__why" role="status">{{ opened ? 'Menú abierto: ' + opened : 'Ningún menú abierto.' }}</p>
  </div>`,
});

const meta: Meta = {
  title: 'Patterns/Demos/Overflow Button',
  parameters: about(`
An overflow \`•••\` button can stay **visually small** (SJButton xs, 24 px, the WCAG 2.5.8 floor) because on a coarse pointer an **invisible hit area** extends it to 44 px without moving the layout. The accessible name says what the menu belongs to ("Más opciones de Carrera matutina"), not just "Más".
  `),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    components: { OverflowList, TryNote },
    template: `<div class="pat-stage"><TryNote>Con el ratón el botón mide 24 px. Activa el modo móvil con toque en DevTools y marca "Mostrar el área táctil": verás un cuadrado de 44 px alrededor de cada botón, sin que la lista se mueva. Toca justo encima del icono: sigue funcionando. Con Tab ves el anillo de foco.</TryNote><OverflowList /></div>`,
  }),
  parameters: tryIt(`Botón ••• compacto con área táctil de 44 px.`),
};

export const Rtl: Story = {
  render: () => ({
    components: { OverflowList, TryNote },
    template: `<div class="pat-stage"><TryNote>Variante RTL: el botón pasa al borde inicial (izquierdo) y su área táctil se mantiene centrada. El texto sigue en español: solo se comprueba el espejo.</TryNote><div dir="rtl"><OverflowList /></div></div>`,
  }),
  parameters: tryIt(`Mismo ejemplo con dir="rtl".`),
};
