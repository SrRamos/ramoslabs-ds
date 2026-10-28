// @ts-check
// `bun run voiceover:switch`: prints the generated VoiceOver protocol for SJSwitch (W1-505 hook).
import { renderMarkdown, renderVoiceOverPack } from './voiceover.js';

process.stdout.write(renderMarkdown(renderVoiceOverPack()));
