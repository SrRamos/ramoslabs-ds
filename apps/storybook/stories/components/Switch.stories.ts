import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJSwitch } from '@ramoslabs/vue';
import { about, tryIt, textRender } from './_shared';

const meta: Meta<typeof SJSwitch> = {
  title: 'Components/Switch',
  component: SJSwitch,
  tags: ['autodocs'],
  parameters: about(`
SJSwitch is one native \`<input type="checkbox" role="switch">\`. Uncontrolled by default (\`defaultChecked\`); pass \`checked\` to control it. In controlled mode the owner must accept the change synchronously in \`checkedChange\`.
  `),
  argTypes: {
    checked: { control: 'boolean' },
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    name: { control: 'text' },
    value: { control: 'text' },
    onCheckedChange: { action: 'checkedChange' },
  },
  args: { disabled: false, defaultChecked: false },
};
export default meta;
type Story = StoryObj<typeof SJSwitch>;

export const Playground: Story = {
  args: { text: 'Email notifications' } as never,
  argTypes: { text: { control: 'text', description: 'Default slot (visible label)' } } as never,
  render: textRender(SJSwitch),
  parameters: tryIt(`
**Tab** to focus (focus ring), **Space** toggles. Clicking the label also toggles. Actions panel logs \`checkedChange\` with the new value. Screen reader: "Email notifications, switch, off/on".
  `),
};

export const Uncontrolled: Story = {
  render: () => ({
    components: { SJSwitch },
    template: `<div class="sbx-stack"><SJSwitch>Starts off</SJSwitch><SJSwitch default-checked>Starts on (defaultChecked)</SJSwitch></div>`,
  }),
  parameters: tryIt(`Toggle each with **Space** and the mouse. The component keeps its own state. Screen reader announces "switch, on" / "off".`),
};

export const Controlled: Story = {
  render: () => ({
    components: { SJSwitch },
    setup: () => {
      const on = ref(true);
      return { on };
    },
    template: `<div class="sbx-stack"><SJSwitch :checked="on" @checked-change="(p) => (on = p.checked)">Owner-controlled</SJSwitch>
      <p class="sbx-note" role="status">Owner state: {{ on ? 'on' : 'off' }}</p></div>`,
  }),
  parameters: tryIt(`The readout below must always equal the visual state. Toggle by keyboard and mouse.`),
};

export const ControlledRejecting: Story = {
  render: () => ({
    components: { SJSwitch },
    template: `<div class="sbx-stack"><SJSwitch :checked="false" @checked-change="() => {}">Owner never accepts</SJSwitch>
      <p class="sbx-note">Controlled with a fixed value and a handler that ignores changes.</p></div>`,
  }),
  parameters: tryIt(`Try to turn it on with **Space** and click: it must snap back to off every time (the owner rejected the change).`),
};

export const Disabled: Story = {
  render: () => ({
    components: { SJSwitch },
    template: `<div class="sbx-stack"><SJSwitch disabled>Disabled off</SJSwitch><SJSwitch disabled default-checked>Disabled on</SJSwitch></div>`,
  }),
  parameters: tryIt(`**Tab** skips both; clicks do nothing. Screen reader: "dimmed", state still read (on/off). The on/off position must be distinguishable without colour.`),
};

export const InForm: Story = {
  render: () => ({
    components: { SJSwitch },
    setup: () => {
      const out = ref('');
      return {
        out,
        onSubmit: (e: Event) => {
          e.preventDefault();
          out.value = new URLSearchParams(new FormData(e.target as HTMLFormElement) as never).toString() || '(empty: nothing on)';
        },
      };
    },
    template: `<form class="sbx-stack" @submit="onSubmit"><SJSwitch name="alerts" value="yes">Alerts</SJSwitch>
      <div class="sbx-row"><button type="submit">Submit</button><button type="reset">Reset</button></div>
      <p class="sbx-note" role="status">Submitted data: {{ out }}</p></form>`,
  }),
  parameters: tryIt(`Turn it on and Submit: the data shows \`alerts=yes\`. Off: nothing is submitted. **Reset** returns to the default.`),
};

export const RTL: Story = {
  render: () => ({
    components: { SJSwitch },
    template: `<div dir="rtl" class="sbx-stack"><SJSwitch default-checked>الإشعارات</SJSwitch><SJSwitch>الوضع الداكن</SJSwitch></div>`,
  }),
  parameters: tryIt(`The thumb must travel toward the left when turning on (mirrored), and the label sits on the correct side. The on state is still visually distinct.`),
};
