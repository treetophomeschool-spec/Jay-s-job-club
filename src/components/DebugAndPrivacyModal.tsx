import React, { useEffect, useState } from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  Bug,
  Check,
  Copy,
  Download,
  Link2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  CanopyStudioConfig,
  TreeProgressState,
  auth,
  db,
  googleProvider,
} from '../firebase';
import { HudSnapshot } from '../types/game';
import { formatDualTimestamp } from '../utils/dualCalendar';
import {
  WorkshopDebugEvent,
  clearDebugEvents,
  evaluateEthicalIdeaForTokens,
  getDebugEvents,
  screenBootsOnGroundCensor,
  subscribeDebugEvents,
} from '../utils/ethicalGuard';
import {
  loadMiniLectures,
  loadOutreachProjects,
  loadVirtualSupplies,
} from './GroundShowAndTellPrepModal';

export type DebugModalTab = 'debug' | 'privacy';

interface ServerDebugSnapshot {
  ok: boolean;
  serverTimeIso: string;
  easyUrls: string[];
  onlinePeers: number;
  shopCatalogIds: string[];
  stock: Record<string, number>;
  recentVerifiedReceipts: number;
  paypalConfigured: boolean;
  paypalMode: string;
}

interface DebugAndPrivacyModalProps {
  isOpen: boolean;
  initialTab?: DebugModalTab;
  user: User | null;
  authReady: boolean;
  hud: HudSnapshot;
  progress: TreeProgressState;
  studioConfig: CanopyStudioConfig;
  collabClientId: string | null;
  onDebugGrantTokens: (
    tryingDelta: number,
    gatheringDelta: number,
    treehouseDelta: number
  ) => void;
  onGlideToElevation: (meters: number, label: string) => void;
  onResetLocalWorkshopState: () => void;
  onClose: () => void;
}

export const DebugAndPrivacyModal: React.FC<DebugAndPrivacyModalProps> = ({
  isOpen,
  initialTab = 'debug',
  user,
  authReady,
  hud,
  progress,
  studioConfig,
  collabClientId,
  onDebugGrantTokens,
  onGlideToElevation,
  onResetLocalWorkshopState,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DebugModalTab>(initialTab);
  const [events, setEvents] = useState<WorkshopDebugEvent[]>(() =>
    getDebugEvents()
  );
  const [censorSample, setCensorSample] = useState(
    'Community carpentry bench open Saturday — zero rude language!'
  );
  const [ideaSampleTitle, setIdeaSampleTitle] = useState(
    'Neighbour Bike & Pram Repair Morning'
  );
  const [ideaSampleDesc, setIdeaSampleDesc] = useState(
    'Fix brakes and pump tyres for local families on Saturday.'
  );
  const [serverStatus, setServerStatus] = useState<ServerDebugSnapshot | null>(
    null
  );
  const [loadingServer, setLoadingServer] = useState(false);

  // Privacy & Easy URL state
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [erasingBusy, setErasingBusy] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    return subscribeDebugEvents(() => {
      setEvents(getDebugEvents());
    });
  }, []);

  const refreshServerDiagnostics = async () => {
    setLoadingServer(true);
    try {
      const res = await fetch('/api/debug/status');
      if (res.ok) {
        const data = (await res.json()) as ServerDebugSnapshot;
        setServerStatus(data);
      }
    } catch {
      // Ignore offline fetch errors
    } finally {
      setLoadingServer(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'debug') {
      void refreshServerDiagnostics();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const easyClubUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/jaysjobclub`
      : '/jaysjobclub';

  const liveCensorResult = screenBootsOnGroundCensor(
    censorSample,
    'debug-tester'
  );
  const liveIdeaResult = evaluateEthicalIdeaForTokens(
    ideaSampleTitle,
    ideaSampleDesc
  );

  const virtualSupplies = loadVirtualSupplies();
  const miniLecturesCount = loadMiniLectures().length;
  const outreachCount = loadOutreachProjects().length;

  const handleCopyEasyUrl = async () => {
    try {
      await navigator.clipboard.writeText(easyClubUrl);
      setCopiedSlug(true);
      window.setTimeout(() => setCopiedSlug(false), 2500);
    } catch {
      setPrivacyNotice(`Easy link ready to bookmark: ${easyClubUrl}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setPrivacyNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setPrivacyNotice('Signed in securely with Google.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setPrivacyNotice('Could not complete Google Sign-In.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setPrivacyNotice(
      'Signed out. Your browser session is now strictly local-only.'
    );
  };

  const handleExportGdprData = async () => {
    const localSnapshot: Record<string, unknown> = {};
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('jays_job_club_')) {
          const val = window.localStorage.getItem(key);
          try {
            localSnapshot[key] = val ? JSON.parse(val) : null;
          } catch {
            localSnapshot[key] = val;
          }
        }
      }
    } catch {
      // Ignore storage access errors
    }

    const cloudSnapshot: Record<string, unknown> = {};
    if (user) {
      try {
        const [journals, posts, tools] = await Promise.all([
          getDocs(
            query(
              collection(db, 'journalEntries'),
              where('uid', '==', user.uid),
              limit(100)
            )
          ),
          getDocs(
            query(
              collection(db, 'communityPosts'),
              where('authorId', '==', user.uid),
              limit(100)
            )
          ),
          getDocs(
            query(
              collection(db, 'toolsOfTrade'),
              where('ownerId', '==', user.uid),
              limit(100)
            )
          ),
        ]);
        cloudSnapshot.journalEntries = journals.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        cloudSnapshot.communityPosts = posts.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        cloudSnapshot.toolsOfTrade = tools.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } catch {
        // Export local data even if cloud is offline
      }
    }

    const payload = {
      exportedAtIso: new Date().toISOString(),
      club: "Jay's Job Club",
      gdprBasis: 'UK GDPR Article 15 (Access) & Article 20 (Data Portability)',
      account: user
        ? {
            uid: user.uid,
            emailVerified: user.emailVerified,
          }
        : null,
      treeProgress: progress,
      canopyStudio: studioConfig,
      localStorageRecords: localSnapshot,
      cloudRecords: cloudSnapshot,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jays-job-club-gdpr-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setPrivacyNotice(
      'Downloaded your portable UK GDPR JSON data archive.'
    );
  };

  const handleEraseAllWorkshopData = async () => {
    setErasingBusy(true);
    setPrivacyNotice(null);
    try {
      // 1. Purge ephemeral WebSocket collaboration presence & messages
      try {
        await fetch('/api/privacy/purge-ephemeral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: collabClientId || '',
            displayName: user?.displayName || '',
          }),
        });
      } catch {
        // Ignore network errors
      }

      // 2. Delete deletable cloud documents owned by signed-in user
      if (user) {
        try {
          const [journals, posts, tools] = await Promise.all([
            getDocs(
              query(
                collection(db, 'journalEntries'),
                where('uid', '==', user.uid),
                limit(100)
              )
            ),
            getDocs(
              query(
                collection(db, 'communityPosts'),
                where('authorId', '==', user.uid),
                limit(100)
              )
            ),
            getDocs(
              query(
                collection(db, 'toolsOfTrade'),
                where('ownerId', '==', user.uid),
                limit(100)
              )
            ),
          ]);
          const deletions: Promise<void>[] = [];
          journals.forEach((d) =>
            deletions.push(deleteDoc(doc(db, 'journalEntries', d.id)))
          );
          posts.forEach((d) =>
            deletions.push(deleteDoc(doc(db, 'communityPosts', d.id)))
          );
          tools.forEach((d) =>
            deletions.push(deleteDoc(doc(db, 'toolsOfTrade', d.id)))
          );
          deletions.push(
            deleteDoc(doc(db, 'canopyStudios', user.uid)).catch(() => undefined)
          );
          await Promise.all(deletions);
        } catch {
          // Continue clearing local storage
        }
      }

      // 3. Clear all local workshop keys
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith('jays_job_club_')) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {
        // Ignore
      }

      onResetLocalWorkshopState();
      setConfirmErase(false);
      setPrivacyNotice(
        'UK GDPR Erasure complete: Local browser records, ephemeral collaboration presence, and deletable cloud entries have been cleared.'
      );
    } finally {
      setErasingBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debug-privacy-heading"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <h2
              id="debug-privacy-heading"
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
            >
              Workshop Debug, UK GDPR Privacy &amp; Easy Club Link
            </h2>
            <p className="mt-0.5 text-xs text-[#C6D2C9]">
              Inspect Tree &apos;Boots on Ground&apos; Censor, Ethical Idea Token Verifier, 3D state, GDPR privacy rights &amp; memorable URL
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
                aria-selected={activeTab === 'debug'}
                onClick={() => setActiveTab('debug')}
                className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeTab === 'debug'
                    ? 'bg-[#E5A93C] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                Debug Console (D)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'privacy'}
                onClick={() => setActiveTab('privacy')}
                className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-[#7CE0A3] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                Privacy (GDPR) &amp; Easy URL
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'debug' ? (
            <>
              {/* Row 1: State Readouts + Sandbox Token & Altitude Controls */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2 text-xs font-mono tabular-nums">
                  <div className="font-sans font-bold text-sm text-[#E5A93C] flex items-center gap-1.5">
                    <Bug className="w-4 h-4" />
                    <span>3D Engine &amp; Lift State</span>
                  </div>
                  <div>Screen: {hud.screen}</div>
                  <div>
                    Elevation: {hud.elevationMeters.toFixed(2)}m /{' '}
                    {hud.maxElevationMeters}m
                  </div>
                  <div>Zone: {hud.zone}</div>
                  <div>
                    Camera: {hud.cameraPreset} ({hud.canopyInspectAngle})
                  </div>
                  <div>
                    Pace: {hud.paceMode} · Poise: {hud.poisePercent}%
                  </div>
                  <div className="pt-2 flex flex-wrap gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() =>
                        onGlideToElevation(0, 'Debug Jump 0m Roots')
                      }
                      className="px-2.5 py-1 rounded bg-[#1E2E24] border border-[#F7F4EB]/18 text-xs font-semibold cursor-pointer"
                    >
                      Glide 0m
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onGlideToElevation(18, 'Debug Jump 18m Bough')
                      }
                      className="px-2.5 py-1 rounded bg-[#1E2E24] border border-[#F7F4EB]/18 text-xs font-semibold cursor-pointer"
                    >
                      Glide 18m
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onGlideToElevation(32.65, 'Debug Jump 33m Canopy')
                      }
                      className="px-2.5 py-1 rounded bg-[#1E2E24] border border-[#E5A93C]/45 text-xs font-semibold text-[#E5A93C] cursor-pointer"
                    >
                      Glide 33m
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2 text-xs font-mono tabular-nums">
                  <div className="font-sans font-bold text-sm text-[#7CE0A3]">
                    Tokens &amp; Show-and-Tell Inventory
                  </div>
                  <div>Trying Tokens: {progress.tryingTokens}</div>
                  <div>Gathering Tokens: {progress.gatheringTokens}</div>
                  <div>Treehouse Tokens: {progress.treehouseTokens}</div>
                  <div>
                    Lanterns Owned: {progress.ownedFurnishings.length} (Lit:{' '}
                    {studioConfig.furnishedItems.length})
                  </div>
                  <div>
                    Virtual Supplies:{' '}
                    {Object.values(virtualSupplies).reduce((a, b) => a + b, 0)}{' '}
                    · Lectures: {miniLecturesCount} · Outreach: {outreachCount}
                  </div>
                  <div className="pt-2 flex flex-wrap gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => onDebugGrantTokens(2, 2, 0)}
                      className="px-2.5 py-1 rounded bg-[#1E2E24] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] cursor-pointer"
                    >
                      +2 Trying &amp; +2 Gathering
                    </button>
                    <button
                      type="button"
                      onClick={() => onDebugGrantTokens(0, 0, 3)}
                      className="px-2.5 py-1 rounded bg-[#E5A93C] text-[#101813] text-xs font-bold cursor-pointer"
                    >
                      +3 Treehouse
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex items-center justify-between font-sans">
                    <span className="font-bold text-sm text-[#E5A93C]">
                      Auth &amp; Server Health
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshServerDiagnostics()}
                      className="text-xs text-[#C8D4CB] hover:text-[#F7F4EB] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${loadingServer ? 'animate-spin' : ''}`}
                      />
                      <span>Ping</span>
                    </button>
                  </div>
                  <div>
                    Auth:{' '}
                    {!authReady
                      ? 'Initializing'
                      : user
                        ? `Signed In (${user.uid.slice(0, 8)}…)`
                        : 'Guest (Local Ready)'}
                  </div>
                  <div>
                    WS Peers: {serverStatus?.onlinePeers ?? hud.onlineCollaborators}
                  </div>
                  <div>
                    Shop Catalog:{' '}
                    {serverStatus?.shopCatalogIds.join(', ') ||
                      'drazella_sprinkles_book'}
                  </div>
                  <div>
                    PayPal:{' '}
                    {serverStatus
                      ? `${serverStatus.paypalConfigured ? 'Configured' : 'Pickup Mode'} (${serverStatus.paypalMode})`
                      : 'Checking…'}
                  </div>
                  <div>Easy Route: /jaysjobclub</div>
                </div>
              </section>

              {/* Row 2: Interactive Censor & Ethical Token Diagnostics */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Live Boots on Ground Censor Tester */}
                <div className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
                  <div className="font-display text-sm font-bold text-[#F7F4EB]">
                    Tree &apos;Boots on Ground&apos; Censor Live Tester
                  </div>
                  <textarea
                    rows={2}
                    value={censorSample}
                    onChange={(e) => setCensorSample(e.target.value)}
                    placeholder="Type a Job Board phrase (try clean vs rude words) to inspect censor..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                  <div
                    className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                      liveCensorResult.allowed
                        ? 'bg-[#15261C] border-[#7CE0A3]/45 text-[#7CE0A3]'
                        : 'bg-[#281A15] border-[#F4A261]/55 text-[#F4A261]'
                    }`}
                  >
                    <div>
                      Verdict:{' '}
                      <strong>
                        {liveCensorResult.allowed
                          ? 'ALLOWED (Clean)'
                          : `BLOCKED (${liveCensorResult.category})`}
                      </strong>
                    </div>
                    {liveCensorResult.flaggedTerms.length > 0 && (
                      <div>
                        Flagged: {liveCensorResult.flaggedTerms.join(', ')}
                      </div>
                    )}
                    <div className="text-[#D6E0D9]">
                      Preview: {liveCensorResult.maskedPreview}
                    </div>
                  </div>
                </div>

                {/* Live Ethical Idea Token Verifier Tester */}
                <div className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
                  <div className="font-display text-sm font-bold text-[#F7F4EB]">
                    Ethical Idea Token Verifier Live Tester
                  </div>
                  <input
                    type="text"
                    value={ideaSampleTitle}
                    onChange={(e) => setIdeaSampleTitle(e.target.value)}
                    placeholder="Sample idea title"
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                  <input
                    type="text"
                    value={ideaSampleDesc}
                    onChange={(e) => setIdeaSampleDesc(e.target.value)}
                    placeholder="Sample idea description"
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                  <div
                    className={`p-3 rounded-lg border text-xs font-mono space-y-1 ${
                      liveIdeaResult.isSoundAndEthical
                        ? 'bg-[#15261C] border-[#7CE0A3]/45 text-[#7CE0A3]'
                        : 'bg-[#281A15] border-[#F4A261]/55 text-[#F4A261]'
                    }`}
                  >
                    <div>
                      isSoundAndEthical:{' '}
                      <strong>{String(liveIdeaResult.isSoundAndEthical)}</strong>{' '}
                      · Award: <strong>+{liveIdeaResult.tokensAwarded}</strong>{' '}
                      Treehouse Tokens
                    </div>
                    <div className="font-sans text-[#D6E0D9]">
                      {liveIdeaResult.feedback}
                    </div>
                  </div>
                </div>
              </section>

              {/* Row 3: Recent Censor & Verifier Event Log */}
              <section className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-[#F7F4EB]">
                    Recent Censor &amp; Token Verification Event Log ({events.length})
                  </h3>
                  {events.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearDebugEvents()}
                      className="text-xs text-[#B8C6BC] hover:text-[#F4A261] cursor-pointer"
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {events.length === 0 ? (
                  <p className="text-xs text-[#9FB0A4]">
                    No live events captured yet. Submit an Ethical Idea or test the Job Board Boots-on-Ground Censor to inspect events here.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#F7F4EB]/10 text-xs font-mono">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="py-2 flex flex-wrap items-baseline justify-between gap-2"
                      >
                        <div>
                          <span
                            className={
                              ev.allowed ? 'text-[#7CE0A3]' : 'text-[#F4A261]'
                            }
                          >
                            [{ev.kind} · {ev.source}]
                          </span>{' '}
                          <span className="text-[#F7F4EB]">{ev.summary}</span>
                          {ev.detail && (
                            <span className="block text-[11px] text-[#9FB0A4]">
                              {ev.detail}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#8FA395]">
                          {formatDualTimestamp(ev.timestampMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* TAB 2: UK GDPR PRIVACY & EASY CLUB URL */
            <div className="space-y-5">
              {privacyNotice && (
                <div className="p-3.5 rounded-xl bg-[#17291E] border border-[#7CE0A3]/50 text-xs text-[#F7F4EB] flex items-center justify-between gap-2">
                  <span>{privacyNotice}</span>
                  <button
                    type="button"
                    onClick={() => setPrivacyNotice(null)}
                    className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Memorable Easy URL Card */}
              <section className="p-5 rounded-xl bg-[#16231C] border border-[#E5A93C]/45 space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#E5A93C]" />
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Easy-to-Remember Jay&apos;s Job Club Link
                  </h3>
                </div>
                <p className="text-xs text-[#C6D2C9] leading-relaxed">
                  Share or bookmark your short, memorable club route—visiting{' '}
                  <code className="font-mono text-[#E5A93C]">/jaysjobclub</code>{' '}
                  (or <code className="font-mono text-[#E5A93C]">/club</code>) opens the Ground Sanctuary directly.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs font-mono text-[#F7F4EB] select-all overflow-x-auto">
                    {easyClubUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyEasyUrl()}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSlug ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy /jaysjobclub Link</span>
                      </>
                    )}
                  </button>
                </div>
              </section>

              {/* Privacy Sign-In & UK GDPR Controls */}
              <section className="p-5 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#7CE0A3]" />
                    <div>
                      <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                        Sign-In for Privacy &amp; UK GDPR Data Rights
                      </h3>
                      <p className="text-xs text-[#B8C6BC]">
                        {user
                          ? 'Signed in with private owner-locked cloud sync'
                          : 'Browsing locally — sign in anytime to lock private Journal & Canopy progress to your account'}
                      </p>
                    </div>
                  </div>

                  {user ? (
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/20 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void handleGoogleSignIn()}
                      className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#93E8B4] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>
                        {authBusy ? 'Signing In…' : 'Sign In with Google'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#C8D4CB] leading-relaxed pt-2 border-t border-[#F7F4EB]/10">
                  <div>
                    <strong className="text-[#F7F4EB]">
                      Data Minimisation (Art. 5(1)(c)):
                    </strong>{' '}
                    Your email address is never written to public boards or shop receipts. You can use a workshop alias on all community notices, and Personal Journal entries are strictly owner-only.
                  </div>
                  <div>
                    <strong className="text-[#F7F4EB]">
                      Storage Limitation (Art. 5(1)(e)):
                    </strong>{' '}
                    Pending PayPal basket holds auto-expire after 2 hours, and voice mini-lectures remain strictly in your local browser unless you choose to download them.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleExportGdprData()}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export My Data (JSON · Art. 15/20)</span>
                  </button>

                  {!confirmErase ? (
                    <button
                      type="button"
                      onClick={() => setConfirmErase(true)}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#241915] border border-[#F4A261]/45 text-xs font-semibold text-[#F4A261] hover:border-[#F4A261] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Erase My Workshop Data (Art. 17)</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-[#281A15] border border-[#F4A261]/60 text-xs">
                      <span className="text-[#F7F4EB] font-semibold">
                        Confirm permanent erasure of local &amp; deletable cloud records?
                      </span>
                      <button
                        type="button"
                        disabled={erasingBusy}
                        onClick={() => void handleEraseAllWorkshopData()}
                        className="px-3 py-1 rounded bg-[#F4A261] text-[#101813] font-bold cursor-pointer"
                      >
                        {erasingBusy ? 'Erasing…' : 'Confirm Erase'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmErase(false)}
                        className="px-2.5 py-1 rounded bg-[#1A2820] text-[#C8D4CB] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
