/**
 * Dual Calendar & Daily Mastery Streak Utilities
 * Formats dates and timestamps in both UK Gregorian (en-GB) and Islamic Hijri calendars,
 * with progressive Intl fallbacks (islamic-umalqura -> islamic-civil -> tabular math)
 * so every browser and server runtime renders accurate UK + Hijri dates.
 */

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi I',
  'Rabi II',
  'Jumada I',
  'Jumada II',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
] as const;

function toValidDate(input?: number | Date): Date {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return new Date(input);
  }
  return new Date();
}

/**
 * Pure arithmetic Kuwaiti/Tabular Hijri fallback if an environment lacks ICU Islamic calendars.
 */
function fallbackTabularHijri(date: Date): string {
  const jd =
    Math.floor(date.getTime() / 86400000) + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.min(12, Math.max(1, Math.floor((24 * l) / 709)));
  const day = Math.max(1, l - Math.floor((709 * month) / 24));
  const year = 30 * n + j - 30;
  return `${day} ${HIJRI_MONTHS[month - 1]} ${year} AH`;
}

export function formatUkDate(input?: number | Date): string {
  const d = toValidDate(input);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toUTCString().slice(5, 16);
  }
}

export function formatUkDateTime(input?: number | Date): string {
  const d = toValidDate(input);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return formatUkDate(d);
  }
}

export function formatIslamicDate(input?: number | Date): string {
  const d = toValidDate(input);
  const locales = [
    'en-GB-u-ca-islamic-umalqura',
    'en-GB-u-ca-islamic-civil',
    'en-u-ca-islamic',
  ];

  for (const loc of locales) {
    try {
      const fmt = new Intl.DateTimeFormat(loc, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const resolved = fmt.resolvedOptions().calendar;
      if (resolved && resolved.includes('islamic')) {
        const formatted = fmt.format(d).replace(/\s*AH$/i, '').trim();
        return `${formatted} AH`;
      }
    } catch {
      // Try next calendar locale
    }
  }

  return fallbackTabularHijri(d);
}

export function formatDualCalendarBanner(input?: number | Date): {
  ukDate: string;
  islamicDate: string;
  combined: string;
} {
  const ukDate = formatUkDate(input);
  const islamicDate = formatIslamicDate(input);
  return {
    ukDate,
    islamicDate,
    combined: `UK: ${ukDate} · Hijri: ${islamicDate}`,
  };
}

export function formatDualTimestamp(ms?: number): string {
  if (!ms) return 'Just now';
  const ukDt = formatUkDateTime(ms);
  const hijri = formatIslamicDate(ms);
  return `${ukDt} (UK) · ${hijri}`;
}

export function getLocalIsoDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDateKeyToUtcMidnightMs(key: string): number | null {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export interface StreakEvaluationResult {
  changed: boolean;
  dailyStreak: number;
  bestStreak: number;
  lastStreakDate: string;
  milestoneBonusTokens: number;
  usedGraceDay: boolean;
}

/**
 * Evaluates Daily Mastery Streak with a compassionate 1-day neuro-affirming grace buffer:
 * - Same day: already recorded today (changed = false)
 * - Next day (diff == 1): increments streak by 1
 * - 1 missed day (diff == 2): preserves streak via 1-day grace buffer and increments by 1
 * - >= 3 days gap or first day: starts fresh at Day 1 while preserving Best Streak
 * - Milestones at 3, 7, 14, 21, 30... award +2 Treehouse Tokens
 */
export function evaluateDailyStreakTransition(
  prevStreak: number,
  prevBest: number,
  lastDateKey: string,
  todayKey: string = getLocalIsoDateKey()
): StreakEvaluationResult {
  const safePrev = Math.max(0, Math.floor(prevStreak || 0));
  const safeBest = Math.max(safePrev, Math.floor(prevBest || 0));

  if (lastDateKey === todayKey && safePrev >= 1) {
    return {
      changed: false,
      dailyStreak: safePrev,
      bestStreak: safeBest,
      lastStreakDate: todayKey,
      milestoneBonusTokens: 0,
      usedGraceDay: false,
    };
  }

  const lastMs = parseIsoDateKeyToUtcMidnightMs(lastDateKey);
  const todayMs = parseIsoDateKeyToUtcMidnightMs(todayKey);

  let nextStreak = 1;
  let usedGraceDay = false;

  if (lastMs !== null && todayMs !== null && safePrev >= 1) {
    const dayDiff = Math.round((todayMs - lastMs) / 86400000);
    if (dayDiff <= 0) {
      return {
        changed: false,
        dailyStreak: safePrev,
        bestStreak: safeBest,
        lastStreakDate: lastDateKey,
        milestoneBonusTokens: 0,
        usedGraceDay: false,
      };
    }
    if (dayDiff === 1) {
      nextStreak = safePrev + 1;
    } else if (dayDiff === 2) {
      nextStreak = safePrev + 1;
      usedGraceDay = true;
    } else {
      nextStreak = 1;
    }
  }

  const nextBest = Math.max(safeBest, nextStreak);
  const isMilestone =
    nextStreak === 3 ||
    nextStreak === 7 ||
    (nextStreak >= 14 && nextStreak % 7 === 0);

  return {
    changed: true,
    dailyStreak: nextStreak,
    bestStreak: nextBest,
    lastStreakDate: todayKey,
    milestoneBonusTokens: isMilestone ? 2 : 0,
    usedGraceDay,
  };
}
