import {
  cellsOnLine,
  createBlankQuestion,
  createJeopardyBoard,
  createVerseScramble,
  createWordSearch,
  normalizeAnswer,
} from './game-engine.js';
import {
  adaptiveShuffle,
  addProfile,
  availableAvatars,
  deleteProfile,
  exportProfile,
  getActiveProfile,
  importProfile,
  loadProfileStore,
  profileSummary,
  recordActivity,
  recordGameSession,
  renameProfile,
  saveProfileStore,
} from './progress-store.js';
import { selectRoundQuestions, typeHistogram } from './round-quotas.js';
import { renderScriptureVerses } from './scripture-highlight.js';
import { CONCORDANCE_HIGHLIGHT_MS } from './scripture-concordance.js';
import { createLocalScriptureProvider } from './scripture-provider.js';
import { createApiBibleProvider, probeApiBibleProvider } from './api-bible-provider.js';
import { createScriptureSession } from './scripture-session.js';
import {
  FLASH_REVEAL_SPEEDS,
  advanceRevealCount,
  prefersReducedMotion,
  revealedVerseText,
  tokenizeVerse,
} from './flash-reveal.js';

const app = document.querySelector('#app');
const announcer = document.querySelector('#announcer');
const homeButton = document.querySelector('[data-action="home"]');
const profileSwitch = document.querySelector('#profile-switch');
const params = new URLSearchParams(window.location.search);
const storageKey = 'bibleQuiz.preferences';

const state = {
  data: null,
  scriptureProvider: null,
  scriptureSession: null,
  scriptureBook: 'John',
  profileStore: null,
  chapter: 'all',
  flashcards: [],
  flashIndex: 0,
  flashRevealed: false,
  flashDeck: 'memory',
  flashSlowReveal: false,
  flashRevealCount: 0,
  flashWords: [],
  flashAutoPlay: false,
  flashRevealSpeed: 'normal',
  flashRevealTimer: null,
  jeopardy: null,
  jeopardyMode: 'official',
  teams: [0, 0],
  wordSearch: null,
  wordSearchStart: null,
  foundWords: new Set(),
  blank: null,
  blankRatio: 0.22,
  quizPractice: [],
  quizPracticeIndex: 0,
  quizPracticeRevealed: false,
  quizPracticeFrom: 1,
  quizPracticeThrough: 5,
  quizPracticeShuffle: true,
  quizPracticeType: 'all',
  quizPracticeMode: 'round',
  quizPracticeResults: new Map(),
  quizSessionRecorded: false,
  buzzerTimer: null,
  buzzerWordCount: 0,
  buzzerRunning: false,
  buzzerBuzzed: false,
  speedTimer: null,
  speedSeconds: 60,
  speedRunning: false,
  speedComplete: false,
  scramble: null,
  scrambleSelected: [],
  situation: null,
  situationRevealed: false,
  situationScore: { correct: 0, total: 0 },
  scriptureChapter: 1,
  scriptureShowMemory: true,
  scriptureShowUnique: true,
  scriptureSearch: '',
  scriptureUniqueFilter: '',
  scriptureFocusVerse: null,
  scriptureHighlightTimer: null,
};

if (params.has('embed') || window.self !== window.top) {
  document.body.classList.add('embedded');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function announce(message) {
  announcer.textContent = '';
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 30);
}

function activeProfile() {
  return getActiveProfile(state.profileStore);
}

function persistProfiles() {
  try {
    saveProfileStore(state.profileStore);
    renderProfileSwitch();
  } catch (error) {
    console.error(error);
    announce('Progress could not be saved on this device.');
  }
}

function renderProfileSwitch() {
  const activeId = state.profileStore?.activeProfileId;
  profileSwitch.innerHTML = state.profileStore.profiles
    .map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}"${profile.id === activeId ? ' selected' : ''}>${escapeHtml(profile.avatar)} ${escapeHtml(profile.name)}</option>`,
    )
    .join('');
}

function trackActivity(activity) {
  recordActivity(activeProfile(), activity);
  persistProfiles();
}

function resetPersonalizedGameState() {
  state.quizPractice = [];
  state.quizPracticeResults = new Map();
  state.flashcards = [];
  state.blank = null;
  state.wordSearch = null;
  state.scramble = null;
  state.situation = null;
  state.situationScore = { correct: 0, total: 0 };
}

function savePreferences() {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      chapter: state.chapter,
      blankRatio: state.blankRatio,
      flashSlowReveal: state.flashSlowReveal,
      flashRevealSpeed: state.flashRevealSpeed,
    }),
  );
}

function migrateBlankRatio(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  const legacy = { easy: 0.12, medium: 0.22, hard: 0.35 };
  if (typeof value === 'string' && legacy[value] != null) return legacy[value];
  return 0.22;
}

function loadPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored?.chapter === 'all' || state.data.metadata.enabledChapters.includes(Number(stored?.chapter))) {
      state.chapter = String(stored.chapter);
    }
    if (stored?.blankRatio != null || stored?.blankDifficulty != null) {
      state.blankRatio = migrateBlankRatio(stored.blankRatio ?? stored.blankDifficulty);
    }
    if (typeof stored?.flashSlowReveal === 'boolean') {
      state.flashSlowReveal = stored.flashSlowReveal;
    }
    if (stored?.flashRevealSpeed && FLASH_REVEAL_SPEEDS[stored.flashRevealSpeed]) {
      state.flashRevealSpeed = stored.flashRevealSpeed;
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function filteredData() {
  if (state.chapter === 'all') {
    return {
      memoryVerses: state.data.memoryVerses,
      uniqueWords: state.data.uniqueWords,
    };
  }
  const chapter = Number(state.chapter);
  return {
    memoryVerses: state.data.memoryVerses.filter((verse) => verse.chapter === chapter),
    uniqueWords: state.data.uniqueWords.filter((record) => record.chapter === chapter),
  };
}

function filteredQuizQuestions() {
  if (state.chapter === 'all') return state.data.quizQuestions;
  return state.data.quizQuestions.filter(({ chapter }) => chapter === Number(state.chapter));
}

function chapterLabel() {
  return state.chapter === 'all' ? 'John 1-5' : `John ${state.chapter}`;
}

function renderGameHeader(title, description) {
  return `
    <div class="game-header">
      <div>
        <p class="eyebrow">${escapeHtml(chapterLabel())}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="game-meta">${escapeHtml(description)}</p>
      </div>
      <button class="button-secondary" type="button" data-action="home">All games</button>
    </div>
  `;
}

function chapterOptions() {
  return `
    <option value="all"${state.chapter === 'all' ? ' selected' : ''}>John 1-5</option>
    ${state.data.metadata.enabledChapters
      .map(
        (chapter) =>
          `<option value="${chapter}"${state.chapter === String(chapter) ? ' selected' : ''}>John ${chapter}</option>`,
      )
      .join('')}
  `;
}

function renderHome() {
  const games = [
    ['quiz-practice', 'Q', 'Quiz Practice', 'Practice a 20-question round or continue without a limit.'],
    ['scripture', '§', 'Scripture', 'Read John with memory-verse bands and unique-word highlights.'],
    ['flashcards', '▣', 'Flash Cards', 'Review memory verses or official quiz questions.'],
    ['jeopardy', '★', 'Jeopardy', 'Play with official questions or study-drill categories.'],
    ['word-search', '⌕', 'Word Search', 'Find selected unique words hidden in a puzzle.'],
    ['fill-blank', '✎', 'Fill in the Blank', 'Restore missing words in memory verses.'],
    ['verse-scramble', '↕', 'Verse Scramble', 'Arrange shuffled phrases into the correct memory verse.'],
    ['situation-challenge', '!', 'Situation Challenge', 'Practice who said it, to whom, when, and where.'],
  ];
  const { memoryVerses, uniqueWords } = filteredData();

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">2026-27 Quiz Season</p>
      <h1>Ready to practice?</h1>
      <p class="lead">
        Choose a game, select your chapter range, and sharpen your knowledge of the Gospel of John.
      </p>
      <div class="toolbar">
        <label class="field">
          Study chapters
          <select id="chapter-filter">${chapterOptions()}</select>
        </label>
        <div class="game-meta">
          ${memoryVerses.length} memory verses <span aria-hidden="true">•</span>
          ${uniqueWords.length} unique words
        </div>
      </div>
    </section>
    <section class="game-grid" aria-label="Practice games">
      ${games
        .map(([route, icon, title, description]) => {
          const actionLabel = route === 'scripture' ? 'Read Scripture' : `Play ${title}`;
          return `
            <article class="game-card">
              <span class="game-card-icon" aria-hidden="true">${icon}</span>
              <h2>${title}</h2>
              <p>${description}</p>
              <button type="button" data-route="${route}">${actionLabel}</button>
            </article>
          `;
        })
        .join('')}
    </section>
  `;
  homeButton.hidden = true;
}

function avatarOptions(selected) {
  return availableAvatars()
    .map(
      (avatar) =>
        `<option value="${avatar}"${avatar === selected ? ' selected' : ''}>${avatar}</option>`,
    )
    .join('');
}

function statLine(label, stats = {}) {
  const accuracy = stats.attempts ? Math.round(((stats.correct ?? 0) / stats.attempts) * 100) : 0;
  return `
    <div class="progress-line">
      <span>${escapeHtml(label)}</span>
      <span>${stats.attempts ?? 0} attempts <span aria-hidden="true">•</span> ${accuracy}%</span>
    </div>
  `;
}

function renderProgressDashboard(message = '', messageType = 'success') {
  const profile = activeProfile();
  const summary = profileSummary(profile);
  const weakQuestions = summary.weakQuestions
    .map((record) => ({
      ...record,
      question: state.data.quizQuestions.find(({ id }) => id === record.id),
    }))
    .filter(({ question }) => question);
  const weakVerses = summary.weakVerses
    .map((record) => ({
      ...record,
      verse: state.data.memoryVerses.find(({ reference }) => reference === record.reference),
    }))
    .filter(({ verse }) => verse);
  const chapterLines = state.data.metadata.enabledChapters
    .map((chapter) => statLine(`John ${chapter}`, profile.stats.byChapter[chapter]))
    .join('');
  const typeNames = {
    A: 'According To',
    G: 'General',
    Q: 'Quote',
    S: 'Situation',
    X: 'Context',
  };
  const typeLines = Object.entries(typeNames)
    .map(([code, name]) => statLine(name, profile.stats.byQuestionType[code]))
    .join('');
  const speedBest = profile.stats.games?.speed?.bestScore ?? 0;
  const buzzerTotals = Object.values(profile.content.questions).reduce(
    (totals, record) => ({
      words: totals.words + (record.buzzerWordsTotal ?? 0),
      attempts: totals.attempts + (record.buzzerAttempts ?? 0),
    }),
    { words: 0, attempts: 0 },
  );
  const buzzerAverage = buzzerTotals.attempts
    ? Math.round(buzzerTotals.words / buzzerTotals.attempts)
    : 0;

  app.innerHTML = `
    ${renderGameHeader('My Progress', 'Your activity stays on this device and customizes future practice.')}
    ${message ? `<p class="notice ${messageType}">${escapeHtml(message)}</p>` : ''}
    <section class="metric-grid" aria-label="Progress summary">
      <article class="metric-card"><strong>${summary.attempts}</strong><span>Attempts</span></article>
      <article class="metric-card"><strong>${summary.accuracy}%</strong><span>Accuracy</span></article>
      <article class="metric-card"><strong>${summary.review}</strong><span>Needs review</span></article>
      <article class="metric-card"><strong>${summary.streakDays}</strong><span>Day streak</span></article>
      <article class="metric-card"><strong>${speedBest}</strong><span>Speed best</span></article>
      <article class="metric-card"><strong>${buzzerAverage}</strong><span>Average buzz words</span></article>
    </section>

    <div class="progress-grid">
      <section class="panel">
        <h2>By chapter</h2>
        ${chapterLines}
      </section>
      <section class="panel">
        <h2>By question type</h2>
        ${typeLines}
      </section>
    </div>

    <section class="panel progress-section">
      <h2>Items to review</h2>
      ${
        weakQuestions.length || weakVerses.length
          ? `<div class="progress-grid">
              <div>
                <h3>Questions</h3>
                ${
                  weakQuestions.length
                    ? `<ol class="review-list">
              ${weakQuestions
                .map(
                  ({ question, mastery }) => `
                    <li>
                      <span>${escapeHtml(question.question)}</span>
                      <small>${escapeHtml(question.reference)} - ${Math.round(mastery * 100)}% mastery</small>
                    </li>
                  `,
                )
                .join('')}
                      </ol>`
                    : '<p class="game-meta">No question reviews yet.</p>'
                }
              </div>
              <div>
                <h3>Memory verses</h3>
                ${
                  weakVerses.length
                    ? `<ol class="review-list">
                        ${weakVerses
                          .map(
                            ({ verse, mastery }) => `
                              <li>
                                <span>${escapeHtml(verse.reference)}</span>
                                <small>${Math.round(mastery * 100)}% mastery</small>
                              </li>
                            `,
                          )
                          .join('')}
                      </ol>`
                    : '<p class="game-meta">No verse reviews yet.</p>'
                }
              </div>
            </div>`
          : '<p class="game-meta">Questions and verses marked for review will appear here.</p>'
      }
    </section>

    <section class="panel progress-section">
      <h2>Manage ${escapeHtml(profile.avatar)} ${escapeHtml(profile.name)}</h2>
      <div class="toolbar">
        <label class="field">
          Profile name
          <input id="profile-name" type="text" maxlength="40" value="${escapeHtml(profile.name)}">
        </label>
        <label class="field">
          Avatar
          <select id="profile-avatar">${avatarOptions(profile.avatar)}</select>
        </label>
        <button type="button" data-action="profile-save">Save profile</button>
      </div>
      <div class="controls">
        <button type="button" data-action="profile-export">Export profile</button>
        <label class="button button-secondary import-button">
          Import profile
          <input id="profile-import" class="sr-only" type="file" accept="application/json,.json">
        </label>
        <button type="button" class="button-danger" data-action="profile-delete">Delete profile</button>
      </div>
    </section>

    <section class="panel progress-section">
      <h2>Add another player</h2>
      <div class="toolbar">
        <label class="field">
          Player name
          <input id="new-profile-name" type="text" maxlength="40" placeholder="Player name">
        </label>
        <label class="field">
          Avatar
          <select id="new-profile-avatar">${avatarOptions(availableAvatars()[1])}</select>
        </label>
        <button type="button" data-action="profile-add">Add profile</button>
      </div>
    </section>
  `;
}

function quizPracticeChapterOptions(selected) {
  return state.data.metadata.enabledChapters
    .map(
      (chapter) =>
        `<option value="${chapter}"${chapter === selected ? ' selected' : ''}>John ${chapter}</option>`,
    )
    .join('');
}

function quizPracticeFilteredQuestions() {
  const firstChapter = Math.min(state.quizPracticeFrom, state.quizPracticeThrough);
  const lastChapter = Math.max(state.quizPracticeFrom, state.quizPracticeThrough);
  state.quizPracticeFrom = firstChapter;
  state.quizPracticeThrough = lastChapter;
  return state.data.quizQuestions.filter(
    ({ chapter, typeCode }) =>
      chapter >= firstChapter &&
      chapter <= lastChapter &&
      (state.quizPracticeType === 'all' || typeCode === state.quizPracticeType),
  );
}

function quizPracticeQuestionPool() {
  const questions = quizPracticeFilteredQuestions();
  return state.quizPracticeShuffle
    ? adaptiveShuffle(questions, 'questions', activeProfile())
    : [...questions];
}

function stopBuzzerReader() {
  if (state.buzzerTimer) window.clearInterval(state.buzzerTimer);
  state.buzzerTimer = null;
  state.buzzerRunning = false;
}

function stopSpeedTimer() {
  if (state.speedTimer) window.clearInterval(state.speedTimer);
  state.speedTimer = null;
  state.speedRunning = false;
}

function resetQuestionPresentation() {
  stopBuzzerReader();
  state.quizPracticeRevealed = false;
  state.buzzerWordCount = 0;
  state.buzzerBuzzed = false;
}

function moveQuizPractice(direction) {
  if (
    direction === 1 &&
    ['continuous', 'speed'].includes(state.quizPracticeMode) &&
    state.quizPracticeIndex === state.quizPractice.length - 1
  ) {
    state.quizPractice.push(...quizPracticeQuestionPool());
  }
  state.quizPracticeIndex = Math.max(
    0,
    Math.min(state.quizPractice.length - 1, state.quizPracticeIndex + direction),
  );
  resetQuestionPresentation();
}

function startBuzzerReader() {
  const question = state.quizPractice[state.quizPracticeIndex];
  const words = question.question.split(' ');
  state.buzzerWordCount = 1;
  state.buzzerRunning = true;
  state.buzzerBuzzed = false;
  state.buzzerTimer = window.setInterval(() => {
    state.buzzerWordCount += 1;
    const questionElement = document.querySelector('#practice-question');
    if (questionElement) {
      questionElement.textContent = words.slice(0, state.buzzerWordCount).join(' ');
    }
    if (state.buzzerWordCount >= words.length) {
      stopBuzzerReader();
      state.buzzerBuzzed = true;
      renderQuizPractice();
      announce('The full question has been read.');
    }
  }, 450);
  renderQuizPractice();
}

function startSpeedRound() {
  state.speedRunning = true;
  state.speedComplete = false;
  state.speedTimer = window.setInterval(() => {
    state.speedSeconds -= 1;
    const timerElement = document.querySelector('#speed-timer');
    if (timerElement) timerElement.textContent = state.speedSeconds;
    if (state.speedSeconds <= 0) {
      stopSpeedTimer();
      state.speedComplete = true;
      state.quizPracticeRevealed = false;
      const score = [...state.quizPracticeResults.values()].filter(
        (result) => result === 'correct',
      ).length;
      recordGameSession(activeProfile(), 'speed', score);
      persistProfiles();
      renderQuizPractice();
      announce('Time is up.');
    }
  }, 1000);
  renderQuizPractice();
  announce('Speed round started.');
}

function prepareQuizPractice() {
  stopBuzzerReader();
  stopSpeedTimer();
  const useTypeQuotas =
    ['round', 'buzzer'].includes(state.quizPracticeMode) && state.quizPracticeType === 'all';
  if (useTypeQuotas) {
    state.quizPractice = selectRoundQuestions(quizPracticeFilteredQuestions(), activeProfile(), {
      shuffle: state.quizPracticeShuffle,
      adaptiveShuffleFn: adaptiveShuffle,
    });
    console.debug('Round type histogram', typeHistogram(state.quizPractice));
  } else {
    const orderedQuestions = quizPracticeQuestionPool();
    state.quizPractice = ['round', 'buzzer'].includes(state.quizPracticeMode)
      ? orderedQuestions.slice(0, 20)
      : orderedQuestions;
  }
  state.quizPracticeIndex = 0;
  resetQuestionPresentation();
  state.speedSeconds = 60;
  state.speedComplete = false;
  state.quizPracticeResults = new Map();
  state.quizSessionRecorded = false;
}

function renderQuizPractice() {
  if (!state.quizPractice.length) prepareQuizPractice();
  const question = state.quizPractice[state.quizPracticeIndex];
  const results = [...state.quizPracticeResults.values()];
  const correct = results.filter((result) => result === 'correct').length;
  const needsReview = results.filter((result) => result === 'review').length;
  const isBuzzer = state.quizPracticeMode === 'buzzer';
  const isSpeed = state.quizPracticeMode === 'speed';
  const currentResult = question
    ? state.quizPracticeResults.get(`${state.quizPracticeIndex}:${question.id}`)
    : null;
  const questionWords = question?.question.split(' ') ?? [];
  const displayedQuestion =
    isBuzzer && !state.quizPracticeRevealed
      ? questionWords.slice(0, state.buzzerWordCount).join(' ') ||
        'Press Start reading when you are ready.'
      : question?.question;
  const scoredQuestionControls = `
    <button type="button" data-action="quiz-practice-reveal" ${
      state.quizPracticeRevealed || (isBuzzer && !state.buzzerBuzzed) || (isSpeed && !state.speedRunning)
        ? 'disabled'
        : ''
    }>Reveal answer</button>
    <button type="button" data-action="quiz-practice-correct" ${state.quizPracticeRevealed && !currentResult ? '' : 'disabled'}>I got it</button>
    <button type="button" class="button-accent" data-action="quiz-practice-review" ${state.quizPracticeRevealed && !currentResult ? '' : 'disabled'}>Needs review</button>
  `;

  app.innerHTML = `
    ${renderGameHeader('Quiz Practice', 'Answer each question aloud, reveal the answer, and score yourself.')}
    <section class="panel">
      <div class="toolbar">
        <label class="field">
          From chapter
          <select id="quiz-practice-from">${quizPracticeChapterOptions(state.quizPracticeFrom)}</select>
        </label>
        <label class="field">
          Through chapter
          <select id="quiz-practice-through">${quizPracticeChapterOptions(state.quizPracticeThrough)}</select>
        </label>
        <label class="field">
          Question type
          <select id="quiz-practice-type">
            <option value="all"${state.quizPracticeType === 'all' ? ' selected' : ''}>All official types</option>
            <option value="A"${state.quizPracticeType === 'A' ? ' selected' : ''}>According To</option>
            <option value="G"${state.quizPracticeType === 'G' ? ' selected' : ''}>General</option>
            <option value="Q"${state.quizPracticeType === 'Q' ? ' selected' : ''}>Quote</option>
            <option value="S"${state.quizPracticeType === 'S' ? ' selected' : ''}>Situation</option>
            <option value="X"${state.quizPracticeType === 'X' ? ' selected' : ''}>Context</option>
          </select>
        </label>
        <label class="field">
          Question order
          <select id="quiz-practice-order">
            <option value="chapter"${state.quizPracticeShuffle ? '' : ' selected'}>Chapter order</option>
            <option value="shuffle"${state.quizPracticeShuffle ? ' selected' : ''}>Shuffled</option>
          </select>
        </label>
        <label class="field">
          Practice mode
          <select id="quiz-practice-mode">
            <option value="round"${state.quizPracticeMode === 'round' ? ' selected' : ''}>20-question round</option>
            <option value="continuous"${state.quizPracticeMode === 'continuous' ? ' selected' : ''}>Continuous</option>
            <option value="buzzer"${state.quizPracticeMode === 'buzzer' ? ' selected' : ''}>Buzzer practice</option>
            <option value="speed"${state.quizPracticeMode === 'speed' ? ' selected' : ''}>60-second speed round</option>
          </select>
        </label>
        <button type="button" data-action="quiz-practice-start">Start</button>
      </div>
      <p class="notice">Using the supplied official quiz question banks.</p>
      ${
        question
          ? `
            <div class="status-row">
              <span>Question ${state.quizPracticeIndex + 1}${['round', 'buzzer'].includes(state.quizPracticeMode) ? ` of ${state.quizPractice.length}` : ''}</span>
              <span>Correct: ${correct} <span aria-hidden="true">•</span> Review: ${needsReview}</span>
            </div>
            <div class="center">
              <p class="eyebrow">${escapeHtml(question.type)} <span aria-hidden="true">•</span> John ${question.chapter}</p>
              ${isSpeed ? `<p id="speed-timer" class="practice-timer" aria-live="polite">${state.speedSeconds}</p>` : ''}
              <h2 id="practice-question" class="question-text">${escapeHtml(displayedQuestion)}</h2>
              <div id="quiz-practice-answer" ${state.quizPracticeRevealed ? '' : 'hidden'}>
                ${isBuzzer ? `<p class="game-meta">Full question: ${escapeHtml(question.question)}</p>` : ''}
                <p class="eyebrow">Answer</p>
                <p class="question-text">${escapeHtml(question.answer)}</p>
                <p class="game-meta">${escapeHtml(question.reference)}</p>
              </div>
              ${
                isBuzzer
                  ? `<div class="controls">
                      <button type="button" data-action="buzzer-start" ${state.buzzerRunning || state.buzzerBuzzed ? 'disabled' : ''}>Start reading</button>
                      <button type="button" class="button-accent buzzer-button" data-action="buzzer-buzz" ${state.buzzerRunning ? '' : 'disabled'}>Buzz!</button>
                    </div>`
                  : ''
              }
              ${
                isSpeed
                  ? `<div class="controls">
                      <button type="button" data-action="speed-start" ${state.speedRunning || state.speedComplete ? 'disabled' : ''}>Start 60 seconds</button>
                    </div>`
                  : ''
              }
              <div class="controls">
                ${scoredQuestionControls}
              </div>
              <div class="controls">
                <button type="button" class="button-secondary" data-action="quiz-practice-prev" ${state.quizPracticeIndex === 0 ? 'disabled' : ''}>Previous</button>
                <button type="button" class="button-secondary" data-action="quiz-practice-next" ${
                  ['round', 'buzzer'].includes(state.quizPracticeMode) &&
                  state.quizPracticeIndex >= state.quizPractice.length - 1
                    ? 'disabled'
                    : isSpeed && !state.speedRunning
                      ? 'disabled'
                      : ''
                }>Next question</button>
              </div>
            </div>
          `
          : '<p class="notice error">No questions are available for this chapter range.</p>'
      }
    </section>
  `;
}

function stopFlashRevealTimer() {
  if (state.flashRevealTimer) window.clearInterval(state.flashRevealTimer);
  state.flashRevealTimer = null;
  state.flashAutoPlay = false;
}

function startFlashRevealAutoplay() {
  if (state.flashRevealTimer) window.clearInterval(state.flashRevealTimer);
  state.flashRevealed = true;
  state.flashAutoPlay = true;
  const delay = FLASH_REVEAL_SPEEDS[state.flashRevealSpeed] ?? FLASH_REVEAL_SPEEDS.normal;
  state.flashRevealTimer = window.setInterval(() => {
    state.flashRevealCount = advanceRevealCount(state.flashRevealCount, state.flashWords.length);
    if (state.flashRevealCount >= state.flashWords.length) {
      stopFlashRevealTimer();
    }
    renderFlashcards();
  }, delay);
}

function syncFlashWords() {
  const card = state.flashcards[state.flashIndex];
  if (!card || state.flashDeck !== 'memory') {
    state.flashWords = [];
    state.flashRevealCount = 0;
    return;
  }
  state.flashWords = tokenizeVerse(card.text);
  state.flashRevealCount = 0;
}

function prepareFlashcards() {
  stopFlashRevealTimer();
  const cards =
    state.flashDeck === 'questions' ? filteredQuizQuestions() : filteredData().memoryVerses;
  state.flashcards = adaptiveShuffle(
    cards,
    state.flashDeck === 'questions' ? 'questions' : 'verses',
    activeProfile(),
  );
  state.flashIndex = 0;
  state.flashRevealed = false;
  syncFlashWords();
}

function renderFlashcards() {
  if (!state.flashcards.length) prepareFlashcards();
  const card = state.flashcards[state.flashIndex];
  const isQuestion = state.flashDeck === 'questions';
  const slow = !isQuestion && state.flashSlowReveal;
  if (
    !isQuestion &&
    (!state.flashWords.length ||
      state.flashWords.join(' ') !== tokenizeVerse(card.text).join(' '))
  ) {
    syncFlashWords();
  }
  const verseBody = slow
    ? revealedVerseText(state.flashWords, state.flashRevealCount)
    : card.text;
  const fullyRevealed = !slow || state.flashRevealCount >= state.flashWords.length;
  const front = isQuestion
    ? `<span class="flashcard-content">
        <span class="flashcard-type">${escapeHtml(card.type)}</span>
        <span class="flashcard-text">${escapeHtml(card.question)}</span>
        <span class="game-meta">Tap to reveal the answer</span>
      </span>`
    : `<span class="flashcard-content">
        <span class="flashcard-reference">${escapeHtml(card.reference)}</span>
        <span class="game-meta">${slow ? 'Tap to start revealing words' : 'Tap to reveal the verse'}</span>
      </span>`;
  const back = isQuestion
    ? `<span class="flashcard-content">
        <span class="flashcard-answer">${escapeHtml(card.answer)}</span>
        <span class="flashcard-answer-reference">${escapeHtml(card.reference)}</span>
      </span>`
    : `<span class="flashcard-content">
        <span class="flashcard-text">${escapeHtml(verseBody)}</span>
        <span class="flashcard-jump">Jump words: ${escapeHtml(card.jumpWords)}</span>
        ${
          slow
            ? `<span class="game-meta">${state.flashRevealCount} of ${state.flashWords.length} words</span>`
            : ''
        }
      </span>`;
  app.innerHTML = `
    ${renderGameHeader('Flash Cards', 'Practice memory verses or official quiz questions.')}
    <div class="toolbar">
      <label class="field">
        Card deck
        <select id="flash-deck">
          <option value="memory"${isQuestion ? '' : ' selected'}>Memory verses</option>
          <option value="questions"${isQuestion ? ' selected' : ''}>Official questions</option>
        </select>
      </label>
      ${
        isQuestion
          ? ''
          : `
        <label class="field checkbox-field">
          <input id="flash-slow-reveal" type="checkbox"${state.flashSlowReveal ? ' checked' : ''}>
          Slow reveal
        </label>
      `
      }
    </div>
    <div class="status-row">
      <span>Card ${state.flashIndex + 1} of ${state.flashcards.length}</span>
      <span>${escapeHtml(card.reference)}</span>
    </div>
    <button class="flashcard" type="button" data-action="flip" aria-pressed="${state.flashRevealed}">
      ${state.flashRevealed ? back : front}
    </button>
    ${
      slow
        ? `
      <div class="controls flash-reveal-controls">
        <button type="button" data-action="flash-next-word"${fullyRevealed && state.flashRevealed ? ' disabled' : ''}>Next word</button>
        <button type="button" class="button-secondary" data-action="flash-reveal-all">Reveal all</button>
        <button type="button" class="button-secondary" data-action="flash-autoplay">${state.flashAutoPlay ? 'Pause' : 'Auto-play'}</button>
        <label class="field">
          Speed
          <select id="flash-reveal-speed">
            <option value="slow"${state.flashRevealSpeed === 'slow' ? ' selected' : ''}>Slow</option>
            <option value="normal"${state.flashRevealSpeed === 'normal' ? ' selected' : ''}>Normal</option>
            <option value="fast"${state.flashRevealSpeed === 'fast' ? ' selected' : ''}>Fast</option>
          </select>
        </label>
      </div>
    `
        : ''
    }
    <div class="controls">
      <button type="button" class="button-secondary" data-action="flash-prev">Previous</button>
      <button type="button" data-action="flip">${state.flashRevealed ? 'Hide' : 'Reveal'} ${isQuestion ? 'answer' : 'verse'}</button>
      <button type="button" data-action="flash-correct">Got it</button>
      <button type="button" class="button-accent" data-action="flash-practice">Needs practice</button>
      <button type="button" class="button-secondary" data-action="flash-next">Next</button>
      <button type="button" class="button-secondary" data-action="flash-shuffle">Shuffle</button>
    </div>
  `;
}

function newBlank() {
  const verses = adaptiveShuffle(filteredData().memoryVerses, 'verses', activeProfile());
  state.blank = createBlankQuestion(verses[0], state.blankRatio);
}

function refreshBlankSameVerse() {
  if (!state.blank?.verse) {
    newBlank();
    return;
  }
  state.blank = createBlankQuestion(state.blank.verse, state.blankRatio);
}

function renderFillBlank() {
  if (!state.blank) newBlank();
  const { verse, words, answers } = state.blank;
  const percent = Math.round(state.blankRatio * 100);
  app.innerHTML = `
    ${renderGameHeader('Fill in the Blank', 'Type each missing word, then check your answer.')}
    <section class="panel center">
      <div class="toolbar">
        <label class="field blank-ratio-field">
          Blank difficulty
          <input
            id="blank-ratio"
            type="range"
            min="0"
            max="100"
            step="1"
            value="${percent}"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${percent}"
            aria-valuetext="${percent} percent blanks"
          >
          <span id="blank-ratio-label" class="game-meta">${percent}% blanks</span>
        </label>
        <button type="button" data-action="blank-new">New verse</button>
      </div>
      <p class="eyebrow">${escapeHtml(verse.reference)}</p>
      <div class="blank-verse">
        ${
          answers.size === 0
            ? escapeHtml(words.join(' '))
            : words
                .map((word, index) =>
                  answers.has(index)
                    ? `<label>
                  <span class="sr-only">Missing word ${index + 1}</span>
                  <input class="blank-input" type="text" data-blank-index="${index}" autocomplete="off">
                </label>`
                    : escapeHtml(word),
                )
                .join(' ')
        }
      </div>
      <div id="blank-result" aria-live="polite"></div>
      <div class="controls">
        <button type="button" data-action="blank-check"${answers.size ? '' : ' disabled'}>Check answers</button>
        <button type="button" class="button-secondary" data-action="blank-hint"${answers.size ? '' : ' disabled'}>Give a hint</button>
        <button type="button" class="button-secondary" data-action="blank-reveal"${answers.size ? '' : ' disabled'}>Reveal answer</button>
      </div>
    </section>
  `;
}

function newJeopardy() {
  const { memoryVerses, uniqueWords } = filteredData();
  state.jeopardy = createJeopardyBoard(
    memoryVerses,
    uniqueWords,
    filteredQuizQuestions(),
    state.jeopardyMode,
  );
  state.teams = [0, 0];
}

function renderJeopardy() {
  if (!state.jeopardy) newJeopardy();
  const cells = [];
  state.jeopardy.forEach((category) => {
    cells.push(`<div class="category">${escapeHtml(category.name)}</div>`);
  });
  for (let row = 0; row < 5; row += 1) {
    state.jeopardy.forEach((category, column) => {
      const clue = category.clues[row];
      cells.push(`
        <button
          class="clue-tile${clue.used ? ' used' : ''}"
          type="button"
          data-jeopardy-column="${column}"
          data-jeopardy-row="${row}"
          ${clue.used ? 'disabled' : ''}
        >${clue.value}</button>
      `);
    });
  }
  app.innerHTML = `
    ${renderGameHeader('Jeopardy', 'Select a value, read the clue, and award points to a team.')}
    <section class="panel">
      <div class="toolbar">
        <label class="field">
          Board type
          <select id="jeopardy-mode">
            <option value="official"${state.jeopardyMode === 'official' ? ' selected' : ''}>Official questions</option>
            <option value="drills"${state.jeopardyMode === 'drills' ? ' selected' : ''}>Study drills</option>
          </select>
        </label>
        <button type="button" data-action="jeopardy-reset">Create board</button>
      </div>
      <div class="jeopardy-board">${cells.join('')}</div>
      <div class="team-scores">
        ${state.teams
          .map(
            (score, index) => `
              <div class="team">
                Team ${index + 1}
                <strong>${score}</strong>
                <div class="team-actions">
                  <button type="button" aria-label="Subtract 100 from Team ${index + 1}" data-team="${index}" data-score="-100">-</button>
                  <button type="button" aria-label="Add 100 to Team ${index + 1}" data-team="${index}" data-score="100">+</button>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
      <div class="controls">
        <button type="button" class="button-secondary" data-action="team-add" ${state.teams.length >= 4 ? 'disabled' : ''}>Add team</button>
        <button type="button" class="button-secondary" data-action="team-remove" ${state.teams.length <= 2 ? 'disabled' : ''}>Remove team</button>
        <button type="button" class="button-danger" data-action="jeopardy-reset">New board</button>
      </div>
    </section>
  `;
}

function openClue(column, row) {
  const clue = state.jeopardy[column].clues[row];
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `
    <section class="clue-dialog" role="dialog" aria-modal="true" aria-labelledby="clue-title">
      <p class="eyebrow">${escapeHtml(state.jeopardy[column].name)} for ${clue.value}</p>
      <h2 id="clue-title" class="question-text">${escapeHtml(clue.clue)}</h2>
      <div id="clue-answer" hidden>
        <p class="eyebrow">Answer</p>
        <p class="question-text">${escapeHtml(clue.answer)}</p>
      </div>
      <div class="controls">
        <button type="button" data-action="clue-reveal">Reveal answer</button>
        <button type="button" class="button-secondary" data-action="clue-close">Back to board</button>
      </div>
    </section>
  `;
  backdrop.dataset.column = column;
  backdrop.dataset.row = row;
  document.body.append(backdrop);
  backdrop.querySelector('button').focus();
}

function wordSearchSettings() {
  const difficulty = document.querySelector('#word-difficulty')?.value ?? 'medium';
  return {
    difficulty,
    size: { easy: 11, medium: 14, hard: 17 }[difficulty],
    count: { easy: 7, medium: 10, hard: 13 }[difficulty],
  };
}

function newWordSearch() {
  const { size, count } = wordSearchSettings();
  const words = adaptiveShuffle(filteredData().uniqueWords, 'uniqueWords', activeProfile());
  state.wordSearch = createWordSearch(words, size, count);
  state.wordSearchStart = null;
  state.foundWords = new Set();
}

function renderWordSearch() {
  if (!state.wordSearch) newWordSearch();
  const puzzle = state.wordSearch;
  const foundCells = new Set();
  puzzle.placements
    .filter(({ word }) => state.foundWords.has(word))
    .forEach(({ cells }) => cells.forEach(({ x, y }) => foundCells.add(`${x},${y}`)));
  app.innerHTML = `
    ${renderGameHeader('Word Search', 'Select the first and last letter of each hidden word.')}
    <section class="panel">
      <div class="toolbar">
        <label class="field">
          Difficulty
          <select id="word-difficulty">
            <option value="easy"${puzzle.size === 11 ? ' selected' : ''}>Easy</option>
            <option value="medium"${puzzle.size === 14 ? ' selected' : ''}>Medium</option>
            <option value="hard"${puzzle.size === 17 ? ' selected' : ''}>Hard</option>
          </select>
        </label>
        <button type="button" data-action="word-new">New puzzle</button>
        <button type="button" class="button-secondary" data-action="word-reveal">Reveal words</button>
      </div>
      <div class="word-search-layout">
        <div
          class="word-grid"
          style="grid-template-columns: repeat(${puzzle.size}, 1fr)"
          aria-label="Word search grid"
        >
          ${puzzle.grid
            .flatMap((row, y) =>
              row.map(
                (letter, x) => `
                  <button
                    class="letter${foundCells.has(`${x},${y}`) ? ' found' : ''}"
                    type="button"
                    data-word-x="${x}"
                    data-word-y="${y}"
                    aria-label="${letter}, row ${y + 1}, column ${x + 1}"
                  >${letter}</button>
                `,
              ),
            )
            .join('')}
        </div>
        <div>
          <h2>Find these words</h2>
          <ul class="word-list">
            ${puzzle.placements
              .map(
                ({ word }) =>
                  `<li class="${state.foundWords.has(word) ? 'found' : ''}">${escapeHtml(word)}</li>`,
              )
              .join('')}
          </ul>
          <p>${state.foundWords.size} of ${puzzle.placements.length} found</p>
        </div>
      </div>
    </section>
  `;
}

function newVerseScramble() {
  const verses = adaptiveShuffle(filteredData().memoryVerses, 'verses', activeProfile());
  const verse = verses[0];
  state.scramble = createVerseScramble(verse);
  state.scrambleSelected = [];
}

function renderVerseScramble() {
  if (!state.scramble) newVerseScramble();
  const selected = new Set(state.scrambleSelected);
  const selectedChunks = state.scrambleSelected.map((id) =>
    state.scramble.chunks.find((chunk) => chunk.id === id),
  );

  app.innerHTML = `
    ${renderGameHeader('Verse Scramble', 'Build the memory verse by selecting each phrase in order.')}
    <section class="panel center">
      <p class="eyebrow">${escapeHtml(state.scramble.verse.reference)}</p>
      <div class="scramble-answer" aria-label="Your arranged verse">
        ${
          selectedChunks.length
            ? selectedChunks
                .map((chunk) => `<span class="scramble-piece placed">${escapeHtml(chunk.text)}</span>`)
                .join('')
            : '<span class="game-meta">Your verse will appear here.</span>'
        }
      </div>
      <div class="scramble-pool" aria-label="Available verse phrases">
        ${state.scramble.shuffled
          .map(
            (chunk) => `
              <button
                type="button"
                class="scramble-piece"
                data-scramble-chunk="${chunk.id}"
                ${selected.has(chunk.id) ? 'disabled' : ''}
              >${escapeHtml(chunk.text)}</button>
            `,
          )
          .join('')}
      </div>
      <div id="scramble-result" aria-live="polite"></div>
      <div class="controls">
        <button type="button" data-action="scramble-check">Check verse</button>
        <button type="button" class="button-secondary" data-action="scramble-undo" ${selectedChunks.length ? '' : 'disabled'}>Undo last</button>
        <button type="button" class="button-secondary" data-action="scramble-reset">Start over</button>
        <button type="button" class="button-accent" data-action="scramble-new">New verse</button>
      </div>
    </section>
  `;
}

function newSituationChallenge() {
  const questions = adaptiveShuffle(
    filteredQuizQuestions().filter(({ typeCode }) => typeCode === 'S'),
    'questions',
    activeProfile(),
  );
  const candidates =
    questions.length > 1
      ? questions.filter((question) => question.id !== state.situation?.id)
      : questions;
  state.situation = candidates[Math.floor(Math.random() * candidates.length)];
  state.situationRevealed = false;
}

function renderSituationChallenge() {
  if (!state.situation) newSituationChallenge();
  const question = state.situation;
  app.innerHTML = `
    ${renderGameHeader('Situation Challenge', 'Practice the people and circumstances surrounding quotations.')}
    <section class="panel center">
      <div class="status-row">
        <span>${escapeHtml(chapterLabel())}</span>
        <span>Score: ${state.situationScore.correct} / ${state.situationScore.total}</span>
      </div>
      <p class="eyebrow">Situation question</p>
      <h2 class="question-text">${escapeHtml(question.question)}</h2>
      <div ${state.situationRevealed ? '' : 'hidden'}>
        <p class="eyebrow">Answer</p>
        <p class="question-text">${escapeHtml(question.answer)}</p>
        <p class="game-meta">${escapeHtml(question.reference)}</p>
      </div>
      <div class="controls">
        <button type="button" data-action="situation-reveal" ${state.situationRevealed ? 'disabled' : ''}>Reveal answer</button>
        <button type="button" data-action="situation-correct" ${state.situationRevealed ? '' : 'disabled'}>I got it</button>
        <button type="button" class="button-accent" data-action="situation-review" ${state.situationRevealed ? '' : 'disabled'}>Needs review</button>
        <button type="button" class="button-secondary" data-action="situation-next">Skip / next</button>
      </div>
    </section>
  `;
}

function clearScriptureHighlightTimer() {
  if (state.scriptureHighlightTimer) window.clearTimeout(state.scriptureHighlightTimer);
  state.scriptureHighlightTimer = null;
}

function jumpToScriptureVerse(chapter, verse) {
  clearScriptureHighlightTimer();
  state.scriptureChapter = Number(chapter);
  state.scriptureFocusVerse = Number(verse);
  void renderScripture().then(() => {
    window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-verse="${verse}"]`);
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    });
  });
  state.scriptureHighlightTimer = window.setTimeout(() => {
    state.scriptureFocusVerse = null;
    state.scriptureHighlightTimer = null;
    const focused = document.querySelector('.concordance-focus');
    focused?.classList.remove('concordance-focus');
  }, CONCORDANCE_HIGHLIGHT_MS);
}

async function renderScripture() {
  const session = state.scriptureSession;
  if (!session) {
    app.innerHTML = `
      ${renderGameHeader('Scripture', 'Chapter text is not available in this build.')}
      <section class="panel"><p>Regenerate study data to include Scripture chapters.</p></section>
    `;
    return;
  }

  const book = state.scriptureBook || 'John';
  const chapterNumbers = await session.listChapters(book);
  if (!chapterNumbers.length) {
    app.innerHTML = `
      ${renderGameHeader('Scripture', 'Chapter text is not available in this build.')}
      <section class="panel"><p>Regenerate study data to include Scripture chapters.</p></section>
    `;
    return;
  }
  if (!chapterNumbers.includes(Number(state.scriptureChapter))) {
    state.scriptureChapter = chapterNumbers[0];
  }

  const view = await session.getChapterView(book, state.scriptureChapter);
  const body = renderScriptureVerses(view.verses, view.memoryVerses, view.uniqueWords, {
    showMemory: state.scriptureShowMemory,
    showUnique: state.scriptureShowUnique,
    focusVerse: state.scriptureFocusVerse,
  });
  const searchResults = await session.search(state.scriptureSearch, {
    book,
    chapter: state.scriptureChapter,
  });
  const uniqueBrowser = await session.listUniqueWords({
    chapter: state.scriptureChapter,
    query: state.scriptureUniqueFilter,
  });
  const translation = view.metadata?.translation || '';
  const abbreviation = view.metadata?.abbreviation || '';
  const attribution =
    view.metadata?.scriptureAttribution || view.metadata?.copyright || '';
  const source = view.metadata?.source || '';
  const providerUrl = view.metadata?.providerUrl || '';
  const ipHolder = view.metadata?.ipHolder || '';
  const ipHolderUrl = view.metadata?.ipHolderUrl || '';
  const requiresBiblicaLink = Boolean(view.metadata?.requiresBiblicaLink);
  const requiresAttributionLink = Boolean(view.metadata?.limits?.requiresAttributionLink);
  const label =
    [abbreviation || translation, translation && abbreviation && abbreviation !== translation ? translation : '']
      .filter(Boolean)
      .join(' - ') ||
    translation ||
    abbreviation;
  const footerParts = [];
  if (label) footerParts.push(`<p class="scripture-translation">${escapeHtml(label)}</p>`);
  if (source) footerParts.push(`<p class="scripture-source">Source: ${escapeHtml(source)}</p>`);
  if (attribution) footerParts.push(`<p class="scripture-attribution">${escapeHtml(attribution)}</p>`);
  if (providerUrl && (requiresAttributionLink || view.metadata?.provider === 'api.bible')) {
    footerParts.push(
      `<p class="scripture-provider-link"><a href="${escapeHtml(providerUrl)}" target="_blank" rel="noopener noreferrer">API.Bible</a></p>`,
    );
  } else if (providerUrl) {
    footerParts.push(
      `<p class="scripture-provider-link"><a href="${escapeHtml(providerUrl)}" target="_blank" rel="noopener noreferrer">Provider</a></p>`,
    );
  }
  if (requiresBiblicaLink && ipHolderUrl) {
    footerParts.push(
      `<p class="scripture-ip-link"><a href="${escapeHtml(ipHolderUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ipHolder || 'Copyright holder')}</a></p>`,
    );
  } else if (ipHolder && ipHolderUrl) {
    footerParts.push(
      `<p class="scripture-ip-link"><a href="${escapeHtml(ipHolderUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ipHolder)}</a></p>`,
    );
  } else if (ipHolder) {
    footerParts.push(`<p class="scripture-ip-holder">${escapeHtml(ipHolder)}</p>`);
  }

  app.innerHTML = `
    ${renderGameHeader('Scripture', 'Read the chapter with concordance search and study highlights.')}
    <section class="panel">
      <div class="toolbar">
        <label class="field">
          Chapter
          <select id="scripture-chapter">
            ${chapterNumbers
              .map(
                (chapter) =>
                  `<option value="${chapter}"${
                    chapter === state.scriptureChapter ? ' selected' : ''
                  }>${escapeHtml(book)} ${chapter}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="field checkbox-field">
          <input id="scripture-memory" type="checkbox"${state.scriptureShowMemory ? ' checked' : ''}>
          Memory verses
        </label>
        <label class="field checkbox-field">
          <input id="scripture-unique" type="checkbox"${state.scriptureShowUnique ? ' checked' : ''}>
          Unique words
        </label>
      </div>
      <div class="concordance-panel">
        <label class="field">
          Search this chapter
          <input id="scripture-search" type="search" value="${escapeHtml(state.scriptureSearch)}" placeholder="Word or phrase" autocomplete="off">
        </label>
        <ul class="concordance-results" role="listbox" aria-label="Scripture search results">
          ${
            state.scriptureSearch.trim()
              ? searchResults.length
                ? searchResults
                    .map(
                      (row) => `
                <li>
                  <button type="button" class="concordance-hit" role="option" data-jump-chapter="${row.chapter}" data-jump-verse="${row.verse}">
                    <strong>${escapeHtml(row.reference)}</strong>
                    <span>${escapeHtml(row.snippet)}</span>
                  </button>
                </li>`,
                    )
                    .join('')
                : '<li class="game-meta">No matches in this chapter.</li>'
              : '<li class="game-meta">Type a word or phrase to search.</li>'
          }
        </ul>
        <label class="field">
          Unique words
          <input id="scripture-unique-filter" type="search" value="${escapeHtml(state.scriptureUniqueFilter)}" placeholder="Filter unique words" autocomplete="off">
        </label>
        <ul class="unique-word-browser" role="listbox" aria-label="Unique words for this chapter">
          ${
            uniqueBrowser.length
              ? uniqueBrowser
                  .map(
                    (row) => `
              <li>
                <button type="button" class="concordance-hit" role="option" data-jump-chapter="${row.chapter}" data-jump-verse="${row.verseStart}">
                  <strong>${escapeHtml(row.word)}</strong>
                  <span>${escapeHtml(row.reference)}</span>
                </button>
              </li>`,
                  )
                  .join('')
              : '<li class="game-meta">No unique words match this filter.</li>'
          }
        </ul>
      </div>
      <div class="scripture-legend game-meta" aria-hidden="true">
        <span class="legend-memory">Memory verse</span>
        <span class="legend-unique">Unique word</span>
      </div>
      <article class="scripture-text" aria-label="${escapeHtml(book)} ${state.scriptureChapter}">
        ${body}
      </article>
      ${
        footerParts.length
          ? `<footer class="scripture-footer game-meta">${footerParts.join('')}</footer>`
          : ''
      }
    </section>
  `;
}

function routeTo(route) {
  if (route === 'questions') route = 'quiz-practice';
  if (route !== 'quiz-practice') {
    stopBuzzerReader();
    stopSpeedTimer();
  }
  if (route !== 'flashcards') stopFlashRevealTimer();
  if (route !== 'scripture') clearScriptureHighlightTimer();
  state.blank = null;
  state.wordSearch = null;
  state.jeopardy = null;
  if (route === 'home') renderHome();
  if (route === 'progress') renderProgressDashboard();
  if (route === 'quiz-practice') {
    if (!state.quizPractice.length && state.chapter !== 'all') {
      state.quizPracticeFrom = Number(state.chapter);
      state.quizPracticeThrough = Number(state.chapter);
    }
    renderQuizPractice();
  }
  if (route === 'scripture') {
    if (state.chapter !== 'all') state.scriptureChapter = Number(state.chapter);
    void renderScripture();
  }
  if (route === 'flashcards') {
    prepareFlashcards();
    renderFlashcards();
  }
  if (route === 'fill-blank') renderFillBlank();
  if (route === 'jeopardy') renderJeopardy();
  if (route === 'word-search') renderWordSearch();
  if (route === 'verse-scramble') renderVerseScramble();
  if (route === 'situation-challenge') renderSituationChallenge();
  homeButton.hidden = route === 'home';
  history.replaceState(null, '', `#${route}`);
  app.focus();
}

function showResult(element, correct, message) {
  element.innerHTML = `<p class="notice ${correct ? 'success' : 'error'}">${escapeHtml(message)}</p>`;
  announce(message);
}

function handleBlankCheck() {
  const result = document.querySelector('#blank-result');
  const entries = [...document.querySelectorAll('[data-blank-index]')];
  const incorrect = entries.filter((input) => {
    const expected = state.blank.answers.get(Number(input.dataset.blankIndex));
    return normalizeAnswer(input.value) !== expected;
  });
  showResult(
    result,
    incorrect.length === 0,
    incorrect.length === 0
      ? 'Excellent! Every word is correct.'
      : `${incorrect.length} ${incorrect.length === 1 ? 'word needs' : 'words need'} another try.`,
  );
  trackActivity({
    contentType: 'verses',
    contentId: state.blank.verse.reference,
    result: incorrect.length === 0 ? 'correct' : 'review',
    game: 'fill-blank',
    chapter: state.blank.verse.chapter,
  });
  incorrect[0]?.focus();
}

function handleWordCell(button) {
  const cell = { x: Number(button.dataset.wordX), y: Number(button.dataset.wordY) };
  if (!state.wordSearchStart) {
    state.wordSearchStart = cell;
    button.classList.add('selected');
    announce('Starting letter selected. Choose the ending letter.');
    return;
  }

  const selectedCells = cellsOnLine(state.wordSearchStart, cell);
  const selected = selectedCells
    .map(({ x, y }) => state.wordSearch.grid[y][x])
    .join('');
  const reversed = [...selected].reverse().join('');
  const placement = state.wordSearch.placements.find(
    ({ word }) => !state.foundWords.has(word) && (word === selected || word === reversed),
  );
  state.wordSearchStart = null;
  if (placement) {
    state.foundWords.add(placement.word);
    const sourceWord = filteredData().uniqueWords.find(
      ({ word }) => normalizeAnswer(word).replaceAll('-', '').toUpperCase() === placement.word,
    );
    if (sourceWord) {
      trackActivity({
        contentType: 'uniqueWords',
        contentId: `${sourceWord.word}|${sourceWord.reference}`,
        result: 'correct',
        game: 'word-search',
        chapter: sourceWord.chapter,
      });
    }
    announce(`Found ${placement.word}.`);
    renderWordSearch();
    if (state.foundWords.size === state.wordSearch.placements.length) {
      recordGameSession(activeProfile(), 'word-search', state.foundWords.size);
      persistProfiles();
      announce('Puzzle complete! You found every word.');
    }
  } else {
    document.querySelectorAll('.letter.selected').forEach((element) => element.classList.remove('selected'));
    announce('That line is not one of the hidden words. Try again.');
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button, [data-route]');
  if (!target) return;

  if (target.dataset.route) routeTo(target.dataset.route);
  if (target.dataset.action === 'home') routeTo('home');
  if (target.dataset.action === 'profile-save') {
    renameProfile(
      activeProfile(),
      document.querySelector('#profile-name').value,
      document.querySelector('#profile-avatar').value,
    );
    persistProfiles();
    renderProgressDashboard('Profile updated.');
  }
  if (target.dataset.action === 'profile-add') {
    const name = document.querySelector('#new-profile-name').value;
    const avatar = document.querySelector('#new-profile-avatar').value;
    addProfile(state.profileStore, name, avatar);
    resetPersonalizedGameState();
    persistProfiles();
    renderProgressDashboard('New profile created.');
  }
  if (target.dataset.action === 'profile-export') {
    const profile = activeProfile();
    const blob = new Blob([exportProfile(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bible-quiz-${profile.name.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-') || 'profile'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    announce('Profile exported.');
  }
  if (target.dataset.action === 'profile-delete') {
    const profile = activeProfile();
    if (window.confirm(`Delete ${profile.name} and all saved progress? This cannot be undone.`)) {
      deleteProfile(state.profileStore, profile.id);
      resetPersonalizedGameState();
      persistProfiles();
      renderProgressDashboard('Profile deleted.');
    }
  }
  if (target.dataset.action === 'quiz-practice-start') {
    state.quizPracticeFrom = Number(document.querySelector('#quiz-practice-from').value);
    state.quizPracticeThrough = Number(document.querySelector('#quiz-practice-through').value);
    state.quizPracticeType = document.querySelector('#quiz-practice-type').value;
    state.quizPracticeShuffle = document.querySelector('#quiz-practice-order').value === 'shuffle';
    state.quizPracticeMode = document.querySelector('#quiz-practice-mode').value;
    prepareQuizPractice();
    renderQuizPractice();
  }
  if (target.dataset.action === 'buzzer-start') startBuzzerReader();
  if (target.dataset.action === 'buzzer-buzz') {
    stopBuzzerReader();
    state.buzzerBuzzed = true;
    renderQuizPractice();
    announce(`Buzzed after ${state.buzzerWordCount} words.`);
  }
  if (target.dataset.action === 'speed-start') startSpeedRound();
  if (target.dataset.action === 'quiz-practice-reveal') {
    state.quizPracticeRevealed = true;
    renderQuizPractice();
    announce('Answer revealed.');
  }
  if (
    target.dataset.action === 'quiz-practice-correct' ||
    target.dataset.action === 'quiz-practice-review'
  ) {
    const question = state.quizPractice[state.quizPracticeIndex];
    const result = target.dataset.action === 'quiz-practice-correct' ? 'correct' : 'review';
    state.quizPracticeResults.set(`${state.quizPracticeIndex}:${question.id}`, result);
    trackActivity({
      contentType: 'questions',
      contentId: question.id,
      result,
      game: `quiz-${state.quizPracticeMode}`,
      chapter: question.chapter,
      questionType: question.typeCode,
      metadata:
        state.quizPracticeMode === 'buzzer'
          ? { buzzerWords: state.buzzerWordCount }
          : {},
    });
    if (
      ['round', 'buzzer'].includes(state.quizPracticeMode) &&
      state.quizPracticeIndex === state.quizPractice.length - 1 &&
      !state.quizSessionRecorded
    ) {
      const score = [...state.quizPracticeResults.values()].filter(
        (value) => value === 'correct',
      ).length;
      recordGameSession(activeProfile(), `quiz-${state.quizPracticeMode}`, score);
      state.quizSessionRecorded = true;
      persistProfiles();
    }
    if (state.quizPracticeMode === 'speed' && state.speedRunning) {
      moveQuizPractice(1);
    }
    renderQuizPractice();
    announce(
      result === 'correct'
        ? `Marked correct.${state.quizPracticeMode === 'speed' ? ' Next question.' : ''}`
        : `Marked for review.${state.quizPracticeMode === 'speed' ? ' Next question.' : ''}`,
    );
  }
  if (
    target.dataset.action === 'quiz-practice-next' ||
    target.dataset.action === 'quiz-practice-prev'
  ) {
    const direction = target.dataset.action === 'quiz-practice-next' ? 1 : -1;
    moveQuizPractice(direction);
    renderQuizPractice();
  }
  if (target.dataset.action === 'flip') {
    const card = state.flashcards[state.flashIndex];
    const slow = state.flashDeck === 'memory' && state.flashSlowReveal;
    if (slow && state.flashRevealed && state.flashRevealCount < state.flashWords.length) {
      state.flashRevealCount = advanceRevealCount(state.flashRevealCount, state.flashWords.length);
      renderFlashcards();
      return;
    }
    if (!state.flashRevealed) {
      trackActivity({
        contentType: state.flashDeck === 'questions' ? 'questions' : 'verses',
        contentId: state.flashDeck === 'questions' ? card.id : card.reference,
        result: 'exposure',
        game: 'flashcards',
        chapter: card.chapter,
        questionType: card.typeCode,
      });
      if (slow) {
        state.flashRevealCount = Math.max(1, state.flashRevealCount);
      }
    } else if (slow) {
      stopFlashRevealTimer();
      state.flashRevealCount = 0;
    }
    state.flashRevealed = !state.flashRevealed;
    renderFlashcards();
  }
  if (target.dataset.action === 'flash-next-word') {
    if (!state.flashRevealed) state.flashRevealed = true;
    state.flashRevealCount = advanceRevealCount(state.flashRevealCount, state.flashWords.length);
    if (state.flashRevealCount >= state.flashWords.length) stopFlashRevealTimer();
    renderFlashcards();
  }
  if (target.dataset.action === 'flash-reveal-all') {
    stopFlashRevealTimer();
    state.flashRevealed = true;
    state.flashRevealCount = state.flashWords.length;
    renderFlashcards();
  }
  if (target.dataset.action === 'flash-autoplay') {
    if (state.flashAutoPlay) {
      stopFlashRevealTimer();
      renderFlashcards();
      return;
    }
    startFlashRevealAutoplay();
    renderFlashcards();
  }
  if (target.dataset.action === 'flash-next' || target.dataset.action === 'flash-prev') {
    stopFlashRevealTimer();
    const direction = target.dataset.action === 'flash-next' ? 1 : -1;
    state.flashIndex = (state.flashIndex + direction + state.flashcards.length) % state.flashcards.length;
    state.flashRevealed = false;
    syncFlashWords();
    renderFlashcards();
  }
  if (target.dataset.action === 'flash-shuffle') {
    prepareFlashcards();
    renderFlashcards();
  }
  if (
    target.dataset.action === 'flash-practice' ||
    target.dataset.action === 'flash-correct'
  ) {
    stopFlashRevealTimer();
    const card = state.flashcards[state.flashIndex];
    const result = target.dataset.action === 'flash-correct' ? 'correct' : 'review';
    trackActivity({
      contentType: state.flashDeck === 'questions' ? 'questions' : 'verses',
      contentId: state.flashDeck === 'questions' ? card.id : card.reference,
      result,
      game: 'flashcards',
      chapter: card.chapter,
      questionType: card.typeCode,
    });
    state.flashIndex = (state.flashIndex + 1) % state.flashcards.length;
    state.flashRevealed = false;
    syncFlashWords();
    renderFlashcards();
    announce(result === 'correct' ? 'Marked correct. Next card.' : 'Marked for review. Next card.');
  }
  if (target.dataset.jumpChapter) {
    jumpToScriptureVerse(target.dataset.jumpChapter, target.dataset.jumpVerse);
  }
  if (target.dataset.action === 'blank-new') {
    newBlank();
    renderFillBlank();
  }
  if (target.dataset.action === 'blank-check') handleBlankCheck();
  if (target.dataset.action === 'blank-hint') {
    const empty = [...document.querySelectorAll('[data-blank-index]')].find((input) => !input.value);
    if (empty) {
      const answer = state.blank.answers.get(Number(empty.dataset.blankIndex));
      empty.value = answer[0];
      empty.focus();
      announce(`Hint: the word begins with ${answer[0]}.`);
    }
  }
  if (target.dataset.action === 'blank-reveal') {
    document.querySelectorAll('[data-blank-index]').forEach((input) => {
      input.value = state.blank.answers.get(Number(input.dataset.blankIndex));
    });
    showResult(document.querySelector('#blank-result'), true, state.blank.verse.text);
  }
  if (target.dataset.jeopardyColumn) {
    openClue(Number(target.dataset.jeopardyColumn), Number(target.dataset.jeopardyRow));
  }
  if (target.dataset.action === 'clue-reveal') {
    document.querySelector('#clue-answer').hidden = false;
    target.disabled = true;
  }
  if (target.dataset.action === 'clue-close') {
    const backdrop = target.closest('.dialog-backdrop');
    state.jeopardy[Number(backdrop.dataset.column)].clues[Number(backdrop.dataset.row)].used = true;
    backdrop.remove();
    renderJeopardy();
  }
  if (target.dataset.score) {
    state.teams[Number(target.dataset.team)] += Number(target.dataset.score);
    renderJeopardy();
  }
  if (target.dataset.action === 'team-add' && state.teams.length < 4) {
    state.teams.push(0);
    renderJeopardy();
  }
  if (target.dataset.action === 'team-remove' && state.teams.length > 2) {
    state.teams.pop();
    renderJeopardy();
  }
  if (target.dataset.action === 'jeopardy-reset') {
    newJeopardy();
    renderJeopardy();
  }
  if (target.dataset.scrambleChunk) {
    state.scrambleSelected.push(target.dataset.scrambleChunk);
    renderVerseScramble();
  }
  if (target.dataset.action === 'scramble-check') {
    const expected = state.scramble.chunks.map(({ id }) => id);
    const correct =
      expected.length === state.scrambleSelected.length &&
      expected.every((id, index) => state.scrambleSelected[index] === id);
    trackActivity({
      contentType: 'verses',
      contentId: state.scramble.verse.reference,
      result: correct ? 'correct' : 'review',
      game: 'verse-scramble',
      chapter: state.scramble.verse.chapter,
    });
    showResult(
      document.querySelector('#scramble-result'),
      correct,
      correct ? 'Excellent! The verse is in the correct order.' : 'Not quite. Adjust the phrases and try again.',
    );
  }
  if (target.dataset.action === 'scramble-undo') {
    state.scrambleSelected.pop();
    renderVerseScramble();
  }
  if (target.dataset.action === 'scramble-reset') {
    state.scrambleSelected = [];
    renderVerseScramble();
  }
  if (target.dataset.action === 'scramble-new') {
    newVerseScramble();
    renderVerseScramble();
  }
  if (target.dataset.action === 'situation-reveal') {
    state.situationRevealed = true;
    renderSituationChallenge();
    announce('Answer revealed.');
  }
  if (
    target.dataset.action === 'situation-correct' ||
    target.dataset.action === 'situation-review'
  ) {
    const correct = target.dataset.action === 'situation-correct';
    state.situationScore.total += 1;
    if (correct) state.situationScore.correct += 1;
    trackActivity({
      contentType: 'questions',
      contentId: state.situation.id,
      result: correct ? 'correct' : 'review',
      game: 'situation-challenge',
      chapter: state.situation.chapter,
      questionType: state.situation.typeCode,
    });
    newSituationChallenge();
    renderSituationChallenge();
    announce(correct ? 'Marked correct. Next situation.' : 'Marked for review. Next situation.');
  }
  if (target.dataset.action === 'situation-next') {
    newSituationChallenge();
    renderSituationChallenge();
  }
  if (target.dataset.wordX) handleWordCell(target);
  if (target.dataset.action === 'word-new') {
    newWordSearch();
    renderWordSearch();
  }
  if (target.dataset.action === 'word-reveal') {
    state.wordSearch.placements.forEach(({ word }) => state.foundWords.add(word));
    renderWordSearch();
    announce('All hidden words revealed.');
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.id === 'profile-switch') {
    state.profileStore.activeProfileId = event.target.value;
    resetPersonalizedGameState();
    persistProfiles();
    routeTo(location.hash.slice(1) || 'home');
  }
  if (event.target.id === 'profile-import') {
    const [file] = event.target.files;
    if (file) {
      try {
        if (file.size > 2_000_000) throw new Error('Profile files must be smaller than 2 MB.');
        importProfile(await file.text(), state.profileStore);
        resetPersonalizedGameState();
        persistProfiles();
        renderProgressDashboard('Profile imported.');
      } catch (error) {
        renderProgressDashboard(error.message, 'error');
      }
    }
  }
  if (event.target.id === 'chapter-filter') {
    state.chapter = event.target.value;
    state.scramble = null;
    state.situation = null;
    state.situationScore = { correct: 0, total: 0 };
    savePreferences();
    renderHome();
  }
  if (event.target.id === 'blank-ratio') {
    state.blankRatio = Number(event.target.value) / 100;
    savePreferences();
    const label = document.querySelector('#blank-ratio-label');
    if (label) label.textContent = `${Math.round(state.blankRatio * 100)}% blanks`;
    refreshBlankSameVerse();
    renderFillBlank();
  }
  if (event.target.id === 'flash-deck') {
    state.flashDeck = event.target.value;
    prepareFlashcards();
    renderFlashcards();
  }
  if (event.target.id === 'flash-slow-reveal') {
    stopFlashRevealTimer();
    state.flashSlowReveal = event.target.checked;
    // Reduced motion: auto-play stays off by default; user may still enable it.
    if (state.flashSlowReveal && prefersReducedMotion()) {
      state.flashAutoPlay = false;
    }
    state.flashRevealed = false;
    syncFlashWords();
    savePreferences();
    renderFlashcards();
  }
  if (event.target.id === 'flash-reveal-speed') {
    state.flashRevealSpeed = event.target.value;
    savePreferences();
    if (state.flashAutoPlay) {
      startFlashRevealAutoplay();
      renderFlashcards();
    }
  }
  if (event.target.id === 'jeopardy-mode') {
    state.jeopardyMode = event.target.value;
    newJeopardy();
    renderJeopardy();
  }
  if (event.target.id === 'word-difficulty') {
    newWordSearch();
    renderWordSearch();
  }
  if (event.target.id === 'scripture-chapter') {
    state.scriptureChapter = Number(event.target.value);
    state.scriptureFocusVerse = null;
    void renderScripture();
  }
  if (event.target.id === 'scripture-memory') {
    state.scriptureShowMemory = event.target.checked;
    void renderScripture();
  }
  if (event.target.id === 'scripture-unique') {
    state.scriptureShowUnique = event.target.checked;
    void renderScripture();
  }
  if (event.target.id === 'scripture-search') {
    state.scriptureSearch = event.target.value;
    void renderScripture().then(() => {
      const input = document.querySelector('#scripture-search');
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    });
  }
  if (event.target.id === 'scripture-unique-filter') {
    state.scriptureUniqueFilter = event.target.value;
    void renderScripture().then(() => {
      const input = document.querySelector('#scripture-unique-filter');
      if (input) {
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    });
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'blank-ratio') {
    state.blankRatio = Number(event.target.value) / 100;
    const label = document.querySelector('#blank-ratio-label');
    if (label) label.textContent = `${Math.round(state.blankRatio * 100)}% blanks`;
    event.target.setAttribute('aria-valuenow', String(Math.round(state.blankRatio * 100)));
    event.target.setAttribute(
      'aria-valuetext',
      `${Math.round(state.blankRatio * 100)} percent blanks`,
    );
  }
  if (event.target.id === 'scripture-search') {
    state.scriptureSearch = event.target.value;
    const caret = event.target.selectionStart;
    void renderScripture().then(() => {
      const input = document.querySelector('#scripture-search');
      if (input) {
        input.focus();
        const pos = caret ?? input.value.length;
        input.setSelectionRange(pos, pos);
      }
    });
  }
  if (event.target.id === 'scripture-unique-filter') {
    state.scriptureUniqueFilter = event.target.value;
    const caret = event.target.selectionStart;
    void renderScripture().then(() => {
      const input = document.querySelector('#scripture-unique-filter');
      if (input) {
        input.focus();
        const pos = caret ?? input.value.length;
        input.setSelectionRange(pos, pos);
      }
    });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelector('.dialog-backdrop')?.remove();
  }
});

async function initialize() {
  try {
    const response = await fetch('data/study-data.json');
    if (!response.ok) throw new Error(`Study data returned ${response.status}`);
    state.data = await response.json();
    const apiMeta = await probeApiBibleProvider();
    if (apiMeta) {
      state.scriptureProvider = createApiBibleProvider();
    } else {
      state.scriptureProvider = createLocalScriptureProvider(state.data);
    }
    state.scriptureSession = createScriptureSession(state.scriptureProvider, state.data);
    state.profileStore = loadProfileStore();
    persistProfiles();
    loadPreferences();
    routeTo(location.hash.slice(1) || 'home');

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('service-worker.js').catch((error) => {
        console.warn('Offline support could not start:', error);
      });
    }
  } catch (error) {
    console.error(error);
    app.innerHTML = `
      <section class="panel center">
        <h1>We could not load the study material.</h1>
        <p>Start the app with <code>npm start</code> and refresh this page.</p>
      </section>
    `;
  }
}

initialize();
