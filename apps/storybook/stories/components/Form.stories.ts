import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJForm, SJField, SJInput } from '@ramoslabs/vue';
import { SJButton } from '@ramoslabs/vue/button';
import { ControlReadout, about, tryIt } from './_shared';

const meta: Meta<typeof SJForm> = {
  title: 'Components/Form',
  component: SJForm,
  tags: ['autodocs'],
  parameters: about(`
SJForm is a native \`<form>\` that works out the Enter key label from field order: every field but the last gets "next", the last gets "go" (or "send", "search", or "done" when it does not submit). It adds no validation or submit handling: validation is the browser's (\`:user-invalid\`), so the form needs no extra code to show errors only after the user has changed a field or tried to submit.
  `),
  argTypes: {
    enter: { control: 'select', options: [undefined, 'go', 'send', 'search'] },
    submits: { control: 'boolean' },
    autoSubmit: { control: 'boolean' },
  },
  args: { submits: true, autoSubmit: false },
};
export default meta;
type Story = StoryObj<typeof SJForm>;

/** Shared submit handler: never navigates the Storybook frame; prints the data instead. */
const useSubmit = () => {
  const out = ref('Not submitted yet.');
  return {
    out,
    onSubmit: (e: Event) => {
      e.preventDefault();
      out.value = 'Submitted: ' + (new URLSearchParams(new FormData(e.target as HTMLFormElement) as never).toString() || '(empty)');
    },
    onReset: () => (out.value = 'Form reset.'),
  };
};

const base = {
  components: { SJForm, SJField, SJInput, SJButton, ControlReadout },
};

export const Playground: Story = {
  render: (args: Record<string, unknown>) => ({
    ...base,
    setup: () => ({ args, ...useSubmit() }),
    template: `<SJForm v-bind="args" class="sbx-stack" data-readout-scope @submit="onSubmit" @reset="onReset">
      <SJField name="name" label="Full name" required><SJInput kind="name" /></SJField>
      <SJField name="email" label="Email address" required><SJInput kind="email" /></SJField>
      <SJField name="phone" label="Phone"><SJInput kind="phone" /></SJField>
      <div class="sbx-row"><SJButton type="submit">Send</SJButton><SJButton type="reset" variant="outline">Reset</SJButton></div>
      <p class="sbx-note" role="status">{{ out }}</p><ControlReadout /></SJForm>`,
  }),
  parameters: tryIt(`
Change \`enter\`, \`submits\`, \`autoSubmit\`. The readout shows the last field's \`enterkeyhint\`: default \`go\`, \`enter=send\` gives \`send\`, \`submits=false\` gives \`done\`; earlier fields always say \`next\`. Press **Enter** in the last field: it submits only when \`submits\` is on.
  `),
};

export const EnterKeyHint: Story = {
  render: () => ({
    ...base,
    template: `<div class="sbx-stack" data-readout-scope><SJForm class="sbx-stack">
      <SJField name="name" label="Full name"><SJInput kind="name" /></SJField>
      <SJField name="email" label="Email address"><SJInput kind="email" /></SJField>
      <SJField name="phone" label="Phone"><SJInput kind="phone" /></SJField></SJForm><ControlReadout />
      <p class="sbx-note">Last editable field: <code>go</code>. All others: <code>next</code>.</p></div>`,
  }),
  parameters: tryIt(`
Read the readout: name and email are \`next\`, phone is \`go\`. On a phone the Enter key label matches. Pressing **Enter** in name or email moves on; it never submits there.
  `),
};

export const EnterKeyHintTextareaLast: Story = {
  render: () => ({
    ...base,
    template: `<div class="sbx-stack" data-readout-scope><SJForm class="sbx-stack">
      <SJField name="name" label="Full name"><SJInput kind="name" /></SJField>
      <SJField name="email" label="Email address"><SJInput kind="email" /></SJField>
      <SJField name="street" label="Street address"><SJInput kind="address" /></SJField></SJForm><ControlReadout /></div>`,
  }),
  parameters: tryIt(`A multi-line field is not counted as "last", so the email field (last single-line field) gets \`go\`, and the textarea keeps normal Enter (new line).`),
};

export const EnterVariantsAndDone: Story = {
  render: () => ({
    ...base,
    template: `<div class="sbx-stack" data-readout-scope>
      <SJForm enter="send" class="sbx-stack"><SJField name="msg" label="Message (enter=send)"><SJInput kind="text" /></SJField></SJForm>
      <SJForm enter="search" class="sbx-stack"><SJField name="q" label="Query (enter=search)"><SJInput kind="search" /></SJField></SJForm>
      <SJForm :submits="false" class="sbx-stack"><SJField name="g" label="Group (submits=false)"><SJInput /></SJField></SJForm><ControlReadout /></div>`,
  }),
  parameters: tryIt(`Three one-field forms. The readout shows \`send\`, \`search\` and \`done\` for the last field of each.`),
};

export const UserInvalid: Story = {
  render: () => ({
    ...base,
    setup: () => useSubmit(),
    template: `<SJForm class="sbx-stack" @submit="onSubmit" @reset="onReset">
      <SJField name="email" label="Email address" hint="Required, must look like an email" required><SJInput kind="email" /></SJField>
      <SJField name="name" label="Full name" required><SJInput kind="name" /></SJField>
      <div class="sbx-row"><SJButton type="submit">Send</SJButton><SJButton type="reset" variant="outline">Reset</SJButton></div>
      <p class="sbx-note" role="status">{{ out }}</p></SJForm>`,
  }),
  parameters: tryIt(`
1. **Tab** through both empty fields: no error styling appears (the user has not changed anything).
2. Type \`nope\` in email and Tab out: the field turns invalid (thicker border) after the change.
3. Clear everything, press **Send** with empty required fields: the browser blocks the submit, focuses the first invalid field and both show invalid.
4. Fix both and Send: "Submitted: ...". Then **Reset**: all values and invalid styling clear.
  `),
};

export const ServerErrors: Story = {
  render: () => ({
    ...base,
    setup: () => {
      const err = ref<string | undefined>();
      return {
        err,
        onSubmit: (e: Event) => {
          e.preventDefault();
          err.value = 'That address is already registered';
        },
        clear: () => (err.value = undefined),
      };
    },
    template: `<SJForm class="sbx-stack" @submit="onSubmit">
      <SJField name="email" label="Email address" :error="err"><SJInput kind="email" value="ada@example.com" @input="clear" /></SJField>
      <SJButton type="submit">Create account</SJButton></SJForm>`,
  }),
  parameters: tryIt(`Press **Send**: a server-style error appears and a screen reader announces it once politely. Typing clears it. The value you typed is kept (nothing is lost on error).`),
};

export const OtpAutoSubmit: Story = {
  render: () => ({
    ...base,
    setup: () => useSubmit(),
    template: `<div class="sbx-stack" data-readout-scope>
      <p class="sbx-note">autoSubmit on the form</p>
      <SJForm auto-submit class="sbx-stack" @submit="onSubmit" @reset="onReset">
        <SJField name="code" label="Verification code" hint="Enter the 6 digits"><SJInput kind="otp" /></SJField>
        <SJButton type="submit">Verify</SJButton><p class="sbx-note" role="status">{{ out }}</p></SJForm>
      <p class="sbx-note">Without autoSubmit (compare)</p>
      <SJForm class="sbx-stack"><SJField name="code2" label="Verification code"><SJInput kind="otp" /></SJField></SJForm>
      <ControlReadout /></div>`,
  }),
  parameters: tryIt(`
Readout: the autoSubmit form's OTP shows \`enterkeyhint=go\` and \`autocomplete=one-time-code\`; the other shows \`done\`. Type 6 digits and press **Enter** in the first form: it submits. The input mode is numeric on a phone.
  `),
};

export const ValuePreservation: Story = {
  render: () => ({
    ...base,
    setup: () => useSubmit(),
    template: `<SJForm class="sbx-stack" @submit="onSubmit" @reset="onReset">
      <SJField name="email" label="Email address"><SJInput kind="email" value="ada@example.com" /></SJField>
      <SJField name="billing" label="Billing email"><SJInput kind="email" /></SJField>
      <SJField name="pw" label="Password"><SJInput kind="password" /></SJField>
      <div class="sbx-row"><SJButton type="submit">Save</SJButton><SJButton type="reset" variant="outline">Reset</SJButton></div>
      <p class="sbx-note" role="status">{{ out }}</p></SJForm>`,
  }),
  parameters: tryIt(`Edit the prefilled email, add a billing email, Save, then **Reset**: fields return to their defaults (email back to ada@example.com, others empty). The password field stays masked while you type.`),
};

export const RTL: Story = {
  render: () => ({
    ...base,
    template: `<SJForm dir="rtl" class="sbx-stack">
      <SJField name="name" label="الاسم الكامل" required><SJInput kind="name" /></SJField>
      <SJField name="email" label="البريد الإلكتروني" required><SJInput kind="email" /></SJField>
      <SJButton type="submit">إرسال</SJButton></SJForm>`,
  }),
  parameters: tryIt(`Right-to-left form. Labels, inputs, and button align right. Tab order still follows the reading order (top to bottom). Submit with empty fields to see invalid styling mirror correctly.`),
};
