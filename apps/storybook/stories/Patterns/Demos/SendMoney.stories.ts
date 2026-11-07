import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, defineComponent, nextTick, reactive, ref } from 'vue';
import { SJField, SJForm, SJInput } from '@ramoslabs/vue';
import { SJButton } from '@ramoslabs/vue/button';
import { TryNote, about, digitsOf, groupAmount, groupDigits, tryIt } from './_demo';

/**
 * Three screens, one question each: who, how much, confirm. Grouping follows GOV.UK: nothing is reformatted while the person types;
 * the grouped display appears when the field loses focus and in read-only views. The submitted value is always raw digits.
 */
const SendMoneyFlow = defineComponent({
  name: 'SendMoneyFlow',
  components: { SJForm, SJField, SJInput, SJButton },
  props: { uid: { type: String, default: 'sm' } },
  setup() {
    const step = ref(1);
    const done = ref(false);
    const account = ref('');
    const amount = ref('');
    const errors = reactive<{ account: string; amount: string }>({ account: '', amount: '' });
    const heading = ref<HTMLElement | null>(null);
    const root = ref<HTMLElement | null>(null);
    const sent = ref('');
    // What the field shows. Written only on blur and on restart, never on input, so the text is not touched mid-typing.
    const accountField = ref('');
    const amountField = ref('');
    const shownAccount = computed(() => groupDigits(account.value));
    const shownAmount = computed(() => groupAmount(amount.value));
    const labels = ['Destinatario', 'Monto', 'Confirmación'];

    const focusHeading = async () => {
      await nextTick();
      heading.value?.focus();
    };
    /** On input only the raw digits are tracked; the field text is left exactly as typed (spaces and dots are accepted). */
    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.name === 'account') {
        account.value = digitsOf(el.value);
        errors.account = '';
      } else if (el.name === 'amount') {
        amount.value = digitsOf(el.value);
        errors.amount = '';
      }
    };
    /** On blur the grouped display replaces the typed text; the raw digits do not change. */
    const onBlur = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement;
      if (el.name === 'account') {
        accountField.value = shownAccount.value;
        el.value = shownAccount.value;
      } else if (el.name === 'amount') {
        amountField.value = shownAmount.value;
        el.value = shownAmount.value;
      }
    };
    /** The form submits the raw digits, whatever the field shows. */
    const onFormData = (e: FormDataEvent) => {
      e.formData.set('account', account.value);
      e.formData.set('amount', amount.value);
    };
    const onSubmit = async (e: Event) => {
      e.preventDefault();
      // Enter submits without a blur, so the grouped display is written here too.
      accountField.value = shownAccount.value;
      amountField.value = shownAmount.value;
      if (step.value === 1) {
        if (account.value.length < 8 || account.value.length > 16) {
          errors.account = 'Escribe entre 8 y 16 dígitos.';
          await nextTick();
          root.value?.querySelector<HTMLElement>('input[name="account"]')?.focus();
          return;
        }
      } else if (step.value === 2) {
        if (!amount.value || Number(amount.value) < 1000 || amount.value.length > 10) {
          errors.amount = 'Escribe un monto de al menos 1.000.';
          await nextTick();
          root.value?.querySelector<HTMLElement>('input[name="amount"]')?.focus();
          return;
        }
      } else {
        sent.value = new URLSearchParams(new FormData(e.target as HTMLFormElement) as never).toString();
        done.value = true;
        await focusHeading();
        return;
      }
      step.value += 1;
      await focusHeading();
    };
    const back = async () => {
      step.value -= 1;
      await focusHeading();
    };
    const restart = async () => {
      step.value = 1;
      done.value = false;
      account.value = '';
      amount.value = '';
      accountField.value = '';
      amountField.value = '';
      await focusHeading();
    };
    return { root, step, done, account, amount, errors, heading, sent, shownAccount, shownAmount, accountField, amountField, labels, onInput, onBlur, onFormData, onSubmit, back, restart };
  },
  template: `
  <div class="pat-phone" ref="root">
    <div class="pat-steps" v-if="!done">
      <div class="pat-steps__top">
        <p class="pat-steps__label"><span class="pat-vh">Paso </span><bdi>{{ step }} de 3</bdi><span class="pat-vh">: {{ labels[step - 1] }}</span></p>
        <SJButton v-if="step > 1" variant="ghost" tone="neutral" size="sm" @press="back">Atrás</SJButton>
      </div>
      <ol class="pat-steps__bar" aria-hidden="true"><li v-for="n in 3" :key="n" class="pat-steps__seg" :data-state="n < step ? 'done' : n === step ? 'current' : 'todo'"></li></ol>
    </div>

    <div v-if="done" class="pat-done">
      <h2 class="pat-step__q" tabindex="-1" ref="heading">Listo, enviaste $ {{ shownAmount }}</h2>
      <p class="pat-readout" role="status">Valor enviado: {{ sent }}</p>
      <SJButton variant="outline" @press="restart">Enviar otro</SJButton>
    </div>

    <SJForm v-else :key="step" class="pat-step" novalidate @submit="onSubmit" @formdata="onFormData" @input="onInput" @focusout="onBlur">
      <template v-if="step === 1">
        <h2 class="pat-step__q" tabindex="-1" ref="heading">¿A quién le envías dinero?</h2>
        <SJField name="account" label="Número de cuenta" hint="Solo números; puedes escribir espacios. Al salir del campo lo mostramos en grupos de cuatro." :error="errors.account || undefined" required>
          <SJInput kind="account" class="pat-grouped" dir="ltr" :value="accountField" />
        </SJField>
        <p class="pat-readout">Se envía: {{ account || '(vacío)' }}</p>
      </template>
      <template v-else-if="step === 2">
        <h2 class="pat-step__q" tabindex="-1" ref="heading">¿Cuánto quieres enviar?</h2>
        <SJField name="amount" label="Monto en pesos (COP)" hint="Solo números; al salir del campo mostramos los puntos de los miles." :error="errors.amount || undefined" required>
          <SJInput kind="amount" class="pat-grouped" dir="ltr" :value="amountField" />
        </SJField>
        <p class="pat-readout">Se envía: {{ amount || '(vacío)' }}</p>
      </template>
      <template v-else>
        <h2 class="pat-step__q" tabindex="-1" ref="heading">Revisa y confirma</h2>
        <dl class="pat-summary">
          <div class="pat-summary__row"><dt class="pat-label">Para la cuenta</dt><dd class="pat-num pat-num--value pat-grouped"><bdi>{{ shownAccount }}</bdi></dd></div>
          <div class="pat-summary__row"><dt class="pat-label">Monto</dt><dd class="pat-num pat-num--value"><bdi><span>$ {{ shownAmount }}</span> <span class="pat-unit">COP</span></bdi></dd></div>
        </dl>
      </template>
      <div class="pat-cta">
        <SJButton type="submit" size="lg">{{ step === 3 ? 'Confirmar y enviar' : 'Continuar' }}</SJButton>
      </div>
    </SJForm>
  </div>`,
});

const meta: Meta = {
  title: 'Patterns/Demos/Send Money',
  parameters: about(`
A three-step "send money" flow. **One question per screen**, the heading is the question. A **"1 de 3"** text label plus a segmented bar show progress (the text is mandatory: the bar alone is colour only, so the current segment is also taller). Fields are **48 px**, **56 px** under a coarse pointer, and the keyboard matches the kind (\`account\` and \`amount\`). Account and amount are **grouped for reading** (\`0123 4567\`, \`1.250.000\`) only when the field loses focus and on the review screen: nothing is reformatted while you type (GOV.UK), and the submitted value stays raw digits. The **primary action is full width and sticky** at the bottom of the screen.
  `),
};
export default meta;
type Story = StoryObj;

export const Flow: Story = {
  render: () => ({
    components: { SendMoneyFlow, TryNote },
    template: `<div class="pat-stage"><TryNote>Escribe 012345678901 en la cuenta: mientras escribes el texto no cambia; al salir del campo se muestra 0123 4567 8901, y debajo ves el valor que se enviaría (solo dígitos). Pulsa Continuar con el campo vacío para ver el error en texto y el foco. En DevTools, activa el modo móvil con toque: los campos pasan de 48 px a 56 px y el botón queda fijo abajo. Con Enter también avanzas.</TryNote><SendMoneyFlow uid="flow" /></div>`,
  }),
  parameters: tryIt(`Recorre los tres pasos. Revisa que el foco pase al título de cada pantalla, que "1 de 3" cambie y que el valor enviado sean solo dígitos.`),
};

export const Rtl: Story = {
  render: () => ({
    components: { SendMoneyFlow, TryNote },
    template: `<div class="pat-stage"><TryNote>Variante RTL: la barra de progreso se llena de derecha a izquierda, "Atrás" pasa al lado opuesto y los números (cuenta, monto) siguen leyéndose de izquierda a derecha, con los grupos en su orden, porque van aislados con dir="ltr". El texto sigue en español: solo se comprueba el espejo.</TryNote><div dir="rtl"><SendMoneyFlow uid="rtl" /></div></div>`,
  }),
  parameters: tryIt(`Mismo flujo con dir="rtl".`),
};
