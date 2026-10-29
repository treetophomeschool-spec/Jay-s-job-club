import {
  BuiltInHabitId,
  CUSTOM_HABIT_SLOTS,
  DailyHabitId,
  DailyHabitTrackerRecord,
  HABIT_ACTIVE_DATE_REGEX,
  HABIT_CUSTOM_LABEL_MAX,
  HABIT_CUSTOM_LABEL_MIN,
  HABIT_ID_ALLOWLIST,
  HABIT_LAST_LABEL_MAX,
  MAX_HABIT_ENERGY,
  MAX_LIFETIME_ENERGY,
  MAX_TOKEN_COUNT,
} from '../firebase';
import { screenForHarmToHumansOrAnimals } from './ethicalGuard';

export interface MasteryHabitDefinition {
  id: DailyHabitId;
  label: string;
  detail: string;
  energyReward: number;
  categoryLabel: string;
  isCustom: boolean;
}

export const BUILT_IN_MASTERY_HABITS: MasteryHabitDefinition[] = [
  {
    id: 'focus_15m',
    label: '15 mins focus',
    detail:
      'Complete 15 minutes of undisturbed craft bench work, study notes, or task focus.',
    energyReward: 15,
    categoryLabel: 'Deep Focus',
    isCustom: false,
  },
  {
    id: 'community_outreach',
    label: 'Community outreach',
    detail:
      'Connect with a collaborator, mentor, Job Centre buddy, or share an encouraging resource.',
    energyReward: 20,
    categoryLabel: 'Outreach',
    isCustom: false,
  },
  {
    id: 'job_slip_step',
    label: 'Job slip micro-step',
    detail:
      'Finish one practical step on an active Job Centre slip or special-interest trade pathway.',
    energyReward: 20,
    categoryLabel: 'Job Steps',
    isCustom: false,
  },
  {
    id: 'skill_practice',
    label: 'Trade & tool practice',
    detail:
      'Practise hands-on maker skills, refine a portfolio piece, or organise workbench tools.',
    energyReward: 15,
    categoryLabel: 'Craft Mastery',
    isCustom: false,
  },
  {
    id: 'sensory_pacing',
    label: 'Regulated pace & rest',
    detail:
      'Honour energy pacing, hydration, or a Mezzanine Chill Pod reset before fatigue builds.',
    energyReward: 10,
    categoryLabel: 'Sustainable Pace',
    isCustom: false,
  },
];

export const CUSTOM_HABIT_ENERGY_REWARD = 15;
export const COUNTERWEIGHT_ENERGY_THRESHOLD = 30;
export const WINDSHIELD_ENERGY_THRESHOLD = 60;
export const BOUGH_BOOST_ENERGY_COST = 15;
export const CANOPY_BOOST_ENERGY_COST = 25;

export const DAILY_HABITS_STORAGE_KEY = 'jays_job_club_daily_habits_v1';
export const DAILY_HABITS_CHANGED_EVENT = 'jaysjobclub:daily-habits-changed';

export function getLocalTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDayIso(todayIso: string): string {
  const parts = todayIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return '';
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() - 1);
  return getLocalTodayIso(dt);
}

export function buildAllMasteryHabits(
  customHabitLabels: string[]
): MasteryHabitDefinition[] {
  const cleanCustom = sanitizeCustomHabitLabels(customHabitLabels);
  const customDefs: MasteryHabitDefinition[] = cleanCustom.map((label, idx) => ({
    id: CUSTOM_HABIT_SLOTS[idx],
    label,
    detail: 'Custom personal mastery milestone saved to your daily checklist.',
    energyReward: CUSTOM_HABIT_ENERGY_REWARD,
    categoryLabel: 'Personal Goal',
    isCustom: true,
  }));
  return [...BUILT_IN_MASTERY_HABITS, ...customDefs];
}

export function getHabitRewardById(id: DailyHabitId): number {
  const found = BUILT_IN_MASTERY_HABITS.find(
    (h) => h.id === (id as BuiltInHabitId)
  );
  return found ? found.energyReward : CUSTOM_HABIT_ENERGY_REWARD;
}

export function sanitizeCompletedHabitIds(
  ids: unknown,
  customCount = 5
): DailyHabitId[] {
  if (!Array.isArray(ids)) return [];
  const validCustomIds = new Set<string>(
    CUSTOM_HABIT_SLOTS.slice(0, Math.max(0, Math.min(5, customCount)))
  );
  const allowedBuiltIn = new Set<string>(
    BUILT_IN_MASTERY_HABITS.map((h) => h.id)
  );
  const seen = new Set<DailyHabitId>();
  const result: DailyHabitId[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    if (!HABIT_ID_ALLOWLIST.includes(raw as DailyHabitId)) continue;
    if (!allowedBuiltIn.has(raw) && !validCustomIds.has(raw)) continue;
    const typed = raw as DailyHabitId;
    if (!seen.has(typed)) {
      seen.add(typed);
      result.push(typed);
    }
    if (result.length >= 10) break;
  }
  return result;
}

export function sanitizeCustomHabitLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  const result: string[] = [];
  for (const raw of labels) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, HABIT_CUSTOM_LABEL_MAX);
    if (trimmed.length >= HABIT_CUSTOM_LABEL_MIN) {
      result.push(trimmed);
    }
    if (result.length >= 5) break;
  }
  return result;
}

export function buildDefaultDailyHabitState(
  todayIso = getLocalTodayIso()
): DailyHabitTrackerRecord {
  return {
    activeDate: todayIso,
    energyPoints: 0,
    lifetimeEnergyEarned: 0,
    totalMilestonesLogged: 0,
    dailyStreak: 0,
    bestStreak: 0,
    completedIdsToday: [],
    customHabitLabels: [],
    lastMilestoneLabel: '',
    lastLoggedDate: '',
    updatedAtMs: 0,
    source: 'local',
  };
}

export function normalizeDailyHabitState(
  raw: Partial<DailyHabitTrackerRecord> | null | undefined,
  todayIso = getLocalTodayIso()
): DailyHabitTrackerRecord {
  const base = buildDefaultDailyHabitState(todayIso);
  if (!raw) return base;

  const customHabitLabels = sanitizeCustomHabitLabels(raw.customHabitLabels);
  const storedDate =
    typeof raw.activeDate === 'string' &&
    HABIT_ACTIVE_DATE_REGEX.test(raw.activeDate)
      ? raw.activeDate
      : todayIso;

  const energyPoints = Math.min(
    MAX_HABIT_ENERGY,
    Math.max(0, Math.floor(Number(raw.energyPoints) || 0))
  );
  const lifetimeEnergyEarned = Math.min(
    MAX_LIFETIME_ENERGY,
    Math.max(
      energyPoints,
      Math.floor(Number(raw.lifetimeEnergyEarned) || energyPoints)
    )
  );
  const totalMilestonesLogged = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(0, Math.floor(Number(raw.totalMilestonesLogged) || 0))
  );

  let completedIdsToday = sanitizeCompletedHabitIds(
    raw.completedIdsToday,
    customHabitLabels.length
  );
  let dailyStreak = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(0, Math.floor(Number(raw.dailyStreak) || 0))
  );
  let bestStreak = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(dailyStreak, Math.floor(Number(raw.bestStreak) || 0))
  );

  const inferredLastLoggedDate =
    typeof raw.lastLoggedDate === 'string' &&
    HABIT_ACTIVE_DATE_REGEX.test(raw.lastLoggedDate)
      ? raw.lastLoggedDate
      : completedIdsToday.length > 0
        ? storedDate
        : '';

  // Roll over to a fresh checklist when a new calendar day starts
  if (storedDate !== todayIso) {
    completedIdsToday = [];
    const yesterdayIso = getPreviousDayIso(todayIso);
    if (
      inferredLastLoggedDate !== todayIso &&
      inferredLastLoggedDate !== yesterdayIso &&
      storedDate !== yesterdayIso
    ) {
      dailyStreak = 0;
    }
  }

  bestStreak = Math.max(bestStreak, dailyStreak);

  const lastMilestoneLabel =
    typeof raw.lastMilestoneLabel === 'string'
      ? raw.lastMilestoneLabel.trim().slice(0, HABIT_LAST_LABEL_MAX)
      : '';

  return {
    activeDate: todayIso,
    energyPoints,
    lifetimeEnergyEarned,
    totalMilestonesLogged,
    dailyStreak,
    bestStreak,
    completedIdsToday,
    customHabitLabels,
    lastMilestoneLabel,
    lastLoggedDate: inferredLastLoggedDate,
    updatedAtMs:
      typeof raw.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs)
        ? raw.updatedAtMs
        : 0,
    source: raw.source === 'cloud' ? 'cloud' : 'local',
  };
}

export function loadLocalDailyHabitState(): DailyHabitTrackerRecord {
  const todayIso = getLocalTodayIso();
  if (typeof window === 'undefined') {
    return buildDefaultDailyHabitState(todayIso);
  }
  try {
    const raw = window.localStorage.getItem(DAILY_HABITS_STORAGE_KEY);
    if (!raw) return buildDefaultDailyHabitState(todayIso);
    const parsed = JSON.parse(raw) as Partial<DailyHabitTrackerRecord>;
    return normalizeDailyHabitState({ ...parsed, source: 'local' }, todayIso);
  } catch {
    return buildDefaultDailyHabitState(todayIso);
  }
}

export function saveLocalDailyHabitState(state: DailyHabitTrackerRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DAILY_HABITS_STORAGE_KEY,
      JSON.stringify(state)
    );
    window.dispatchEvent(new Event(DAILY_HABITS_CHANGED_EVENT));
  } catch {
    // Ignore storage quota issues
  }
}

export function mergeCloudAndLocalHabitState(
  local: DailyHabitTrackerRecord,
  cloud: DailyHabitTrackerRecord | null
): DailyHabitTrackerRecord {
  const normLocal = normalizeDailyHabitState(local);
  if (!cloud) return normLocal;
  const normCloud = normalizeDailyHabitState(cloud);
  return normLocal.updatedAtMs > normCloud.updatedAtMs ? normLocal : normCloud;
}

export interface ToggleHabitOutcome {
  nextState: DailyHabitTrackerRecord;
  justCompleted: boolean;
  energyDelta: number;
  habitLabel: string;
}

export function toggleHabitMilestone(
  current: DailyHabitTrackerRecord,
  habitId: DailyHabitId
): ToggleHabitOutcome {
  const todayIso = getLocalTodayIso();
  const normalized = normalizeDailyHabitState(current, todayIso);
  const allHabits = buildAllMasteryHabits(normalized.customHabitLabels);
  const target = allHabits.find((h) => h.id === habitId);
  if (!target) {
    return {
      nextState: normalized,
      justCompleted: false,
      energyDelta: 0,
      habitLabel: '',
    };
  }

  const alreadyDone = normalized.completedIdsToday.includes(habitId);

  if (alreadyDone) {
    const nextCompleted = normalized.completedIdsToday.filter(
      (id) => id !== habitId
    );
    const nextEnergy = Math.max(0, normalized.energyPoints - target.energyReward);
    const nextLifetime = Math.max(
      nextEnergy,
      normalized.lifetimeEnergyEarned - target.energyReward
    );
    const nextTotal = Math.max(0, normalized.totalMilestonesLogged - 1);
    return {
      nextState: {
        ...normalized,
        activeDate: todayIso,
        energyPoints: nextEnergy,
        lifetimeEnergyEarned: nextLifetime,
        totalMilestonesLogged: nextTotal,
        completedIdsToday: nextCompleted,
        updatedAtMs: Date.now(),
      },
      justCompleted: false,
      energyDelta: -target.energyReward,
      habitLabel: target.label,
    };
  }

  const wasEmptyToday = normalized.completedIdsToday.length === 0;
  const nextCompleted = sanitizeCompletedHabitIds(
    [...normalized.completedIdsToday, habitId],
    normalized.customHabitLabels.length
  );
  const nextEnergy = Math.min(
    MAX_HABIT_ENERGY,
    normalized.energyPoints + target.energyReward
  );
  const nextLifetime = Math.min(
    MAX_LIFETIME_ENERGY,
    Math.max(nextEnergy, normalized.lifetimeEnergyEarned + target.energyReward)
  );
  const nextTotal = Math.min(
    MAX_TOKEN_COUNT,
    normalized.totalMilestonesLogged + 1
  );

  let nextDailyStreak = normalized.dailyStreak;
  let nextLastLoggedDate = normalized.lastLoggedDate;
  if (wasEmptyToday && normalized.lastLoggedDate !== todayIso) {
    const yesterdayIso = getPreviousDayIso(todayIso);
    nextDailyStreak =
      normalized.lastLoggedDate === yesterdayIso
        ? Math.min(MAX_TOKEN_COUNT, normalized.dailyStreak + 1)
        : Math.max(1, normalized.dailyStreak > 0 ? normalized.dailyStreak : 1);
    nextLastLoggedDate = todayIso;
  } else if (nextDailyStreak === 0) {
    nextDailyStreak = 1;
    nextLastLoggedDate = todayIso;
  }

  const nextBestStreak = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(normalized.bestStreak, nextDailyStreak)
  );

  return {
    nextState: {
      ...normalized,
      activeDate: todayIso,
      energyPoints: nextEnergy,
      lifetimeEnergyEarned: nextLifetime,
      totalMilestonesLogged: nextTotal,
      dailyStreak: nextDailyStreak,
      bestStreak: nextBestStreak,
      completedIdsToday: nextCompleted,
      lastMilestoneLabel: target.label.slice(0, HABIT_LAST_LABEL_MAX),
      lastLoggedDate: nextLastLoggedDate,
      updatedAtMs: Date.now(),
    },
    justCompleted: true,
    energyDelta: target.energyReward,
    habitLabel: target.label,
  };
}

export function spendHabitEnergy(
  current: DailyHabitTrackerRecord,
  cost: number
): { ok: boolean; nextState: DailyHabitTrackerRecord } {
  const normalized = normalizeDailyHabitState(current);
  if (cost <= 0 || normalized.energyPoints < cost) {
    return { ok: false, nextState: normalized };
  }
  const nextEnergy = Math.max(0, normalized.energyPoints - cost);
  return {
    ok: true,
    nextState: {
      ...normalized,
      energyPoints: nextEnergy,
      lifetimeEnergyEarned: Math.max(nextEnergy, normalized.lifetimeEnergyEarned),
      updatedAtMs: Date.now(),
    },
  };
}

export function validateCustomHabitMilestone(rawLabel: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const cleaned = rawLabel.trim().replace(/\s+/g, ' ');
  if (cleaned.length < HABIT_CUSTOM_LABEL_MIN) {
    return {
      valid: false,
      cleaned,
      error: 'Enter at least 2 characters for your custom milestone.',
    };
  }
  if (cleaned.length > HABIT_CUSTOM_LABEL_MAX) {
    return {
      valid: false,
      cleaned: cleaned.slice(0, HABIT_CUSTOM_LABEL_MAX),
      error: `Keep milestone labels under ${HABIT_CUSTOM_LABEL_MAX} characters.`,
    };
  }
  const safety = screenForHarmToHumansOrAnimals(cleaned);
  if (!safety.safe) {
    return {
      valid: false,
      cleaned,
      error:
        safety.reason ||
        'Please keep mastery milestones constructive, safe, and respectful.',
    };
  }
  return { valid: true, cleaned };
}

export function addCustomHabitMilestone(
  current: DailyHabitTrackerRecord,
  rawLabel: string
): {
  ok: boolean;
  nextState: DailyHabitTrackerRecord;
  error?: string;
} {
  const normalized = normalizeDailyHabitState(current);
  if (normalized.customHabitLabels.length >= 5) {
    return {
      ok: false,
      nextState: normalized,
      error: 'Up to 5 custom daily milestones can be saved at once.',
    };
  }
  const check = validateCustomHabitMilestone(rawLabel);
  if (!check.valid) {
    return {
      ok: false,
      nextState: normalized,
      error: check.error,
    };
  }
  const duplicate = normalized.customHabitLabels.some(
    (existing) => existing.toLowerCase() === check.cleaned.toLowerCase()
  );
  if (duplicate) {
    return {
      ok: false,
      nextState: normalized,
      error: 'That milestone is already in your daily tracker.',
    };
  }
  return {
    ok: true,
    nextState: {
      ...normalized,
      customHabitLabels: [...normalized.customHabitLabels, check.cleaned],
      updatedAtMs: Date.now(),
    },
  };
}

export function removeCustomHabitMilestone(
  current: DailyHabitTrackerRecord,
  customIndex: number
): DailyHabitTrackerRecord {
  const normalized = normalizeDailyHabitState(current);
  if (
    customIndex < 0 ||
    customIndex >= normalized.customHabitLabels.length
  ) {
    return normalized;
  }
  const nextLabels = normalized.customHabitLabels.filter(
    (_, idx) => idx !== customIndex
  );
  // Remap completed custom slot indices cleanly after removal
  const keptBuiltIns = normalized.completedIdsToday.filter(
    (id) => !id.startsWith('custom_')
  );
  const shiftedCustoms: DailyHabitId[] = [];
  normalized.customHabitLabels.forEach((_, oldIdx) => {
    if (oldIdx === customIndex) return;
    const oldSlot = CUSTOM_HABIT_SLOTS[oldIdx];
    if (normalized.completedIdsToday.includes(oldSlot)) {
      const newIdx = oldIdx > customIndex ? oldIdx - 1 : oldIdx;
      shiftedCustoms.push(CUSTOM_HABIT_SLOTS[newIdx]);
    }
  });
  return {
    ...normalized,
    customHabitLabels: nextLabels,
    completedIdsToday: sanitizeCompletedHabitIds(
      [...keptBuiltIns, ...shiftedCustoms],
      nextLabels.length
    ),
    updatedAtMs: Date.now(),
  };
}
