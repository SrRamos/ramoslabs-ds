import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJButton } from '@ramoslabs/vue/button';
import { SJIcon, about, tryIt, iconPlus, textRender } from './_shared';

const variants = ['solid', 'soft', 'outline', 'ghost'] as const;
const tones = ['primary', 'neutral', 'success', 'warning', 'error', 'info'] as const;

const meta: Meta<typeof SJButton> = {
  title: 'Components/Button',
  component: SJButton,
  tags: ['autodocs'],
  parameters: about(`
SJButton renders a native \`<button>\` (or an \`<a>\` when \`href\` is set). Variant x tone x size are data attributes styled by \`@ramoslabs/css\`. A button never submits a form unless \`type="submit"\`.
The click target is at least 44 px (24 px in compact density), so even a small button is large to hit.
  `),
  argTypes: {
    variant: { control: 'select', options: variants },
    tone: { control: 'select', options: tones },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
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
Every variant x tone pair. Check each is clearly readable and that the focus ring (Tab through all 24) is visible on every one. Hover and press each: the colour must change without the text becoming hard to read.
  `),
};

export const Sizes: Story = {
  render: () => ({
    components: { SJButton },
    template: `<div class="sbx-row"><SJButton size="sm">Small</SJButton><SJButton size="md">Medium</SJButton><SJButton size="lg">Large</SJButton></div>`,
  }),
  parameters: tryIt(
    `Three sizes. Even **Small** keeps a 44 px minimum hit area: click just outside the label and it should still activate.`,
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

export const AsLink: Story = {
  render: () => ({
    components: { SJButton },
    template: `<div class="sbx-row"><SJButton href="https://example.com">Same tab link</SJButton>
      <SJButton href="https://example.com" target="_blank" variant="outline">New tab link</SJButton></div>`,
  }),
  parameters: tryIt(`
Both render \`<a>\`. Inspect the second: \`target="_blank"\` adds \`rel="noopener noreferrer"\` automatically. Screen reader: "Same tab link, link". **Enter** follows it; **Space** does not.
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
