# Tooltip

## Recommended variant

Use `role="tooltip"` only for short noninteractive supplemental text referenced by the trigger's `aria-describedby`; show on focus and hover, keep focus on the trigger, and dismiss on Escape. Touch gets persistent text or an explicit disclosure. APG supplies the contract but labels it **work in progress without task-force consensus** ([APG, retrieved 2026-10-27](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).

## Measured evidence and alternatives

ARIA-AT has no tooltip report in the verified candidate set. The JSON therefore cites Command Button reports only as **trigger-semantics** observations and explicitly says they do not measure tooltip speech ([ARIA-AT Command Button, test plan V25.11.02](https://aria-at.w3.org/report/163671)). Historical `aria-describedby` results report partial/no dynamic-description support on VoiceOver iOS, so a late description mutation cannot be the sole announcement path ([a11ysupport, 2021-10-19](https://a11ysupport.io/tech/aria/aria-describedby_attribute)).

Discarded: interactive content inside a tooltip, hover/long-press-only discovery, and dynamic-description-only announcement, contrary to APG or contradicted by the dated observation. TalkBack's historical matrix supports initial description contribution but not dynamic changes while focused; it is related evidence, not a current tooltip test. Both VoiceOver lanes remain pending real testing.
