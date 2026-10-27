# Dated AT issue log

Template per ADR-006 (dated AT issue log in the repo). One row per observed assistive-technology
issue. Append rows; never edit a past observation, add a retest row instead. Leave a cell `TBD`
until it is observed; never invent speech output, versions or results.

| Field | Value |
|---|---|
| Issue ID | `<pattern>-<at>-<NNN>` |
| Date observed (YYYY-MM-DD) | |
| Pattern or component (APG pattern id and variant) | |
| Assistive technology and exact version | |
| Browser and exact version | |
| Platform and OS version | |
| Device (for real-device runs: model and build) | |
| Minimal repro (numbered steps, smallest page that shows it) | |
| Expected speech output | |
| Actual speech output (verbatim) | |
| Focus before and after | |
| Workaround status | `none` (user-agent-keyed ARIA workarounds are prohibited, ADR-006) |
| Evidence link (registry `file#id` or log reference) | |
| Retest date (YYYY-MM-DD) | |
| Retest result | `fixed`, `still reproduces`, or `not retested` |
| Retest versions (AT, browser, platform) | |
| Owner of follow-up | |

Worked layout, to copy per issue:

```
Issue ID:            <pattern>-<at>-<NNN>
Date observed:       YYYY-MM-DD
Pattern:             <APG pattern id> (<variant>)
AT / version:        <name> <exact version>
Browser / version:   <name> <exact version>
Platform / OS:       <platform> <OS version>
Minimal repro:       1. ...  2. ...
Expected speech:     ...
Actual speech:       ...   (verbatim)
Retest:              YYYY-MM-DD, <fixed | still reproduces | not retested>, <versions>
```
