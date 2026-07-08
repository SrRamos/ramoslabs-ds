---
id: persuasion
title: Persuasion
group: patterns
storybookTitle: Patterns/Persuasion
summary: The standing six UX persuasion principles (smart defaults, endowed progress, reciprocity, IKEA/endowment, loss aversion, contrast) each gated by a hard truth-and-reversibility line, with dark patterns banned
---

Behavioral design works, which is why it needs a limit. Six principles, each drawn to move a person toward something they already want, each gated by a hard line: honest persuasion that serves the user, never a dark pattern that extracts against them. The test: if a technique only works while the user does not notice it, it does not ship.

The doctrine:

- **Serve the user's goal.** A technique earns its place only when it moves a person toward an outcome they already want.
- **Nothing hidden.** Reversible, transparent, true. A default is a starting point the user can change. A number on screen matches reality.
- **Dark patterns are banned.** Fake scarcity, false countdowns, confirmshaming, inflated anchors. Prohibited in this system, not merely discouraged.

## 1. Smart Defaults

A smart default pre-selects the sensible choice so the path of least resistance is also the good path, always visible and one tap to change.

**Rule:** Pre-select the choice the data already points to, and style it so it plainly reads as changeable.
**Why:** the path of least resistance becomes the good path while the user keeps a one-tap way out.

Evidence: defaults are the strongest lever in choice architecture. Switching organ donation from opt-in to opt-out swings participation from single digits to over 90 percent, everything else held constant (Johnson & Goldstein, Science 2003).

In a RamosLabs product: pre-fill the field the way the data already points, and style the pre-filled state so it reads as changeable, never locked. See Patterns / Form Elements for the input primitives.

- ✓ Recommended: default to the option a typical user would pick anyway, labelled and one tap to change. The default saves effort on a choice the user still owns.
- ✕ Avoid: pre-checking a paid add-on or a marketing opt-in the user never asked for. Preselection is banned wherever it costs money or privacy.

## 2. Endowed Progress

Open a progress bar at a true, non-zero point, counting real work already behind the user, and the end feels reachable. The rule is not to inflate the number, it is to count only what actually happened.

**Rule:** Open a progress indicator at a true, non-zero point that credits only work the user actually did.
**Why:** a real head start makes the finish feel reachable and pulls the user forward.

Evidence: a car-wash card pre-credited two of ten stamps was completed far more often than a blank card needing the same eight washes (34 versus 19 percent) (Nunes & Dreze, J. Consumer Research 2006).

In a RamosLabs product: open a multi-step flow with the first step already credited when the user genuinely did something (arrived with an account, verified an email). The fill uses `--color-primary` on a `--color-border` track. See Patterns / Interactive.

- ✓ Recommended: credit steps the user truly completed and show how near the finish is. The head start is real, and the destination is one the user chose.
- ✕ Avoid: a "90 percent complete" bar that only fills once payment is handed over, or invented steps that manufacture sunk cost. Progress that does not reflect real progress is a lie with a nice animation.

## 3. Reciprocity

Deliver something genuinely useful first, then make a fair ask, and it lands on willing ground. The value stays whether or not they say yes.

**Rule:** Deliver a genuinely useful result first, then make a fair ask the user is free to decline.
**Why:** value given up front lands the request on willing ground and keeps its worth either way.

Evidence: an unsolicited favor creates a felt obligation to return it. In Regan's experiment, people given a small unrequested gift later agreed to a larger request far more often than a control group (Regan 1971; Cialdini 1984).

In a RamosLabs product: let the product prove itself before it asks. Return a real result, then invite the user to save it. The request comes after the gift, never as a toll gate in front of it.

- ✓ Recommended: give a genuinely useful result up front, then ask to save or continue. The gift keeps its value even if the user declines.
- ✕ Avoid: a hollow "free" gift that is really a hook, or a preview that vanishes unless you pay. If the value evaporates the moment the user hesitates, it was bait.

## 4. The IKEA and Endowment Effect

We value what we build and own more than the identical thing untouched. Let a person name a project or arrange a layout and it becomes theirs in their mind before it is theirs in fact, so signing up feels like keeping something they already have.

**Rule:** Let the user personalize real work before any gate, then carry that work intact through sign-up.
**Why:** people value what they build, so keeping their own work feels like keeping something they own.

Evidence: labor and ownership both inflate perceived value. People price self-assembled goods above identical ready-made ones (the IKEA effect), and owners demand more to give up an object than others will pay for it (the endowment effect) (Norton, Mochon & Ariely 2012; Kahneman, Knetsch & Thaler 1990).

In a RamosLabs product: let the user personalize before the gate, then carry that work intact through sign-up so nothing they made is lost. Investment they chose to make is legitimate; investment tricked out of them is not.

- ✓ Recommended: offer real customization the user wants, and carry their work across the sign-up boundary intact. They keep exactly what they built.
- ✕ Avoid: forcing busywork to manufacture sunk cost, then holding the user's own work hostage behind a paywall. Effort must never become a hostage.

## 5. Loss Aversion (Contested)

A loss tends to weigh heavier than an equivalent gain, so framing a choice around what a person stands to lose can sharpen attention. Use it only where a real loss exists: an unsaved draft, an earned credit about to expire. Never invent one.

**Rule:** Frame a choice around loss only where a real, preventable loss exists, and pair the warning with the fix.
**Why:** a true loss sharpens attention honestly, while an invented one is manufactured fear.

Evidence: losses loom larger than gains. Prospect theory formalized it: the value function is steeper for losses than for equal-sized gains. The size of that asymmetry is actively debated (Kahneman & Tversky 1979; Gal & Rucker 2018).

In a RamosLabs product: name the real thing at risk, plainly, and pair the warning with an easy way to prevent the loss. No invented deadlines, no fake stock counters. Example: "You have 3 unsaved sections. Create a free account to keep them, or they clear when this tab closes."

- ✓ Recommended: remind the user of value that truly exists and truly could be lost, with a clear way to keep it. The loss is real and preventable.
- ✕ Avoid: fake "only 2 left" counters, invented countdowns, or confirmshaming ("No thanks, I like overpaying"). Manufactured fear is the sharpest dark pattern of all, and it is banned.

## 6. Contrast Effect

A number means little in isolation. Beside a true reference (a real list price, a genuine alternative, or the value it returns) the same cost reads as proportionate. Anchor only on a reference the user could verify.

**Rule:** Show every price beside a reference the user could independently verify.
**Why:** a number reads as proportionate next to a true comparison, and every figure on screen stays checkable.

Evidence: judgments latch onto whatever reference is offered. An anchor pulls numeric estimates toward it even when people know it is arbitrary, and it shifts what they will actually pay (Tversky & Kahneman 1974; Ariely, Loewenstein & Prelec 2003).

In a RamosLabs product: never show a price bare. Set it beside a genuine reference on a `--color-surface-secondary` card, with the offer on a `--color-primary` bordered card. Let the comparison inform, not corner.

- ✓ Recommended: contextualize a price against a true reference: a real alternative cost, a genuine higher tier, or the value returned. Every number on screen is one the user could verify.
- ✕ Avoid: a struck-through "original" that never sold, or a fake premium tier built only to make the real one look cheap. A reference the user cannot verify is a lie.

## The Line: Persuasion or Manipulation

The mechanics are identical on both sides of the line. What separates honest persuasion from a dark pattern is whose goal it serves and what it hides. Brignull coined "dark patterns" in 2010 for interfaces built to trick people. This system treats that catalogue as a list of prohibitions.

- Whose goal: honest persuasion advances a goal the user already holds. Manipulation advances the business at the user's expense.
- Awareness: if it only works because the user does not notice, it is manipulation. Honest nudges survive being pointed out.
- Reversibility: a default they can change, a step they can skip, a choice they can undo. Traps that are hard to escape are out.
- Truth: every scarcity claim, countdown, progress figure, and reference price is literally true. No inventions.

## Before You Ship a Persuasive Element

1. Whose goal does this serve? If it advances the business against what the user wants, it does not ship.
2. Is every claim literally true? The scarcity, the countdown, the progress number, the reference price. If any is invented, stop.
3. Would it survive being pointed out? Imagine the user seeing exactly how it works. If that kills the effect, it was manipulation. Remove it.
4. Can the user reverse it? A default they can change, a step they can skip, a choice they can undo. If not, make it so or drop it.

## Notes and Sources

1. Smart defaults: the mechanism is effort-avoidance and status-quo bias, not "decision fatigue" (the ego-depletion account failed a large multi-lab replication, Hagger et al. 2016). Leave a default unset where there is no majority choice or the stakes are personal. Johnson & Goldstein, Science 302 (2003); Thaler & Sunstein, Nudge (2008); NN/g form design.
2. Endowed progress: the lift depends on an honest reason for the head start. Count only real progress. Hull (1932); Kivetz, Urminsky & Zheng, JMR 43 (2006); Nunes & Dreze, J. Consumer Research 32 (2006).
3. Reciprocity: Regan's effect is established for offline, interpersonal compliance; "value-first content raises product sign-ups" is a reasonable but untested extrapolation. Cialdini, Influence (1984); Regan, J. Experimental Social Psychology 7 (1971).
4. IKEA and endowment: the effect needs successful completion; unfinished or trivially easy building does not raise valuation. Norton, Mochon & Ariely, J. Consumer Psychology 22 (2012); Kahneman, Knetsch & Thaler, J. Political Economy 98 (1990).
5. Loss aversion (contested): treat it as real but bounded. Gal & Rucker (2018) argue the asymmetry is weaker and context-dependent; Simonson (2018) defends a contingent version. Kahneman & Tversky, Econometrica 47 (1979); Gal & Rucker, J. Consumer Psychology 28 (2018).
6. Contrast and anchoring: the reference must be true; a comparison price never charged crosses into deception and, in many markets, unlawful pricing. Tversky & Kahneman, Science 185 (1974); Ariely, Loewenstein & Prelec, Q. J. Economics 118 (2003).
- Dark patterns: Brignull originated the term (deceptive.design); Gray et al. formalized the taxonomy (CHI 2018); NN/g tracks it as deceptive patterns. The strict truth-and-reversibility gate around each technique is this system's house doctrine.
