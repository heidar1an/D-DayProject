/*
 * ذخیره‌سازیِ ایستر اگ — namespace اختصاصی `tapesh:easterEgg:*`.
 * هرگز به کلیدهای موجود پروژه دست نمی‌زند و در محیطِ بدون localStorage
 * (حالتِ خصوصی/سندباکس) بی‌صدا رد می‌شود.
 */

const NS = 'tapesh:easterEgg:';
const HIGH_SCORE_KEY = `${NS}highScore`;
const MUTED_KEY = `${NS}muted`;

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* دسترسی به localStorage ممکن نیست؛ بازی باید بدون ذخیره هم کار کند */
  }
}

export function readHighScore() {
  const parsed = Number.parseInt(read(HIGH_SCORE_KEY) ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** @returns {{best:number, isNew:boolean}} */
export function submitScore(score) {
  const best = readHighScore();
  if (score > best) {
    write(HIGH_SCORE_KEY, String(score));
    return { best: score, isNew: true };
  }
  return { best, isNew: false };
}

export function readMuted() {
  return read(MUTED_KEY) === '1';
}

export function saveMuted(muted) {
  write(MUTED_KEY, muted ? '1' : '0');
}
