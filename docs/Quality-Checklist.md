# Quality checklist

Record each verification pass. Do not mark browsers fully complete if Safari was only skipped.

## Run metadata

| Field | Value |
|---|---|
| Date | 2026-08-09 |
| Build / commit | trainer polish (blank slider, concordance, flash reveal) local |
| Tester | Stephen (operator) / agent-assisted |

## Automated

| Check | Result | Notes |
|---|---|---|
| `npm test` | Pass | Blank ratio 0/1%/22%/100%, concordance, flash reveal helpers, prior suite |
| `npm run generate:data` | Pass | John 1-5 Scripture + typeName Context |

## Accessibility

| Check | Result | Notes |
|---|---|---|
| Keyboard navigation of primary controls | Pass | Tab through home cards, selects, practice buttons |
| Concordance search results keyboard usable | Pass | Result buttons are focusable; Enter activates jump |
| Unique-word browser keyboard usable | Pass | Filter field + focusable word buttons |
| Flash slow-reveal controls keyboard usable | Pass | Next word / Reveal all / Auto-play / speed select |
| Screen-reader announcements (`#announcer`) | Pass | Spot-check reveal / found-word / route messages |
| Focus returns sensibly after route change | Pass | `#app` focused on route |

## Motion and contrast

| Check | Result | Notes |
|---|---|---|
| `prefers-reduced-motion` disables transitions/animations | Pass | CSS media query present |
| Flash auto-play defaults off under reduced motion | Pass | Auto-play remains choosable; not hard-disabled |
| Concordance jump highlight clears after 2.5s | Pass | `CONCORDANCE_HIGHLIGHT_MS` |
| Text contrast on cards / buttons / highlights | Pass | Spot-check memory band + unique-word mark on dark/light panels |

## Browsers

| Browser | Result | Notes |
|---|---|---|
| Chrome | Pass | Smoke: home, Quiz Practice round, Scripture |
| Edge | Pass | Smoke: home, Quiz Practice round, Scripture |
| Firefox | Pass | Smoke: home, Quiz Practice round, Scripture |
| Safari | Not available - explicitly skipped | No Safari host in this verification pass |

Overall browsers TODO: **Partial** (Chrome / Edge / Firefox complete; Safari N/A).

## Viewports

| Width | Result | Notes |
|---|---|---|
| 390 | Pass | Phone layout |
| 768 | Pass | Tablet |
| 1280 | Pass | Laptop |
| 1920 | Pass | Projector / desktop |

## Notes / defects

- Safari not exercised; re-run checklist on a Mac/iOS Safari before claiming full browser coverage.
- Scripture attribution remains a placeholder for internal-personal distribution.
