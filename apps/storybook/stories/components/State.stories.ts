import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { SJState } from '@ramoslabs/vue';
import { SJButton } from '@ramoslabs/vue/button';
import { SJIcon, SJProvider, about, tryIt, iconAlert, iconFolder, iconSearch } from './_shared';

const variants = ['first-use', 'no-results', 'cleared', 'loading', 'error'] as const;

const meta: Meta<typeof SJState> = {
  title: 'Components/State',
  component: SJState,
  tags: ['autodocs'],
  parameters: about(`
SJState covers the five states of an empty or busy region: \`first-use\` (never had data), \`no-results\` (search matched nothing), \`cleared\` (user emptied it), \`loading\` and \`error\`. Meaning is always text, never icon or colour alone. Announcements go through one polite live region (assertive only with \`interrupt\`).
Known limit: when two components announce in the same moment, only the last text is spoken (the registry holds one pending text per role).
  `),
  argTypes: {
    variant: { control: 'select', options: variants },
    heading: { control: 'text' },
    description: { control: 'text' },
    announce: { control: 'text' },
    interrupt: { control: 'boolean' },
  },
  args: { variant: 'first-use', heading: 'No projects yet', description: 'Create your first project to get started.' },
  decorators: [
    (story) => ({
      components: { story, SJProvider },
      template: `<SJProvider><story /></SJProvider>`,
    }),
  ],
};
export default meta;
type Story = StoryObj<typeof SJState>;

const withParts = (args: Record<string, unknown>, icon: unknown, action?: string) => ({
  components: { SJState, SJIcon, SJButton },
  setup: () => ({ args, icon, action }),
  template: `<SJState v-bind="args"><template #icon><SJIcon :icon="icon" size="lg" /></template>
    <template v-if="action" #actions><SJButton>{{ action }}</SJButton></template></SJState>`,
});

export const Playground: Story = {
  render: (args: Record<string, unknown>) => withParts(args, iconFolder, 'Create project'),
  parameters: tryIt(`
Switch \`variant\` and edit the copy. Each variant renders visible text. Set \`announce\` (or use loading / error / no-results, which announce their heading by default) and a screen reader speaks it politely once, after the page is idle. Toggle \`interrupt\` on an error: it speaks assertively ("alert").
  `),
};

export const FirstUse: Story = {
  args: { variant: 'first-use' },
  render: (args: Record<string, unknown>) => withParts(args, iconFolder, 'Create project'),
  parameters: tryIt(`Onboarding: "No projects yet" with a first action. **Tab** reaches the button. Static content: a screen reader announces nothing on its own; navigate to it to read it.`),
};

export const NoResults: Story = {
  args: { variant: 'no-results', heading: 'No results for "invoice"', description: 'Try a different search or clear the filters.' },
  render: (args: Record<string, unknown>) => withParts(args, iconSearch, 'Clear filters'),
  parameters: tryIt(`Reload the story with a screen reader on: it politely announces "No results for invoice". The action changes the search; it does not onboard.`),
};

export const Cleared: Story = {
  args: { variant: 'cleared', heading: 'Inbox cleared', description: 'Everything is archived.' },
  render: (args: Record<string, unknown>) => withParts(args, iconFolder),
  parameters: tryIt(`The user emptied it on purpose: confirms, with no onboarding call to action. Silent to a screen reader unless navigated to.`),
};

export const Loading: Story = {
  args: { variant: 'loading', heading: 'Loading projects', description: 'This usually takes a few seconds.' },
  render: (args: Record<string, unknown>) => withParts(args, iconSearch),
  parameters: tryIt(`Text "Loading projects" is visible (not just a spinner) and announced politely once. If the OS reduce-motion setting is on, any motion must stop.`),
};

export const ErrorState: Story = {
  name: 'Error',
  args: { variant: 'error', heading: 'Could not load projects', description: 'Check your connection and try again.' },
  render: (args: Record<string, unknown>) => withParts(args, iconAlert, 'Try again'),
  parameters: tryIt(`Text and icon both show the error. Polite announcement by default. The retry button is reachable by **Tab**.`),
};

export const InterruptingError: Story = {
  args: { variant: 'error', heading: 'Payment failed', description: 'Your card was declined.', interrupt: true },
  render: (args: Record<string, unknown>) => withParts(args, iconAlert, 'Update card'),
  parameters: tryIt(`Only for an error that interrupts the user's task: a screen reader interrupts and says "Payment failed" assertively.`),
};

export const AllVariants: Story = {
  render: () => ({
    components: { SJState },
    setup: () => ({ variants }),
    template: `<div class="sbx-grid"><div v-for="v in variants" :key="v" class="sbx-card"><SJState :variant="v" :heading="v + ' heading'" description="Supporting copy." /></div></div>`,
  }),
  parameters: tryIt(`Compare all five side by side: each must be distinguishable by its words, not only colour.`),
};

export const RTL: Story = {
  args: { variant: 'no-results', heading: 'لا توجد نتائج', description: 'جرّب بحثاً مختلفاً أو امسح عوامل التصفية.' },
  render: (args: Record<string, unknown>) => ({ ...withParts(args, iconSearch, 'مسح'), template: `<div dir="rtl"><SJState v-bind="args"><template #icon><SJIcon :icon="icon" size="lg" /></template><template #actions><SJButton>{{ action }}</SJButton></template></SJState></div>` }),
  parameters: tryIt(`Right-to-left: text aligns to the right, layout mirrors, reading order is icon, heading, description, action.`),
};
