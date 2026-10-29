import React, { useEffect, useState } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Compass,
  HeartHandshake,
  LogIn,
  Plus,
  Sliders,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  OperationType,
  PROVIDER_ACCOMMODATIONS_MAX_LENGTH,
  PROVIDER_ACCOMMODATIONS_MIN_LENGTH,
  PROVIDER_NAME_MAX_LENGTH,
  PROVIDER_NAME_MIN_LENGTH,
  PROVIDER_SUMMARY_MAX_LENGTH,
  PROVIDER_SUMMARY_MIN_LENGTH,
  SERVICE_PROVIDER_ROLES,
  SERVICE_SESSION_MODES,
  ServiceProviderRole,
  ServiceSessionMode,
  VALID_DOC_ID_REGEX,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import { PaceMode } from '../types/game';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

export type SupportTab = 'skills' | 'providers';

interface ProviderListing {
  id: string;
  providerId: string;
  displayName: string;
  providerRole: ServiceProviderRole;
  specialtySummary: string;
  neuroAccommodations: string;
  sessionMode: ServiceSessionMode;
  availabilityStatus: 'available' | 'paused' | 'archived';
}

interface OpenSkillGoal {
  id: string;
  title: string;
  note: string;
  done: boolean;
}

const LOCAL_OPEN_SKILL_GOALS_KEY = 'jays_job_club_open_skill_goals_v1';

const ROLE_DISPLAY_LABEL: Record<ServiceProviderRole, string> = {
  'Pre-Crisis Intervention Counsellor': 'Calm Check-In & Peer Support',
  'Crisis Coaching Specialist': 'Workshop Steadying & Coaching',
  'Neurobiologically-Aware Skills & Trade Trainer': 'Practical Skills & Trade Mentor',
};

function loadOpenSkillGoals(): OpenSkillGoal[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_OPEN_SKILL_GOALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g): g is OpenSkillGoal =>
        Boolean(g) && typeof g === 'object' && typeof g.title === 'string'
    );
  } catch {
    return [];
  }
}

function saveOpenSkillGoals(goals: OpenSkillGoal[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_OPEN_SKILL_GOALS_KEY,
      JSON.stringify(goals.slice(0, 30))
    );
  } catch {
    // Ignore storage errors
  }
}

interface SupportAndSkillsModalProps {
  isOpen: boolean;
  initialTab?: SupportTab;
  user: User | null;
  authReady: boolean;
  paceMode: PaceMode;
  onSwitchToFinePace: () => void;
  onGlideToRootRest: () => void;
  onLaunchCoachingCollab: (
    roomId: string,
    roomTitle: string,
    seedNote: string
  ) => void;
  onSkillModuleCompleted: (moduleTitle: string) => void;
  onClose: () => void;
}

export const SupportAndSkillsModal: React.FC<SupportAndSkillsModalProps> = ({
  isOpen,
  initialTab = 'skills',
  user,
  authReady,
  paceMode,
  onSwitchToFinePace,
  onGlideToRootRest,
  onLaunchCoachingCollab,
  onSkillModuleCompleted,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SupportTab>(initialTab);
  const [bannerNote, setBannerNote] = useState<string | null>(null);

  // Open member-defined skill practice checklist (zero pre-seeded autism modules)
  const [skillGoals, setSkillGoals] = useState<OpenSkillGoal[]>(() =>
    loadOpenSkillGoals()
  );
  const [newSkillTitle, setNewSkillTitle] = useState('');
  const [newSkillNote, setNewSkillNote] = useState('');

  // Open Community Mentors & Support Directory (zero pre-seeded autism providers)
  const [cloudProviders, setCloudProviders] = useState<ProviderListing[]>([]);
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [providerRole, setProviderRole] = useState<ServiceProviderRole>(
    'Neurobiologically-Aware Skills & Trade Trainer'
  );
  const [sessionMode, setSessionMode] = useState<ServiceSessionMode>(
    'Live Collab Workbench'
  );
  const [specialtySummary, setSpecialtySummary] = useState<string>('');
  const [neuroAccommodations, setNeuroAccommodations] = useState<string>('');
  const [savingProvider, setSavingProvider] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Subscribe to verified community mentor/support listings when signed in
  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setCloudProviders([]);
      return;
    }

    const q = query(collection(db, 'serviceProviders'), limit(60));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ProviderListing[] = [];
        snap.forEach((dSnap) => {
          const d = dSnap.data();
          const status = String(d.availabilityStatus || 'available');
          if (status !== 'available' && d.providerId !== user.uid) return;
          const role = SERVICE_PROVIDER_ROLES.includes(d.providerRole)
            ? (d.providerRole as ServiceProviderRole)
            : 'Neurobiologically-Aware Skills & Trade Trainer';
          const mode = SERVICE_SESSION_MODES.includes(d.sessionMode)
            ? (d.sessionMode as ServiceSessionMode)
            : 'Paced 1-on-1 Trade Bench';
          const _ts = d.updatedAt as Timestamp | null;
          void _ts;
          list.push({
            id: dSnap.id,
            providerId: String(d.providerId || dSnap.id),
            displayName: String(d.displayName || 'Community Mentor'),
            providerRole: role,
            specialtySummary: String(d.specialtySummary || ''),
            neuroAccommodations: String(d.neuroAccommodations || ''),
            sessionMode: mode,
            availabilityStatus:
              status === 'paused'
                ? 'paused'
                : status === 'archived'
                  ? 'archived'
                  : 'available',
          });
        });
        setCloudProviders(list);

        const own = list.find((item) => item.providerId === user.uid);
        if (own) {
          setDisplayName((prev) => prev || own.displayName);
          setProviderRole(own.providerRole);
          setSessionMode(own.sessionMode);
          setSpecialtySummary((prev) => prev || own.specialtySummary);
          setNeuroAccommodations((prev) => prev || own.neuroAccommodations);
        }
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'serviceProviders');
        }
      }
    );

    return () => unsub();
  }, [isOpen, authReady, user]);

  if (!isOpen) return null;

  const handleAddOpenSkillGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newSkillTitle.trim().slice(0, 80);
    const cleanNote = newSkillNote.trim().slice(0, 240);
    if (cleanTitle.length < 2) return;

    const censor = screenBootsOnGroundCensor(
      `${cleanTitle} ${cleanNote}`,
      'open-skills-goal'
    );
    if (!censor.allowed) {
      setBannerNote(
        censor.reason ||
          "Tree 'Boots on Ground' Censor: Please keep skill practice notes respectful."
      );
      return;
    }

    const created: OpenSkillGoal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      note: cleanNote,
      done: false,
    };
    const next = [created, ...skillGoals];
    setSkillGoals(next);
    saveOpenSkillGoals(next);
    setNewSkillTitle('');
    setNewSkillNote('');
    setBannerNote(`Added "${cleanTitle}" to your Open Skills bench.`);
  };

  const handleToggleGoalDone = (goal: OpenSkillGoal) => {
    const becomingDone = !goal.done;
    const next = skillGoals.map((g) =>
      g.id === goal.id ? { ...g, done: becomingDone } : g
    );
    setSkillGoals(next);
    saveOpenSkillGoals(next);
    if (becomingDone) {
      onSkillModuleCompleted(goal.title);
      setBannerNote(
        `Completed "${goal.title}" · Awarded +1 Trying Token & +1 Treehouse Token!`
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setFormError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setFormError('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveProviderProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;

    const cleanName = displayName.trim().slice(0, PROVIDER_NAME_MAX_LENGTH);
    const cleanSummary = specialtySummary
      .trim()
      .slice(0, PROVIDER_SUMMARY_MAX_LENGTH);
    const cleanAccom = neuroAccommodations
      .trim()
      .slice(0, PROVIDER_ACCOMMODATIONS_MAX_LENGTH);

    if (cleanName.length < PROVIDER_NAME_MIN_LENGTH) {
      setFormError('Please enter your mentor or support handle (2+ chars).');
      return;
    }
    if (cleanSummary.length < PROVIDER_SUMMARY_MIN_LENGTH) {
      setFormError(
        `Please describe the practical skill or peer support you share (${PROVIDER_SUMMARY_MIN_LENGTH}+ chars).`
      );
      return;
    }
    if (cleanAccom.length < PROVIDER_ACCOMMODATIONS_MIN_LENGTH) {
      setFormError(
        'Please note your preferred workshop pace or session style (6+ chars).'
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanName} ${cleanSummary} ${cleanAccom}`,
      'open-support-directory'
    );
    if (!censor.allowed) {
      setFormError(
        censor.reason ||
          'Blocked: Mentor listings must use respectful, welcoming language.'
      );
      return;
    }

    setSavingProvider(true);
    setFormError(null);

    const providerPath = `serviceProviders/${user.uid}`;
    const providerRef = doc(db, 'serviceProviders', user.uid);
    const profileRef = doc(db, 'publicProfiles', user.uid);

    try {
      const [existingProviderSnap, existingProfileSnap] = await Promise.all([
        getDoc(providerRef),
        getDoc(profileRef),
      ]);

      if (existingProviderSnap.exists()) {
        await updateDoc(providerRef, {
          displayName: cleanName,
          providerRole,
          specialtySummary: cleanSummary,
          neuroAccommodations: cleanAccom,
          sessionMode,
          availabilityStatus: 'available',
          updatedAt: serverTimestamp(),
        });
      } else {
        const batch = writeBatch(db);
        if (!existingProfileSnap.exists()) {
          batch.set(profileRef, {
            uid: user.uid,
            username: cleanName.slice(0, 40),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        batch.set(providerRef, {
          providerId: user.uid,
          displayName: cleanName,
          providerRole,
          specialtySummary: cleanSummary,
          neuroAccommodations: cleanAccom,
          sessionMode,
          availabilityStatus: 'available',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }

      setComposerOpen(false);
      setBannerNote(
        `Published "${cleanName}" to the Open Skills & Support Directory!`
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setFormError('Daily Firestore quota reached. Please try again tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.WRITE, providerPath);
      }
    } finally {
      setSavingProvider(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-skills-heading"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <div className="flex items-center gap-2.5">
              <HeartHandshake className="w-5 h-5 text-[#7CE0A3]" />
              <h2
                id="support-skills-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Open Skills &amp; Community Support Section
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#C6D2C9]">
              Open community bench · Self-paced skill goals, calm pulley controls &amp; member-contributed trade mentors
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1 p-1 bg-[#101914] rounded-lg border border-[#F7F4EB]/12"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'skills'}
                onClick={() => setActiveTab('skills')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'skills'
                    ? 'bg-[#E5A93C] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                Open Skills Space
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'providers'}
                onClick={() => setActiveTab('providers')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'providers'
                    ? 'bg-[#7CE0A3] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                Community Directory ({cloudProviders.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Open Skills and Community Support"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {bannerNote && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#18291F] border border-[#7CE0A3]/45 text-xs text-[#F7F4EB]">
              <span>{bannerNote}</span>
              <button
                type="button"
                onClick={() => setBannerNote(null)}
                className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'skills' ? (
            <div className="space-y-5">
              {/* Calm Workshop Pace & Sanctuary Bar */}
              <section className="p-5 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#E5A93C]" />
                    <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                      Open Workshop Pacing &amp; Sanctuary Controls
                    </h3>
                  </div>
                  <p className="text-xs text-[#C8D4CB] leading-relaxed">
                    This section stays open for any practical trade skill, quiet study block, or peer check-in you want to shape yourself.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {paceMode !== PaceMode.FINE && (
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchToFinePace();
                        setBannerNote(
                          'Switched Lift to Fine Gentle Pace (2.8 m/s).'
                        );
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] cursor-pointer"
                    >
                      Enable Fine Pulley Pace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onGlideToRootRest();
                      onClose();
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] cursor-pointer"
                  >
                    Glide to 0m Ground Sanctuary
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchCoachingCollab(
                        'open-skills-lounge',
                        'Open Skills, Mini-Lectures & Outreach Lounge',
                        'Open peer skill-sharing session started.'
                      )
                    }
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] cursor-pointer"
                  >
                    Open Skills Lounge (Live Collab)
                  </button>
                </div>
              </section>

              {/* Open Member Skill Goal Builder */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <form
                  onSubmit={handleAddOpenSkillGoal}
                  className="lg:col-span-5 p-5 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 space-y-3.5"
                >
                  <h4 className="font-display text-base font-bold text-[#F7F4EB]">
                    Add an Open Skill Practice Goal
                  </h4>
                  <p className="text-xs text-[#C6D2C9]">
                    Set any craft, repair, reading, or Show &amp; Tell skill step you want to practice today (+1 Trying &amp; +1 Treehouse Token when ticked off).
                  </p>
                  <div>
                    <label
                      htmlFor="open-skill-title"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      Skill Step Title
                    </label>
                    <input
                      id="open-skill-title"
                      type="text"
                      required
                      maxLength={80}
                      value={newSkillTitle}
                      onChange={(e) => setNewSkillTitle(e.target.value)}
                      placeholder="e.g., Practice brass lantern wiring continuity check"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="open-skill-note"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      Optional Bench Note
                    </label>
                    <input
                      id="open-skill-note"
                      type="text"
                      maxLength={240}
                      value={newSkillNote}
                      onChange={(e) => setNewSkillNote(e.target.value)}
                      placeholder="Tools needed or calm pace reminder..."
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to My Open Skills Bench</span>
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  <h4 className="font-display text-base font-bold text-[#F7F4EB]">
                    Your Open Skill Goals ({skillGoals.length})
                  </h4>
                  {skillGoals.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#16231C] border border-[#F7F4EB]/12 space-y-2 text-xs text-[#B8C6BC]">
                      <div className="flex items-center gap-2 font-semibold text-[#F7F4EB]">
                        <Compass className="w-4 h-4 text-[#E5A93C]" />
                        <span>Open Slate — Ready for Your Skills</span>
                      </div>
                      <p className="leading-relaxed">
                        Preset modules have been cleared so this space stays open for your own workshop goals, trade practice, and Show &amp; Tell preparation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {skillGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex items-start justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleGoalDone(goal)}
                            className="flex items-start gap-2.5 text-left cursor-pointer"
                          >
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                goal.done ? 'text-[#7CE0A3]' : 'text-[#7D8F83]'
                              }`}
                            />
                            <div>
                              <div
                                className={`text-sm font-semibold ${
                                  goal.done
                                    ? 'line-through text-[#9FB0A4]'
                                    : 'text-[#F7F4EB]'
                                }`}
                              >
                                {goal.title}
                              </div>
                              {goal.note && (
                                <p className="text-xs text-[#C6D2C9] mt-0.5">
                                  {goal.note}
                                </p>
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const next = skillGoals.filter(
                                (g) => g.id !== goal.id
                              );
                              setSkillGoals(next);
                              saveOpenSkillGoals(next);
                            }}
                            className="text-xs text-[#9FB0A4] hover:text-[#F4A261] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: OPEN COMMUNITY DIRECTORY (ZERO PRESET AUTISM PROVIDERS) */
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#C6D2C9]">
                  Open member directory for sharing trade mentoring, craft skills, or calm peer support.
                </p>

                {user ? (
                  <button
                    type="button"
                    onClick={() => setComposerOpen((v) => !v)}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#91E8B3] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {composerOpen
                        ? 'Close Mentor Form'
                        : 'Offer a Skill or Support Listing'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={handleGoogleSignIn}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1A2820] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>
                      {authBusy
                        ? 'Signing In...'
                        : 'Sign In to Add a Community Listing'}
                    </span>
                  </button>
                )}
              </div>

              {composerOpen && user && (
                <form
                  onSubmit={handleSaveProviderProfile}
                  className="p-5 rounded-xl bg-[#16231C] border border-[#7CE0A3]/45 space-y-4"
                >
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Add or Update Your Open Skill / Mentor Listing
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="prov-name"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1.5"
                      >
                        Mentor / Member Display Name
                      </label>
                      <input
                        id="prov-name"
                        type="text"
                        required
                        minLength={PROVIDER_NAME_MIN_LENGTH}
                        maxLength={PROVIDER_NAME_MAX_LENGTH}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Jordan · Timber & Lantern Mentor"
                        className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="prov-mode"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1.5"
                      >
                        Session Format
                      </label>
                      <select
                        id="prov-mode"
                        value={sessionMode}
                        onChange={(e) =>
                          setSessionMode(e.target.value as ServiceSessionMode)
                        }
                        className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                      >
                        {SERVICE_SESSION_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#D0DBD3] mb-1.5">
                      Focus Area
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {SERVICE_PROVIDER_ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setProviderRole(r)}
                          className={`min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold border text-left cursor-pointer ${
                            providerRole === r
                              ? 'bg-[#7CE0A3] text-[#101813] border-[#7CE0A3]'
                              : 'bg-[#101914] text-[#C8D4CB] border-[#F7F4EB]/14'
                          }`}
                        >
                          {ROLE_DISPLAY_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="prov-summary"
                      className="block text-xs font-semibold text-[#D0DBD3] mb-1.5"
                    >
                      Skills or Practical Guidance Offered
                    </label>
                    <textarea
                      id="prov-summary"
                      rows={3}
                      required
                      minLength={PROVIDER_SUMMARY_MIN_LENGTH}
                      maxLength={PROVIDER_SUMMARY_MAX_LENGTH}
                      value={specialtySummary}
                      onChange={(e) => setSpecialtySummary(e.target.value)}
                      placeholder="Describe the practical craft, Show & Tell coaching, or outreach skills you share..."
                      className="w-full px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="prov-accom"
                      className="block text-xs font-semibold text-[#D0DBD3] mb-1.5"
                    >
                      Workshop Pacing &amp; Session Notes
                    </label>
                    <input
                      id="prov-accom"
                      type="text"
                      required
                      minLength={PROVIDER_ACCOMMODATIONS_MIN_LENGTH}
                      maxLength={PROVIDER_ACCOMMODATIONS_MAX_LENGTH}
                      value={neuroAccommodations}
                      onChange={(e) => setNeuroAccommodations(e.target.value)}
                      placeholder="e.g., Written steps welcome, flexible Saturday mornings, beginner friendly"
                      className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-[#F4A261] font-medium">
                      {formError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setComposerOpen(false)}
                      className="min-h-[38px] px-4 py-2 rounded-lg bg-[#1A2820] text-xs font-semibold text-[#C8D4CB] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProvider}
                      className="min-h-[38px] px-5 py-2 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#93E8B4] disabled:opacity-60 cursor-pointer"
                    >
                      {savingProvider ? 'Publishing...' : 'Publish Listing'}
                    </button>
                  </div>
                </form>
              )}

              {cloudProviders.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 text-center space-y-2">
                  <p className="font-display text-base font-bold text-[#F7F4EB]">
                    Directory Open for Community Mentors &amp; Skill Sharers
                  </p>
                  <p className="text-xs text-[#B8C6BC] max-w-md mx-auto leading-relaxed">
                    Preset specialist cards have been removed. This directory remains open whenever club members want to list trade skills, Show &amp; Tell mentoring, or peer support.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cloudProviders.map((prov) => {
                    const roomSlug = `support-${prov.id
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .slice(0, 28)}`;
                    return (
                      <article
                        key={prov.id}
                        className="p-5 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#7CE0A3]">
                              {ROLE_DISPLAY_LABEL[prov.providerRole]}
                            </span>
                            <span className="font-mono text-[11px] text-[#E5A93C]">
                              {prov.sessionMode}
                            </span>
                          </div>
                          <h4 className="font-display text-base font-bold text-[#F7F4EB]">
                            {prov.displayName}
                          </h4>
                          <p className="text-xs text-[#DCE3DD] leading-relaxed">
                            {prov.specialtySummary}
                          </p>
                          <div className="pt-2 border-t border-[#F7F4EB]/10 text-xs text-[#B8C6BC]">
                            <strong className="text-[#F7F4EB]">
                              Session Notes:
                            </strong>{' '}
                            {prov.neuroAccommodations}
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              onLaunchCoachingCollab(
                                roomSlug,
                                `Mentor Bench · ${prov.displayName.slice(0, 28)}`,
                                `Opened room with ${prov.displayName}. Notes: ${prov.neuroAccommodations}`
                              )
                            }
                            className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Open Live Room</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
