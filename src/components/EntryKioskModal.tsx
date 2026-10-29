import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ArrowUpRight, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CANOPY_FURNISHING_KINDS,
  CanopyFurnishingKind,
  db,
  DEFAULT_TREE_PROGRESS,
  getAuthSessionNotice,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  MAX_TOKEN_COUNT,
  NEXT_STEP_MAX_LENGTH,
  OperationType,
  POTENTIAL_JOB_MAX_LENGTH,
  POTENTIAL_JOB_MIN_LENGTH,
  SPECIAL_INTEREST_MAX_LENGTH,
  SPECIAL_INTEREST_MIN_LENGTH,
  SpecialInterestPathwayRecord,
  subscribeSafeAuth,
  SUPERVISION_CONTEXTS,
  SupervisionContextKind,
  TOKEN_CODE_REGEX,
  TREETOP_TRADE_TRACKS,
  TreeProgressState,
  TreetopApplicationState,
  TreetopTradeTrack,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import {
  ActiveCanopySession,
  calculateKioskSessionChanges,
  CanopySessionMode,
  SESSION_MODE_META,
} from '../utils/canopySessionStore';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';
import {
  loadLocalInterestPathways,
  saveLocalInterestPathways,
  suggestDeterministicJobRoles,
} from '../utils/interestJobBridge';

interface EntryKioskModalProps {
  isOpen: boolean;
  localProgress: TreeProgressState;
  onUpdateLocalProgress: (
    next: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onLaunchCanopySession: (
    session: ActiveCanopySession,
    summaryBanner: string
  ) => void;
  onOpenShoeSelector?: () => void;
  onClose: () => void;
}

const QUICK_INTEREST_PRESETS: Array<{
  label: string;
  interest: string;
  job: string;
  mode: CanopySessionMode;
}> = [
  {
    label: 'Agarwood Oil',
    interest: 'Distilling Agarwood bark essential oil & tactile labelling',
    job: 'Small-Batch Botanical Distiller & Maker',
    mode: 'work',
  },
  {
    label: 'Cedar Joinery',
    interest: 'Hand-planing aromatic cedar & mortise joinery',
    job: 'Bespoke Cabinetmaker & Joinery Craftsperson',
    mode: 'trade',
  },
  {
    label: 'Peer Outreach',
    interest: 'Sensory-paced craft mentoring & calm peer workshops',
    job: 'Community Maker Space Facilitator',
    mode: 'community',
  },
];

function makeSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function generateTreetopTokenCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const candidate = `TTK-AGAR-${suffix}`;
  return TOKEN_CODE_REGEX.test(candidate) ? candidate : 'TTK-AGAR-2026';
}

function sanitizeFurnishings(items: unknown): CanopyFurnishingKind[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items.filter((x): x is CanopyFurnishingKind =>
        CANOPY_FURNISHING_KINDS.includes(x as CanopyFurnishingKind)
      )
    )
  ).slice(0, 6);
}

export const EntryKioskModal: React.FC<EntryKioskModalProps> = ({
  isOpen,
  localProgress,
  onUpdateLocalProgress,
  onLaunchCanopySession,
  onOpenShoeSelector,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'entry' | 'account'>('entry');
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Entry Pop-Up Fields
  const [sessionMode, setSessionMode] = useState<CanopySessionMode>('trade');
  const [workshopHandle, setWorkshopHandle] = useState('Sanctuary Maker');
  const [specialInterestInput, setSpecialInterestInput] = useState('');
  const [potentialJobInput, setPotentialJobInput] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [infoBanner, setInfoBanner] = useState<string | null>(null);

  // Cloud Existence Tracking (Non-blocking)
  const [profileExists, setProfileExists] = useState(false);
  const [progressExists, setProgressExists] = useState(false);
  const [cloudProgress, setCloudProgress] =
    useState<TreeProgressState>(DEFAULT_TREE_PROGRESS);
  const [adminQueue, setAdminQueue] = useState<TreetopApplicationState[]>([]);
  const [adminBusyUid, setAdminBusyUid] = useState<string | null>(null);

  const isVerifiedAdmin =
    Boolean(currentUser?.emailVerified) &&
    currentUser?.email?.toLowerCase() ===
      BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    return subscribeSafeAuth((user) => {
      setCurrentUser(user);
      if (user) {
        setWorkshopHandle((prev) => {
          if (prev && prev !== 'Sanctuary Maker') return prev;
          const suggested = (user.displayName || 'Agarwood Maker')
            .replace(/[^a-zA-Z0-9 _\-']/g, '')
            .trim()
            .slice(0, USERNAME_MAX_LENGTH);
          return suggested.length >= 2 ? suggested : 'Agarwood Maker';
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !VALID_DOC_ID_REGEX.test(currentUser.uid)) {
      setProfileExists(false);
      setProgressExists(false);
      return;
    }
    const uid = currentUser.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'publicProfiles', uid),
      (snap) => {
        setProfileExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.username === 'string' && d.username.trim()) {
            setWorkshopHandle(d.username.trim());
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

    const unsubProgress = onSnapshot(
      doc(db, 'treeProgress', uid),
      (snap) => {
        setProgressExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          const synced: TreeProgressState = {
            tryingTokens:
              typeof d.tryingTokens === 'number' ? d.tryingTokens : 0,
            gatheringTokens:
              typeof d.gatheringTokens === 'number' ? d.gatheringTokens : 0,
            treehouseTokens:
              typeof d.treehouseTokens === 'number' ? d.treehouseTokens : 2,
            ownedFurnishings: sanitizeFurnishings(d.ownedFurnishings),
            sharesCompleted:
              typeof d.sharesCompleted === 'number' ? d.sharesCompleted : 0,
            welcomeCheckedIn: Boolean(d.welcomeCheckedIn),
            dailyStreak: typeof d.dailyStreak === 'number' ? d.dailyStreak : 0,
            bestStreak: typeof d.bestStreak === 'number' ? d.bestStreak : 0,
            lastStreakDate:
              typeof d.lastStreakDate === 'string' ? d.lastStreakDate : '',
          };
          setCloudProgress(synced);
          onUpdateLocalProgress(synced);
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.GET, `treeProgress/${uid}`);
      }
    );

    return () => {
      unsubProfile();
      unsubProgress();
    };
  }, [currentUser, onUpdateLocalProgress]);

  useEffect(() => {
    if (!isOpen || !currentUser || !isVerifiedAdmin) {
      setAdminQueue([]);
      return;
    }
    const q = query(
      collection(db, 'treetopApplications'),
      where('status', 'in', ['pending', 'approved', 'declined'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TreetopApplicationState[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          rows.push({
            applicantId: docSnap.id,
            displayName: String(d.displayName || 'Applicant'),
            specialInterestJourney: String(d.specialInterestJourney || ''),
            preferredTradeTrack: (TREETOP_TRADE_TRACKS.includes(
              d.preferredTradeTrack
            )
              ? d.preferredTradeTrack
              : TREETOP_TRADE_TRACKS[0]) as TreetopTradeTrack,
            supervisionContext: (SUPERVISION_CONTEXTS.includes(
              d.supervisionContext
            )
              ? d.supervisionContext
              : SUPERVISION_CONTEXTS[0]) as SupervisionContextKind,
            status:
              d.status === 'approved' || d.status === 'declined'
                ? d.status
                : 'pending',
            treetopTokenGranted: Boolean(d.treetopTokenGranted),
            tokenCode: typeof d.tokenCode === 'string' ? d.tokenCode : '',
            adminNote: typeof d.adminNote === 'string' ? d.adminNote : '',
          });
        });
        setAdminQueue(rows);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'treetopApplications');
      }
    );
    return () => unsub();
  }, [isOpen, currentUser, isVerifiedAdmin]);

  const effectiveProgress = currentUser ? cloudProgress : localProgress;

  const roleSuggestions = useMemo(() => {
    const seedTrack: TreetopTradeTrack =
      sessionMode === 'community'
        ? 'Botanical & Community Outreach'
        : 'Woodcraft & Joinery';
    return suggestDeterministicJobRoles(specialInterestInput, seedTrack);
  }, [specialInterestInput, sessionMode]);

  const liveCalculation = useMemo(() => {
    const fallbackInterest =
      specialInterestInput.trim() || 'Special interest craft';
    return calculateKioskSessionChanges({
      entrantHandle: workshopHandle,
      specialInterest: fallbackInterest,
      customJobGoal: potentialJobInput,
      sessionMode,
      currentProgress: effectiveProgress,
    });
  }, [
    workshopHandle,
    specialInterestInput,
    potentialJobInput,
    sessionMode,
    effectiveProgress,
  ]);

  if (!isOpen) return null;

  const sessionNotice = getAuthSessionNotice();

  const handleApplyPreset = (preset: (typeof QUICK_INTEREST_PRESETS)[number]) => {
    setErrorBanner(null);
    setInfoBanner(null);
    setSessionMode(preset.mode);
    setSpecialInterestInput(preset.interest);
    setPotentialJobInput(preset.job);
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setErrorBanner(null);
    setInfoBanner(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setInfoBanner('Signed in with Google — cloud sync ready.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setErrorBanner(
          'Could not complete Google Sign-In. You can still launch your Canopy session right away.'
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setInfoBanner('Signed out — local Kiosk mode active.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCalculateAndAscend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setInfoBanner(null);

    const cleanHandle = (workshopHandle.trim() || 'Sanctuary Maker').slice(
      0,
      USERNAME_MAX_LENGTH
    );
    if (cleanHandle.length < USERNAME_MIN_LENGTH) {
      setErrorBanner(
        `Please enter a handle of at least ${USERNAME_MIN_LENGTH} characters.`
      );
      return;
    }

    const cleanInterest = specialInterestInput
      .trim()
      .slice(0, SPECIAL_INTEREST_MAX_LENGTH);
    if (cleanInterest.length < SPECIAL_INTEREST_MIN_LENGTH) {
      setErrorBanner(
        `Please enter your special interest (at least ${SPECIAL_INTEREST_MIN_LENGTH} characters) or pick an example chip.`
      );
      return;
    }

    const resolvedJob = (
      potentialJobInput.trim() ||
      roleSuggestions[0]?.role ||
      'Specialist Craft & Community Apprentice'
    ).slice(0, POTENTIAL_JOB_MAX_LENGTH);

    if (resolvedJob.length < POTENTIAL_JOB_MIN_LENGTH) {
      setErrorBanner(
        `Target job or session goal must be at least ${POTENTIAL_JOB_MIN_LENGTH} characters.`
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanHandle} ${cleanInterest} ${resolvedJob}`,
      'entry-kiosk-popup',
      true
    );
    if (!censor.allowed) {
      setErrorBanner(
        censor.reason ||
          'Please keep special interest and session notes respectful and safe.'
      );
      return;
    }

    setSubmitting(true);

    // 1. Deterministically calculate session changes & updated progress
    const { session, nextProgress, summaryLine } = calculateKioskSessionChanges(
      {
        entrantHandle: cleanHandle,
        specialInterest: cleanInterest,
        customJobGoal: resolvedJob,
        sessionMode,
        currentProgress: effectiveProgress,
      }
    );

    const firstStep = (session.steps[0] || '').slice(0, NEXT_STEP_MAX_LENGTH);

    // 2. Always persist immediately to local pathways so Entry Kiosk works 100% offline or online
    const localExisting = loadLocalInterestPathways();
    const localRecord: SpecialInterestPathwayRecord = {
      id: makeSafeDocId('local_pathway'),
      uid: currentUser?.uid || 'local_visitor',
      entrantHandle: cleanHandle,
      specialInterest: cleanInterest,
      potentialJobRole: session.matchedJobRole,
      tradeTrack: session.tradeTrack,
      comfortableNextStep: firstStep,
      readinessStage:
        sessionMode === 'work' ? 'Active Job Step' : 'Practicing Craft',
      createdAtMs: Date.now(),
      source: 'local',
    };

    if (!currentUser || !currentUser.emailVerified) {
      saveLocalInterestPathways([localRecord, ...localExisting]);
    }

    // 3. Apply progress and launch Canopy glide immediately so UI never stalls
    onUpdateLocalProgress(nextProgress, summaryLine);

    if (
      currentUser &&
      currentUser.emailVerified &&
      VALID_DOC_ID_REGEX.test(currentUser.uid)
    ) {
      const uid = currentUser.uid;
      const todayIso = new Date().toISOString().slice(0, 10);
      const pathwayId = makeSafeDocId('pathway');

      try {
        const profileOp = !profileExists
          ? setDoc(doc(db, 'publicProfiles', uid), {
              uid,
              username: cleanHandle,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          : updateDoc(doc(db, 'publicProfiles', uid), {
              username: cleanHandle,
              updatedAt: serverTimestamp(),
            });

        const pathwayOp = setDoc(doc(db, 'interestPathways', pathwayId), {
          uid,
          entrantHandle: cleanHandle,
          specialInterest: cleanInterest,
          potentialJobRole: session.matchedJobRole,
          tradeTrack: session.tradeTrack,
          comfortableNextStep: firstStep,
          readinessStage:
            sessionMode === 'work' ? 'Active Job Step' : 'Practicing Craft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const progressOp = !progressExists
          ? setDoc(doc(db, 'treeProgress', uid), {
              uid,
              tryingTokens: nextProgress.tryingTokens,
              gatheringTokens: nextProgress.gatheringTokens,
              treehouseTokens: nextProgress.treehouseTokens,
              ownedFurnishings: sanitizeFurnishings(
                nextProgress.ownedFurnishings
              ),
              sharesCompleted: Math.min(
                MAX_TOKEN_COUNT,
                Math.max(0, Math.floor(nextProgress.sharesCompleted))
              ),
              welcomeCheckedIn: true,
              dailyStreak: nextProgress.dailyStreak,
              bestStreak: nextProgress.bestStreak,
              lastStreakDate: todayIso,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          : updateDoc(doc(db, 'treeProgress', uid), {
              tryingTokens: nextProgress.tryingTokens,
              gatheringTokens: nextProgress.gatheringTokens,
              treehouseTokens: nextProgress.treehouseTokens,
              ownedFurnishings: sanitizeFurnishings(
                nextProgress.ownedFurnishings
              ),
              sharesCompleted: Math.min(
                MAX_TOKEN_COUNT,
                Math.max(0, Math.floor(nextProgress.sharesCompleted))
              ),
              welcomeCheckedIn: true,
              dailyStreak: nextProgress.dailyStreak,
              bestStreak: nextProgress.bestStreak,
              lastStreakDate: todayIso,
              updatedAt: serverTimestamp(),
            });

        const cloudResult = await withCloudWriteTimeout(
          Promise.all([profileOp, pathwayOp, progressOp]),
          1800
        );
        if (!cloudResult.settled) {
          saveLocalInterestPathways([localRecord, ...localExisting]);
        } else {
          setProfileExists(true);
          setProgressExists(true);
        }
      } catch (err) {
        saveLocalInterestPathways([localRecord, ...localExisting]);
        if (
          !isQuotaExceededError(err) &&
          !isTransientOfflineOrTokenError(err)
        ) {
          setSubmitting(false);
          handleFirestoreError(err, OperationType.CREATE, 'interestPathways');
        }
      }
    }

    setSubmitting(false);
    setSpecialInterestInput('');
    setPotentialJobInput('');
    onLaunchCanopySession(session, summaryLine);
  };

  const handleAdminApprove = async (item: TreetopApplicationState) => {
    if (!isVerifiedAdmin) return;
    setAdminBusyUid(item.applicantId);
    const issuedCode =
      item.tokenCode && TOKEN_CODE_REGEX.test(item.tokenCode)
        ? item.tokenCode
        : generateTreetopTokenCode();
    try {
      await withCloudWriteTimeout(
        updateDoc(doc(db, 'treetopApplications', item.applicantId), {
          status: 'approved',
          treetopTokenGranted: true,
          tokenCode: issuedCode,
          adminNote: 'Welcome to the 33m Treetop Canopy! Move at your own pace.',
          updatedAt: serverTimestamp(),
        }),
        2200
      );
      setInfoBanner(`Approved Treetop Token ${issuedCode} for ${item.displayName}.`);
    } catch (err) {
      if (!isQuotaExceededError(err) && !isTransientOfflineOrTokenError(err)) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `treetopApplications/${item.applicantId}`
        );
      }
    } finally {
      setAdminBusyUid(null);
    }
  };

  const pendingAdminItems = adminQueue.filter((x) => x.status === 'pending');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-kiosk-popup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55 pointer-events-auto"
    >
      <div className="w-full max-w-[440px] max-h-[84vh] flex flex-col rounded-2xl bg-[#111C15] border border-white/15 text-[#F7F4EB] shadow-2xl overflow-hidden">
        {/* Compact Pop-Up Header */}
        <div className="px-5 py-3.5 bg-[#16241B] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="entry-kiosk-popup-title"
              className="font-display text-lg font-bold text-[#FFFFFF] truncate"
            >
              Entry Kiosk
            </h2>
            <p className="text-xs text-[#B9D1C1] truncate">
              Enter your interest · Calculate &amp; ascend to 33m Canopy
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Entry Kiosk"
            className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-[#1E3125] hover:bg-[#284131] text-[#F7F4EB] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Mode Switch Only When User Wants Account/Admin */}
        <div className="px-5 py-2 bg-[#142018] border-b border-white/10 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setViewMode('entry')}
              className={`py-1 font-semibold whitespace-nowrap cursor-pointer ${
                viewMode === 'entry'
                  ? 'text-[#FFD166] underline underline-offset-4'
                  : 'text-[#B9D1C1] hover:text-[#FFFFFF]'
              }`}
            >
              Session Entry
            </button>
            <button
              type="button"
              onClick={() => setViewMode('account')}
              className={`py-1 font-semibold whitespace-nowrap cursor-pointer font-mono tabular-nums ${
                viewMode === 'account'
                  ? 'text-[#FFD166] underline underline-offset-4'
                  : 'text-[#B9D1C1] hover:text-[#FFFFFF]'
              }`}
            >
              Cloud &amp; Account
              {isVerifiedAdmin && pendingAdminItems.length > 0
                ? ` (${pendingAdminItems.length})`
                : ''}
            </button>
          </div>

          {onOpenShoeSelector && (
            <button
              type="button"
              onClick={onOpenShoeSelector}
              className="text-xs font-medium text-[#7CE0A3] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Choose Footwear
            </button>
          )}
        </div>

        {/* Feedback Strip */}
        {(errorBanner || infoBanner) && (
          <div
            role="status"
            className={`px-5 py-2 text-xs border-b shrink-0 ${
              errorBanner
                ? 'bg-[#361818] border-[#F87171]/40 text-[#FECACA]'
                : 'bg-[#1A3123] border-[#7CE0A3]/40 text-[#D8F5E2]'
            }`}
          >
            {errorBanner || infoBanner}
          </div>
        )}

        {/* Compact Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 select-text">
          {viewMode === 'entry' ? (
            <form onSubmit={handleCalculateAndAscend} className="space-y-4">
              {/* 1. Session Type Selector: Trade / Work / Community */}
              <div>
                <label className="block text-xs font-medium text-[#D6E5D9] mb-1.5">
                  Canopy Session Focus
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#18281E]">
                  {(['trade', 'work', 'community'] as CanopySessionMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSessionMode(mode)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          sessionMode === mode
                            ? 'bg-[#E5A93C] text-[#181009]'
                            : 'text-[#D6E5D9] hover:text-[#FFFFFF]'
                        }`}
                      >
                        {SESSION_MODE_META[mode].label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 2. Special Interest Input + Quick Presets */}
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <label
                    htmlFor="kiosk-interest-input"
                    className="text-xs font-medium text-[#D6E5D9]"
                  >
                    Your Special Interest
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {QUICK_INTEREST_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="text-[#FFD166] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="kiosk-interest-input"
                  type="text"
                  value={specialInterestInput}
                  onChange={(e) => {
                    setErrorBanner(null);
                    setSpecialInterestInput(
                      e.target.value.slice(0, SPECIAL_INTEREST_MAX_LENGTH)
                    );
                  }}
                  placeholder="e.g. Agarwood essential oil, timber joinery, repair…"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D1610] border border-white/15 focus:border-[#FFD166] focus:outline-none text-sm text-[#FFFFFF] placeholder:text-[#7E9B88]"
                />
              </div>

              {/* 3. Target Job / Session Goal + Live Deterministic Suggestions */}
              <div>
                <label
                  htmlFor="kiosk-job-input"
                  className="block text-xs font-medium text-[#D6E5D9] mb-1"
                >
                  Job, Trade, or Community Goal
                </label>
                <input
                  id="kiosk-job-input"
                  type="text"
                  value={potentialJobInput}
                  onChange={(e) => {
                    setErrorBanner(null);
                    setPotentialJobInput(
                      e.target.value.slice(0, POTENTIAL_JOB_MAX_LENGTH)
                    );
                  }}
                  placeholder={roleSuggestions[0]?.role || 'Matched role…'}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0D1610] border border-white/15 focus:border-[#FFD166] focus:outline-none text-sm text-[#FFFFFF] placeholder:text-[#7E9B88]"
                />
                {roleSuggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9DC0A6]">
                    {roleSuggestions.slice(0, 2).map((sug) => (
                      <button
                        key={sug.role}
                        type="button"
                        onClick={() => setPotentialJobInput(sug.role)}
                        className="text-left hover:text-[#FFD166] hover:underline truncate max-w-full cursor-pointer"
                      >
                        Use: {sug.role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Compact Handle Input */}
              <div>
                <label
                  htmlFor="kiosk-handle-input"
                  className="block text-xs font-medium text-[#D6E5D9] mb-1"
                >
                  Workshop Handle
                </label>
                <input
                  id="kiosk-handle-input"
                  type="text"
                  value={workshopHandle}
                  onChange={(e) =>
                    setWorkshopHandle(
                      e.target.value.slice(0, USERNAME_MAX_LENGTH)
                    )
                  }
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0D1610] border border-white/15 focus:border-[#FFD166] focus:outline-none text-sm text-[#FFFFFF]"
                />
              </div>

              {/* 5. Live Calculated Changes Preview */}
              <div className="pt-3 border-t border-white/10 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#B9D1C1]">Calculated Changes</span>
                  <span className="font-mono tabular-nums font-semibold text-[#7CE0A3]">
                    +{liveCalculation.session.tryingDelta} Try · +
                    {liveCalculation.session.gatheringDelta} Gather · +
                    {liveCalculation.session.canopyDelta} Canopy
                  </span>
                </div>
                <p className="text-[#D6E5D9] truncate">
                  33m Bench: {liveCalculation.session.canopyFocus} ·{' '}
                  {SESSION_MODE_META[sessionMode].shortHeading}
                </p>
              </div>

              {/* Primary CTA: Calculate & Ascend to 33m Canopy */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] disabled:opacity-60 text-[#181009] text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
              >
                <span>
                  {submitting
                    ? 'Calculating…'
                    : 'Calculate & Go to Canopy'}
                </span>
                <ArrowUpRight className="w-4 h-4 shrink-0" />
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-[#FFFFFF]">
                  {currentUser
                    ? `Signed in as ${workshopHandle}`
                    : 'Local Kiosk Mode Active'}
                </p>
                <p className="text-xs text-[#B9D1C1] leading-relaxed">
                  {currentUser
                    ? 'Your pathways and tokens sync to your private Sanctuary profile.'
                    : sessionNotice ||
                      'All entries work immediately on this device. Sign in with Google anytime to sync across sessions.'}
                </p>
                <div className="pt-1">
                  {!currentUser ? (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleGoogleSignIn}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      {authBusy ? 'Signing In…' : 'Sign In with Google'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleSignOut}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1D2F23] hover:bg-[#274030] border border-white/15 text-[#F7F4EB] text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </div>

              {isVerifiedAdmin && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <p className="text-xs font-semibold text-[#FFD166]">
                    Admin Token Queue ({pendingAdminItems.length} pending)
                  </p>
                  {pendingAdminItems.length === 0 ? (
                    <p className="text-xs text-[#9AB6A3]">
                      No pending Treetop Token requests right now.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingAdminItems.map((item) => (
                        <div
                          key={item.applicantId}
                          className="pt-2 border-t border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#F7F4EB] truncate">
                              {item.displayName}
                            </p>
                            <p className="text-xs text-[#9AB6A3] truncate">
                              {item.preferredTradeTrack}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={adminBusyUid === item.applicantId}
                            onClick={() => void handleAdminApprove(item)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#7CE0A3] text-[#101B14] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
