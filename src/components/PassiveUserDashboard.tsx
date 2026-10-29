import { User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  CANOPY_FURNISHING_KINDS,
  CanopyFurnishingKind,
  DailyHabitId,
  DailyHabitTrackerRecord,
  db,
  DEFAULT_TREE_PROGRESS,
  getSafeCurrentUser,
  HABIT_CUSTOM_LABEL_MAX,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  MAX_TOKEN_COUNT,
  OperationType,
  subscribeSafeAuth,
  TreeProgressState,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import { HudSnapshot } from '../types/game';
import {
  CANOPY_SESSION_CHANGED_EVENT,
  loadLocalGrowthRings,
} from '../utils/canopySessionStore';
import { CarerRemindersState } from '../utils/carerRemindersStore';
import {
  addCustomHabitMilestone,
  BOUGH_BOOST_ENERGY_COST,
  buildAllMasteryHabits,
  CANOPY_BOOST_ENERGY_COST,
  COUNTERWEIGHT_ENERGY_THRESHOLD,
  DAILY_HABITS_CHANGED_EVENT,
  DAILY_HABITS_STORAGE_KEY,
  getLocalTodayIso,
  loadLocalDailyHabitState,
  mergeCloudAndLocalHabitState,
  normalizeDailyHabitState,
  removeCustomHabitMilestone,
  saveLocalDailyHabitState,
  spendHabitEnergy,
  toggleHabitMilestone,
  WINDSHIELD_ENERGY_THRESHOLD,
} from '../utils/dailyHabitStore';
import {
  loadLocalInterestPathways,
  PATHWAYS_CHANGED_EVENT,
} from '../utils/interestJobBridge';

interface PassiveUserDashboardProps {
  hud: HudSnapshot | null;
  localProgress: TreeProgressState;
  anyModalOpen?: boolean;
  kioskOpen: boolean;
  jobBoardOpen: boolean;
  mezzanineOpen: boolean;
  carerModalOpen: boolean;
  betaModalOpen: boolean;
  canopyStoreOpen: boolean;
  bankModalOpen?: boolean;
  activeJobRefCode: string | null;
  carerReminders: CarerRemindersState;
  noticesVisible: boolean;
  onToggleEntryKiosk: () => void;
  onOpenJobBoard: () => void;
  onOpenMezzanine: () => void;
  onOpenCarerReminders: () => void;
  onDismissCarerStrip: () => void;
  onOpenBetaModal: () => void;
  onOpenCanopyPaypalStore: () => void;
  onOpenBankOfTreetop: () => void;
  onOpenShoeSelector: () => void;
  onReplayNotices: () => void;
  onDismissNotices: () => void;
  onSyncTreeProgress: (
    progress: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onHabitEnergyEarned: (
    milestoneLabel: string,
    energyAwarded: number,
    lifetimeEnergyEarned: number
  ) => void;
  onHabitPassiveSync: (lifetimeEnergyEarned: number) => void;
  onSpendEnergyClimbBoost: (
    targetElevationMeters: number,
    label: string,
    energySpent: number
  ) => void;
}

function sanitizeOwnedFurnishings(items: unknown): CanopyFurnishingKind[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items.filter((x): x is CanopyFurnishingKind =>
        CANOPY_FURNISHING_KINDS.includes(x as CanopyFurnishingKind)
      )
    )
  ).slice(0, 6);
}

export const PassiveUserDashboard: React.FC<PassiveUserDashboardProps> = ({
  hud,
  localProgress,
  anyModalOpen = false,
  kioskOpen,
  jobBoardOpen,
  mezzanineOpen,
  carerModalOpen,
  betaModalOpen,
  canopyStoreOpen,
  bankModalOpen = false,
  activeJobRefCode,
  carerReminders,
  noticesVisible,
  onToggleEntryKiosk,
  onOpenJobBoard,
  onOpenMezzanine,
  onOpenCarerReminders,
  onDismissCarerStrip,
  onOpenBetaModal,
  onOpenCanopyPaypalStore,
  onOpenBankOfTreetop,
  onOpenShoeSelector,
  onReplayNotices,
  onDismissNotices,
  onSyncTreeProgress,
  onHabitEnergyEarned,
  onHabitPassiveSync,
  onSpendEnergyClimbBoost,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [memberHandle, setMemberHandle] = useState<string>('Sanctuary Visitor');
  const [cloudSharesCompleted, setCloudSharesCompleted] = useState<number>(0);
  const [cloudProgressExists, setCloudProgressExists] =
    useState<boolean>(false);
  const [localGrowthRings, setLocalGrowthRings] = useState<number>(() =>
    loadLocalGrowthRings()
  );
  const [cloudPathwayCount, setCloudPathwayCount] = useState<number>(0);
  const [latestCloudJobRole, setLatestCloudJobRole] = useState<string>('');
  const [localPathwayCount, setLocalPathwayCount] = useState<number>(
    () => loadLocalInterestPathways().length
  );
  const [latestLocalJobRole, setLatestLocalJobRole] = useState<string>(
    () => loadLocalInterestPathways()[0]?.potentialJobRole || ''
  );

  // Daily Mastery Habit Tracker state (local + cloud merged)
  const [habitsPanelOpen, setHabitsPanelOpen] = useState<boolean>(false);
  const [localHabitState, setLocalHabitState] =
    useState<DailyHabitTrackerRecord>(() => loadLocalDailyHabitState());
  const [cloudHabitState, setCloudHabitState] =
    useState<DailyHabitTrackerRecord | null>(null);
  const [cloudHabitDocExists, setCloudHabitDocExists] =
    useState<boolean>(false);
  const [customMilestoneInput, setCustomMilestoneInput] = useState<string>('');
  const [habitFeedback, setHabitFeedback] = useState<string | null>(null);
  const [habitError, setHabitError] = useState<string | null>(null);

  const habitState = useMemo(
    () => mergeCloudAndLocalHabitState(localHabitState, cloudHabitState),
    [cloudHabitState, localHabitState]
  );

  const allHabits = useMemo(
    () => buildAllMasteryHabits(habitState.customHabitLabels),
    [habitState.customHabitLabels]
  );

  useEffect(() => {
    onHabitPassiveSync(habitState.lifetimeEnergyEarned);
  }, [habitState.lifetimeEnergyEarned, onHabitPassiveSync]);

  // Collapse inline Habit Tracker panel automatically if a full modal opens or Escape is pressed
  useEffect(() => {
    if (anyModalOpen && habitsPanelOpen) {
      setHabitsPanelOpen(false);
    }
  }, [anyModalOpen, habitsPanelOpen]);

  useEffect(() => {
    if (!habitsPanelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHabitsPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [habitsPanelOpen]);

  useEffect(() => {
    const syncLocalSummary = () => {
      const localItems = loadLocalInterestPathways();
      setLocalPathwayCount(localItems.length);
      setLatestLocalJobRole(localItems[0]?.potentialJobRole || '');
      setLocalGrowthRings(loadLocalGrowthRings());
    };
    const syncLocalHabits = () => {
      setLocalHabitState(loadLocalDailyHabitState());
    };
    const onStorage = (e: StorageEvent) => {
      syncLocalSummary();
      if (!e.key || e.key === DAILY_HABITS_STORAGE_KEY) {
        syncLocalHabits();
      }
    };
    window.addEventListener(PATHWAYS_CHANGED_EVENT, syncLocalSummary);
    window.addEventListener(CANOPY_SESSION_CHANGED_EVENT, syncLocalSummary);
    window.addEventListener(DAILY_HABITS_CHANGED_EVENT, syncLocalHabits);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PATHWAYS_CHANGED_EVENT, syncLocalSummary);
      window.removeEventListener(
        CANOPY_SESSION_CHANGED_EVENT,
        syncLocalSummary
      );
      window.removeEventListener(DAILY_HABITS_CHANGED_EVENT, syncLocalHabits);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    return subscribeSafeAuth((user) => {
      setCurrentUser(user);
      if (!user) {
        setMemberHandle('Sanctuary Visitor');
        setCloudPathwayCount(0);
        setLatestCloudJobRole('');
        setCloudSharesCompleted(0);
        setCloudProgressExists(false);
        setCloudHabitState(null);
        setCloudHabitDocExists(false);
      } else {
        const fallbackName = user.displayName?.trim() || 'Sanctuary Member';
        setMemberHandle(fallbackName);
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !VALID_DOC_ID_REGEX.test(currentUser.uid)) return;

    const uid = currentUser.uid;
    const isAdminEmail =
      Boolean(currentUser.emailVerified) &&
      Boolean(currentUser.email) &&
      currentUser.email?.toLowerCase() ===
        BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const profileRef = doc(db, 'publicProfiles', uid);
    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.username === 'string' && data.username.trim()) {
            setMemberHandle(data.username.trim());
          }
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.GET, `publicProfiles/${uid}`);
      }
    );

    const progressRef = doc(db, 'treeProgress', uid);
    const unsubProgress = onSnapshot(
      progressRef,
      (snap) => {
        setCloudProgressExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          const completed =
            typeof d.sharesCompleted === 'number'
              ? d.sharesCompleted
              : DEFAULT_TREE_PROGRESS.sharesCompleted;
          setCloudSharesCompleted(completed);
          onSyncTreeProgress({
            tryingTokens:
              typeof d.tryingTokens === 'number'
                ? d.tryingTokens
                : DEFAULT_TREE_PROGRESS.tryingTokens,
            gatheringTokens:
              typeof d.gatheringTokens === 'number'
                ? d.gatheringTokens
                : DEFAULT_TREE_PROGRESS.gatheringTokens,
            treehouseTokens:
              typeof d.treehouseTokens === 'number'
                ? d.treehouseTokens
                : DEFAULT_TREE_PROGRESS.treehouseTokens,
            ownedFurnishings: Array.isArray(d.ownedFurnishings)
              ? d.ownedFurnishings
              : DEFAULT_TREE_PROGRESS.ownedFurnishings,
            sharesCompleted: completed,
            welcomeCheckedIn: Boolean(d.welcomeCheckedIn) || isAdminEmail,
            dailyStreak: typeof d.dailyStreak === 'number' ? d.dailyStreak : 0,
            bestStreak: typeof d.bestStreak === 'number' ? d.bestStreak : 0,
            lastStreakDate:
              typeof d.lastStreakDate === 'string' ? d.lastStreakDate : '',
          });
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.GET, `treeProgress/${uid}`);
      }
    );

    const habitRef = doc(db, 'dailyHabitTrackers', uid);
    const unsubHabits = onSnapshot(
      habitRef,
      (snap) => {
        setCloudHabitDocExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          const ts = d.updatedAt as Timestamp | undefined;
          const updatedAtMs =
            ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 1;
          const parsed = normalizeDailyHabitState({
            activeDate:
              typeof d.activeDate === 'string'
                ? d.activeDate
                : getLocalTodayIso(),
            energyPoints:
              typeof d.energyPoints === 'number' ? d.energyPoints : 0,
            lifetimeEnergyEarned:
              typeof d.lifetimeEnergyEarned === 'number'
                ? d.lifetimeEnergyEarned
                : 0,
            totalMilestonesLogged:
              typeof d.totalMilestonesLogged === 'number'
                ? d.totalMilestonesLogged
                : 0,
            dailyStreak: typeof d.dailyStreak === 'number' ? d.dailyStreak : 0,
            bestStreak: typeof d.bestStreak === 'number' ? d.bestStreak : 0,
            completedIdsToday: Array.isArray(d.completedIdsToday)
              ? (d.completedIdsToday as DailyHabitId[])
              : [],
            customHabitLabels: Array.isArray(d.customHabitLabels)
              ? (d.customHabitLabels as string[])
              : [],
            lastMilestoneLabel:
              typeof d.lastMilestoneLabel === 'string'
                ? d.lastMilestoneLabel
                : '',
            lastLoggedDate:
              typeof d.activeDate === 'string' &&
              Array.isArray(d.completedIdsToday) &&
              d.completedIdsToday.length > 0
                ? d.activeDate
                : '',
            updatedAtMs,
            source: 'cloud',
          });
          setCloudHabitState(parsed);
        } else {
          setCloudHabitState(null);
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(
          err,
          OperationType.GET,
          `dailyHabitTrackers/${uid}`
        );
      }
    );

    const pathwaysQuery = query(
      collection(db, 'interestPathways'),
      where('uid', '==', uid)
    );
    const unsubPathways = onSnapshot(
      pathwaysQuery,
      (snap) => {
        let newestMs = -1;
        let newestRole = '';
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms =
            ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
          if (ms >= newestMs && typeof d.potentialJobRole === 'string') {
            newestMs = ms;
            newestRole = d.potentialJobRole;
          }
        });
        setCloudPathwayCount(snap.size);
        setLatestCloudJobRole(newestRole);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'interestPathways');
      }
    );

    return () => {
      unsubProfile();
      unsubProgress();
      unsubHabits();
      unsubPathways();
    };
  }, [currentUser, onSyncTreeProgress]);

  const persistHabitTrackerState = useCallback(
    async (nextState: DailyHabitTrackerRecord) => {
      setLocalHabitState(nextState);
      saveLocalDailyHabitState(nextState);

      if (
        currentUser &&
        currentUser.emailVerified &&
        VALID_DOC_ID_REGEX.test(currentUser.uid)
      ) {
        const uid = currentUser.uid;
        const ref = doc(db, 'dailyHabitTrackers', uid);
        const payload = {
          activeDate: nextState.activeDate,
          energyPoints: nextState.energyPoints,
          lifetimeEnergyEarned: Math.max(
            nextState.energyPoints,
            nextState.lifetimeEnergyEarned
          ),
          totalMilestonesLogged: nextState.totalMilestonesLogged,
          dailyStreak: nextState.dailyStreak,
          bestStreak: Math.max(nextState.dailyStreak, nextState.bestStreak),
          completedIdsToday: nextState.completedIdsToday,
          customHabitLabels: nextState.customHabitLabels,
          lastMilestoneLabel: nextState.lastMilestoneLabel,
        };
        try {
          const writeOp = cloudHabitDocExists
            ? updateDoc(ref, {
                ...payload,
                updatedAt: serverTimestamp(),
              })
            : setDoc(ref, {
                uid,
                ...payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
          await withCloudWriteTimeout(writeOp, 2200);
          setCloudHabitDocExists(true);
        } catch (err) {
          if (
            !isQuotaExceededError(err) &&
            !isTransientOfflineOrTokenError(err)
          ) {
            handleFirestoreError(
              err,
              cloudHabitDocExists
                ? OperationType.UPDATE
                : OperationType.CREATE,
              `dailyHabitTrackers/${uid}`
            );
          }
        }
      }
    },
    [cloudHabitDocExists, currentUser]
  );

  const persistTreeProgressMilestone = useCallback(
    async (nextHabitState: DailyHabitTrackerRecord) => {
      const todayIso = nextHabitState.activeDate;
      const mergedDailyStreak = Math.max(
        localProgress.dailyStreak || 0,
        nextHabitState.dailyStreak
      );
      const mergedBestStreak = Math.max(
        localProgress.bestStreak || 0,
        mergedDailyStreak,
        nextHabitState.bestStreak
      );
      const nextProgress: TreeProgressState = {
        ...localProgress,
        tryingTokens: Math.min(MAX_TOKEN_COUNT, localProgress.tryingTokens + 1),
        dailyStreak: mergedDailyStreak,
        bestStreak: mergedBestStreak,
        lastStreakDate: todayIso,
      };
      onSyncTreeProgress(nextProgress);

      if (
        currentUser &&
        currentUser.emailVerified &&
        VALID_DOC_ID_REGEX.test(currentUser.uid)
      ) {
        const uid = currentUser.uid;
        const progressRef = doc(db, 'treeProgress', uid);
        const ownedClean = sanitizeOwnedFurnishings(
          nextProgress.ownedFurnishings
        );
        try {
          const writeOp = cloudProgressExists
            ? updateDoc(progressRef, {
                tryingTokens: nextProgress.tryingTokens,
                gatheringTokens: nextProgress.gatheringTokens,
                treehouseTokens: nextProgress.treehouseTokens,
                ownedFurnishings: ownedClean,
                sharesCompleted: nextProgress.sharesCompleted,
                welcomeCheckedIn: nextProgress.welcomeCheckedIn,
                dailyStreak: nextProgress.dailyStreak,
                bestStreak: nextProgress.bestStreak,
                lastStreakDate: todayIso,
                updatedAt: serverTimestamp(),
              })
            : setDoc(progressRef, {
                uid,
                tryingTokens: nextProgress.tryingTokens,
                gatheringTokens: nextProgress.gatheringTokens,
                treehouseTokens: nextProgress.treehouseTokens,
                ownedFurnishings: ownedClean,
                sharesCompleted: nextProgress.sharesCompleted,
                welcomeCheckedIn: nextProgress.welcomeCheckedIn,
                dailyStreak: nextProgress.dailyStreak,
                bestStreak: nextProgress.bestStreak,
                lastStreakDate: todayIso,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
          await withCloudWriteTimeout(writeOp, 2200);
          setCloudProgressExists(true);
        } catch (err) {
          if (
            !isQuotaExceededError(err) &&
            !isTransientOfflineOrTokenError(err)
          ) {
            handleFirestoreError(
              err,
              cloudProgressExists
                ? OperationType.UPDATE
                : OperationType.CREATE,
              `treeProgress/${uid}`
            );
          }
        }
      }
    },
    [cloudProgressExists, currentUser, localProgress, onSyncTreeProgress]
  );

  const handleToggleHabit = async (habitId: DailyHabitId) => {
    setHabitError(null);
    const outcome = toggleHabitMilestone(habitState, habitId);
    if (!outcome.habitLabel) return;

    if (outcome.justCompleted) {
      onHabitEnergyEarned(
        outcome.habitLabel,
        outcome.energyDelta,
        outcome.nextState.lifetimeEnergyEarned
      );
      setHabitFeedback(
        `Logged "${outcome.habitLabel}" · +${outcome.energyDelta} Tree-Climbing Energy Points (+1 Trying Token & +15% Lift Poise).`
      );
      void persistHabitTrackerState(outcome.nextState);
      void persistTreeProgressMilestone(outcome.nextState);
    } else {
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();
      setHabitFeedback(`Unmarked "${outcome.habitLabel}" for today.`);
      void persistHabitTrackerState(outcome.nextState);
    }
  };

  const handleSpendClimbBoost = (
    cost: number,
    targetMeters: number,
    boostLabel: string
  ) => {
    setHabitError(null);
    const res = spendHabitEnergy(habitState, cost);
    if (!res.ok) {
      setHabitError(
        `Need ${cost} Tree-Climbing Energy Points for ${boostLabel} (currently ${habitState.energyPoints} pts). Log a milestone above to charge up!`
      );
      return;
    }
    setHabitFeedback(
      `Channeled ${cost} Energy Points -> ${boostLabel} engaged with 100% Lift Poise!`
    );
    setHabitsPanelOpen(false);
    onSpendEnergyClimbBoost(targetMeters, boostLabel, cost);
    void persistHabitTrackerState(res.nextState);
  };

  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    setHabitError(null);
    const res = addCustomHabitMilestone(habitState, customMilestoneInput);
    if (!res.ok) {
      setHabitError(res.error || 'Could not add custom milestone.');
      return;
    }
    soundEngine.unlock();
    soundEngine.playCraftLoad();
    setCustomMilestoneInput('');
    setHabitFeedback('Added custom milestone to your daily habit tracker.');
    void persistHabitTrackerState(res.nextState);
  };

  const handleRemoveCustomHabit = (customIndex: number, label: string) => {
    setHabitError(null);
    const next = removeCustomHabitMilestone(habitState, customIndex);
    setHabitFeedback(`Removed "${label}" from custom daily milestones.`);
    void persistHabitTrackerState(next);
  };

  const elevation = hud?.elevationMeters ?? 0;
  const poisePercent = hud?.poisePercent ?? 100;
  const activeChillPodId = hud?.activeChillPodId ?? null;

  const totalPathways = currentUser
    ? cloudPathwayCount + localPathwayCount
    : localPathwayCount;
  const activeJobRole = currentUser
    ? latestCloudJobRole || latestLocalJobRole
    : latestLocalJobRole;

  const growthRingCount = Math.max(localGrowthRings, cloudSharesCompleted);
  const visibleRings = Math.min(4, Math.max(1, growthRingCount));

  const habitsTotal = allHabits.length;
  const habitsCompletedCount = habitState.completedIdsToday.length;
  const energyPoints = habitState.energyPoints;
  const lifetimeEnergy = habitState.lifetimeEnergyEarned;
  const effectiveStreak = Math.max(
    habitState.dailyStreak,
    hud?.dailyStreak ?? localProgress.dailyStreak ?? 0
  );

  const counterweightUnlocked =
    Boolean(hud?.counterweightUpgraded) ||
    lifetimeEnergy >= COUNTERWEIGHT_ENERGY_THRESHOLD;
  const windShieldUnlocked =
    Boolean(hud?.windShieldUpgraded) ||
    lifetimeEnergy >= WINDSHIELD_ENERGY_THRESHOLD;

  const carerTotal = carerReminders.items.length;
  const carerChecked = carerReminders.items.filter((i) => i.checked).length;
  const carerUnchecked = carerReminders.items.filter((i) => !i.checked);
  const carerAllReady = carerTotal > 0 && carerChecked === carerTotal;

  return (
    <header
      aria-label="Member Sanctuary Top Bar"
      className={`${
        anyModalOpen ? 'hidden sm:block' : 'block'
      } fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-20 w-[min(1240px,96vw)] pointer-events-auto`}
    >
      <div className="rounded-xl bg-[#121E17]/96 border border-white/18 px-3 py-2 sm:px-5 sm:py-2.5 text-[#F7F4EB] shadow-xl flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm">
          {/* Zone 1: Brand Wordmark + Growth Rings & Tree-Climbing Energy */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <span className="font-display font-bold tracking-tight text-[#FFD166] whitespace-nowrap text-sm sm:text-base">
              JAY&apos;S JOB CLUB
            </span>
            <span
              className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#7CE0A3] whitespace-nowrap text-xs"
              title={`Completed Workshops: ${growthRingCount} Growth Rings · Tree-Climbing Energy: ${energyPoints} pts · Poise ${poisePercent}% · ${memberHandle}`}
            >
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4 shrink-0"
                aria-hidden="true"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="#8FB996"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                />
                {visibleRings >= 1 && (
                  <circle
                    cx="10"
                    cy="10"
                    r="2.2"
                    fill="none"
                    stroke="#FFD166"
                    strokeWidth="1.4"
                  />
                )}
                {visibleRings >= 2 && (
                  <circle
                    cx="10"
                    cy="10"
                    r="4.2"
                    fill="none"
                    stroke="#7CE0A3"
                    strokeWidth="1.2"
                  />
                )}
                {visibleRings >= 3 && (
                  <circle
                    cx="10"
                    cy="10"
                    r="6.2"
                    fill="none"
                    stroke="#FFD166"
                    strokeWidth="1.2"
                  />
                )}
                {visibleRings >= 4 && (
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="#7CE0A3"
                    strokeWidth="1.3"
                  />
                )}
              </svg>
              <span>Rings {growthRingCount}</span>
              <span aria-hidden="true" className="text-white/30">
                ·
              </span>
              <span className="text-[#FFD166] font-semibold">
                {energyPoints} pts
              </span>
              <span
                aria-hidden="true"
                className="hidden xl:inline text-white/30"
              >
                ·
              </span>
              <span className="hidden xl:inline text-[#F7F4EB] font-sans font-medium">
                {elevation.toFixed(0)}m
              </span>
            </span>
          </div>

          {/* Zone 2: User-Friendly Unboxed Navigation */}
          <nav
            aria-label="Sanctuary stations"
            className="hidden lg:flex items-center gap-3 overflow-hidden text-xs sm:text-sm text-[#D4E4D7]"
          >
            <button
              type="button"
              aria-expanded={habitsPanelOpen}
              onClick={() => {
                setHabitError(null);
                setHabitsPanelOpen((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer font-mono tabular-nums ${
                habitsPanelOpen
                  ? 'text-[#FFD166] underline'
                  : 'text-[#7CE0A3] hover:text-[#FFD166]'
              }`}
              title="Log daily professional mastery milestones ('15 mins focus', 'Community outreach', and more) to earn Tree-Climbing Energy Points"
            >
              <span className="font-sans">Daily Habits</span>
              <span>
                ({habitsCompletedCount}/{habitsTotal})
              </span>
              {habitsPanelOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenJobBoard}
              className={`font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                jobBoardOpen
                  ? 'text-[#FFD166] underline'
                  : 'text-[#FFD166] hover:text-[#FFF3C4]'
              }`}
              title={
                activeJobRole
                  ? `Old-Style Job Centre · ${activeJobRole}`
                  : 'Open the 0m Old-Style Job Centre to choose a job slip or collaborate'
              }
            >
              {activeJobRefCode
                ? `Job Centre (${activeJobRefCode})`
                : 'Job Centre'}
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenMezzanine}
              className={`font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                mezzanineOpen || activeChillPodId
                  ? 'text-[#7CE0A3] underline'
                  : 'text-[#F7F4EB] hover:text-[#7CE0A3]'
              }`}
              title="Open 33m Mezzanine Library, Refreshments Bar & 1-Per-Person Private Chill Pods"
            >
              {activeChillPodId ? 'Mezzanine (In Pod)' : 'Mezzanine & Pods'}
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenCanopyPaypalStore}
              className={`font-medium whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                canopyStoreOpen
                  ? 'text-[#FFD166] underline'
                  : 'text-[#F7F4EB] hover:text-[#FFD166]'
              }`}
            >
              Canopy Store
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenBankOfTreetop}
              className={`font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                bankModalOpen
                  ? 'text-[#FFD166] underline'
                  : 'text-[#FFE082] hover:text-[#FFFFFF]'
              }`}
              title="Bank of Treetop (Not a Real Bank): How to save symbolic club tokens for Special-Interest Stock + Unpaid Exchequer role"
            >
              Bank of Treetop
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenShoeSelector}
              className="text-[#F7F4EB] hover:text-[#FFD166] hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Footwear
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenCarerReminders}
              className={`font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                carerModalOpen
                  ? 'text-[#FFD166] underline'
                  : 'text-[#A7F3D0] hover:text-[#FFD166]'
              }`}
              title="Carer Going-Out Checklist: Everyone's Coat, Snacks, Meds, Bags & Changes of Clothes"
            >
              Carer ({carerChecked}/{carerTotal})
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            <button
              type="button"
              onClick={onOpenBetaModal}
              className={`font-semibold whitespace-nowrap shrink-0 hover:underline cursor-pointer ${
                betaModalOpen
                  ? 'text-[#7CE0A3] underline'
                  : 'text-[#9EE6B8] hover:text-[#FFFFFF]'
              }`}
              title="Copy Public Beta URL & record UX Testing feedback"
            >
              Beta URL
            </button>

            <span aria-hidden="true" className="text-white/25">
              ·
            </span>

            {noticesVisible ? (
              <button
                type="button"
                onClick={onDismissNotices}
                className="text-[#B9D1C1] hover:text-[#F7F4EB] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Clear Notice
              </button>
            ) : (
              <button
                type="button"
                onClick={onReplayNotices}
                className="text-[#B9D1C1] hover:text-[#F7F4EB] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Guide
              </button>
            )}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <button
            type="button"
            onClick={onToggleEntryKiosk}
            className={`touch-manipulation min-h-[44px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer font-mono tabular-nums ${
              kioskOpen
                ? 'bg-[#281B11] border border-[#FFD166] text-[#FFD166]'
                : 'bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009]'
            }`}
          >
            {kioskOpen
              ? 'Close Kiosk'
              : totalPathways > 0
                ? `Entry Kiosk (${totalPathways})`
                : 'Entry Kiosk'}
          </button>
        </div>

        {/* Mobile / Compact Quick-Access Row with >=44px Touch Hitboxes */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pt-1 border-t border-white/10 text-xs text-[#E4F0E7]">
          <button
            type="button"
            aria-expanded={habitsPanelOpen}
            onClick={() => {
              setHabitError(null);
              setHabitsPanelOpen((prev) => !prev);
            }}
            className={`touch-manipulation min-h-[44px] px-2.5 rounded-lg border font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer font-mono tabular-nums ${
              habitsPanelOpen
                ? 'bg-[#281B11] border-[#FFD166] text-[#FFD166]'
                : 'bg-[#193023] border-[#7CE0A3]/55 text-[#7CE0A3]'
            }`}
          >
            <span className="font-sans">Habits</span>
            <span>
              ({habitsCompletedCount}/{habitsTotal} · {energyPoints}pt)
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenMezzanine}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg bg-[#1A3326] border border-[#7CE0A3]/50 font-semibold text-[#7CE0A3] whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            {activeChillPodId ? 'In Chill Pod' : 'Chill Pods'}
          </button>
          <button
            type="button"
            onClick={onOpenCarerReminders}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg bg-[#1E3327] border border-[#A7F3D0]/45 font-semibold text-[#A7F3D0] whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Carer ({carerChecked}/{carerTotal})
          </button>
          <button
            type="button"
            onClick={onOpenJobBoard}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg bg-[#1B2B20] border border-[#FFD166]/40 font-semibold text-[#FFD166] whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Job Centre
          </button>
          <button
            type="button"
            onClick={onOpenBankOfTreetop}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg bg-[#242012] border border-[#FFD166]/45 font-semibold text-[#FFE082] whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Bank of Treetop
          </button>
          <button
            type="button"
            onClick={onOpenCanopyPaypalStore}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg hover:bg-white/5 whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Canopy Store
          </button>
          <button
            type="button"
            onClick={onOpenShoeSelector}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg hover:bg-white/5 whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Footwear
          </button>
          <button
            type="button"
            onClick={onOpenBetaModal}
            className="touch-manipulation min-h-[44px] px-2.5 rounded-lg hover:bg-white/5 font-semibold text-[#9EE6B8] whitespace-nowrap shrink-0 inline-flex items-center cursor-pointer"
          >
            Beta URL
          </button>
        </div>

        {/* Gentle Doorway Reminder Strip for Carers (Dismissible & Non-Blocking) */}
        {carerReminders.pinnedStripVisible && !anyModalOpen && !habitsPanelOpen && (
          <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#DCEADF]">
            <button
              type="button"
              onClick={onOpenCarerReminders}
              className="touch-manipulation min-w-0 text-left truncate hover:text-[#FFD166] cursor-pointer py-0.5"
              title="Tap to open Carer Going-Out Checklist & Lift Speed Controls"
            >
              <span className="font-semibold text-[#FFD166]">
                Going Out Check:
              </span>{' '}
              {carerAllReady ? (
                <span className="text-[#7CE0A3] font-medium">
                  All {carerTotal} essentials packed ✓
                </span>
              ) : (
                <span>
                  Remember{' '}
                  {carerUnchecked
                    .slice(0, 5)
                    .map((i) => i.shortTag.toLowerCase())
                    .join(' · ')}
                </span>
              )}
              {carerReminders.outingNote ? (
                <span className="text-[#9EE6B8]">
                  {' '}
                  · {carerReminders.outingNote}
                </span>
              ) : null}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenCarerReminders}
                className="touch-manipulation text-[#7CE0A3] hover:underline font-semibold whitespace-nowrap cursor-pointer"
              >
                Checklist
              </button>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <button
                type="button"
                onClick={onDismissCarerStrip}
                className="touch-manipulation text-[#B2C6B8] hover:text-[#F7F4EB] whitespace-nowrap cursor-pointer"
                title="Hide Going-Out strip (you can reopen Carer Check anytime)"
              >
                Hide
              </button>
            </div>
          </div>
        )}

        {/* Expandable Daily Mastery Habit Tracker & Tree-Climbing Energy Panel */}
        {habitsPanelOpen && !anyModalOpen && (
          <section
            aria-label="Daily Mastery Habit Tracker"
            className="mt-1.5 pt-3 border-t border-white/15 touch-pan-y-contain mobile-touch-scroll max-h-[72dvh] overflow-y-auto pr-0.5"
          >
            {/* Header & Telemetry Summary */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="min-w-0">
                <h2 className="font-display font-bold text-sm sm:text-base text-[#F7F4EB]">
                  Daily Mastery Habit Tracker
                </h2>
                <p className="text-xs text-[#C6DACB] mt-0.5 leading-relaxed">
                  Log sustainable professional milestones to earn Tree-Climbing
                  Energy Points, restore Lift Poise, and power smooth ascents up
                  the Agarwood trunk.
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono tabular-nums text-[#9EE6B8]">
                  <span className="text-[#FFD166] font-semibold">
                    Energy {energyPoints} pts
                  </span>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span>
                    Today {habitsCompletedCount}/{habitsTotal}
                  </span>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span>
                    Streak {effectiveStreak}{' '}
                    {effectiveStreak === 1 ? 'day' : 'days'}
                  </span>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span className="text-[#C6DACB]">
                    Counterweight (30pt):{' '}
                    {counterweightUnlocked ? 'Unlocked' : `${lifetimeEnergy}/30`}
                  </span>
                  <span aria-hidden="true" className="text-white/25">
                    ·
                  </span>
                  <span className="text-[#C6DACB]">
                    Wind-Shield (60pt):{' '}
                    {windShieldUnlocked ? 'Unlocked' : `${lifetimeEnergy}/60`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHabitsPanelOpen(false)}
                className="touch-manipulation min-h-[44px] min-w-[44px] rounded-lg border border-white/15 hover:border-[#FFD166] inline-flex items-center justify-center text-[#D4E4D7] hover:text-[#FFD166] shrink-0 cursor-pointer"
                aria-label="Close Daily Mastery Habit Tracker"
                title="Close Daily Habits"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Feedback / Validation Notice */}
            {habitFeedback && !habitError && (
              <p
                role="status"
                className="mt-2.5 text-xs text-[#7CE0A3] font-medium"
              >
                {habitFeedback}
              </p>
            )}
            {habitError && (
              <p
                role="alert"
                className="mt-2.5 text-xs text-[#FFD166] font-medium"
              >
                {habitError}
              </p>
            )}

            {/* Milestone Checklist Grid */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {allHabits.map((habit) => {
                const isDone = habitState.completedIdsToday.includes(habit.id);
                const customIdx = habit.isCustom
                  ? Number(habit.id.replace('custom_', '')) - 1
                  : -1;

                return (
                  <div
                    key={habit.id}
                    className={`rounded-lg border px-3 py-2.5 flex items-start justify-between gap-2.5 transition-colors ${
                      isDone
                        ? 'bg-[#193224] border-[#7CE0A3]/60'
                        : 'bg-[#16261D] border-white/12 hover:border-white/25'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggleHabit(habit.id)}
                      className="touch-manipulation min-h-[44px] flex-1 text-left flex items-start gap-2.5 cursor-pointer"
                      aria-pressed={isDone}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isDone
                            ? 'bg-[#7CE0A3] border-[#7CE0A3] text-[#102016]'
                            : 'border-white/35 bg-transparent text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span
                            className={`font-semibold text-xs sm:text-sm ${
                              isDone
                                ? 'text-[#A7F3D0] line-through'
                                : 'text-[#F7F4EB]'
                            }`}
                          >
                            {habit.label}
                          </span>
                          <span className="font-mono tabular-nums text-xs text-[#FFD166] shrink-0">
                            {isDone
                              ? `Earned +${habit.energyReward} pts`
                              : `+${habit.energyReward} Energy`}
                          </span>
                        </span>
                        <span className="block text-[11px] sm:text-xs text-[#B9D1C1] mt-0.5 leading-snug">
                          {habit.categoryLabel} · {habit.detail}
                        </span>
                      </span>
                    </button>

                    {habit.isCustom && customIdx >= 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveCustomHabit(customIdx, habit.label)
                        }
                        className="touch-manipulation min-h-[44px] min-w-[40px] rounded-md text-[#B2C6B8] hover:text-[#FFD166] inline-flex items-center justify-center shrink-0 cursor-pointer"
                        aria-label={`Remove custom milestone ${habit.label}`}
                        title="Remove custom milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Channel Tree-Climbing Energy Points + Add Custom Milestone */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Spend Energy for Lift Ascent Boosts */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#D4E4D7] mr-1">
                  Channel Energy Climb:
                </span>
                <button
                  type="button"
                  disabled={energyPoints < BOUGH_BOOST_ENERGY_COST}
                  onClick={() =>
                    handleSpendClimbBoost(
                      BOUGH_BOOST_ENERGY_COST,
                      18,
                      '18m Mid-Trunk Bough Boost'
                    )
                  }
                  className={`touch-manipulation min-h-[44px] sm:min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold font-mono tabular-nums border transition-colors ${
                    energyPoints >= BOUGH_BOOST_ENERGY_COST
                      ? 'bg-[#1D3528] hover:bg-[#254534] border-[#7CE0A3]/60 text-[#7CE0A3] cursor-pointer'
                      : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  Boost 18m Bough ({BOUGH_BOOST_ENERGY_COST} pts)
                </button>

                <button
                  type="button"
                  disabled={energyPoints < CANOPY_BOOST_ENERGY_COST}
                  onClick={() =>
                    handleSpendClimbBoost(
                      CANOPY_BOOST_ENERGY_COST,
                      33,
                      '33m Canopy Summit Boost'
                    )
                  }
                  className={`touch-manipulation min-h-[44px] sm:min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold font-mono tabular-nums border transition-colors ${
                    energyPoints >= CANOPY_BOOST_ENERGY_COST
                      ? 'bg-[#E5A93C] hover:bg-[#FFD166] border-[#FFD166] text-[#181009] cursor-pointer'
                      : 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  Boost 33m Canopy ({CANOPY_BOOST_ENERGY_COST} pts)
                </button>
              </div>

              {/* Add Custom Professional Milestone Form */}
              <form
                onSubmit={handleAddCustomHabit}
                className="flex items-center gap-2 w-full lg:w-auto"
              >
                <label htmlFor="custom-habit-input" className="sr-only">
                  Add custom daily mastery milestone
                </label>
                <input
                  id="custom-habit-input"
                  type="text"
                  value={customMilestoneInput}
                  maxLength={HABIT_CUSTOM_LABEL_MAX}
                  onChange={(e) => setCustomMilestoneInput(e.target.value)}
                  placeholder="Add custom milestone (e.g. Portfolio review)"
                  className="min-h-[44px] sm:min-h-[40px] flex-1 lg:w-64 rounded-lg bg-[#0D1711] border border-white/18 px-3 py-1.5 text-xs sm:text-sm text-[#F7F4EB] placeholder:text-[#8CA695] focus:outline-none focus:border-[#FFD166]"
                />
                <button
                  type="submit"
                  disabled={habitState.customHabitLabels.length >= 5}
                  className="touch-manipulation min-h-[44px] sm:min-h-[40px] px-3 py-1.5 rounded-lg bg-[#1F382A] hover:bg-[#294A37] disabled:opacity-45 border border-[#7CE0A3]/50 text-xs font-semibold text-[#F7F4EB] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#7CE0A3]" />
                  <span>Add (+15 pt)</span>
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </header>
  );
};
