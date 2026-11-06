import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJField, SJInput } from '@ramoslabs/vue';
import { about, tryIt } from './_shared';

const meta: Meta<typeof SJField> = {
  title: 'Components/Field',
  component: SJField,
  tags: ['autodocs'],
  parameters: about(`
SJField wraps one control (SJInput) with a visible label, optional hint and an error. It owns the ids and ARIA links (\`aria-describedby\`, \`aria-invalid\`) and announces a new error once through the polite live region. A non-empty \`error\` marks the control invalid; the error always shows text and an icon, never colour alone.
Known limit: if two fields show errors in the same moment, only one is spoken (both stay visible). A form summary or focus move is the consumer's job.
  `),
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    errorMessage: { control: 'boolean' },
    name: { control: 'text' },
  },
  args: { label: 'Email address', name: 'email', required: false, disabled: false },
};
export default meta;
type Story = StoryObj<typeof SJField>;

const one = (args: Record<string, unknown>, kind = 'email') => ({
  components: { SJField, SJInput },
  setup: () => ({ args, kind }),
  template: `<div class="sbx-stack"><SJField v-bind="args"><SJInput :kind="kind" /></SJField></div>`,
});

export const Playground: Story = {
  args: { hint: 'We only use it to send receipts' },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`
Edit label, hint and error. Click the label: focus moves into the input. **Tab** into the input: a screen reader says "Email address, edit text, [hint text], [required], [invalid, error text]". Type an \`error\`: it appears with an icon and is announced once politely.
  `),
};

export const Default: Story = {
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`Label above the input. **Tab** once to reach the input; the label is read on focus.`),
};

export const WithHint: Story = {
  args: { hint: 'We only use it to send receipts' },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`On focus the screen reader reads the label, then the hint as the description.`),
};

export const Invalid: Story = {
  args: { error: 'Enter an email address like name@example.com', hint: 'We only use it to send receipts' },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`Visible error text with an icon and a thicker border. On focus: "invalid entry" plus the error text. A standing error at load is not announced (it is silent until it changes).`),
};

export const InvalidWithErrormessage: Story = {
  args: { error: 'Enter an email address like name@example.com', errorMessage: true },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`Inspect the input: \`aria-errormessage\` is added next to \`aria-describedby\`. Support varies between screen readers, so the described-by path still carries the text.`),
};

export const Required: Story = {
  args: { required: true },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`Screen reader says "required". The visible label must show that it is required in a way that is not colour only.`),
};

export const LongLabel: Story = {
  args: {
    label: 'Email address where we send your receipts, security notices and the occasional update about your account, kept private and never shared with anyone outside the company',
  },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`The label wraps; nothing is clipped. Resize the canvas narrow and zoom to 200%.`),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args: Record<string, unknown>) => one(args),
  parameters: tryIt(`**Tab** skips the input; typing does nothing. The label and input both look dimmed but the label text must stay readable.`),
};

export const LiveValidation: Story = {
  render: () => ({
    components: { SJField, SJInput },
    setup: () => {
      const error = ref<string | undefined>();
      const check = (e: Event) => {
        const v = (e.target as HTMLInputElement).value;
        error.value = /^\S+@\S+\.\S+$/.test(v) ? undefined : 'Enter an email address like name@example.com';
      };
      return { error, check };
    },
    template: `<div class="sbx-stack"><SJField name="email" label="Email address" hint="Validated when you leave the field" :error="error">
      <SJInput kind="email" @change="check" /></SJField></div>`,
  }),
  parameters: tryIt(`
Type \`nope\` and press **Tab**: the error appears and a screen reader says the error politely once. Fix it to \`a@b.co\` and Tab out: the error disappears. Tabbing through the empty field first shows nothing wrong because the check only runs on change.
  `),
};

export const RTL: Story = {
  args: { label: 'البريد الإلكتروني', hint: 'نستخدمه لإرسال الإيصالات', error: 'أدخل بريداً صالحاً' },
  render: (args: Record<string, unknown>) => ({ ...one(args), template: `<div dir="rtl" class="sbx-stack"><SJField v-bind="args"><SJInput kind="email" /></SJField></div>` }),
  parameters: tryIt(`Label, hint and error align to the right; the error icon sits at the start (right). Email typing stays left-to-right inside the input.`),
};
