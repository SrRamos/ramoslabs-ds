// @ts-check
// `bun run voiceover:checkbox`: prints the generated VoiceOver protocol for SJCheckbox (W1-505 hook).
import { renderMarkdown, renderVoiceOverPack } from './voiceover.js';

process.stdout.write(renderMarkdown(renderVoiceOverPack()));
