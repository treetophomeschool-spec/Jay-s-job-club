import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Check, Eye, EyeOff, Pause, Play, RotateCcw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  CANOPY_FURNISHING_KINDS,
  CanopyFurnishingKind,
  db,
  getSafeCurrentUser,
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
import {
  ActiveCanopySession,
  CanopySessionMode,
  incrementLocalGrowthRings,
  SESSION_MODE_META,
} from '../utils/canopySessionStore';

interface CanopySessionPanelProps {
  session: ActiveCanopySession | null;
  isHidden: boolean;
  elevationMeters: number;
  anyDrawerOpen: boolean;
  localProgress: TreeProgressState;
  onToggleHidden: (hidden: boolean) => void;
  onUpdateSession: (next: ActiveCanopySession | null) => void;
  onUpdateLocalProgress: (
    next: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onGlideToCanopy: () => void;
  onOpenEntryKiosk: () => void;
  onOpenCanopyCustomizer: () => void;
  onOpenCanopyPaypalStore: () => void;
}

function sanitizeOwned(items: unknown): CanopyFurnishingKind[] {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items.filter((x): x is CanopyFurnishingKind =>
        CANOPY_FURNISHING_KINDS.includes(x as CanopyFurnishingKind)
      )
    )
  ).slice(0, 6);
}

export const CanopySessionPanel: React.FC<CanopySessionPanelProps> = ({
  session,
  isHidden,
  elevationMeters,
  anyDrawerOpen,
  localProgress,
  onToggleHidden,
  onUpdateSession,
  onUpdateLocalProgress,
  onGlideToCanopy,
  onOpenEntryKiosk,
  onOpenCanopyCustomizer,
  onOpenCanopyPaypalStore,
}) => {
  const [user, setUser] = useState(() => getSafeCurrentUser());
  const [progressExists, setProgressExists] = useState(false);

  // Calm Relaxation Time-Out timer for Canopy sensory breaks (120 seconds)
  const [timeoutActive, setTimeoutActive] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSafeAuth((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProgressExists(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;
    const unsub = onSnapshot(
      doc(db, 'treeProgress', user.uid),
      (snap) => {
        setProgressExists(snap.exists());
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(
          err,
          OperationType.GET,
          `treeProgress/${user.uid}`
        );
      }
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!timeoutActive) return;
    const id = window.setInterval(() => {
      setTimeoutSeconds((prev) => {
        if (prev <= 1) {
          setTimeoutActive(false);
          setStatusNote(
            'Canopy relaxation breather complete — return to your bench whenever ready.'
          );
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timeoutActive]);

  if (!session || anyDrawerOpen) return null;

  const atCanopy = elevationMeters >= 30.5;
  const modeMeta = SESSION_MODE_META[session.sessionMode];

  // Compact hidden state at the Canopy ("where it can be hidden")
  if (isHidden) {
    return (
      <div className="fixed top-16 left-3 sm:left-5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => onToggleHidden(false)}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#101B14]/95 border border-white/15 hover:border-[#FFD166] text-[#F7F4EB] text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg transition-colors cursor-pointer"
          title="Show active Canopy Trade, Work, or Community session"
        >
          <Eye className="w-4 h-4 text-[#FFD166] shrink-0" />
          <span>Show {modeMeta.label} Session</span>
        </button>
      </div>
    );
  }

  const handleToggleStep = (index: number) => {
    const nextCompleted = session.completedSteps.map((done, idx) =>
      idx === index ? !done : done
    );
    onUpdateSession({
      ...session,
      completedSteps: nextCompleted,
    });
  };

  const handleSwitchMode = (nextMode: CanopySessionMode) => {
    if (nextMode === session.sessionMode) return;
    setStatusNote(null);
    onUpdateSession({
      ...session,
      sessionMode: nextMode,
    });
  };

  const handleCompleteSession = async () => {
    if (session.sessionCompleted) {
      onToggleHidden(true);
      return;
    }

    incrementLocalGrowthRings();
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextProgress: TreeProgressState = {
      ...localProgress,
      treehouseTokens: Math.min(
        MAX_TOKEN_COUNT,
        localProgress.treehouseTokens + 1
      ),
      sharesCompleted: Math.min(
        MAX_TOKEN_COUNT,
        localProgress.sharesCompleted + 1
      ),
      welcomeCheckedIn: true,
      dailyStreak: Math.max(1, localProgress.dailyStreak || 0),
      bestStreak: Math.max(1, localProgress.bestStreak || 0),
      lastStreakDate: todayIso,
    };

    onUpdateLocalProgress(
      nextProgress,
      `Completed ${modeMeta.label} Session at 33m Canopy (+1 Growth Ring & +1 Canopy Token)!`
    );

    onUpdateSession({
      ...session,
      completedSteps: session.steps.map(() => true),
      sessionCompleted: true,
    });
    setStatusNote(
      'Session complete! Added +1 Growth Ring and +1 Canopy Token. Hide this card anytime to enjoy the Canopy.'
    );

    if (user && user.emailVerified && VALID_DOC_ID_REGEX.test(user.uid)) {
      const ref = doc(db, 'treeProgress', user.uid);
      try {
        const writeOp = progressExists
          ? updateDoc(ref, {
              tryingTokens: nextProgress.tryingTokens,
              gatheringTokens: nextProgress.gatheringTokens,
              treehouseTokens: nextProgress.treehouseTokens,
              ownedFurnishings: sanitizeOwned(nextProgress.ownedFurnishings),
              sharesCompleted: nextProgress.sharesCompleted,
              welcomeCheckedIn: true,
              dailyStreak: nextProgress.dailyStreak,
              bestStreak: nextProgress.bestStreak,
              lastStreakDate: todayIso,
              updatedAt: serverTimestamp(),
            })
          : setDoc(ref, {
              uid: user.uid,
              tryingTokens: nextProgress.tryingTokens,
              gatheringTokens: nextProgress.gatheringTokens,
              treehouseTokens: nextProgress.treehouseTokens,
              ownedFurnishings: sanitizeOwned(nextProgress.ownedFurnishings),
              sharesCompleted: nextProgress.sharesCompleted,
              welcomeCheckedIn: true,
              dailyStreak: nextProgress.dailyStreak,
              bestStreak: nextProgress.bestStreak,
              lastStreakDate: todayIso,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
        await withCloudWriteTimeout(writeOp, 2200);
        setProgressExists(true);
      } catch (err) {
        if (
          !isQuotaExceededError(err) &&
          !isTransientOfflineOrTokenError(err)
        ) {
          handleFirestoreError(
            err,
            progressExists ? OperationType.UPDATE : OperationType.CREATE,
            `treeProgress/${user.uid}`
          );
        }
      }
    }
  };

  const mins = Math.floor(timeoutSeconds / 60);
  const secs = timeoutSeconds % 60;
  const formattedTimer = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <aside
      aria-label="33m Canopy Active Session"
      className="fixed top-16 left-3 sm:left-5 z-20 w-[min(372px,92vw)] max-h-[calc(100vh-11rem)] pointer-events-auto flex flex-col rounded-2xl bg-[#101B14]/96 border border-white/15 text-[#F7F4EB] shadow-2xl overflow-hidden"
    >
      {/* Compact Header with Hide Control */}
      <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-[#A9C7B2] font-mono tabular-nums">
            <span>{atCanopy ? '33m Canopy Active' : `Climbing ${elevationMeters.toFixed(1)}m / 33m`}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#FFD166]">{modeMeta.label}</span>
          </div>
          <h2 className="mt-0.5 font-display text-base font-bold text-[#FFFFFF] truncate">
            {session.matchedJobRole}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => onToggleHidden(true)}
          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1A2B20] hover:bg-[#243B2C] border border-white/15 text-xs font-semibold text-[#F7F4EB] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          title="Hide session card while working at the Canopy"
        >
          <EyeOff className="w-3.5 h-3.5 text-[#FFD166] shrink-0" />
          <span>Hide</span>
        </button>
      </div>

      {/* Scrollable Compact Session Body */}
      <div className="overflow-y-auto px-4 py-3.5 space-y-3.5 text-xs sm:text-sm select-text">
        {/* Calculated Changes Summary (Unboxed Typography) */}
        <div className="space-y-1">
          <p className="text-xs text-[#C6DCD0]">
            Interest:{' '}
            <span className="font-semibold text-[#F7F4EB]">
              {session.specialInterest}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono tabular-nums text-[#7CE0A3]">
            <span>+{session.tryingDelta} Try</span>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <span>+{session.gatheringDelta} Gather</span>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <span>+{session.canopyDelta} Canopy</span>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <span className="text-[#FFD166]">{session.canopyFocus}</span>
          </div>
        </div>

        {!atCanopy && (
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <span className="text-xs text-[#D6E5D9]">
              Agarwood Lift ascending to Canopy…
            </span>
            <button
              type="button"
              onClick={onGlideToCanopy}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Glide to 33m
            </button>
          </div>
        )}

        {/* Segmented Mode Switcher: Trade / Work / Community */}
        <div className="pt-2.5 border-t border-white/10">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#17261D]">
            {(['trade', 'work', 'community'] as CanopySessionMode[]).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSwitchMode(m)}
                  className={`min-h-[34px] px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    session.sessionMode === m
                      ? 'bg-[#E5A93C] text-[#181009]'
                      : 'text-[#C8DDD0] hover:text-[#FFFFFF]'
                  }`}
                >
                  {SESSION_MODE_META[m].label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Interactive Canopy Steps */}
        <div className="space-y-2">
          {session.steps.map((step, idx) => {
            const done = Boolean(session.completedSteps[idx]);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleStep(idx)}
                className="w-full text-left flex items-start gap-2.5 py-1.5 text-xs leading-relaxed text-[#E7F0EA] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                    done
                      ? 'bg-[#7CE0A3] border-[#7CE0A3] text-[#101B14]'
                      : 'border-[#8FB996]/60 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </span>
                <span className={done ? 'line-through text-[#9AB6A3]' : ''}>
                  {step}
                </span>
              </button>
            );
          })}
        </div>

        {/* Canopy Relaxation Time-Out (Always handy during Community or sensory pacing) */}
        {session.sessionMode === 'community' && (
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#F7F4EB]">
                Calm Canopy Time-Out
              </p>
              <p className="text-xs font-mono tabular-nums text-[#9DC0A6]">
                {formattedTimer} quiet breather
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setTimeoutActive((prev) => !prev)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#1D3125] hover:bg-[#274232] border border-[#7CE0A3]/50 text-xs font-semibold text-[#E6F7EC] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {timeoutActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5 shrink-0" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    <span>Time-Out</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeoutActive(false);
                  setTimeoutSeconds(120);
                }}
                aria-label="Reset relaxation timer"
                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#17261D] hover:bg-[#213629] text-[#C8DDD0] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {statusNote && (
          <p role="status" className="text-xs text-[#7CE0A3] leading-relaxed">
            {statusNote}
          </p>
        )}

        {/* Primary Canopy Workspace Actions */}
        <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-2">
          {session.sessionMode === 'work' ? (
            <button
              type="button"
              onClick={onOpenCanopyPaypalStore}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1D3125] hover:bg-[#274232] border border-[#7CE0A3]/55 text-xs font-semibold text-[#E6F7EC] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open PayPal Store
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCanopyCustomizer}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1D3125] hover:bg-[#274232] border border-[#FFD166]/50 text-xs font-semibold text-[#FFD166] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Customise Bench
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleCompleteSession()}
            className="flex-1 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {session.sessionCompleted ? 'Hide Card' : 'Complete (+1 Ring)'}
          </button>
        </div>

        {/* Subtle Secondary Footer Links */}
        <div className="pt-1 flex items-center justify-between text-xs text-[#9AB6A3]">
          <button
            type="button"
            onClick={onOpenEntryKiosk}
            className="hover:text-[#F7F4EB] hover:underline whitespace-nowrap cursor-pointer"
          >
            Edit at Kiosk
          </button>
          <button
            type="button"
            onClick={() => onUpdateSession(null)}
            className="hover:text-[#F7F4EB] hover:underline whitespace-nowrap cursor-pointer"
          >
            End Session
          </button>
        </div>
      </div>
    </aside>
  );
};
