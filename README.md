# Bible Quiz

Practice games for Bible quizzers studying the Gospel of John during the 2026-27 season.

## Included games

- Quiz Practice with shuffled 20-question rounds, continuous mode, Buzzer Practice, Speed Round, type filters, answer reveal, and self-scoring.
- Flash cards for memory verses or official question-and-answer review.
- A coach-led Jeopardy-style team game with official and study-drill boards.
- Generated word search puzzles using unique words.
- Fill-in-the-blank memory verse practice.
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
  SourceMaterial/          Original quiz CSV files
  scripts/                 Data generator and local server
  test/                    Game-logic tests
  web/                     Deployable static application
  DESIGN.md                Product and technical design
  TODO.md                  Persistent project backlog
```

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
3. Creates preview environments for pull requests.

Repository setup:

1. Initialize this directory as a Git repository and push it to GitHub.
2. Create or connect an Azure Static Web App.
3. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to the GitHub repository secrets.
4. Push to the `main` branch.

No client-side API keys are required.

## Content note

The app displays the supplied quiz wording without attempting to replace or expand it. Confirm the authoritative translation and required copyright notice before public release. Full chapter text is not currently included, so question generation uses memory verses and unique-word references.
