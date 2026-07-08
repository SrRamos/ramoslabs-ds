---
id: voice-tone
title: Voice & Tone
group: patterns
storybookTitle: Patterns/Voice & Tone
summary: One constant brand voice, tone that adapts to context, three unbending voice principles, a microcopy library, tone by context, the error-writing framing rule, and the copy ethics prohibitions
---

Every label, empty state, and error is the product talking, and the words are the design, not a coat applied after. The voice never changes. The tone bends to the moment: warm at a win, calm at a break, plain when it counts.

Doctrine:

- The UI is a conversation. Content is a design material, weighed like spacing and color, not poured in last.
- Read before it is read. People scan, they do not study. Front-load the point, cut the dead words.
- Respect on the worst day. The tone that matters most is the one for when something breaks. No blame, no jargon, no dead ends.

## Voice Is Constant, Tone Adapts

Voice is who the product is: one personality that never shifts. Tone is how that voice modulates for the situation.

Voice, constant: set once, held everywhere. Redact the logo and you should still know it is us.
- Clear before clever, always.
- Human, not corporate or robotic.
- Honest, never hype.
- Plain enough for a nine-year-old.

Tone, variable: the dial the voice turns for context.
- Success: brief and glad, then gone.
- Error: calm, specific, pointed at the fix.
- Destructive: slow, plain, no cheer.
- Onboarding: encouraging, never flooding.

Where our voice sits on each dial (NN/g's four dimensions):
- Funny to Serious: serious, with warmth. Wit only when it never costs a second of comprehension.
- Formal to Casual: casual, but clear. Say "you" and "we", use contractions, skip ceremony. Casual is not sloppy; it is plain.
- Respectful to Irreverent: respectful. Never at the user's expense. No sarcasm in errors, no jokes where they are stuck.
- Enthusiastic to Matter-of-fact: measured, warm at wins. Mostly matter-of-fact so the interface stays quiet; enthusiasm saved for real moments.

## Three Principles That Never Bend

**1. Clarity Over Creativity.** A clever line that makes someone stop to decode it has already failed. Write for scanning: outcome first, cut every word that does not change what they do, plain term over the impressive one. Label versus joke, the label wins. In practice: headline the result ("Saved", not "Your changes were successfully saved"), name buttons for what they do ("Delete event", not "Confirm"), and drop filler like "please", "simply", and "in order to".

**2. Human, Not Robotic.** Machine copy hides in the passive voice and the system's point of view: "an error occurred". Human copy says "you" and "we", takes responsibility, and prefers the active voice. Warmth comes from plainness, not exclamation marks. The test: read the line aloud. If no real person would say it to another across a desk, rewrite it.

**3. Honest, Never Hype.** Every number, claim, and countdown on screen must be literally true. No inflation ("the best", "in seconds"), no manufactured urgency, no cost buried in a cheerful phrase. Honesty is completeness too: say what will happen before someone commits, above all when it spends money, shares data, or cannot be undone. This runs into Patterns / Persuasion.

## Microcopy, Pattern by Pattern

Buttons and calls to action. A button names its own action, so the label reads as a promise. Verb plus object beats a vague "Submit".
- ✓ Recommended: "Create event" (names the exact outcome), "Delete event" (a destructive action says so), "Save changes" (verb plus object), "Send invites" (the user knows what leaves and to whom).
- ✕ Avoid: "Submit" (submit what, to where?), "Confirm" (on a delete dialog, hides the consequence), "OK" (agrees to nothing in particular), "Click here" (describes the mechanic, not the result).

Labels and hints. A label says what the field is; a hint removes doubt before the user types.
- ✓ Recommended: "Work email" (specific), "Doors open at" (plain label with an example time), "We will only use this to send your tickets." (answers the unspoken why).
- ✕ Avoid: "Email *" (which email, and why?), "Time" (of what?), "Enter valid input" (nothing to act on).

Empty states. Not a dead end; the first step. Say what will be here, then hand over the one action that fills it.
- ✓ Recommended: "No events yet. Create your first one to get started.", "Nothing matches 'jazz'. Try a broader search."
- ✕ Avoid: "Your story starts now." (tells the user nothing to do), "No results found." (a dead end).

Errors. One job: get the user unstuck. Say what happened in their words, drop the blame and codes, point at the fix.
- ✓ Recommended: "That email is missing an @. Check and try again.", "This card was declined. Try another card or contact your bank."
- ✕ Avoid: "Invalid input." (nothing to act on), "Error 402: transaction failed." (a code and blame, no path out).

Confirmations. Confirm in the fewest words that close the loop. State what happened and, if there is one, the next thing the user might want.
- ✓ Recommended: "Event created. It is now visible to your audience.", "Invites sent to 12 people."
- ✕ Avoid: "Success!" (at what?), "Your request has been processed." (robotic and vague).

## Tone by Context

One voice, four registers. The words stay plain throughout; only the temperature changes. The register is set by how the user feels arriving, not how the team feels shipping.

- Success (brief, warm, then gone): "Event created. It is live for your audience now." Acknowledge the win, name the result, step aside. Confirm, do not celebrate at length.
- Error (calm, specific, fixable): "This card was declined. Try another card or contact your bank." No exclamation, no blame, no code. The tone that reassures is a clear path out.
- Destructive (slow, plain, no cheer): "Delete this event? Its 240 tickets will be cancelled. This cannot be undone." Slow the user with facts, not fear. Label the button "Delete event", not "Confirm". Never cheerful, never coy.
- Onboarding (encouraging, unhurried): "Let us set up your first event. It takes about two minutes." One step at a time, honest about effort. Invite; do not flood.

## Writing Errors People Can Act On

**The Framing Rule.** A good error message answers three questions in the user's words: what happened, why (if it helps), and how to fix it. Everything else (blame, apology theatre, codes, jargon) is noise.

1. What happened: name the problem in plain words, from the user's side. "This card was declined", not "Gateway returned 402".
2. Why, if it helps: add a reason only when it guides the fix. "The file is over the 10 MB limit" earns its place; a stack trace does not.
3. How to fix it: hand back a next step, ideally more than one. "Try another card or contact your bank." Never leave the user at a wall.

The field, the error border, and `var(--color-error)` live in Patterns / Form Elements. Voice owns the words, Form Elements owns the field.

## Copy Has Ethics

Words persuade, so words can manipulate. This system draws the line in the copy itself: no dark patterns, no false urgency, no shame. A phrase that only works because the user is rushed, confused, or embarrassed is banned, not discouraged. Technique-by-technique treatment is in Patterns / Persuasion.

- No false urgency: no invented countdowns, no "only 2 left" the data cannot back, no fake "selling fast". Urgency stated only when literally true.
- No confirmshaming: the decline option is neutral. "No thanks" is a valid answer, never "No, I like paying full price".
- No hidden cost: every charge, fee, and commitment is named before the user agrees, in the same breath as the benefit.
- No dark patterns: copy never works by being missed. If a line only lands because the user did not read it closely, it is manipulation and it is out.

## Rules of the Voice

**Rule:** Lead with the outcome; put the point in the first three words.
**Why:** people scan before they study, so a clever line that must be decoded has already failed.

**Rule:** Name every action button with a verb and its object.
**Why:** "Submit", "Confirm", and "OK" hide what happens next; "Delete event" reads as a promise.

**Rule:** Write in the active voice and speak to the reader as "you".
**Why:** the passive voice and the system's point of view sound like a machine, not a person.

**Rule:** Keep every line plain enough to read at a glance.
**Why:** jargon and filler like "please", "simply", and "in order to" cost comprehension and add nothing.

**Rule:** In an error, say what happened and how to fix it.
**Why:** "An error occurred" or a raw code leaves the reader stuck at a wall.

**Rule:** Match the register to the reader's moment, not the team's.
**Why:** cheer on a destructive step, or a buried consequence, breaks trust exactly where it counts.

**Rule:** Keep every number and claim literally true.
**Why:** invented urgency, a shamed decline, or a hidden cost is manipulation, and it stays out.

## Before You Ship a Line

1. Can the user act on it at a glance? If the outcome is not clear in the first few words, rewrite it leading with the result.
2. Would a real person say this out loud? Read it aloud. If it sounds like a machine or a form, make it human, active, and personal.
3. Does the register fit the moment? Warm at a win, calm at an error, plain and cheerless at a destructive step.
4. Is every word true and free of pressure? No invented urgency, no shame, no hidden cost. In doubt, see Patterns / Persuasion.
5. Only now, ship it, in the DS primitives. See Patterns / Form Elements.

## Sources

Mailchimp Content Style Guide, "Voice and Tone": one voice, many tones. Nielsen Norman Group, "The Four Dimensions of Tone of Voice": funny-serious, formal-casual, respectful-irreverent, enthusiastic-matter-of-fact. NN/g reading behavior: "How Users Read on the Web" and "Concise, SCANNABLE, and Objective". NN/g microcopy: "The 3 Cs of Microcopy" and "Error-Message Guidelines". Nielsen's 10 Usability Heuristics (H9). GOV.UK writing standards (plain English, front-load, active voice, reading-age-of-9). U.S. plain language guidance. Shopify Polaris content guidelines. Deceptive patterns: Brignull's deceptive.design and NN/g's "Deceptive Patterns". The four-dial positions and the framing of copy ethics as hard prohibitions are house doctrine.
