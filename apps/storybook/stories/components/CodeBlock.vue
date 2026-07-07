<template>
  <div class="code-block">
    <div class="code-block__header">
      <span class="code-block__lang">{{ language }}</span>
      <button
        class="code-block__copy"
        @click="copyToClipboard"
        :aria-label="copied ? 'Copied!' : 'Copy code'"
      >
        <span v-if="copied" class="code-block__copied">
          <span class="sj-icon sj-icon--sm">check</span>
          Copied!
        </span>
        <span v-else class="code-block__copy-text">
          <span class="sj-icon sj-icon--sm">content_copy</span>
          Copy
        </span>
      </button>
    </div>
    <pre class="code-block__pre"><code
      class="code-block__code"
      v-html="sanitize(highlightedCode || code)"
    ></code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const sanitize = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');

type Props = {
  code: string;
  language?: string;
  highlightedCode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: 'css',
  highlightedCode: ''
});

const copied = ref(false);

const copyToClipboard = async () => {
  try {
    // Strip HTML tags for copying plain text
    const plainCode = props.code.replace(/<[^>]*>/g, '');
    await navigator.clipboard.writeText(plainCode);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};
</script>

<style scoped>
.code-block {
  background: #1e293b;
  border-radius: 12px;
  overflow: hidden;
  margin: 1rem 0;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
}

.code-block__header {
  background: #334155;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #475569;
}

.code-block__lang {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.code-block__copy {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid #475569;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.code-block__copy:hover {
  background: #475569;
  color: #e2e8f0;
  border-color: #64748b;
}

.code-block__copy:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.4);
}

.code-block__copied {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #22c55e;
}

.code-block__copy-text {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.code-block__pre {
  margin: 0;
  padding: 1.25rem;
  overflow-x: auto;
}

.code-block__code {
  font-size: 0.8125rem;
  line-height: 1.7;
  color: #e2e8f0;
  white-space: pre;
}

/* Syntax highlighting classes */
:deep(.comment) { color: #64748b; font-style: italic; }
:deep(.selector) { color: #fbbf24; }
:deep(.property) { color: #7dd3fc; }
:deep(.value) { color: #a5f3fc; }
:deep(.punctuation) { color: #94a3b8; }
:deep(.keyword) { color: #c084fc; }
:deep(.string) { color: #86efac; }
:deep(.function) { color: #f472b6; }
:deep(.number) { color: #fb923c; }
</style>
