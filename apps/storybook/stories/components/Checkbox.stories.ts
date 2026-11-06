import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJCheckbox } from '@ramoslabs/vue';
import { about, tryIt, textRender } from './_shared';

const meta: Meta<typeof SJCheckbox> = {
  title: 'Components/Checkbox',
  component: SJCheckbox,
  tags: ['autodocs'],
  parameters: about(`
SJCheckbox is one native checkbox. \`checked\` / \`indeterminate\` are the controlled props; \`defaultChecked\` / \`defaultIndeterminate\` the uncontrolled ones. Indeterminate (mixed) is a visual/AT state only: a click clears it and checks the box.
  `),
  argTypes: {
    checked: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
    defaultIndeterminate: { control: 'boolean' },
    disabled: { control: 'boolean' },
    name: { control: 'text' },
    value: { control: 'text' },
    onCheckedChange: { action: 'checkedChange' },
    onIndeterminateChange: { action: 'indeterminateChange' },
  },
  args: { disabled: false },
};
export default meta;
type Story = StoryObj<typeof SJCheckbox>;

export const Playground: Story = {
  args: { text: 'Accept the terms' } as never,
  argTypes: { text: { control: 'text', description: 'Default slot (visible label)' } } as never,
  render: textRender(SJCheckbox),
  parameters: tryIt(`**Tab** to focus, **Space** toggles, label click toggles. Actions panel shows \`checkedChange\`. Screen reader: "Accept the terms, checkbox, not checked/checked".`),
};

export const Uncontrolled: Story = {
  render: () => ({
    components: { SJCheckbox },
    template: `<div class="sbx-stack"><SJCheckbox>Unchecked</SJCheckbox><SJCheckbox default-checked>Checked (defaultChecked)</SJCheckbox></div>`,
  }),
  parameters: tryIt(`Toggle each. The check mark must be visible, not only a colour change.`),
};

export const Indeterminate: Story = {
  render: () => ({
    components: { SJCheckbox },
    template: `<div class="sbx-stack"><SJCheckbox default-indeterminate>Some selected (defaultIndeterminate)</SJCheckbox></div>`,
  }),
  parameters: tryIt(`Shows a dash. Screen reader: "checkbox, mixed". Press **Space**: it becomes checked and the dash goes away (it does not return).`),
};

export const SelectAllController: Story = {
  render: () => ({
    components: { SJCheckbox },
    setup: () => {
      const items = ref([true, false, false]);
      const names = ['Email', 'SMS', 'Push'];
      const count = () => items.value.filter(Boolean).length;
      const setAll = (v: boolean) => (items.value = items.value.map(() => v));
      return { items, names, count, setAll };
    },
    template: `<div class="sbx-stack">
      <SJCheckbox :checked="count() === items.length" :indeterminate="count() > 0 && count() < items.length"
        @checked-change="(p) => setAll(p.checked)">Select all</SJCheckbox>
      <SJCheckbox v-for="(n, i) in names" :key="n" :checked="items[i]" @checked-change="(p) => (items[i] = p.checked)">{{ n }}</SJCheckbox></div>`,
  }),
  parameters: tryIt(`
Fully controlled parent/children. Tick one child: parent shows mixed. Tick all: parent is checked. Click the parent: all children follow. Screen reader on the parent: "Select all, checkbox, mixed".
  `),
};

export const Controlled: Story = {
  render: () => ({
    components: { SJCheckbox },
    setup: () => ({ on: ref(false) }),
    template: `<div class="sbx-stack"><SJCheckbox :checked="on" @checked-change="(p) => (on = p.checked)">Owner-controlled</SJCheckbox>
      <p class="sbx-note" role="status">Owner state: {{ on ? 'checked' : 'unchecked' }}</p></div>`,
  }),
  parameters: tryIt(`The readout always equals the visual state.`),
};

export const ControlledRejecting: Story = {
  render: () => ({
    components: { SJCheckbox },
    template: `<SJCheckbox :checked="false" @checked-change="() => {}">Owner never accepts</SJCheckbox>`,
  }),
  parameters: tryIt(`Click or press **Space**: it must stay unchecked (snaps back).`),
};

export const Disabled: Story = {
  render: () => ({
    components: { SJCheckbox },
    template: `<div class="sbx-stack"><SJCheckbox disabled>Disabled</SJCheckbox><SJCheckbox disabled default-checked>Disabled checked</SJCheckbox></div>`,
  }),
  parameters: tryIt(`**Tab** skips them; clicks do nothing. Screen reader reads "dimmed" plus the checked state.`),
};

export const InForm: Story = {
  render: () => ({
    components: { SJCheckbox },
    setup: () => {
      const out = ref('');
      return {
        out,
        onSubmit: (e: Event) => {
          e.preventDefault();
          out.value = new URLSearchParams(new FormData(e.target as HTMLFormElement) as never).toString() || '(empty)';
        },
      };
    },
    template: `<form class="sbx-stack" @submit="onSubmit"><SJCheckbox name="topics" value="news">News</SJCheckbox><SJCheckbox name="topics" value="offers">Offers</SJCheckbox>
      <div class="sbx-row"><button type="submit">Submit</button><button type="reset">Reset</button></div><p class="sbx-note" role="status">Submitted: {{ out }}</p></form>`,
  }),
  parameters: tryIt(`Check both and Submit: \`topics=news&topics=offers\`. Unchecked boxes are omitted. **Reset** unchecks.`),
};

export const RTL: Story = {
  render: () => ({
    components: { SJCheckbox },
    template: `<div dir="rtl" class="sbx-stack"><SJCheckbox default-checked>أوافق على الشروط</SJCheckbox><SJCheckbox default-indeterminate>تحديد البعض</SJCheckbox></div>`,
  }),
  parameters: tryIt(`The box sits at the right (start) of the label; check mark and dash are centred in the box.`),
};
