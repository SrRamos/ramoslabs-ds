import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import { SJIcon, about, tryIt, iconPlus, textRender } from './_shared';

const variants = ['solid', 'soft', 'outline', 'ghost', 'link'] as const;
const sizes = ['xs', 'sm', 'md', 'lg'] as const;
const tones = ['primary', 'neutral', 'success', 'warning', 'error', 'info'] as const;

const meta: Meta<typeof SJButton> = {
  title: 'Components/Button',
  component: SJButton,
  tags: ['autodocs'],
  parameters: about(`
SJButton renders a native \`<button>\` (or an \`<a>\` when \`href\` is set). Variant x tone x size are data attributes styled by \`@ramoslabs/css\`. A button never submits a form unless \`type="submit"\`.
The visual height runs 24 / 32 / 36 / 44 px (xs / sm / md / lg), never below the 24 px WCAG 2.5.8 floor. On a touch screen (\`any-pointer: coarse\`) an invisible hit area extends every size to 44 px without moving the layout. Space adjacent compact buttons by at least \`--space-2\` (\`--space-3\` around xs) so a finger cannot land on the wrong one.
  `),
  argTypes: {
    variant: { control: 'select', options: variants },
    tone: { control: 'select', options: tones },
    size: { control: 'inline-radio', options: sizes },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
    disabled: { control: 'boolean' },
    iconOnly: { control: 'boolean' },
    href: { control: 'text' },
    target: { control: 'text' },
    rel: { control: 'text' },
    label: { control: 'text' },
    onPress: { action: 'press' },
  },
  args: { variant: 'solid', tone: 'primary', size: 'md', disabled: false, type: 'button' },
};
export default meta;
type Story = StoryObj<typeof SJButton>;

export const Playground: Story = {
  args: { text: 'Save changes' } as never,
  argTypes: { text: { control: 'text', description: 'Default slot (visible label)' } } as never,
  render: textRender(SJButton),
  parameters: tryIt(`
Change every control and watch the button follow.
1. Press **Tab** until the button shows its focus ring, then **Enter** and **Space**: the Actions panel logs one \`press\` each.
2. Set \`href\` to \`https://example.com\`: the element becomes a link. **Enter** activates it, **Space** does nothing (native link behaviour).
3. Screen reader: "Save changes, button" (or "link"). Disabled: "dimmed/unavailable".
  `),
};

export const VariantsAndTones: Story = {
  render: () => ({
    components: { SJButton },
    setup: () => ({ variants, tones }),
    template: `<div class="sbx-stack"><div v-for="v in variants" :key="v" class="sbx-row">
      <SJButton v-for="t in tones" :key="t" :variant="v" :tone="t">{{ v }} {{ t }}</SJButton></div></div>`,
  }),
  parameters: tryIt(`
Every variant x tone pair. The last row is the inline link variant. Check each is clearly readable and that the focus ring (Tab through all 30) is visible on every one. Hover and press each: the colour must change without the text becoming hard to read. Solid buttons also lift (glow on hover) and press in to 97% scale.
  `),
};

export const Sizes: Story = {
  render: () => ({
    components: { SJButton, SJIcon },
    setup: () => ({ sizes, iconPlus, heights: { xs: 24, sm: 32, md: 36, lg: 44 } }),
    template: `<div class="sbx-stack">
      <div class="sbx-row sbx-row--end"><div v-for="z in sizes" :key="z" class="sbx-cell">
        <SJButton :size="z">{{ z }} button</SJButton><span class="sbx-note">{{ z }} · {{ heights[z] }} px</span></div></div>
      <div class="sbx-row sbx-row--end"><div v-for="z in sizes" :key="z" class="sbx-cell">
        <SJButton :size="z" icon-only variant="outline" :label="'Add item, ' + z"><template #icon><SJIcon :icon="iconPlus" /></template></SJButton>
        <span class="sbx-note">{{ z }} · {{ heights[z] }} × {{ heights[z] }} px</span></div></div></div>`,
  }),
  parameters: tryIt(
    `Four sizes with visibly different heights: xs 24, sm 32, md 36, lg 44 px, with icon-only squares below. The visual floor is 24 px (WCAG 2.5.8). Open the story on a phone, or emulate touch in the browser devtools: the hit area of every size grows to 44 px (an invisible area around the button) while the button looks the same. Tap just above or below **xs**: it should still activate.`,
  ),
};

export const Disabled: Story = {
  render: () => ({
    components: { SJButton },
    template: `<div class="sbx-row"><SJButton disabled>Disabled button</SJButton><SJButton disabled href="https://example.com">Disabled link</SJButton></div>`,
  }),
  parameters: tryIt(`
**Tab** skips the disabled button (not focusable). Clicking does nothing, no \`press\`. The disabled link has no \`href\`, so it is not focusable or navigable either. Screen reader: "Disabled button, dimmed".
  `),
};

export const AsAnchor: Story = {
  render: () => ({
    components: { SJButton },
    template: `<div class="sbx-row"><SJButton href="https://example.com">Same tab link</SJButton>
      <SJButton href="https://example.com" target="_blank" variant="outline">New tab link</SJButton></div>`,
  }),
  parameters: tryIt(`
Both render \`<a>\`. Inspect the second: \`target="_blank"\` adds \`rel="noopener noreferrer"\` automatically. Screen reader: "Same tab link, link". **Enter** follows it; **Space** does not.
  `),
};

export const Link: Story = {
  render: () => ({
    components: { SJButton },
    template: `<p class="sbx-prose">Tu prueba gratuita termina el 30 de noviembre.
      <SJButton variant="link" href="#billing">Revisa la facturación</SJButton> o
      <SJButton variant="link" tone="neutral" href="#plans">compara los planes</SJButton> antes de esa fecha.
      ¿Ya no lo necesitas? <SJButton variant="link" tone="error">Cancela la suscripción</SJButton>.</p>`,
  }),
  parameters: tryIt(`
The link variant is inline text: underlined at rest (never colour alone), the size and line height of the sentence, no padding, no height. Hover thickens the underline; **Tab** to it and the focus ring appears. It renders \`<a>\` with \`href\` and \`<button>\` without (the last one performs an action, so it stays a button). Screen reader: "Revisa la facturación, link".
  `),
};

export const IconOnly: Story = {
  render: () => ({
    components: { SJButton, SJIcon },
    setup: () => ({ iconPlus }),
    template: `<div class="sbx-row"><SJButton icon-only label="Add item" variant="outline"><template #icon><SJIcon :icon="iconPlus" /></template></SJButton>
      <SJButton variant="soft"><template #icon><SJIcon :icon="iconPlus" /></template>With icon</SJButton></div>`,
  }),
  parameters: tryIt(`
The icon-only button is square and has no visible text. Screen reader must say "Add item, button" (from \`label\`); the glyph itself is hidden from assistive tech. The second shows an icon next to the text.
  `),
};

export const InsideForm: Story = {
  render: () => ({
    components: { SJButton },
    setup: () => {
      const out = ref('Nothing pressed yet.');
      return {
        out,
        onSubmit: (e: Event) => {
          e.preventDefault();
          out.value = 'Submit fired (page not reloaded).';
        },
        onReset: () => (out.value = 'Reset fired.'),
      };
    },
    template: `<form class="sbx-stack" @submit="onSubmit" @reset="onReset">
      <input aria-label="Sample field" placeholder="Type, then use the buttons" />
      <div class="sbx-row"><SJButton type="submit">Submit</SJButton><SJButton type="reset" variant="outline">Reset</SJButton>
      <SJButton variant="ghost">Plain (type=button)</SJButton></div><p class="sbx-note" role="status">{{ out }}</p></form>`,
  }),
  parameters: tryIt(`
Type in the field, then press **Enter**: the form submits through the Submit button. **Reset** clears the field. The plain button does neither (a button never submits implicitly).
  `),
};

export const RTL: Story = {
  render: () => ({
    components: { SJButton, SJIcon },
    setup: () => ({ iconPlus }),
    template: `<div dir="rtl" class="sbx-row"><SJButton><template #icon><SJIcon :icon="iconPlus" /></template>حفظ التغييرات</SJButton><SJButton variant="outline" tone="neutral">إلغاء</SJButton></div>`,
  }),
  parameters: tryIt(
    `Right-to-left page. The icon should sit on the start (right) side of the text, padding stays symmetric, and the focus ring wraps the whole button.`,
  ),
};
