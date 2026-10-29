import { signInWithPopup, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  OperationType,
  PUBLIC_BETA_URL,
  subscribeSafeAuth,
  UX_FEEDBACK_AREAS,
  UX_IMPROVEMENT_MAX,
  UX_WORKED_WELL_MAX,
  UX_WORKED_WELL_MIN,
  UxBetaFeedbackRecord,
  UxFeedbackFocusArea,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';

const LOCAL_UX_FEEDBACK_KEY = 'jays_job_club_ux_feedback_v1';
const LOCAL_UX_CHECKLIST_KEY = 'jays_job_club_ux_checklist_v1';

interface UxChecklistItem {
  id: string;
  title: string;
  detail: string;
  stationAction: 'job_centre' | 'chill_pods' | 'library' | 'refreshments' | 'kiosk';
  actionLabel: string;
}

const UX_TEST_CHECKLIST: UxChecklistItem[] = [
  {
    id: 'test-job-board',
    title: "1. Browse Jay's Job Centre (JC-001 Beta Researcher & JC-002 Drazella Sprinkes)",
    detail:
      "Inspect Jay's Job Centre in the 0m Courtyard: review JC-001 (Beta User Researcher), preview JC-002 (Drazella Sprinkes' Easy Read + Digital Art Neurobiology advert), and test Team-Up Collaboration.",
    stationAction: 'job_centre',
    actionLabel: "Open Jay's Job Centre",
  },
  {
    id: 'test-chill-pods',
    title: '2. Enter a 1-Per-Person Private Chill Pod on the Mezzanine',
    detail:
      'Step into a vacant green-lit pod and test Cool Down (Fan), Heater, Sensory Calm (Light Off), Water Flotation, and Vegan vs Natural Duck Feather Quilt.',
    stationAction: 'chill_pods',
    actionLabel: 'Go to Chill Pods',
  },
  {
    id: 'test-library',
    title: '3. Read a Large-Print Handbook in the Mezzanine Library',
    detail:
      'Visit the West Mezzanine reading desk and flip through practical joinery, pacing, and collaboration guides.',
    stationAction: 'library',
    actionLabel: 'Open Library',
  },
  {
    id: 'test-refreshments',
    title: '4. Pour Herbal Tea or Spring Water at Refreshments',
    detail:
      'Visit the East Mezzanine copper tea urn bar to restore Canopy Poise to 100%.',
    stationAction: 'refreshments',
    actionLabel: 'Visit Refreshments',
  },
  {
    id: 'test-entry-kiosk',
    title: '5. Map a Special Interest to a Canopy Session at the Kiosk',
    detail:
      'Enter an interest at the compact Entry Kiosk and ride the Agarwood Lift to 33m.',
    stationAction: 'kiosk',
    actionLabel: 'Open Entry Kiosk',
  },
];

function loadLocalFeedback(): UxBetaFeedbackRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_UX_FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UxBetaFeedbackRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocalFeedback(items: UxBetaFeedbackRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_UX_FEEDBACK_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota
  }
}

function loadCheckedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_UX_CHECKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

interface BetaShareModalProps {
  isOpen: boolean;
  initialFocusArea?: UxFeedbackFocusArea;
  onJumpToStation: (
    target: 'job_centre' | 'chill_pods' | 'library' | 'refreshments' | 'kiosk'
  ) => void;
  onClose: () => void;
}

export const BetaShareModal: React.FC<BetaShareModalProps> = ({
  isOpen,
  initialFocusArea,
  onJumpToStation,
  onClose,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    loadCheckedIds()
  );

  // Feedback form state
  const [testerHandle, setTesterHandle] = useState<string>('UX Beta Tester');
  const [focusArea, setFocusArea] = useState<UxFeedbackFocusArea>(
    initialFocusArea ?? 'Overall Navigation & Readability'
  );
  const [easeScore, setEaseScore] = useState<number>(5);
  const [workedWell, setWorkedWell] = useState<string>('');
  const [improvementIdea, setImprovementIdea] = useState<string>('');
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [cloudFeedback, setCloudFeedback] = useState<UxBetaFeedbackRecord[]>(
    []
  );
  const [localFeedback, setLocalFeedback] = useState<UxBetaFeedbackRecord[]>(
    () => loadLocalFeedback()
  );

  useEffect(() => {
    if (isOpen && initialFocusArea) {
      setFocusArea(initialFocusArea);
    }
  }, [isOpen, initialFocusArea]);

  useEffect(() => {
    return subscribeSafeAuth((u) => {
      setCurrentUser(u);
      if (u?.displayName && u.displayName.trim().length >= 2) {
        setTesterHandle(u.displayName.trim().slice(0, 40));
      }
    });
  }, []);

  useEffect(() => {
    if (
      !isOpen ||
      !currentUser ||
      !VALID_DOC_ID_REGEX.test(currentUser.uid)
    ) {
      setCloudFeedback([]);
      return;
    }

    const isAdmin =
      Boolean(currentUser.emailVerified) &&
      currentUser.email?.toLowerCase() ===
        BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const q = isAdmin
      ? query(collection(db, 'uxBetaFeedback'), where('easeScore', '>=', 1))
      : query(
          collection(db, 'uxBetaFeedback'),
          where('authorId', '==', currentUser.uid)
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UxBetaFeedbackRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          list.push({
            id: docSnap.id,
            authorId: String(d.authorId || ''),
            testerHandle: String(d.testerHandle || 'Tester'),
            focusArea:
              (d.focusArea as UxFeedbackFocusArea) ||
              'Overall Navigation & Readability',
            easeScore: Number(d.easeScore || 5),
            workedWell: String(d.workedWell || ''),
            improvementIdea: String(d.improvementIdea || ''),
            createdAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setCloudFeedback(list);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'uxBetaFeedback');
      }
    );

    return () => unsub();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      soundEngine.unlock();
      soundEngine.playTokenCollect();
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2400);
    } catch {
      setSubmitNotice(
        'Clipboard access was blocked by the browser — you can select and copy the URL text directly.'
      );
    }
  };

  const toggleChecklist = (id: string) => {
    setCheckedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        window.localStorage.setItem(
          LOCAL_UX_CHECKLIST_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle =
      testerHandle.trim().length >= 2
        ? testerHandle.trim().slice(0, 40)
        : 'UX Beta Tester';
    const cleanWorked = workedWell.trim();
    const cleanImprove = improvementIdea.trim().slice(0, UX_IMPROVEMENT_MAX);

    if (cleanWorked.length < UX_WORKED_WELL_MIN) {
      setSubmitNotice(
        `Please share at least ${UX_WORKED_WELL_MIN} characters on what worked well or felt clear.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitNotice(null);

    const docId = `ux_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const canWriteCloud = Boolean(
      currentUser &&
        currentUser.emailVerified &&
        VALID_DOC_ID_REGEX.test(currentUser.uid)
    );

    const record: UxBetaFeedbackRecord = {
      id: docId,
      authorId: currentUser?.uid || 'local_tester',
      testerHandle: cleanHandle,
      focusArea,
      easeScore: Math.min(5, Math.max(1, Math.round(easeScore))),
      workedWell: cleanWorked.slice(0, UX_WORKED_WELL_MAX),
      improvementIdea: cleanImprove,
      createdAtMs: Date.now(),
      source: canWriteCloud ? 'cloud' : 'local',
    };

    try {
      const nextLocal = [record, ...localFeedback];
      setLocalFeedback(nextLocal);
      saveLocalFeedback(nextLocal);

      if (canWriteCloud && currentUser) {
        try {
          await withCloudWriteTimeout(
            setDoc(doc(db, 'uxBetaFeedback', docId), {
              authorId: currentUser.uid,
              testerHandle: record.testerHandle,
              focusArea: record.focusArea,
              easeScore: record.easeScore,
              workedWell: record.workedWell,
              improvementIdea: record.improvementIdea,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        } catch (err) {
          if (
            !isQuotaExceededError(err) &&
            !isTransientOfflineOrTokenError(err)
          ) {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `uxBetaFeedback/${docId}`
            );
          }
        }
      }

      soundEngine.unlock();
      soundEngine.playCanopyDelivery(false);
      setWorkedWell('');
      setImprovementIdea('');
      setSubmitNotice(
        canWriteCloud
          ? "Thank you! Your Beta User Research note for Jay's Job Centre has been saved to the cloud log."
          : "Thank you! Your Beta User Research note has been saved on this device (sign in with a verified email anytime to sync to cloud)."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inviteNote = `You're invited to join as a Beta User Researcher for Jay's Job Centre — The Canopy Lift (Public Beta):
${PUBLIC_BETA_URL}

Things to try at your own pace:
1. 0m Jay's Job Centre: check Notice JC-001 (Beta User Researcher), inspect JC-002 (Drazella Sprinkes' Youth Development Publishing advert for Easy Read neurobiological books using digital art), and test Easy Read · Large Print mode.
2. 33m Treetop Mezzanine: explore Drazella Sprinkes' Easy Read Neurobiology handbook in the Library, Refreshments Bar, and 1-per-person Safe Chill Pods.`;

  const combinedFeedback =
    cloudFeedback.length > 0 ? cloudFeedback : localFeedback;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Public Beta URL & UX Testing Hub"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/70 pointer-events-auto"
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#132119] border-2 border-[#7CE0A3]/70 text-[#F7F4EB] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#182B20] border-b border-white/15 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#7CE0A3]">
              Shareable Public Preview · UX Testing Ready
            </p>
            <h2 className="mt-0.5 text-lg sm:text-xl font-bold text-[#FFD166]">
              Public Beta URL &amp; UX Tester Walkthrough
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-1.5 rounded-xl bg-[#241810] border border-[#E5A93C]/60 hover:border-[#FFD166] text-[#FFD166] text-xs sm:text-sm font-bold cursor-pointer touch-manipulation"
          >
            Close ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto mobile-touch-scroll p-5 space-y-5">
          {/* Shareable Public Beta Link Box */}
          <section className="rounded-2xl bg-[#1A2F23] border border-[#FFD166]/55 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                Public Beta URL (Share with UX Testers &amp; Collaborators)
              </h3>
              <span className="text-xs font-mono text-[#7CE0A3]">
                Live Multi-User WebSockets + Cloud Rules Active
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                aria-label="Public Beta URL"
                value={PUBLIC_BETA_URL}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-xl bg-[#0F1B14] border border-white/25 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-[#FFFDF7] select-all"
              />
              <button
                type="button"
                onClick={() => void copyText(PUBLIC_BETA_URL, 'main_url')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer"
              >
                {copiedKey === 'main_url'
                  ? '✓ Copied Beta URL!'
                  : 'Copy Public Beta URL'}
              </button>
              <button
                type="button"
                onClick={() => void copyText(inviteNote, 'invite_note')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#243D2E] border border-[#7CE0A3]/60 hover:border-[#7CE0A3] text-[#E9F8EE] font-semibold text-xs sm:text-sm whitespace-nowrap cursor-pointer"
              >
                {copiedKey === 'invite_note'
                  ? '✓ Invite Copied!'
                  : 'Copy Tester Invite Note'}
              </button>
            </div>

            {/* Direct Station Deep Links */}
            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#C4D9CB] font-medium">
                Direct Station Deep-Links:
              </span>
              {(
                [
                  {
                    key: 'dl_jobs',
                    label: 'Copy Job Centre Link',
                    url: `${PUBLIC_BETA_URL}?station=job-centre`,
                  },
                  {
                    key: 'dl_pods',
                    label: 'Copy Chill Pods Link',
                    url: `${PUBLIC_BETA_URL}?station=chill-pods`,
                  },
                  {
                    key: 'dl_mez',
                    label: 'Copy Mezzanine Library Link',
                    url: `${PUBLIC_BETA_URL}?station=mezzanine`,
                  },
                ] as const
              ).map((dl) => (
                <button
                  key={dl.key}
                  type="button"
                  onClick={() => void copyText(dl.url, dl.key)}
                  className="px-3 py-1.5 rounded-lg bg-[#122018] border border-white/15 hover:border-[#FFD166] text-[#F7F4EB] font-mono cursor-pointer"
                >
                  {copiedKey === dl.key ? '✓ Copied' : dl.label}
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Interactive UX Testing Checklist */}
            <section className="lg:col-span-6 rounded-2xl bg-[#18281F] border border-white/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                  5-Step UX Testing Walkthrough
                </h3>
                <span className="font-mono text-xs text-[#7CE0A3]">
                  {checkedIds.length} / {UX_TEST_CHECKLIST.length} Tried
                </span>
              </div>

              <div className="space-y-2.5">
                {UX_TEST_CHECKLIST.map((item) => {
                  const done = checkedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#121F18] border border-white/12 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleChecklist(item.id)}
                            className="mt-1 w-4 h-4 accent-[#7CE0A3]"
                          />
                          <span
                            className={`text-xs sm:text-sm font-semibold ${
                              done
                                ? 'line-through text-[#94B3A0]'
                                : 'text-[#F7F4EB]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-[#C4D8CA] pl-6">
                        {item.detail}
                      </p>
                      <div className="pl-6">
                        <button
                          type="button"
                          onClick={() => onJumpToStation(item.stationAction)}
                          className="px-3 py-1.5 rounded-lg bg-[#213A2B] border border-[#7CE0A3]/50 hover:border-[#FFD166] text-xs font-semibold text-[#FFD166] cursor-pointer"
                        >
                          {item.actionLabel} →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Right: UX Tester Feedback Form */}
            <section className="lg:col-span-6 rounded-2xl bg-[#18281F] border border-white/15 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                  Record UX Testing Feedback
                </h3>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await signInWithPopup(auth, googleProvider);
                      } catch {
                        // Ignore popup close
                      }
                    }}
                    className="text-xs text-[#7CE0A3] underline font-semibold cursor-pointer"
                  >
                    Sign in for Cloud Sync
                  </button>
                )}
              </div>

              {submitNotice && (
                <div className="rounded-xl bg-[#1E3829] border border-[#7CE0A3] px-3.5 py-2.5 text-xs text-[#EEFBF2]">
                  {submitNotice}
                </div>
              )}

              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="block text-xs text-[#D4E6DA]">
                    Your Name / Tester Handle
                    <input
                      type="text"
                      value={testerHandle}
                      onChange={(e) => setTesterHandle(e.target.value)}
                      maxLength={40}
                      className="mt-1 w-full rounded-lg bg-[#101C15] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                    />
                  </label>
                  <label className="block text-xs text-[#D4E6DA]">
                    Ease of Use (1–5)
                    <select
                      value={easeScore}
                      onChange={(e) => setEaseScore(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-[#101C15] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                    >
                      <option value={5}>5 — Very Clear &amp; Calm</option>
                      <option value={4}>4 — Easy to Use</option>
                      <option value={3}>3 — Mostly Clear</option>
                      <option value={2}>2 — Needed Exploring</option>
                      <option value={1}>1 — Hard to Find Things</option>
                    </select>
                  </label>
                </div>

                <label className="block text-xs text-[#D4E6DA]">
                  Station Tested
                  <select
                    value={focusArea}
                    onChange={(e) =>
                      setFocusArea(e.target.value as UxFeedbackFocusArea)
                    }
                    className="mt-1 w-full rounded-lg bg-[#101C15] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                  >
                    {UX_FEEDBACK_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs text-[#D4E6DA]">
                  What Worked Well?
                  <textarea
                    rows={2}
                    required
                    minLength={UX_WORKED_WELL_MIN}
                    maxLength={UX_WORKED_WELL_MAX}
                    value={workedWell}
                    onChange={(e) => setWorkedWell(e.target.value)}
                    placeholder="e.g. Loved the old-style Job Centre slips and turning the light off in Pod 02..."
                    className="mt-1 w-full rounded-lg bg-[#101C15] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                  />
                </label>

                <label className="block text-xs text-[#D4E6DA]">
                  Any Suggestions or Sensory Tweaks? (Optional)
                  <textarea
                    rows={2}
                    maxLength={UX_IMPROVEMENT_MAX}
                    value={improvementIdea}
                    onChange={(e) => setImprovementIdea(e.target.value)}
                    placeholder="Any labels, buttons, or features that could feel even friendlier..."
                    className="mt-1 w-full rounded-lg bg-[#101C15] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] rounded-xl bg-[#7CE0A3] hover:bg-[#9BEBB9] text-[#0E2015] font-bold text-sm cursor-pointer"
                >
                  {submitting ? 'Saving UX Note...' : 'Save UX Testing Note'}
                </button>
              </form>

              {combinedFeedback.length > 0 && (
                <div className="pt-2 space-y-2 max-h-[150px] overflow-y-auto">
                  <div className="text-xs font-mono uppercase text-[#9DC3AC]">
                    Recent UX Notes ({combinedFeedback.length})
                  </div>
                  {combinedFeedback.slice(0, 5).map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg bg-[#111E17] border border-white/10 p-2.5 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-[#FFD166]">
                        <span>
                          {f.testerHandle} · {f.focusArea}
                        </span>
                        <span>{f.easeScore}/5</span>
                      </div>
                      <p className="mt-1 text-[#E6F4EB]">{f.workedWell}</p>
                      {f.improvementIdea && (
                        <p className="mt-0.5 text-[#B8D2C2]">
                          Idea: {f.improvementIdea}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
