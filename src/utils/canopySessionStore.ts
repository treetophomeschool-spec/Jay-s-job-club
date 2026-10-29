import {
  CanopyTradeFocus,
  MAX_TOKEN_COUNT,
  POTENTIAL_JOB_MAX_LENGTH,
  SPECIAL_INTEREST_MAX_LENGTH,
  TreeProgressState,
  TreetopTradeTrack,
  USERNAME_MAX_LENGTH,
} from '../firebase';
import { suggestDeterministicJobRoles } from './interestJobBridge';

export type CanopySessionMode = 'trade' | 'work' | 'community';

export interface ActiveCanopySession {
  id: string;
  entrantHandle: string;
  specialInterest: string;
  matchedJobRole: string;
  tradeTrack: TreetopTradeTrack;
  canopyFocus: CanopyTradeFocus;
  sessionMode: CanopySessionMode;
  tryingDelta: number;
  gatheringDelta: number;
  canopyDelta: number;
  totalTryingAfter: number;
  totalGatheringAfter: number;
  totalCanopyAfter: number;
  steps: string[];
  completedSteps: boolean[];
  sessionCompleted: boolean;
  createdAtMs: number;
}

const ACTIVE_SESSION_STORAGE_KEY = 'jays_job_club_active_canopy_session_v1';
const GROWTH_RINGS_STORAGE_KEY = 'jays_job_club_growth_rings_v1';
export const CANOPY_SESSION_CHANGED_EVENT = 'jays-job-club-canopy-session-changed';

export const SESSION_MODE_META: Record<
  CanopySessionMode,
  {
    label: string;
    shortHeading: string;
    canopyBanner: string;
  }
> = {
  trade: {
    label: 'Trade',
    shortHeading: 'Learn-a-Trade Bench Session',
    canopyBanner: '33m Canopy · Trade Bench & Tools of the Trade Session',
  },
  work: {
    label: 'Work',
    shortHeading: 'Maker Work & Bottling Session',
    canopyBanner: '33m Canopy · Practical Work, Labelling & Store Session',
  },
  community: {
    label: 'Community',
    shortHeading: 'Community Outreach & Calm Session',
    canopyBanner: '33m Canopy · Community Outreach & Relaxation Session',
  },
};

export function mapTrackToCanopyFocus(
  track: TreetopTradeTrack,
  mode: CanopySessionMode
): CanopyTradeFocus {
  if (mode === 'community') return 'Community Outreach';
  switch (track) {
    case 'Woodcraft & Joinery':
      return 'Woodcraft & Joinery';
    case 'Metalwork & Lanterns':
      return 'Metalwork & Lanterns';
    case 'Textiles & Weaving':
      return 'Textiles & Weaving';
    case 'Repair & Maker Tools':
    case 'Digital & Systems Craft':
      return 'Repair & Maker Tools';
    case 'Botanical & Community Outreach':
      return 'Community Outreach';
    default:
      return 'Woodcraft & Joinery';
  }
}

function buildSessionSteps(
  specialInterest: string,
  jobRole: string,
  mode: CanopySessionMode
): string[] {
  const shortInterest =
    specialInterest.length > 36
      ? `${specialInterest.slice(0, 34).trim()}…`
      : specialInterest;

  if (mode === 'trade') {
    return [
      `Set up your 33m bench for ${shortInterest} and check non-slip safety gate`,
      `Select and prepare Tools of the Trade toward ${jobRole}`,
      'Practice one unhurried craft technique and log your bench takeaway',
    ];
  }
  if (mode === 'work') {
    return [
      `Prepare small-batch ${shortInterest} work on the 33m Canopy bench`,
      'Bottle or finish piece with high-contrast, easy-to-read batch labels',
      `Review pricing or list your work at the Canopy PayPal Store (${jobRole})`,
    ];
  }
  return [
    `Prepare a welcoming peer outreach demonstration around ${shortInterest}`,
    `Outline how ${jobRole} supports community wellbeing at a calm pace`,
    'Take an optional Canopy relaxation breather whenever sensory time-out is needed',
  ];
}

export function calculateKioskSessionChanges(params: {
  entrantHandle: string;
  specialInterest: string;
  customJobGoal: string;
  sessionMode: CanopySessionMode;
  currentProgress: TreeProgressState;
}): {
  session: ActiveCanopySession;
  nextProgress: TreeProgressState;
  summaryLine: string;
} {
  const cleanHandle = (params.entrantHandle.trim() || 'Sanctuary Maker').slice(
    0,
    USERNAME_MAX_LENGTH
  );
  const cleanInterest = params.specialInterest
    .trim()
    .slice(0, SPECIAL_INTEREST_MAX_LENGTH);

  const preferredSeedTrack: TreetopTradeTrack =
    params.sessionMode === 'community'
      ? 'Botanical & Community Outreach'
      : 'Woodcraft & Joinery';

  const suggestions = suggestDeterministicJobRoles(
    cleanInterest,
    preferredSeedTrack
  );
  const topSuggestion = suggestions[0];

  const matchedTradeTrack: TreetopTradeTrack =
    topSuggestion?.suggestedTrack || preferredSeedTrack;
  const matchedJobRole = (
    params.customJobGoal.trim() ||
    topSuggestion?.role ||
    'Specialist Craft & Community Apprentice'
  ).slice(0, POTENTIAL_JOB_MAX_LENGTH);

  const canopyFocus = mapTrackToCanopyFocus(
    matchedTradeTrack,
    params.sessionMode
  );

  // Deterministic token calculation
  const firstCheckInBonus = params.currentProgress.welcomeCheckedIn ? 0 : 1;
  const tryingDelta = 1 + firstCheckInBonus;
  const gatheringDelta = 1;
  const canopyDelta = params.sessionMode === 'work' ? 2 : 1;

  const totalTryingAfter = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(0, Math.floor(params.currentProgress.tryingTokens) + tryingDelta)
  );
  const totalGatheringAfter = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(
      0,
      Math.floor(params.currentProgress.gatheringTokens) + gatheringDelta
    )
  );
  const totalCanopyAfter = Math.min(
    MAX_TOKEN_COUNT,
    Math.max(
      0,
      Math.floor(params.currentProgress.treehouseTokens) + canopyDelta
    )
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const nextProgress: TreeProgressState = {
    ...params.currentProgress,
    tryingTokens: totalTryingAfter,
    gatheringTokens: totalGatheringAfter,
    treehouseTokens: totalCanopyAfter,
    welcomeCheckedIn: true,
    dailyStreak: Math.max(1, params.currentProgress.dailyStreak || 0),
    bestStreak: Math.max(1, params.currentProgress.bestStreak || 0),
    lastStreakDate: todayIso,
  };

  const steps = buildSessionSteps(
    cleanInterest,
    matchedJobRole,
    params.sessionMode
  );

  const session: ActiveCanopySession = {
    id: `session_${Date.now().toString(36)}`,
    entrantHandle: cleanHandle,
    specialInterest: cleanInterest,
    matchedJobRole,
    tradeTrack: matchedTradeTrack,
    canopyFocus,
    sessionMode: params.sessionMode,
    tryingDelta,
    gatheringDelta,
    canopyDelta,
    totalTryingAfter,
    totalGatheringAfter,
    totalCanopyAfter,
    steps,
    completedSteps: steps.map(() => false),
    sessionCompleted: false,
    createdAtMs: Date.now(),
  };

  const modeLabel = SESSION_MODE_META[params.sessionMode].label;
  const summaryLine = `Calculated ${modeLabel} Session (+${tryingDelta} Try · +${gatheringDelta} Gather · +${canopyDelta} Canopy) · Ascending to 33m Canopy`;

  return { session, nextProgress, summaryLine };
}

function emitSessionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CANOPY_SESSION_CHANGED_EVENT));
  }
}

export function loadActiveCanopySession(): ActiveCanopySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveCanopySession>;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.specialInterest !== 'string' ||
      typeof parsed.matchedJobRole !== 'string'
    ) {
      return null;
    }
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((s): s is string => typeof s === 'string')
      : [];
    const completedSteps = Array.isArray(parsed.completedSteps)
      ? steps.map((_, idx) => Boolean(parsed.completedSteps?.[idx]))
      : steps.map(() => false);
    const mode: CanopySessionMode =
      parsed.sessionMode === 'trade' ||
      parsed.sessionMode === 'work' ||
      parsed.sessionMode === 'community'
        ? parsed.sessionMode
        : 'trade';

    return {
      id: parsed.id,
      entrantHandle: String(parsed.entrantHandle || 'Sanctuary Maker'),
      specialInterest: parsed.specialInterest,
      matchedJobRole: parsed.matchedJobRole,
      tradeTrack: (parsed.tradeTrack ||
        'Woodcraft & Joinery') as TreetopTradeTrack,
      canopyFocus: (parsed.canopyFocus ||
        'Woodcraft & Joinery') as CanopyTradeFocus,
      sessionMode: mode,
      tryingDelta: Number(parsed.tryingDelta) || 1,
      gatheringDelta: Number(parsed.gatheringDelta) || 1,
      canopyDelta: Number(parsed.canopyDelta) || 1,
      totalTryingAfter: Number(parsed.totalTryingAfter) || 0,
      totalGatheringAfter: Number(parsed.totalGatheringAfter) || 0,
      totalCanopyAfter: Number(parsed.totalCanopyAfter) || 2,
      steps,
      completedSteps,
      sessionCompleted: Boolean(parsed.sessionCompleted),
      createdAtMs: Number(parsed.createdAtMs) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveActiveCanopySession(
  session: ActiveCanopySession | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_SESSION_STORAGE_KEY,
        JSON.stringify(session)
      );
    }
    emitSessionChanged();
  } catch {
    // Ignore storage quota issues
  }
}

export function loadLocalGrowthRings(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(GROWTH_RINGS_STORAGE_KEY);
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  } catch {
    return 0;
  }
}

export function incrementLocalGrowthRings(): number {
  const next = loadLocalGrowthRings() + 1;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GROWTH_RINGS_STORAGE_KEY, String(next));
      emitSessionChanged();
    } catch {
      // Ignore storage quota issues
    }
  }
  return next;
}
