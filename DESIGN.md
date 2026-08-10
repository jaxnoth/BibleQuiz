# Bible Quiz Design

Last updated: 2026-08-09

## Product vision

Bible Quiz is a mobile-friendly collection of practice games for Bible quizzers studying the Gospel of John. It should feel related to Bible Bingo, work well in a classroom or church setting, and remain easy to expand as more study material is added.

**Distribution:** Immediate quiz-team / non-commercial use for this ship (`metadata.distribution: internal-team`). Public Scripture distribution requires translation permission and attribution review first. API.Bible (if added later) requires a secure backend proxy, FUMS, Biblica display rules, and API-driven attribution - see Scripture provider model below. See `metadata.scriptureAttribution` and [docs/Quizmaster-Workshop.md](docs/Quizmaster-Workshop.md).

## Guides

- [Quizmaster Workshop](docs/Quizmaster-Workshop.md)
- [Scoring Summary](docs/Scoring-Summary.md)
- [Practice Tips and Study Plan](docs/Practice-Tips-and-Study-Plan.md)
- [Team Practice](docs/Team-Practice.md)
- [Quality Checklist](docs/Quality-Checklist.md)

## Current scope

The first release supports John 1-5 and includes:

1. Direct quiz-question practice by chapter range, with official type quotas on 20-question rounds.
2. Flash cards for memory verses.
3. A Jeopardy-style team game.
4. Word search puzzles.
5. Fill-in-the-blank memory verse practice.
6. Verse Scramble memory practice.
7. Situation Challenge using official situation questions.
8. Scripture chapter reader with memory-verse and unique-word highlights.

The app is a static site with local study data. Core play does not require an API key or account.

## Audience and use cases

- Individual quizzers practicing on a phone, tablet, or computer.
- Coaches running a game on a shared screen.
- Small teams competing in a classroom.
- Families reviewing verses away from an internet connection.

## Design direction

Match the Bible Bingo visual family:

- Dark blue: `#202833`
- Off-white: `#dae4e8`
- Orange accent: `#ee6c4d`
- Main blue: `#2c5777`
- Light blues: `#bbdaea`, `#98c1d9`, and `#548eba`
- Oswald-style headings and Dancing Script-style accents, with local system fallbacks.
- Dark-to-blue header gradient, white game cards, rounded corners, and restrained shadows.
- Responsive controls and large touch targets.
- Support embedded display through `?embed=1`.

## Information architecture

### Home

- Study-range summary.
- Chapter filter.
- Game cards with short descriptions and play buttons.

### Shared game shell

- Home/back navigation.
- Current chapter scope.
- Progress or score.
- New round and reset controls.
- Clear instructions available without leaving the game.

## Game specifications

### Quiz Practice

- Defaults to a shuffled 20-question round, matching the usual quiz-round length.
- Offers continuous practice without a question limit.
- Buzzer Practice reads a question word-by-word until the student buzzes.
- Speed Round gives the student 60 seconds to answer as many questions as possible.
- Selects one chapter or a continuous range of chapters.
- Supports chapter order or shuffled order.
- Filters by official type: According To, General, Quote, Situation, or Context (`typeCode` `X`).
- 20-question round and buzzer modes with type filter `all` apply round type quotas (G/A/Q/V/R/S/X); empty V/R backfill from G then A.
- Reveals the supplied answer and reference on request.
- Lets quizzers self-score as correct or needing review.
- Uses the official chapter question banks extracted from the supplied ZIP files.
- Never substitutes memory-verse, jump-word, or unique-word drills for official Quiz Practice questions.

### Flash cards

- Offers memory-verse and official-question decks.
- Memory cards show the reference, complete verse, and optional jump words.
- Memory cards may use optional slow reveal (next word, reveal all, auto-play with pause/speed). Auto-play defaults off under `prefers-reduced-motion` but remains available.
- Question cards show the type above the question, then reveal the answer with its reference on a separate line.
- Previous, flip, next, shuffle, and "needs practice" controls.
- Session progress and local review tracking.
- Jump words are recognition aids only and are not presented as questions to answer.

### Jeopardy

- Five categories with five increasing point values.
- Official mode uses According To, General, Quote, Situation, and Context questions.
- Study-drill mode uses References, Finish the Verse, Missing Words, Jump Words, and Unique Words.
- Coach-controlled reveal flow: clue, answer, award points.
- Two to four configurable teams.
- Board state and scores remain in the browser during the session.
- A reset creates a newly shuffled board.

### Word search

- Uses unique words from the selected chapters.
- Generates a reproducible grid from a random seed.
- Supports mouse, touch, and keyboard-friendly word marking.
- Difficulty changes grid size, directions, and word count.
- Includes reveal and new-puzzle actions.

### Fill in the blank

- Uses memory verse text.
- Blank-ratio slider (0-100%): 0% shows the full verse; 1-99% blanks eligible words (length >= 4); 100% blanks every word.
- Accepts answers without requiring exact capitalization or punctuation.
- Offers hints and a full-answer reveal.
- Shows immediate, encouraging correction.

### Scripture

- Home CTA is **Read Scripture** (feature title remains Scripture).
- Chapter reader with memory-verse bands and unique-word marks.
- Concordance: free-text search in the current chapter plus a unique-word browser; results jump to the verse with a temporary highlight.
- Scripture text is loaded through an async **ScriptureProvider**. The UI uses a **scripture-session** facade that joins provider text with study overlays.
- Footer renders provider metadata (translation/abbreviation, attribution/copyright, source, and provider/IP-holder links when present). Do not hardcode final API.Bible/Biblica citation strings in the UI.

## Scripture provider model

BibleQuiz uses a replaceable Scripture provider architecture.

Providers own:
- Scripture text
- Scripture search
- chapter listing
- source/translation/copyright metadata
- provider capabilities and limits

Study packs own:
- memory verses
- unique words
- quiz questions
- question type mappings
- round quotas
- practice overlays

The Scripture session facade combines provider text with study-pack overlays for UI rendering.

This separation exists so BibleQuiz can support bundled local Scripture today and API-backed Scripture later without rewriting the Scripture reader, concordance, or highlight UI.

BibleQuiz optimizes for replaceable Scripture sources and provider-enforced license constraints, not for scattered UI checks or manual verse-count exposure rules.

Flow: `UI -> scripture-session.js -> ScriptureProvider` (`LocalScriptureProvider` or `ApiBibleProvider` via `/api/scripture/*` proxy).

Prefer API when `/api/scripture` is reachable (full John 1-21 via API.Bible). Local bundled John 1-5 remains the offline fallback. Quiz/game `enabledChapters` stay John 1-5 and do not limit the Scripture reader.

Shared metadata shape (both providers): `provider`, `source`, `translation`, `abbreviation`, `copyright`, `copyrightHtml`, `scriptureAttribution`, `distribution`, `ipHolder`, `ipHolderUrl`, `providerUrl`, `requiresBiblicaLink`, `capabilities`, `limits`.

`ApiBibleProvider` is translation-agnostic: IP holder, Biblica flags, and limits come from the proxy metadata endpoint (server `translation-policy.js`), not client hardcodes.

FUMS: provider returns `fumsToken`; `scripture-session` reports views via the official tracker. Retrieval and tracking stay separate.

Visible-content limits: session exposes `validateVisibleContent` / `canRender` for future UI. V1 single-chapter reader does not block on those limits.

## API.Bible / Biblica requirements

API.Bible keys must never appear in browser JavaScript. The Azure Functions proxy under `api/` holds `API_BIBLE_KEY` and `API_BIBLE_BIBLE_ID`.

Requirements reflected in architecture:
- FUMS via session when `fumRequired` / tokens are present
- API.Bible attribution and hyperlink from provider metadata (`providerUrl`, `requiresAttributionLink`)
- IP-holder copyright metadata and Biblica link when `requiresBiblicaLink` / `ipHolderUrl` are set by the proxy
- Do not modify Scripture text
- Do not use copyrighted Scripture for AI/LLM training, personalized AI/ML, or TTS unless separately licensed
- Do not export API-fetched Scripture into `study-data.json`
- Prefer no persistent Scripture cache; session memory only in V1
- Surface translation-specific limits in metadata; enforce in UI only when a view can exceed them

### Verse Scramble

- Breaks a selected memory verse into short phrases.
- Lets the student arrange the phrases in the correct order.
- Supports checking, undoing, resetting, and selecting a new verse.

### Situation Challenge

- Uses only official Situation questions.
- Shows the official answer and reference after reveal.
- Tracks correct and needs-review responses.

## Data design

Source files are retained unchanged in `SourceMaterial/`. A generated application data file will normalize them into:

```text
memoryVerses[]
  reference
  book
  chapter
  verseStart
  verseEnd
  jumpWords
  text

uniqueWords[]
  word
  reference
  book
  chapter
  verseStart
  verseEnd

quizQuestions[]
  id
  question
  answer
  reference
  chapter
  type
  typeCode
  typeName

scriptureChapters[]
  book
  chapter
  verses[] { verse, text, reference }

metadata (Scripture-related)
  translation
  abbreviation
  source
  distribution
  scriptureAttribution
  copyright
  copyrightHtml
  ipHolder
  ipHolderUrl
  providerUrl
```

Provider runtime metadata also exposes `provider`, `capabilities`, and `limits` (see LocalScriptureProvider defaults in `web/js/scripture-provider.js`).

Only records from enabled chapters are exposed in the first release. The importer must tolerate whitespace and punctuation issues in source CSV files, decode the supplied RTF question banks, parse Scripture markdown under `SourceMaterial/Scripture/`, and make future chapter additions data-only work. Stats keys stay on `typeCode`; UI labels use `typeName` (Context for `X`).

## Technical architecture

- Semantic HTML, CSS, and modern JavaScript modules.
- No runtime framework or server dependency.
- Local JSON/JavaScript study data.
- Scripture retrieval is provider-based (`createLocalScriptureProvider` or `createApiBibleProvider`); quiz overlays stay on study data. Consumers use `UI -> scripture-session -> provider` only. Prefer API when the `/api/scripture` proxy is available.
- Azure Functions under `api/` hold the API.Bible key; browser never sees it.
- Browser `localStorage` for preferences and lightweight progress.
- Service worker and web manifest for installable/offline use.
- Node scripts for source-data validation and generation.
- Node's built-in test runner for pure game and data utilities.
- Azure Static Web Apps deployment from `web/`, following Bible Bingo's publishing model.

## Profiles, progress, and personalization

- A versioned local profile store supports multiple players on one device.
- The active profile is available from every screen.
- My Progress shows attempts, accuracy, review count, practice streak, Speed Round best score, buzzer average, chapter accuracy, question-type accuracy, and weak questions.
- Players can create, rename, switch, export, import, and delete profiles.
- Imported profile files are validated, limited in size, and added as a copy instead of overwriting an existing player.
- Export files contain one player's progress as JSON.

### Cross-game signals

- Official question results update question mastery in Quiz Practice, Buzzer Practice, Speed Round, Situation Challenge, and question flash cards.
- Memory verse results update verse mastery in memory flash cards, Fill in the Blank, and Verse Scramble.
- Word Search updates unique-word familiarity.
- Revealing a flash card records a small exposure signal.
- Correct answers increase mastery; "Needs review" responses lower it more strongly.
- Question results are the strongest signal, verse activities are moderate signals, and word-search results are lighter signals.

### Adaptive behavior

- Shuffled question sets favor unseen and weak questions.
- Memory verse games favor verses with lower mastery.
- Situation Challenge favors weak or unseen Situation questions.
- Word Search favors less-practiced unique words.
- Mastered material remains eligible so it returns periodically for review.

### Storage limitations

- Profiles stay in the current browser's local storage.
- Clearing browser site data removes local profiles.
- Export and import provide manual backup and movement between devices.
- No profile data is sent to a server.

## Accessibility and safety

- Keyboard-operable controls and visible focus states.
- Minimum 44px touch targets where practical.
- Sufficient color contrast and no color-only status messages.
- Reduced-motion support.
- Screen-reader announcements for score, correctness, and game state.
- No study content sent to third parties.
- No API keys embedded in the client.

## Publishing

- GitHub Actions deploys `web/` to Azure Static Web Apps on pushes to `main`.
- Pull requests receive Azure preview environments.
- The app requires no build step for deployment.
- Local preview uses a small static file server.

## Assumptions

- The supplied wording is the approved quiz material and should not be silently rewritten.
- John 1-5 is the enabled range even though the CSVs already contain later chapters.
- Quiz Practice contains only the official questions supplied for each chapter.
- Coaches can judge open-ended Jeopardy responses; automatic speech recognition is out of scope.
- Scores and practice progress are device-local in the first version.
- No login, cloud sync, analytics, or multiplayer networking is required initially.

## Open questions

These do not block the first iteration:

1. What Bible translation is authoritative, and what display/licensing notice is required?
2. Will full chapter text be supplied later, or should it be sourced under a suitable license?
3. Should Jeopardy support buzzers from players' phones in a future release?
4. How many teams and players are typical?
5. Should practice history sync across devices?

## Candidate future games

- Reference match: pair references with verse text.
- Timeline challenge: order events from John.
- Quote or not?: decide whether a line appears in the selected chapters.
- Quiz bowl/buzzer mode for teams.
- Daily practice streak with spaced repetition.

## Release milestones

### Milestone 1 - Playable local app

- Shared themed shell and chapter filters.
- Normalized John 1-5 data.
- All five requested game modes.
- Responsive and accessible baseline.

### Milestone 2 - Quality and publishing

- Automated data and game-logic tests.
- Offline install support.
- Azure Static Web Apps workflow.
- Cross-device browser checks.

### Milestone 3 - Expanded material

- Import additional chapters without changing game code.
- Import additional official chapter question banks as they are supplied.
- Add coach customization based on feedback.

## Decision log

- 2026-07-18: Use a static, dependency-light architecture to match Bible Bingo's deployment and keep the app inexpensive and reliable.
- 2026-07-18: Generate games from supplied source data so missing full chapter text does not block the first release.
- 2026-07-18: Enable only John 1-5 while keeping the data pipeline ready for John 6-21.
- 2026-07-18: Add direct Quiz Practice with chapter ranges.
- 2026-07-18: Import all 791 official questions from the supplied John 1-5 ZIP archives.
- 2026-07-18: Treat jump words and unique words as recognition aids, not Quiz Practice questions.
- 2026-07-18: Merge Random Questions into Quiz Practice with 20-question rounds and continuous mode.
- 2026-07-18: Add Buzzer Practice and a 60-second Speed Round to Quiz Practice.
- 2026-07-18: Add Verse Scramble and Situation Challenge as standalone games.
- 2026-07-18: Add local multi-profile progress tracking, adaptive practice, and JSON backup.
