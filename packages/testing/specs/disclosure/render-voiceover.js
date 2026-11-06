// @ts-check
// `bun run voiceover:disclosure`: prints the generated VoiceOver protocol for SJDisclosure (W1-505 hook).
import { renderMarkdown, renderVoiceOverPack } from './voiceover.js';

process.stdout.write(renderMarkdown(renderVoiceOverPack()));
