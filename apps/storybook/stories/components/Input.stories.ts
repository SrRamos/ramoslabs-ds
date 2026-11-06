import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { SJField, SJInput } from '@ramoslabs/vue';
import { ControlReadout, about, tryIt } from './_shared';

const kinds = [
  'text', 'name', 'username', 'email', 'url', 'phone', 'otp', 'otp-alnum', 'amount', 'amount-signed',
  'quantity', 'postal', 'reference', 'account', 'tax-id', 'search', 'password', 'password-new', 'date',
  'time', 'cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-name', 'address',
  'address-line', 'country', 'organization',
] as const;

const meta: Meta<typeof SJInput> = {
  title: 'Components/Input',
  component: SJInput,
  tags: ['autodocs'],
  parameters: about(`
SJInput turns an ADR-007 \`kind\` into the right native control: element, \`type\`, \`inputmode\`, \`autocomplete\`, \`enterkeyhint\`, autocapitalise, autocorrect and spellcheck. It never sets \`maxlength\`. \`address\` renders a \`<textarea>\`. Inside a SJForm, the form decides which field gets the Go/Done/Send Enter label.
Use a phone or the browser's device emulation to see the right on-screen keyboard for each kind.
  `),
  argTypes: {
    kind: { control: 'select', options: kinds },
    variant: { control: 'select', options: [undefined, 'text'] },
    autocomplete: { control: 'text' },
    section: { control: 'text' },
    meaningful: { control: 'boolean' },
    digits: { control: 'boolean' },
    uppercase: { control: 'boolean' },
    autoSubmit: { control: 'boolean' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    name: { control: 'text' },
  },
  args: { kind: 'email', name: 'sample' },
};
export default meta;
type Story = StoryObj<typeof SJInput>;

export const Playground: Story = {
  render: (args: Record<string, unknown>) => ({
    components: { SJField, SJInput, ControlReadout },
    setup: () => ({ args }),
    template: `<div class="sbx-stack" data-readout-scope><SJField :name="args.name" :label="'Kind: ' + args.kind"><SJInput v-bind="args" /></SJField><ControlReadout /></div>`,
  }),
  parameters: tryIt(`
Pick a \`kind\` from the control. The readout shows the attributes the browser receives (type, inputmode, enterkeyhint, autocomplete). On a phone or emulator, focus the field and check the keyboard matches (email: @ key; phone: dial pad; amount: decimal pad). Toggle \`digits\` on postal/reference to see numeric vs text keypad.
  `),
};

export const AllKinds: Story = {
  render: () => ({
    components: { SJField, SJInput, ControlReadout },
    setup: () => ({ kinds }),
    template: `<div class="sbx-stack" data-readout-scope>
      <SJField v-for="k in kinds" :key="k" :name="k" :label="k"><SJInput :kind="k" /></SJField><ControlReadout /></div>`,
  }),
  parameters: tryIt(`
Every ADR-007 kind (30). The readout at the bottom updates as you focus each field. Check: \`email\`/\`url\` have no autocapitalise and no spellcheck, \`password\` is masked, \`otp\` has \`autocomplete=one-time-code\` and numeric input mode, \`address\` is a multi-line textarea. A screen reader reads the label then "edit text" (password: "secure edit text").
  `),
};

export const Otp: Story = {
  render: () => ({
    components: { SJField, SJInput, ControlReadout },
    template: `<div class="sbx-stack" data-readout-scope>
      <SJField name="code" label="Verification code"><SJInput kind="otp" /></SJField>
      <SJField name="code2" label="Standalone, autoSubmit"><SJInput kind="otp" auto-submit /></SJField><ControlReadout /></div>`,
  }),
  parameters: tryIt(`
Compare the readout: the plain OTP has \`enterkeyhint=done\`, the autoSubmit one has \`enterkeyhint=go\`. Inside a real form the form decides instead; see the Form stories.
  `),
};

export const Textarea: Story = {
  render: () => ({
    components: { SJField, SJInput },
    template: `<div class="sbx-stack"><SJField name="street" label="Street address" hint="Enter inserts a new line here"><SJInput kind="address" /></SJField></div>`,
  }),
  parameters: tryIt(`Multi-line control. **Enter** adds a line, it does not submit. Screen reader: "Street address, edit text, multi-line".`),
};

export const Disabled: Story = {
  render: () => ({
    components: { SJField, SJInput },
    template: `<div class="sbx-stack"><SJField name="note" label="Note" disabled><SJInput /></SJField></div>`,
  }),
  parameters: tryIt(`Not focusable. Dimmed but legible.`),
};

export const Standalone: Story = {
  render: () => ({
    components: { SJInput },
    template: `<div class="sbx-stack"><SJInput kind="search" name="q" aria-label="Search" placeholder="Search" /></div>`,
  }),
  parameters: tryIt(`An input with no SJField needs its own accessible name (here \`aria-label\`). Screen reader: "Search, search text field".`),
};

export const RTL: Story = {
  render: () => ({
    components: { SJField, SJInput },
    template: `<div dir="rtl" class="sbx-stack"><SJField name="n" label="الاسم الكامل"><SJInput kind="name" /></SJField>
      <SJField name="p" label="الهاتف"><SJInput kind="phone" /></SJField></div>`,
  }),
  parameters: tryIt(`Text starts on the right. Phone numbers stay left-to-right while you type digits.`),
};
