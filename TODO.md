# Bible Quiz TODO

Last updated: 2026-08-09

This file is the persistent project backlog. Completed work remains checked for history.

Guides: [Quizmaster Workshop](docs/Quizmaster-Workshop.md) · [Scoring](docs/Scoring-Summary.md) · [Practice tips](docs/Practice-Tips-and-Study-Plan.md) · [Team practice](docs/Team-Practice.md) · [Quality checklist](docs/Quality-Checklist.md)

Workshop Reference / Finish + give reference is a memory-family quiz type (future code `R`). Future Reference matching is a separate feature.

## In progress

- [x] Build Milestone 1 as a playable local app.
- [ ] Review and refine the playable app with coaches and quizzers.

## Product and design

- [x] Inventory the existing BibleQuiz source material.
- [x] Review Bible Bingo's theme and publishing approach.
- [x] Define first-release scope and assumptions.
- [x] Record non-blocking product questions.
- [ ] Review the first playable iteration with coaches and quizzers.
- [ ] Confirm the authoritative Bible translation and required copyright notice (tracked for internal personal use; public distribution remains gated).

## Foundation

- [x] Add the static application shell and responsive navigation.
- [x] Apply the Bible Bingo color, typography, and card theme.
- [x] Add chapter and game-setting controls.
- [x] Add browser persistence for preferences and individual progress.
- [x] Add embedded mode using `?embed=1`.

## Study data

- [x] Create a repeatable CSV-and-RTF-to-app-data generator.
- [x] Normalize references, source whitespace, and encoded punctuation.
- [x] Validate duplicate and malformed records.
- [x] Enable John 1-5 while retaining a path to later chapters.
- [x] Document how to add future material.
- [x] Add chapter text (Scripture John 1-5) with attribution metadata for internal personal use.
- [x] Remap display label for type `X` to Context while keeping `typeCode` for stats.
- [x] Apply 20-question round type quotas (G/A/Q/V/R/S/X) with G-then-A backfill when V/R are empty.

## Games

### Quiz Practice

- [x] Add chapter and chapter-range selection.
- [x] Add chapter-order and shuffled practice sets.
- [x] Add answer reveal, question progress, and self-scoring.
- [x] Default to shuffled 20-question rounds.
- [x] Add continuous practice mode.
- [x] Add word-by-word Buzzer Practice.
- [x] Add a timed 60-second Speed Round.
- [x] Add official question-type filters.
- [x] Extract and parse the supplied John 1-5 RTF question banks.
- [x] Import all 791 official questions with type, answer, and reference.
- [x] Exclude jump-word and unique-word drills from Quiz Practice.
- [x] Enforce official type quotas on round/buzzer when type filter is all.

### Scripture

- [x] Ingest John 1-5 chapter text.
- [x] Reader UI with memory-verse bands and unique-word highlights (escape-first).
- [x] Toggles for memory and unique highlights.
- [x] Home CTA reads **Read Scripture** (card title stays Scripture).
- [x] Concordance: free-text chapter search + unique-word browser with jump/highlight.
- [x] ScriptureProvider architecture complete (async contract; capabilities/limits metadata).
- [x] Scripture session facade complete (joins provider text with study overlays).
- [x] LocalScriptureProvider implemented.
- [x] Scripture UI no longer reads state.data.scriptureChapters directly.
- [x] Metadata footer supports provider metadata (translation, attribution, source, IP-holder links when present).
- [x] ApiBibleProvider + Azure Functions `/api/scripture/*` proxy (key server-side only).
- [x] Session-owned FUMS reporting; metadata-driven footer links.
- [x] `validateVisibleContent` / `canRender` helpers (no V1 UI blocking).
- [x] Scripture reader lists full John 1-21 via API.Bible (hybrid provider; quiz enabledChapters stay 1-5).

### Flash cards

- [x] Add reference and verse card faces.
- [x] Add an official question-and-answer card deck.
- [x] Add flip, previous, next, and shuffle actions.
- [x] Add "needs practice" tracking.
- [x] Memory-deck slow reveal (next word, reveal all, auto-play/pause/speed).

### Jeopardy

- [x] Generate a five-category question board.
- [x] Add official-question and study-drill board modes.
- [x] Add clue and answer reveal flow.
- [x] Add two-to-four-team score controls.
- [x] Add board reset.
- [ ] Add Jeopardy session persistence.

### Word search

- [x] Generate puzzles from selected unique words.
- [x] Add touch, mouse, and keyboard selection.
- [x] Add difficulty settings, reveal, and regeneration.

### Fill in the blank

- [x] Generate blanks from memory verses.
- [x] Add difficulty, hints, checking, and reveal.
- [x] Normalize typed answers for fair checking.
- [x] Progressive blank-ratio slider (0% none, 1-99% eligible words, 100% all words).

### Verse Scramble

- [x] Generate phrase scrambles from memory verses.
- [x] Add phrase selection, undo, reset, checking, and new-verse actions.

### Situation Challenge

- [x] Use official Situation questions.
- [x] Add answer reveal, self-scoring, and continuous questions.

## Quality

- [x] Add automated tests for CSV parsing and normalization.
- [x] Add automated tests for question and puzzle generation.
- [x] Add automated tests for profiles, progress, adaptive ordering, and import/export.
- [x] Add automated tests for round quotas, Scripture parse, and highlight escape-first.
- [x] Add automated tests for blank-ratio, Scripture concordance, and flash slow-reveal helpers.
- [x] Check keyboard navigation and screen-reader announcements (see [Quality checklist](docs/Quality-Checklist.md)).
- [x] Check reduced-motion behavior and color contrast (see checklist).
- [x] Accessibility smoke: concordance results, unique-word browser, and flash reveal controls are keyboard usable (see checklist).
- [x] Test current Chrome, Edge, and Firefox. Safari: Not available - explicitly skipped (Partial browsers coverage).
- [x] Test common phone, tablet, laptop, and projector sizes (390 / 768 / 1280 / 1920).

## Profiles and personalization

- [x] Add multiple local player profiles and active-profile switching.
- [x] Track question, verse, and unique-word mastery across games.
- [x] Track chapter, question-type, streak, Speed Round, and buzzer statistics.
- [x] Add adaptive question, verse, situation, and word selection.
- [x] Add the My Progress dashboard and weak-question list.
- [x] Add create, rename, export, import, and delete controls.
- [ ] Consider optional cloud synchronization in a later release.

## Offline and publishing

- [x] Add a web app manifest and icons.
- [x] Add service-worker caching and an offline fallback.
- [x] Add local preview commands.
- [x] Add the Azure Static Web Apps GitHub Actions workflow.
- [x] Add Azure route and security-header configuration.
- [x] Document repository and deployment setup.

## Future candidates

## Future: API.Bible provider

- [x] Build secure backend/proxy for API.Bible key handling.
- [x] Do not expose API.Bible key in browser JavaScript.
- [x] Implement API.Bible FUMS (session-owned; provider returns `fumsToken`).
- [x] Load copyright/attribution metadata from API.Bible via proxy.
- [x] Display API.Bible visible link for Starter Plan use (metadata-driven).
- [x] Display Biblica link when NIV policy sets `requiresBiblicaLink` (proxy policy, not client hardcode).
- [ ] Wire `validateVisibleContent` into UI when a view can exceed chapter/verse limits (helper exists; single-chapter reader already complies).
- [ ] Avoid persistent Scripture caching until 30-day refresh and removal workflows are implemented.
- [x] Do not export API.Bible Scripture into study-data.json.
- [x] Do not use API.Bible copyrighted text for AI/LLM training, AI-generated derivatives, personalized AI/ML content, or text-to-speech.
- [ ] Add translation selector later: NIV primary, NLT comprehension, third translation TBD.

### Future: Translation-specific policy metadata

Different providers or translations may require:
- attribution links
- verse limits
- chapter limits
- refresh intervals
- IP holder links

Provider metadata should drive compliance rather than hard-coded NIV assumptions. Server policy lives in `api/lib/translation-policy.js`.

### Other

- [ ] Finish this verse (`V`) question bank.
- [ ] Finish + give reference (`R`) question bank (workshop Reference; not Reference matching).
- [ ] True book-and-chapter questions for epistle seasons.
- [ ] Reference matching (separate from workshop finish + reference).
- [ ] Who said it?
- [ ] Timeline challenge.
- [ ] Quote or not?
- [ ] Team buzzer mode.
- [ ] Live scoring / toss-up and bonus simulation.
- [ ] Spaced-repetition practice plan.
- [ ] Coach-authored CSV question imports.
- [ ] Tips / Study Plan UI surfaces for the guide docs.
- [ ] Coach Play modes beyond current games.

### From phone brainstorm 2026-08-08

- [x] Highlight key words within each passage during study and practice (Scripture reader memory + unique highlights; practice-card highlights remain future).
- [ ] Progressive memory-verse trainer (first-letter / advanced masking).
- [ ] Pictionary-style drawing game mode.
- [ ] Pre-jump trainer that reveals a question with the ending removed for jump-timing practice.
- [ ] Pre-jump timing option that fires right before the question ends.
- [x] Concordance and keyword lookup across Scripture (chapter search + unique-word browser; quiz-bank search remains future).
- [ ] Rotation mode where a player rotates out after answering correctly.
- [ ] Support non-Bible (general) question sets in training modes.
