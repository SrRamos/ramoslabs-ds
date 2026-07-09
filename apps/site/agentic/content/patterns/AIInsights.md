---
id: ai-insights
title: AI Content
group: patterns
storybookTitle: Patterns/AI Content
summary: The AI-content pattern: label generated output, communicate uncertainty, show generation states, keep a human in the loop, plan for wrong answers, one-tap feedback, and data disclosure, under a disclosed-bounded-checkable-reversible contract
---

A model can write, summarize, and suggest in seconds, and it can be confidently wrong just as fast. Show plainly what a machine produced, how sure it is, and where it came from, then keep a person in the loop before anything acts. The goal is not to hide the AI. It is to make its output legible, checkable, and reversible.

Doctrine:

- Disclosed, never disguised. Anything a model generated carries a visible marker. A person always knows when they are reading a machine.
- Honest about certainty. Output is framed as a draft or an estimate, not a verdict. Confidence, sources, and the option to verify travel with the text.
- Human holds the last word. The person reviews, edits, and approves before the result acts. Every action the AI proposes is one the user can undo.

## 1. Label What the Machine Made

People calibrate trust by source. Text that looks like a fact, a human note, or a system rule earns a trust the model has not earned.

**Rule:** Attach a visible, consistent marker to every piece of AI-generated content, at the point where it is read.
**Why:** users judge trust by source, so an unlabeled draft borrows credibility it has not earned.

Evidence: set expectations up front. Microsoft's first two Human-AI guidelines put "make clear what the system can do" (G1) and "make clear how well" (G2) at the very start of an interaction.

In a RamosLabs product: use one badge everywhere, a sparkle glyph plus a word like "Generated," on `--color-primary-surface` with a `--color-primary` label. Icon and text together, never color alone, so the marker survives grayscale and screen readers.

- ✓ Recommended: badge every generated block with the same icon-plus-text marker, inline where it is read. A person always knows the source before they act on it.
- ✕ Avoid: slipping generated text into the same style as human or factual content, or burying the disclosure in a tooltip. Unlabeled AI reads as ground truth, a trust the model has not earned.

## 2. Communicate Uncertainty

A model returns a most-likely answer, not a certain one, yet fluent prose reads as authority. Carry a signal of confidence with the output, and word it as an estimate. "Projected," "suggested," and "likely" tell the truth. "The answer is" does not.

**Rule:** Pair generated output with a confidence signal and estimate-framed wording that flags it as provisional.
**Why:** fluent text reads as certain, so without a visible cue users over-trust a guess.

Evidence: Google's People + AI Guidebook devotes its Explainability and Trust chapter to showing confidence honestly, warning that a poorly framed number can mislead as much as no number at all.

In a RamosLabs product: show confidence as a stepped meter plus a word, differentiated by fill count and label, not by hue. Three levels: high, medium, limited. When confidence is low, say so and point to what would raise it.

- ✓ Recommended: frame output as an estimate and show how firm it is, in words and a meter. The reader sees both the answer and how far to trust it.
- ✕ Avoid: stating a guess as flat fact, or a precise 87.34 percent score that implies a rigor the model does not have. False precision is just a prettier form of overconfidence.

## 3. Show the Work in Progress

Generation takes time and does not always land. Stream the answer as it forms so the wait feels alive, and keep the user in command: a stop while it runs, a regenerate when it misses. A spinner that cannot be cancelled is a trap.

**Rule:** Stream output as it generates and give a stop control while it runs and a regenerate after it finishes.
**Why:** visible progress keeps a slow response tolerable, and control over it keeps the user in charge.

Evidence: Microsoft's guidelines call for easy dismissal (G8) and correction (G9); Apple frames on-device generation as something people should be able to interrupt and rerun.

In a RamosLabs product: while tokens stream, show them arriving with a caret and swap the primary action to Stop. When done, offer Regenerate and Copy. Never leave a bare, uncancellable spinner.

- ✓ Recommended: stream the response, expose Stop while running, and Regenerate plus Copy when done. The user drives the generation.
- ✕ Avoid: a modal spinner that blocks the screen with no way out, or a single answer the user cannot rerun. Removing control over a slow, fallible process turns waiting into helplessness.

## 4. Keep a Human in the Loop

The model proposes; the person disposes. Between a generated result and any real-world effect, insert a step to review, edit, and approve. Match the friction to the stakes: a draft email can auto-fill, but sending it, spending money, or deleting data waits for a human yes, and stays reversible.

**Rule:** Route consequential AI output through a human review-edit-approve step, and keep the resulting action reversible.
**Why:** the person carries the consequences, so they, not the model, make the final call.

Evidence: Apple advises giving people a chance to review and revise machine output before acting on it, and Google's guidebook ties the level of automation to the cost of a mistake.

In a RamosLabs product: present generated output as an editable draft, not a done deed. The primary action is Approve, editing is always open, and once applied the change can be undone. See Patterns / Persuasion on reversibility as a hard line.

- ✓ Recommended: hold consequential output at an editable review step, then let the applied result be undone. The human approves, and can always walk it back.
- ✕ Avoid: auto-sending, auto-charging, or auto-deleting on the model's word, with no review and no undo. Irreversible action on an unverified guess hands the user the blame for the model's mistake.

## 5. Plan for Wrong Answers

A model will state a falsehood with the same confidence as a fact. Cite the source so a claim can be checked, make correction a first-class action, and when the system cannot answer well, say so plainly instead of inventing. Graceful failure beats a confident fabrication.

**Rule:** Attach checkable sources to factual claims, offer a correction path, and degrade to an honest "I do not know" over a guess.
**Why:** models hallucinate fluently, so users need a way to verify, fix, and recognize the system's limits.

Evidence: Google's People + AI Guidebook has a full Errors and Graceful Failure chapter; Microsoft's G9 calls for supporting efficient correction; NN/g documents that citing sources and enabling verification is what makes AI answers trustworthy.

In a RamosLabs product: show the sources a claim rests on as chips the user can open. Offer Report and Suggest a fix on every answer. When the system is unsure, it says so rather than filling the gap with a plausible invention.

- ✓ Recommended: cite sources, let users correct or report, and admit uncertainty when the answer is thin. Every claim is checkable, and every miss is fixable.
- ✕ Avoid: sourceless assertions, no way to flag a wrong answer, or a confident fabrication where "I could not find that" was the honest reply. An unverifiable, uncorrectable answer is a liability wearing the mask of help.

## 6. Make Feedback One Tap Away

The model improves only when it hears where it failed, and users trust a system more when their signal is welcome. Put a lightweight rating on every answer, thumbs up or down, with a quiet path to report something harmful. Ask, acknowledge, and never nag.

**Rule:** Offer a one-tap rating and a report path on every generated answer, and acknowledge the input without nagging.
**Why:** cheap-to-give feedback improves the system and signals that the user's judgment counts.

Evidence: Microsoft's guidelines G12 and G15 to G17 cover remembering, learning from, and updating on user feedback; Google's guidebook makes feedback and control a core chapter.

In a RamosLabs product: sit thumbs and a report flag in the answer footer, low-key until hovered. A tap confirms with a quiet "Thanks, noted," never a modal. Optional detail on a down-vote, never required.

- ✓ Recommended: a quiet thumbs pair and report flag, a one-line acknowledgement, optional extra detail. Giving feedback costs the user a single tap.
- ✕ Avoid: a mandatory survey after every answer, or thumbs that vanish into a void with no sign they landed. Feedback the user cannot see received is feedback they stop giving.

## 7. Say What Happens to the Data

People share more with a system they understand. Before an input reaches a model, state what is sent, where it goes, and whether it trains anything, in plain words at the moment of entry. A disclaimer is not fine print. It is a promise placed where the user can act on it.

**Rule:** Disclose what data the feature sends, where it goes, and whether it trains a model, in plain language at the point of input.
**Why:** informed consent needs the facts before the send, not buried in a policy read by no one.

Evidence: Google's People + AI Guidebook dedicates a Data Collection chapter to responsible, consented data use, and Apple's guidance stresses being clear and up front about how personal data feeds machine-learning features.

In a RamosLabs product: a one-line disclaimer sits beside the AI input, in muted `--color-text-body` that still clears AA contrast. It names the boundary in words a person can act on, with a link to the detail. Example: "Your text is sent to our AI provider to generate this draft. It is not used to train their models, and it is deleted after processing. Read how we handle AI data."

- ✓ Recommended: name what leaves the device and what happens to it, in plain words at the input. The user consents knowing the facts, before anything is sent.
- ✕ Avoid: hiding data use in a linked policy, or quietly training on user content without a clear, visible say. Consent extracted through omission is not consent.

## The Contract With the User

Every generated pixel makes an implicit promise about what it is and how far to trust it. Honest AI content keeps that promise: it is disclosed, bounded, checkable, and reversible. The moment output pretends to be more certain, more human, or more final than it is, the interface has started to deceive on the model's behalf.

- Disclosed: generated content is marked as generated. No one mistakes a machine's draft for a human's word or a settled fact.
- Bounded: output states its confidence and its limits. An estimate is called an estimate; an unknown is admitted, not invented.
- Checkable: claims carry sources and a way to verify or correct them. Nothing important rests on the user's blind faith.
- Reversible: a human approves before anything acts, and can undo it after. The model never gets an irreversible last word.

## Before You Ship AI-Generated Content

1. Is it labeled as generated? A visible, consistent marker sits where the content is read.
2. Does it show its confidence and limits? Output is framed as an estimate, with a signal of how firm it is.
3. Can the user verify and correct it? Sources are checkable, a wrong answer can be reported or fixed, and the system admits when it does not know.
4. Does a human approve before it acts, and can they undo it? Consequential actions wait for a human yes and stay reversible.
5. Is the user told what happens to their data? What is sent, where it goes, and whether it trains anything is stated in plain words at the input.

## Notes and Sources

Google People + AI Guidebook (PAIR): Mental Models, Explainability + Trust, Errors + Graceful Failure, Feedback + Controls, Data Collection + Evaluation. Microsoft HAX, Guidelines for Human-AI Interaction (Amershi et al., CHI 2019): G1, G2, G9, G11, G17. Apple Human Interface Guidelines: Generative AI and Machine learning. Nielsen Norman Group: AI Hallucinations (citing sources, first-person uncertainty), Explainable AI in Chat Interfaces (disclaimer placement near the input), AI Chatbot design guidelines (streaming). House doctrine: the strict disclose, bound, verify, and reverse gate around each pattern, and the mono-indigo, icon-plus-text treatment of every state. Confidence is shown by fill and label, never hue alone, to satisfy WCAG 2.1 SC 1.4.1 Use of Color.
