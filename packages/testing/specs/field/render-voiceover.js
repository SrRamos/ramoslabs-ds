// @ts-check
// `bun run voiceover:field`: prints the generated VoiceOver protocol for SJField, SJInput and SJForm (W1-505 hook).
import { renderMarkdown, renderVoiceOverPack } from './voiceover.js';

process.stdout.write(renderMarkdown(renderVoiceOverPack()));
