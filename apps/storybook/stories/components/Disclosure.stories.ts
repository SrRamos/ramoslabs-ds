import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { SJDisclosure } from '@ramoslabs/vue';
import { about, tryIt } from './_shared';

const meta: Meta<typeof SJDisclosure> = {
  title: 'Components/Disclosure',
  component: SJDisclosure,
  tags: ['autodocs'],
  parameters: about(`
SJDisclosure is a native \`<details>\`/\`<summary>\`. The browser owns open/close, Enter/Space and focus. Members sharing a \`name\` form an exclusive group (opening one closes the others). Controlled mode (\`open\`) needs the owner to accept the change synchronously in \`openChange\`.
Known limit: on the shipped engines the native \`name\` grouping always wins, so the fallback close path is covered by unit tests only.
  `),
  argTypes: {
    open: { control: 'boolean' },
    defaultOpen: { control: 'boolean' },
    disabled: { control: 'boolean' },
    name: { control: 'text' },
    onOpenChange: { action: 'openChange' },
  },
  args: { defaultOpen: false, disabled: false },
};
export default meta;
type Story = StoryObj<typeof SJDisclosure>;

export const Playground: Story = {
  args: { summary: 'Shipping details', content: 'Orders ship within two business days.' } as never,
  argTypes: {
    summary: { control: 'text', description: 'Trigger title (summary slot)' },
    content: { control: 'text', description: 'Panel text (default slot)' },
  } as never,
  render: (args: Record<string, unknown>) => ({
    components: { SJDisclosure },
    setup: () => ({ args }),
    template: `<SJDisclosure :open="args.open" :default-open="args.defaultOpen" :disabled="args.disabled" :name="args.name" @open-change="args.onOpenChange">
      <template #summary>{{ args.summary }}</template>{{ args.content }}</SJDisclosure>`,
  }),
  parameters: tryIt(`
**Tab** to the trigger, **Enter** or **Space** toggles the panel; the chevron turns. Actions panel logs \`openChange\`. Screen reader: "Shipping details, disclosure triangle, collapsed" then "expanded". Clicking the title also toggles.
  `),
};

export const ClosedAndOpen: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<div class="sbx-stack"><SJDisclosure><template #summary>Starts closed</template>Hidden panel content.</SJDisclosure>
      <SJDisclosure default-open><template #summary>Starts open (defaultOpen)</template>Visible panel content.</SJDisclosure></div>`,
  }),
  parameters: tryIt(`Uncontrolled. Toggle both with the keyboard. Hidden content must not be reachable by Tab or read while closed.`),
};

export const Disabled: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<SJDisclosure disabled><template #summary>Disabled disclosure</template>Cannot open.</SJDisclosure>`,
  }),
  parameters: tryIt(`**Tab** skips it; click and **Space** do nothing. Screen reader announces it as dimmed/unavailable.`),
};

export const LongTitle: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<SJDisclosure><template #summary>Everything you need to know about shipping, returns, warranty claims, exchanges and the way we handle personal data when an order is placed from outside the country</template>Orders ship within two business days.</SJDisclosure>`,
  }),
  parameters: tryIt(`The title wraps over several lines and the chevron stays aligned with the first line. Resize the canvas narrow to confirm no overflow.`),
};

export const ExclusiveGroup: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<div class="sbx-stack">
      <SJDisclosure name="faq" default-open><template #summary>Shipping</template>Shipping panel</SJDisclosure>
      <SJDisclosure name="faq"><template #summary>Returns</template>Returns panel</SJDisclosure>
      <SJDisclosure name="faq"><template #summary>Warranty</template>Warranty panel</SJDisclosure></div>`,
  }),
  parameters: tryIt(`
Three members share \`name="faq"\`. Open Returns: Shipping closes by itself. Only one is ever open. Use **Tab**/**Enter** to move through; a screen reader announces each collapse/expand.
  `),
};

export const Controlled: Story = {
  render: () => ({
    components: { SJDisclosure },
    setup: () => ({ open: ref(false) }),
    template: `<div class="sbx-stack"><SJDisclosure :open="open" @open-change="(p) => (open = p.open)"><template #summary>Owner-controlled</template>Panel</SJDisclosure>
      <div class="sbx-row"><button type="button" @click="open = !open">Toggle from outside</button></div>
      <p class="sbx-note" role="status">Owner state: {{ open ? 'open' : 'closed' }}</p></div>`,
  }),
  parameters: tryIt(`The external button and the trigger both drive the same state; the readout always matches the panel.`),
};

export const ControlledRejecting: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<SJDisclosure :open="false" @open-change="() => {}"><template #summary>Owner never accepts</template>Never shown.</SJDisclosure>`,
  }),
  parameters: tryIt(`Press **Enter**/**Space** or click: the panel flashes at most and must go back to closed (the owner rejected).`),
};

export const ControlledGroup: Story = {
  render: () => ({
    components: { SJDisclosure },
    setup: () => {
      const titles = ['Shipping', 'Returns', 'Warranty'];
      const open = ref<number | null>(0);
      return { titles, open };
    },
    template: `<div class="sbx-stack"><SJDisclosure v-for="(t, i) in titles" :key="t" name="faq2" :open="open === i"
      @open-change="(p) => (open = p.open ? i : open === i ? null : open)"><template #summary>{{ t }}</template>{{ t }} panel</SJDisclosure></div>`,
  }),
  parameters: tryIt(`Exclusive group where the owner decides which is open. Open a second: the first closes. Close the open one: none are open.`),
};

export const RTL: Story = {
  render: () => ({
    components: { SJDisclosure },
    template: `<div dir="rtl" class="sbx-stack"><SJDisclosure default-open><template #summary>تفاصيل الشحن</template>تُشحن الطلبات خلال يومي عمل.</SJDisclosure>
      <SJDisclosure><template #summary>سياسة الإرجاع</template>محتوى</SJDisclosure></div>`,
  }),
  parameters: tryIt(`The chevron sits on the right (start) and points the correct way: down-ish when open, toward the reading direction when closed (not sideways the wrong way).`),
};
