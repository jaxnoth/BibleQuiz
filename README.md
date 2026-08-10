# Bible Quiz

Practice games for Bible quizzers studying the Gospel of John during the 2026-27 season.

## Included games

- Quiz Practice with shuffled 20-question rounds, continuous mode, Buzzer Practice, Speed Round, type filters, answer reveal, and self-scoring.
- Flash cards for memory verses or official question-and-answer review (optional slow word reveal on the memory deck).
- Scripture chapter reader with concordance search and unique-word browser (home CTA: Read Scripture).
- A coach-led Jeopardy-style team game with official and study-drill boards.
- Generated word search puzzles using unique words.
- Fill-in-the-blank memory verse practice with a 0-100% blank-ratio slider.
- Verse Scramble using memory-verse phrases.
- Situation Challenge using official Situation questions.

John 1-5 is enabled in the first release. The supplied source files already include later chapters and can be enabled as the season progresses.

## Run locally

Install Node.js 20 or newer, then run:

```powershell
npm run generate:data
npm test
npm start
```

Open `http://localhost:3000`.

The app can be embedded with `http://localhost:3000/?embed=1`.

## Project structure

```text
BibleQuiz/
  SourceMaterial/          Original quiz CSV, RTF banks, Scripture chapters
  api/                     Azure Functions proxy for API.Bible (keys server-side)
  docs/                    Workshop, scoring, practice, quality guides
  scripts/                 Data generator and local server
  test/                    Game-logic tests
  web/                     Deployable static application
  DESIGN.md                Product and technical design
  TODO.md                  Persistent project backlog
```

Guides: [Quizmaster Workshop](docs/Quizmaster-Workshop.md), [Quality checklist](docs/Quality-Checklist.md). Distribution is internal-personal until translation rights are confirmed for public Scripture.

## Add study material

1. Update the CSV files in `SourceMaterial/`.
2. In `scripts/generate-study-data.mjs`, add newly approved chapters to `enabledChapters`.
3. Run `npm run generate:data`.
4. Run `npm test`.
5. Review each game with the newly enabled chapter filter.

The generator normalizes extra whitespace, encoded apostrophes, and reference formatting. It fails on unsupported references or duplicate records instead of silently publishing ambiguous data.

## Official quiz questions

Quiz Practice uses the full question banks supplied in `SourceMaterial/John 1.zip` through `John 5.zip`. The extracted RTF files are retained under `SourceMaterial/Questions/` so the cross-platform data generator can validate and import them during local development and deployment.

The current material provides 791 official questions:

- John 1: 186
- John 2: 99
- John 3: 124
- John 4: 210
- John 5: 172

Jump words and unique-word lists are recognition aids and are not used as Quiz Practice questions.

## Profiles and progress

Bible Quiz keeps separate local profiles for players sharing a device. Use the profile selector in the header and open **My Progress** to:

- Review accuracy, attempts, weak questions, chapter results, and question-type results.
- See practice streaks, Speed Round best scores, and buzzer averages.
- Create, rename, switch, export, import, or delete profiles.

Results from official questions, flash cards, Fill in the Blank, Verse Scramble, Situation Challenge, Buzzer Practice, Speed Round, and Word Search contribute appropriately weighted progress signals. Shuffled games favor weak and unseen material while continuing to revisit mastered content.

Profiles are stored only in the browser. Clearing site data removes them. Export a profile as JSON to create a backup or move it to another device; importing creates a separate copy and does not overwrite an existing player.

## Azure Static Web Apps

The workflow at `.github/workflows/azure-static-web-apps.yml`:

1. Runs the data generator and tests.
2. Deploys the `web/` directory without a build step.
3. Deploys the `api/` Azure Functions proxy (`api_location: api`).
4. Creates preview environments for pull requests.

Repository setup:

1. Initialize this directory as a Git repository and push it to GitHub.
2. Create or connect an Azure Static Web App.
3. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to the GitHub repository secrets.
4. In Azure Portal SWA Configuration, set `API_BIBLE_KEY` and `API_BIBLE_BIBLE_ID` (discover the NIV id once via `GET https://api.scripture.api.bible/v1/bibles` with your key).
5. Push to the `main` branch.

No client-side API keys are required. The browser calls only `/api/scripture/*`.

### Local Scripture API

Plain static preview (Local Scripture provider fallback):

```powershell
npm start
```

Proxy + app together (API provider when keys are set):

```powershell
copy api\local.settings.json.example api\local.settings.json
# Edit api\local.settings.json - set API_BIBLE_KEY and API_BIBLE_BIBLE_ID
npx @azure/static-web-apps-cli start web --api-location api
```

`api/local.settings.json` is gitignored.

## Content note

The app displays the supplied quiz wording without attempting to replace or expand it. Confirm the authoritative translation and required copyright notice before public release. Bundled John 1-5 Scripture remains available as Local fallback; API.Bible text is never written into `study-data.json`.
