<template>
  <div class="token-picker">
    <div class="token-picker__header">
      <h3 class="token-picker__title">{{ title }}</h3>
      <p class="token-picker__subtitle">Click any color to copy its CSS variable</p>
    </div>

    <div class="token-picker__grid">
      <button
        v-for="color in colors"
        :key="color.token"
        class="token-picker__swatch"
        :style="{ backgroundColor: color.value }"
        :class="{ 'token-picker__swatch--light': isLightColor(color.value) }"
        @click="selectColor(color)"
        :aria-label="`Select ${color.name}`"
      >
        <span class="token-picker__swatch-name">{{ color.name }}</span>
        <span class="token-picker__swatch-value">{{ color.value }}</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="selectedColor" class="token-picker__details">
        <div class="token-picker__selected">
          <div
            class="token-picker__selected-preview"
            :style="{ backgroundColor: selectedColor.value }"
          >
            <span :style="{ color: contrastWhite >= 4.5 ? '#ffffff' : '#000000' }">
              Aa
            </span>
          </div>
          <div class="token-picker__selected-info">
            <div class="token-picker__selected-name">{{ selectedColor.name }}</div>
            <code class="token-picker__selected-token">{{ selectedColor.token }}</code>
            <div class="token-picker__selected-value">{{ selectedColor.value }}</div>
          </div>
        </div>

        <div class="token-picker__contrast">
          <h4 class="token-picker__contrast-title">Contrast Ratios</h4>
          <div class="token-picker__contrast-grid">
            <div class="token-picker__contrast-item">
              <div
                class="token-picker__contrast-preview"
                :style="{ backgroundColor: selectedColor.value, color: '#ffffff' }"
              >
                White Text
              </div>
              <div class="token-picker__contrast-ratio">
                <span class="token-picker__contrast-value">{{ contrastWhite.toFixed(2) }}:1</span>
                <span
                  class="token-picker__contrast-badge"
                  :class="getContrastClass(contrastWhite)"
                >
                  {{ getContrastLabel(contrastWhite) }}
                </span>
              </div>
            </div>

            <div class="token-picker__contrast-item">
              <div
                class="token-picker__contrast-preview"
                :style="{ backgroundColor: selectedColor.value, color: '#000000' }"
              >
                Black Text
              </div>
              <div class="token-picker__contrast-ratio">
                <span class="token-picker__contrast-value">{{ contrastBlack.toFixed(2) }}:1</span>
                <span
                  class="token-picker__contrast-badge"
                  :class="getContrastClass(contrastBlack)"
                >
                  {{ getContrastLabel(contrastBlack) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button class="token-picker__copy" @click="copyToken">
          <span v-if="copied" class="token-picker__copy-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
          </span>
          <span v-else>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy var({{ selectedColor.token }})
          </span>
        </button>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="showToast" class="token-picker__toast">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied: var({{ lastCopied }})
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

type ColorToken = {
  name: string;
  token: string;
  value: string;
  description?: string;
}

type Props = {
  title?: string;
  colors: ColorToken[];
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Color Tokens',
});

const selectedColor = ref<ColorToken | null>(null);
const copied = ref(false);
const showToast = ref(false);
const lastCopied = ref('');

// Calculate relative luminance for WCAG contrast
const getLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const getContrastRatio = (color1: string, color2: string): number => {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const isLightColor = (hex: string): boolean => {
  return getLuminance(hex) > 0.5;
};

const contrastWhite = computed(() => {
  if (!selectedColor.value) return 0;
  return getContrastRatio(selectedColor.value.value, '#ffffff');
});

const contrastBlack = computed(() => {
  if (!selectedColor.value) return 0;
  return getContrastRatio(selectedColor.value.value, '#000000');
});

const getContrastClass = (ratio: number): string => {
  if (ratio >= 7) return 'token-picker__contrast-badge--aaa';
  if (ratio >= 4.5) return 'token-picker__contrast-badge--aa';
  if (ratio >= 3) return 'token-picker__contrast-badge--aa-large';
  return 'token-picker__contrast-badge--fail';
};

const getContrastLabel = (ratio: number): string => {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
};

const selectColor = (color: ColorToken) => {
  selectedColor.value = color;
};

const copyToken = async () => {
  if (!selectedColor.value) return;

  try {
    await navigator.clipboard.writeText(`var(${selectedColor.value.token})`);
    copied.value = true;
    lastCopied.value = selectedColor.value.token;
    showToast.value = true;

    setTimeout(() => {
      copied.value = false;
    }, 2000);

    setTimeout(() => {
      showToast.value = false;
    }, 3000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
</script>

<style scoped>
.token-picker {
  font-family: 'Rubik', system-ui, sans-serif;
  position: relative;
}

.token-picker__header {
  margin-bottom: 1.5rem;
}

.token-picker__title {
  font-family: 'Red Hat Display', system-ui, sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-heading, #0f172a);
  margin: 0 0 0.25rem;
}

.token-picker__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted, #94a3b8);
  margin: 0;
}

.token-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.token-picker__swatch {
  aspect-ratio: 1;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.75rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.token-picker__swatch--light {
  color: #0f172a;
  text-shadow: none;
}

.token-picker__swatch:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.token-picker__swatch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary, #4f46e5);
}

.token-picker__swatch-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.token-picker__swatch-value {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.625rem;
  opacity: 0.8;
}

.token-picker__details {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e6e8eb);
  border-radius: 16px;
}

.token-picker__selected {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.token-picker__selected-preview {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.token-picker__selected-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.token-picker__selected-name {
  font-family: 'Red Hat Display', sans-serif;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-heading, #0f172a);
  text-transform: capitalize;
}

.token-picker__selected-token {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.8125rem;
  color: var(--color-primary, #4f46e5);
  background: var(--color-surface-secondary, #f8fafc);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
  margin: 0.25rem 0;
}

.token-picker__selected-value {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.75rem;
  color: var(--color-text-muted, #94a3b8);
}

.token-picker__contrast {
  margin-bottom: 1.5rem;
}

.token-picker__contrast-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #94a3b8);
  margin: 0 0 0.75rem;
}

.token-picker__contrast-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.token-picker__contrast-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.token-picker__contrast-preview {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
}

.token-picker__contrast-ratio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.token-picker__contrast-value {
  font-family: 'SF Mono', 'Monaco', monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-heading, #0f172a);
}

.token-picker__contrast-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.token-picker__contrast-badge--aaa {
  background: #dcfce7;
  color: #166534;
}

.token-picker__contrast-badge--aa {
  background: #d1fae5;
  color: #047857;
}

.token-picker__contrast-badge--aa-large {
  background: #fef3c7;
  color: #92400e;
}

.token-picker__contrast-badge--fail {
  background: #fee2e2;
  color: #dc2626;
}

.token-picker__copy {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--color-primary, #4f46e5);
  color: white;
  border: none;
  border-radius: 9999px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.token-picker__copy:hover {
  background: var(--color-primary-dark, #4338ca);
}

.token-picker__copy:active {
  transform: scale(0.98);
}

.token-picker__copy-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #22c55e;
}

.token-picker__toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: #0f172a;
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 1000;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.token-picker__toast svg {
  color: #22c55e;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* Dark mode support */
.dark .token-picker,
:global([data-theme="dark"]) .token-picker {
  color: #f1f5f9;
}

.dark .token-picker__title,
:global([data-theme="dark"]) .token-picker__title {
  color: #f1f5f9;
}

.dark .token-picker__subtitle,
:global([data-theme="dark"]) .token-picker__subtitle {
  color: #64748b;
}

.dark .token-picker__details,
:global([data-theme="dark"]) .token-picker__details {
  background: #1e293b;
  border-color: #334155;
}

.dark .token-picker__selected-name,
:global([data-theme="dark"]) .token-picker__selected-name {
  color: #f1f5f9;
}

.dark .token-picker__selected-token,
:global([data-theme="dark"]) .token-picker__selected-token {
  background: #0f172a;
  color: #818cf8;
}

.dark .token-picker__selected-value,
:global([data-theme="dark"]) .token-picker__selected-value {
  color: #64748b;
}

.dark .token-picker__contrast-title,
:global([data-theme="dark"]) .token-picker__contrast-title {
  color: #64748b;
}

.dark .token-picker__contrast-value,
:global([data-theme="dark"]) .token-picker__contrast-value {
  color: #f1f5f9;
}

.dark .token-picker__contrast-badge--aaa,
:global([data-theme="dark"]) .token-picker__contrast-badge--aaa {
  background: #052e16;
  color: #4ade80;
}

.dark .token-picker__contrast-badge--aa,
:global([data-theme="dark"]) .token-picker__contrast-badge--aa {
  background: #064e3b;
  color: #34d399;
}

.dark .token-picker__contrast-badge--aa-large,
:global([data-theme="dark"]) .token-picker__contrast-badge--aa-large {
  background: #422006;
  color: #fbbf24;
}

.dark .token-picker__contrast-badge--fail,
:global([data-theme="dark"]) .token-picker__contrast-badge--fail {
  background: #450a0a;
  color: #f87171;
}

.dark .token-picker__copy,
:global([data-theme="dark"]) .token-picker__copy {
  background: #6366f1;
}

.dark .token-picker__copy:hover,
:global([data-theme="dark"]) .token-picker__copy:hover {
  background: #4f46e5;
}

.dark .token-picker__toast,
:global([data-theme="dark"]) .token-picker__toast {
  background: #f1f5f9;
  color: #0f172a;
}
</style>
