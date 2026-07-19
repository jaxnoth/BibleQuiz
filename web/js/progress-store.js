export const PROFILE_STORAGE_KEY = 'bibleQuiz.profileStore.v1';
export const PROFILE_SCHEMA_VERSION = 1;

const defaultAvatars = ['⭐', '📖', '🕊️', '🐟', '🌿', '🏆'];

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyStats() {
  return {
    attempts: 0,
    correct: 0,
    review: 0,
    streakDays: 0,
    lastPracticeDate: null,
    byChapter: {},
    byQuestionType: {},
    games: {},
  };
}

export function createProfile(name = 'Player 1', avatar = defaultAvatars[0], now = new Date()) {
  const timestamp = now.toISOString();
  return {
    id: createId(),
    name: String(name).trim().slice(0, 40) || 'Player',
    avatar: defaultAvatars.includes(avatar) ? avatar : defaultAvatars[0],
    createdAt: timestamp,
    updatedAt: timestamp,
    stats: emptyStats(),
    content: {
      questions: {},
      verses: {},
      uniqueWords: {},
    },
  };
}

export function createProfileStore(now = new Date()) {
  const profile = createProfile('Player 1', defaultAvatars[0], now);
  return {
    version: PROFILE_SCHEMA_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('The profile is not valid.');
  const normalized = createProfile(profile.name, profile.avatar);
  normalized.id = typeof profile.id === 'string' && profile.id ? profile.id : createId();
  normalized.createdAt = profile.createdAt || normalized.createdAt;
  normalized.updatedAt = profile.updatedAt || normalized.updatedAt;
  normalized.stats = {
    ...emptyStats(),
    ...(profile.stats && typeof profile.stats === 'object' ? profile.stats : {}),
  };
  normalized.stats.byChapter = { ...(profile.stats?.byChapter ?? {}) };
  normalized.stats.byQuestionType = { ...(profile.stats?.byQuestionType ?? {}) };
  normalized.stats.games = { ...(profile.stats?.games ?? {}) };
  normalized.content = {
    questions: { ...(profile.content?.questions ?? {}) },
    verses: { ...(profile.content?.verses ?? {}) },
    uniqueWords: { ...(profile.content?.uniqueWords ?? {}) },
  };
  return normalized;
}

export function loadProfileStore(storage = globalThis.localStorage) {
  try {
    const source = storage?.getItem(PROFILE_STORAGE_KEY);
    if (!source) return createProfileStore();
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      return createProfileStore();
    }
    const profiles = parsed.profiles.map(normalizeProfile);
    const activeProfileId = profiles.some(({ id }) => id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : profiles[0].id;
    return { version: PROFILE_SCHEMA_VERSION, activeProfileId, profiles };
  } catch {
    return createProfileStore();
  }
}

export function saveProfileStore(store, storage = globalThis.localStorage) {
  const payload = {
    version: PROFILE_SCHEMA_VERSION,
    activeProfileId: store.activeProfileId,
    profiles: store.profiles,
  };
  storage?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
}

export function getActiveProfile(store) {
  return store.profiles.find(({ id }) => id === store.activeProfileId) ?? store.profiles[0];
}

export function addProfile(store, name, avatar) {
  const profile = createProfile(name, avatar);
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  return profile;
}

export function renameProfile(profile, name, avatar = profile.avatar) {
  profile.name = String(name).trim().slice(0, 40) || profile.name;
  profile.avatar = defaultAvatars.includes(avatar) ? avatar : profile.avatar;
  profile.updatedAt = new Date().toISOString();
}

export function deleteProfile(store, profileId) {
  store.profiles = store.profiles.filter(({ id }) => id !== profileId);
  if (store.profiles.length === 0) store.profiles.push(createProfile());
  if (!store.profiles.some(({ id }) => id === store.activeProfileId)) {
    store.activeProfileId = store.profiles[0].id;
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateStreak(stats, now) {
  const today = dateKey(now);
  if (stats.lastPracticeDate === today) return;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  stats.streakDays = stats.lastPracticeDate === dateKey(yesterday) ? stats.streakDays + 1 : 1;
  stats.lastPracticeDate = today;
}

function statsBucket(container, key) {
  if (!key) return null;
  container[key] ??= { attempts: 0, correct: 0, review: 0 };
  return container[key];
}

function applyResult(bucket, result) {
  if (!bucket || !['correct', 'review'].includes(result)) return;
  bucket.attempts += 1;
  bucket[result] += 1;
}

const masteryChanges = {
  questions: { correct: 0.22, review: -0.3, exposure: 0.01 },
  verses: { correct: 0.18, review: -0.24, exposure: 0.01 },
  uniqueWords: { correct: 0.08, review: -0.1, exposure: 0.01 },
};

export function recordActivity(
  profile,
  {
    contentType,
    contentId,
    result,
    game,
    chapter,
    questionType,
    metadata = {},
  },
  now = new Date(),
) {
  if (!profile.content[contentType]) throw new Error(`Unsupported content type: ${contentType}`);
  const records = profile.content[contentType];
  const record = records[contentId] ?? {
    attempts: 0,
    correct: 0,
    review: 0,
    exposures: 0,
    mastery: 0,
    lastPracticedAt: null,
  };

  if (result === 'exposure') {
    record.exposures = (record.exposures ?? 0) + 1;
  } else {
    record.attempts = (record.attempts ?? 0) + 1;
    record[result] = (record[result] ?? 0) + 1;
  }
  const change = masteryChanges[contentType]?.[result] ?? 0;
  record.mastery = Math.max(0, Math.min(1, (record.mastery ?? 0) + change));
  record.lastPracticedAt = now.toISOString();
  if (metadata.buzzerWords) {
    record.buzzerWordsTotal = (record.buzzerWordsTotal ?? 0) + metadata.buzzerWords;
    record.buzzerAttempts = (record.buzzerAttempts ?? 0) + 1;
  }
  records[contentId] = record;

  if (result !== 'exposure') {
    applyResult(profile.stats, result);
    applyResult(statsBucket(profile.stats.byChapter, String(chapter)), result);
    applyResult(statsBucket(profile.stats.byQuestionType, questionType), result);
    applyResult(statsBucket(profile.stats.games, game), result);
  } else {
    const gameStats = statsBucket(profile.stats.games, game);
    gameStats.exposures = (gameStats.exposures ?? 0) + 1;
  }

  updateStreak(profile.stats, now);
  profile.updatedAt = now.toISOString();
  return record;
}

export function recordGameSession(profile, game, score = null, now = new Date()) {
  const gameStats = statsBucket(profile.stats.games, game);
  gameStats.sessions = (gameStats.sessions ?? 0) + 1;
  if (Number.isFinite(score)) {
    gameStats.bestScore = Math.max(gameStats.bestScore ?? 0, score);
    gameStats.lastScore = score;
  }
  updateStreak(profile.stats, now);
  profile.updatedAt = now.toISOString();
}

function itemContentId(item, contentType) {
  if (contentType === 'questions') return item.id;
  if (contentType === 'verses') return item.reference;
  return `${item.word}|${item.reference}`;
}

function adaptiveWeight(item, contentType, profile) {
  const record = profile?.content?.[contentType]?.[itemContentId(item, contentType)];
  if (!record) return 4;
  const uncertainty = 1 - (record.mastery ?? 0);
  const reviewRate = record.attempts ? record.review / record.attempts : 0;
  return Math.max(0.3, 1 + uncertainty * 3 + reviewRate * 2);
}

export function adaptiveShuffle(items, contentType, profile, random = Math.random) {
  const remaining = [...items];
  const ordered = [];
  while (remaining.length) {
    const weights = remaining.map((item) => adaptiveWeight(item, contentType, profile));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let selection = random() * total;
    let index = 0;
    while (index < weights.length - 1 && selection > weights[index]) {
      selection -= weights[index];
      index += 1;
    }
    ordered.push(remaining.splice(index, 1)[0]);
  }
  return ordered;
}

export function profileSummary(profile) {
  const accuracy = profile.stats.attempts
    ? Math.round((profile.stats.correct / profile.stats.attempts) * 100)
    : 0;
  const weakQuestions = Object.entries(profile.content.questions)
    .filter(([, record]) => record.attempts > 0)
    .sort(([, left], [, right]) => left.mastery - right.mastery)
    .slice(0, 10)
    .map(([id, record]) => ({ id, ...record }));
  const weakVerses = Object.entries(profile.content.verses)
    .filter(([, record]) => record.attempts > 0)
    .sort(([, left], [, right]) => left.mastery - right.mastery)
    .slice(0, 8)
    .map(([reference, record]) => ({ reference, ...record }));
  return {
    attempts: profile.stats.attempts,
    correct: profile.stats.correct,
    review: profile.stats.review,
    accuracy,
    streakDays: profile.stats.streakDays,
    weakQuestions,
    weakVerses,
  };
}

export function exportProfile(profile) {
  return JSON.stringify(
    {
      kind: 'bible-quiz-profile',
      version: PROFILE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
    },
    null,
    2,
  );
}

export function importProfile(source, store) {
  let parsed;
  try {
    parsed = typeof source === 'string' ? JSON.parse(source) : source;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  if (parsed?.kind !== 'bible-quiz-profile' || !parsed.profile) {
    throw new Error('The selected file is not a Bible Quiz profile export.');
  }
  const profile = normalizeProfile(parsed.profile);
  profile.id = createId();
  profile.name = `${profile.name} (Imported)`.slice(0, 40);
  profile.updatedAt = new Date().toISOString();
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  return profile;
}

export function availableAvatars() {
  return [...defaultAvatars];
}
