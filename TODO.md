# Bible Quiz TODO

Last updated: 2026-07-18

This file is the persistent project backlog. Completed work remains checked for history.

## In progress

- [x] Build Milestone 1 as a playable local app.
- [ ] Review and refine the playable app with coaches and quizzers.

## Product and design

- [x] Inventory the existing BibleQuiz source material.
- [x] Review Bible Bingo's theme and publishing approach.
- [x] Define first-release scope and assumptions.
- [x] Record non-blocking product questions.
- [ ] Review the first playable iteration with coaches and quizzers.
- [ ] Confirm the authoritative Bible translation and required copyright notice.

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
- [ ] Add full chapter text when an approved source is available.

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

### Flash cards

- [x] Add reference and verse card faces.
- [x] Add an official question-and-answer card deck.
- [x] Add flip, previous, next, and shuffle actions.
- [x] Add "needs practice" tracking.

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

### Verse Scramble

- [x] Generate phrase scrambles from memory verses.
- [x] Add phrase selection, undo, reset, checking, and new-verse actions.

### Situation Challenge

- [x] Use official Situation questions.
- [x] Add answer reveal, self-scoring, and continuous questions.

## Quality

- [ ] Add automated tests for CSV parsing and normalization.
- [x] Add automated tests for question and puzzle generation.
- [x] Add automated tests for profiles, progress, adaptive ordering, and import/export.
- [ ] Check keyboard navigation and screen-reader announcements.
- [ ] Check reduced-motion behavior and color contrast.
- [ ] Test current Chrome, Edge, Firefox, and Safari.
- [ ] Test common phone, tablet, laptop, and projector sizes.

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

- [ ] Verse scramble.
- [ ] Reference matching.
- [ ] Who said it?
- [ ] Timeline challenge.
- [ ] Quote or not?
- [ ] Sixty-second speed round.
- [ ] Team buzzer mode.
- [ ] Spaced-repetition practice plan.
- [ ] Coach-authored CSV question imports.
