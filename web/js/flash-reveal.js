export function tokenizeVerse(text) {
  return String(text ?? '')
    .split(/\s+/)
    .filter(Boolean);
}

export function revealedVerseText(words, count) {
  const total = words.length;
  const shown = Math.max(0, Math.min(count, total));
  if (shown === 0) return '...';
  if (shown >= total) return words.join(' ');
  return `${words.slice(0, shown).join(' ')} ...`;
}

export function advanceRevealCount(count, total) {
  return Math.min(total, Math.max(0, count) + 1);
}

export const FLASH_REVEAL_SPEEDS = {
  slow: 1100,
  normal: 700,
  fast: 400,
};

export function prefersReducedMotion(windowObject = globalThis) {
  return Boolean(windowObject?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}
