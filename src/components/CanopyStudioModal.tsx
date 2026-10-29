import { signInWithPopup, User } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Check,
  Eye,
  Lamp,
  Lock,
  LogIn,
  RotateCcw,
  ShieldCheck,
  Store,
  Unlock,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  auth,
  CANOPY_FLOOR_STYLES,
  CANOPY_FURNISHING_CATALOG,
  CANOPY_FURNISHING_KINDS,
  CANOPY_TRADE_FOCUSES,
  CANOPY_TRIM_ACCENTS,
  CanopyFloorStyle,
  CanopyFurnishingKind,
  CanopyStudioConfig,
  CanopyTradeFocus,
  CanopyTrimAccent,
  db,
  DEFAULT_CANOPY_STUDIO,
  getDocWithTimeout,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  OperationType,
  STUDIO_NAME_MAX_LENGTH,
  STUDIO_NAME_MIN_LENGTH,
  subscribeSafeAuth,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import { CanopyInspectAngle } from '../types/game';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

interface CanopyStudioModalProps {
  isOpen: boolean;
  studioConfig: CanopyStudioConfig;
  inspectAngle: CanopyInspectAngle;
  roofCutaway: boolean;
  onChangeConfig: (next: CanopyStudioConfig, celebrate?: boolean) => void;
  onSelectInspectAngle: (angle: CanopyInspectAngle) => void;
  onToggleRoofCutaway: (enabled: boolean) => void;
  onOpenCanopyPaypalStore: () => void;
  onClose: () => void;
}

const FLOOR_METADATA: Record<
  CanopyFloorStyle,
  { label: string; detail: string; swatch: string }
> = {
  interlocking_oak: {
    label: 'Interlocking White Oak',
    detail: 'Tongue-and-groove planks with brass traction strips',
    swatch: '#AD7F52',
  },
  nonslip_slate: {
    label: 'Non-Slip Honed Slate',
    detail: 'Charcoal safety tiles with raised diamond grip studs',
    swatch: '#36433F',
  },
  cork_sanctuary: {
    label: 'Acoustic Cork Sanctuary',
    detail: 'Quiet cushioned cork-and-cedar composite tiles',
    swatch: '#B58356',
  },
  herringbone_cedar: {
    label: 'Herringbone Red Cedar',
    detail: '45-degree aromatic parquet with chamfered grip seams',
    swatch: '#9E5636',
  },
};

const TRIM_METADATA: Record<
  CanopyTrimAccent,
  { label: string; shortLabel: string; swatch: string }
> = {
  warm_brass: {
    label: 'Warm Brushed Brass',
    shortLabel: 'Brass',
    swatch: '#E5A93C',
  },
  forged_iron: {
    label: 'Forged Charcoal Iron',
    shortLabel: 'Forged Iron',
    swatch: '#34403C',
  },
  forest_sage: {
    label: 'Canopy Sage Enamel',
    shortLabel: 'Sage',
    swatch: '#548263',
  },
  terracotta_clay: {
    label: 'Kiln Terracotta',
    shortLabel: 'Terracotta',
    swatch: '#C76540',
  },
};

const INSPECT_ANGLES: Array<{ id: CanopyInspectAngle; label: string }> = [
  { id: 'overview', label: 'Exterior Crown' },
  { id: 'interior', label: 'Inside Studio' },
  { id: 'lanterns_floor', label: 'Floor & Lanterns' },
  { id: 'tools_rack', label: 'Tools Locker' },
];

export const CanopyStudioModal: React.FC<CanopyStudioModalProps> = ({
  isOpen,
  studioConfig,
  inspectAngle,
  roofCutaway,
  onChangeConfig,
  onSelectInspectAngle,
  onToggleRoofCutaway,
  onOpenCanopyPaypalStore,
  onClose,
}) => {
  const [user, setUser] = useState<User | null>(() => getSafeCurrentUser());
  const [authReady, setAuthReady] = useState(false);
  const [cloudDocExists, setCloudDocExists] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [nameDraft, setNameDraft] = useState(studioConfig.studioName);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    setNameDraft(studioConfig.studioName);
  }, [studioConfig.studioName]);

  useEffect(() => {
    return subscribeSafeAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setCloudDocExists(false);
        setSnapshotLoaded(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;
    const studioRef = doc(db, 'canopyStudios', user.uid);
    const unsub = onSnapshot(
      studioRef,
      (snap) => {
        setSnapshotLoaded(true);
        setCloudDocExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          const loaded: CanopyStudioConfig = {
            studioName:
              typeof d.studioName === 'string' &&
              d.studioName.trim().length >= STUDIO_NAME_MIN_LENGTH
                ? d.studioName.trim().slice(0, STUDIO_NAME_MAX_LENGTH)
                : DEFAULT_CANOPY_STUDIO.studioName,
            tradeFocus: CANOPY_TRADE_FOCUSES.includes(
              d.tradeFocus as CanopyTradeFocus
            )
              ? (d.tradeFocus as CanopyTradeFocus)
              : DEFAULT_CANOPY_STUDIO.tradeFocus,
            floorStyle: CANOPY_FLOOR_STYLES.includes(
              d.floorStyle as CanopyFloorStyle
            )
              ? (d.floorStyle as CanopyFloorStyle)
              : DEFAULT_CANOPY_STUDIO.floorStyle,
            trimAccent: CANOPY_TRIM_ACCENTS.includes(
              d.trimAccent as CanopyTrimAccent
            )
              ? (d.trimAccent as CanopyTrimAccent)
              : DEFAULT_CANOPY_STUDIO.trimAccent,
            safetyGateClosed:
              typeof d.safetyGateClosed === 'boolean'
                ? d.safetyGateClosed
                : true,
            furnishedItems: Array.isArray(d.furnishedItems)
              ? d.furnishedItems.filter((k): k is CanopyFurnishingKind =>
                  CANOPY_FURNISHING_KINDS.includes(k as CanopyFurnishingKind)
                )
              : [],
          };
          onChangeConfig(loaded, false);
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(
          err,
          OperationType.GET,
          `canopyStudios/${user.uid}`
        );
      }
    );
    return () => unsub();
  }, [user, onChangeConfig]);

  if (!isOpen) return null;

  const updatePartial = (
    patch: Partial<CanopyStudioConfig>,
    celebrate = true
  ) => {
    setSaveFeedback(null);
    setErrorMsg(null);
    onChangeConfig({ ...studioConfig, ...patch }, celebrate);
  };

  const handleToggleFurnishing = (kind: CanopyFurnishingKind) => {
    const current = new Set(studioConfig.furnishedItems);
    if (current.has(kind)) {
      current.delete(kind);
    } else {
      current.add(kind);
    }
    updatePartial({ furnishedItems: Array.from(current) }, true);
  };

  const handleNameChange = (val: string) => {
    const clipped = val.slice(0, STUDIO_NAME_MAX_LENGTH);
    setNameDraft(clipped);
    setSaveFeedback(null);
    setErrorMsg(null);
    if (clipped.trim().length >= STUDIO_NAME_MIN_LENGTH) {
      const censor = screenBootsOnGroundCensor(clipped.trim());
      if (censor.allowed) {
        onChangeConfig({ ...studioConfig, studioName: clipped.trim() }, false);
      }
    }
  };

  const handleResetDefaults = () => {
    const starterStudio: CanopyStudioConfig = {
      ...DEFAULT_CANOPY_STUDIO,
      furnishedItems: [
        'brass_hanging_lantern',
        'amber_floor_lantern',
        'starlight_garland',
        'woven_sanctuary_rug',
      ],
    };
    setNameDraft(starterStudio.studioName);
    setSaveFeedback(
      'Restored oak flooring, brass safety curbs, and warm starter lanterns.'
    );
    setErrorMsg(null);
    onChangeConfig(starterStudio, true);
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setErrorMsg('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveToCloud = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = nameDraft.trim().slice(0, STUDIO_NAME_MAX_LENGTH);
    if (cleanName.length < STUDIO_NAME_MIN_LENGTH) {
      setErrorMsg(
        `Studio name must be between ${STUDIO_NAME_MIN_LENGTH} and ${STUDIO_NAME_MAX_LENGTH} characters.`
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(cleanName);
    if (!censor.allowed) {
      setErrorMsg(censor.reason || 'Studio name held by Boots-on-Ground Censor.');
      return;
    }

    const finalConfig: CanopyStudioConfig = {
      ...studioConfig,
      studioName: cleanName,
    };
    onChangeConfig(finalConfig, true);

    if (!user) {
      setSaveFeedback(
        'Saved your Upstairs Canopy layout on this device! Sign in anytime to sync across devices.'
      );
      return;
    }

    if (!user.emailVerified) {
      setErrorMsg(
        'Saved locally! A verified Google email is required to sync upstairs layouts to the cloud.'
      );
      return;
    }

    if (!VALID_DOC_ID_REGEX.test(user.uid)) {
      setErrorMsg('Invalid account identifier.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSaveFeedback(null);

    const studioPath = `canopyStudios/${user.uid}`;
    const studioRef = doc(db, 'canopyStudios', user.uid);

    try {
      let existsNow = cloudDocExists;
      if (!existsNow && !snapshotLoaded) {
        const { snap, timedOut } = await getDocWithTimeout(studioRef);
        if (timedOut) {
          setSaveFeedback(
            'Saved your Upstairs Canopy Studio on this device — cloud sync queued while reconnecting.'
          );
          return;
        }
        existsNow = Boolean(snap?.exists());
      }

      const writeOp = existsNow
        ? updateDoc(studioRef, {
            studioName: finalConfig.studioName,
            tradeFocus: finalConfig.tradeFocus,
            floorStyle: finalConfig.floorStyle,
            trimAccent: finalConfig.trimAccent,
            safetyGateClosed: finalConfig.safetyGateClosed,
            furnishedItems: finalConfig.furnishedItems,
            updatedAt: serverTimestamp(),
          })
        : setDoc(studioRef, {
            uid: user.uid,
            studioName: finalConfig.studioName,
            tradeFocus: finalConfig.tradeFocus,
            floorStyle: finalConfig.floorStyle,
            trimAccent: finalConfig.trimAccent,
            safetyGateClosed: finalConfig.safetyGateClosed,
            furnishedItems: finalConfig.furnishedItems,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

      const { settled } = await withCloudWriteTimeout(writeOp, 2200);
      if (settled) {
        setCloudDocExists(true);
        setSnapshotLoaded(true);
        setSaveFeedback(
          'Synced your Upstairs Canopy Studio, Flooring & 3D Lanterns to your account.'
        );
      } else {
        setSaveFeedback(
          'Saved your Upstairs Canopy Studio on this device — cloud sync queued while reconnecting.'
        );
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setErrorMsg(
          'Daily Firestore quota reached — your upstairs customisation remains saved locally.'
        );
      } else if (isTransientOfflineOrTokenError(err)) {
        setSaveFeedback(
          'Saved your Upstairs Canopy Studio on this device — cloud sync is currently offline.'
        );
      } else {
        handleFirestoreError(
          err,
          cloudDocExists ? OperationType.UPDATE : OperationType.CREATE,
          studioPath
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-end p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canopy-studio-heading"
    >
      <div className="pointer-events-auto w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#111C15] border-2 border-[#E5A93C]/65 rounded-2xl text-[#F7F4EB] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 border-b border-[#8FB996]/30 bg-[#16241B]">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#FFD166] font-semibold">
              33m Treetop Summit · Live 3D Upstairs Customiser
            </p>
            <h2
              id="canopy-studio-heading"
              className="mt-0.5 font-display text-xl sm:text-2xl font-bold tracking-tight text-[#FFFFFF]"
            >
              Customise Upstairs Canopy
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCanopyPaypalStore}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1D2F24] border border-[#7CE0A3]/60 text-xs sm:text-sm font-bold text-[#7CE0A3] hover:border-[#FFD166] hover:text-[#FFD166] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Canopy PayPal Store</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Upstairs Canopy Customiser"
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#281B11] border border-[#FFD166]/65 text-xs sm:text-sm font-bold text-[#FFD166] hover:bg-[#352316] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Camera Inspection & Cutaway Strip */}
        <div className="px-5 py-2.5 sm:px-6 bg-[#132018] border-b border-[#8FB996]/25 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#7CE0A3] mr-1 shrink-0" />
            {INSPECT_ANGLES.map((ang) => (
              <button
                key={ang.id}
                type="button"
                onClick={() => onSelectInspectAngle(ang.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  inspectAngle === ang.id
                    ? 'bg-[#E5A93C] text-[#171008]'
                    : 'bg-[#19291F] border border-[#8FB996]/30 text-[#D8E8DD] hover:border-[#FFD166]'
                }`}
              >
                {ang.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onToggleRoofCutaway(!roofCutaway)}
            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap cursor-pointer ${
              roofCutaway
                ? 'bg-[#243E2E] border-[#7CE0A3] text-[#FFFFFF]'
                : 'bg-[#19291F] border-[#8FB996]/35 text-[#C8DDD0]'
            }`}
          >
            {roofCutaway ? 'Roof Cutaway: ON' : 'Roof Cutaway: OFF'}
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSaveToCloud}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* 01. Secure Non-Slip Flooring Selector */}
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-[#FFFFFF]">
                01. Upstairs Non-Slip Flooring Surface
              </h3>
              <span className="text-xs font-mono text-[#7CE0A3]">
                Updates 3D Deck Live
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CANOPY_FLOOR_STYLES.map((style) => {
                const meta = FLOOR_METADATA[style];
                const active = studioConfig.floorStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updatePartial({ floorStyle: style })}
                    className={`text-left p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1B2F23] border-[#FFD166]'
                        : 'bg-[#15231A] border-[#8FB996]/25 hover:border-[#7CE0A3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-[#FFFFFF]">
                        <span
                          className="w-4 h-4 rounded-sm border border-[#FFFFFF]/35 shrink-0"
                          style={{ backgroundColor: meta.swatch }}
                        />
                        <span>{meta.label}</span>
                      </span>
                      {active && (
                        <Check className="w-4 h-4 text-[#FFD166] shrink-0" />
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[#C8DDD0] leading-snug">
                      {meta.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 02. Lift Arrival Hatch & Perimeter Safety Gate */}
          <section className="pt-4 border-t border-[#8FB996]/25 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[220px]">
                <h3 className="text-base font-bold text-[#FFFFFF] inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#E5A93C]" />
                  <span>02. Lift Bay Safety Hatch &amp; Curb Finish</span>
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#C8DDD0] leading-relaxed">
                  Seals the Canopy Lift shaft when the carriage is below so you
                  can walk safely across the upstairs deck, retracting smoothly
                  when your Lift arrives.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  updatePartial({
                    safetyGateClosed: !studioConfig.safetyGateClosed,
                  })
                }
                className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  studioConfig.safetyGateClosed
                    ? 'bg-[#E5A93C] text-[#140E08] border-[#FFD166]'
                    : 'bg-[#17241D] text-[#E5EFE8] border-[#8FB996]/40 hover:border-[#FFD166]'
                }`}
              >
                {studioConfig.safetyGateClosed ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Safety Hatch Latched</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Hatch Retracted</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CANOPY_TRIM_ACCENTS.map((accent) => {
                const meta = TRIM_METADATA[accent];
                const active = studioConfig.trimAccent === accent;
                return (
                  <button
                    key={accent}
                    type="button"
                    onClick={() => updatePartial({ trimAccent: accent })}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#1D3024] border-[#FFD166] text-[#FFFFFF]'
                        : 'bg-[#15221A] border-[#8FB996]/30 text-[#D6E6DC] hover:border-[#7CE0A3]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-[#FFFFFF]/35 shrink-0"
                      style={{ backgroundColor: meta.swatch }}
                    />
                    <span className="truncate">{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 03. Personal Trade Studio Nameplate & Trade Specialty */}
          <section className="pt-4 border-t border-[#8FB996]/25 space-y-4">
            <h3 className="text-base font-bold text-[#FFFFFF]">
              03. Overhead Studio Sign &amp; Workbench Props
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="canopy-studio-name"
                  className="text-xs sm:text-sm font-semibold text-[#E5EFE8]"
                >
                  Large-Print 3D Overhead Studio Nameplate
                </label>
                <span className="text-xs font-mono tabular-nums text-[#9DC0A6]">
                  {nameDraft.trim().length}/{STUDIO_NAME_MAX_LENGTH}
                </span>
              </div>
              <input
                id="canopy-studio-name"
                type="text"
                required
                minLength={STUDIO_NAME_MIN_LENGTH}
                maxLength={STUDIO_NAME_MAX_LENGTH}
                value={nameDraft}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Agarwood & Cedar Trade Loft"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 text-sm sm:text-base text-[#FFFFFF] focus:outline-none focus:border-[#FFD166]"
              />
            </div>

            <div>
              <span className="block text-xs sm:text-sm font-semibold text-[#E5EFE8] mb-2">
                Active 3D Workbench Specialty Props
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CANOPY_TRADE_FOCUSES.map((focus: CanopyTradeFocus) => {
                  const active = studioConfig.tradeFocus === focus;
                  return (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => updatePartial({ tradeFocus: focus })}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#E5A93C] text-[#140E08] border-[#FFD166] font-bold'
                          : 'bg-[#15221A] text-[#D8E8DD] border-[#8FB996]/30 hover:border-[#7CE0A3]'
                      }`}
                    >
                      {focus}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 04. Placed 3D Canopy Lanterns, Rugs & Planters */}
          <section className="pt-4 border-t border-[#8FB996]/25 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-[#FFFFFF] inline-flex items-center gap-1.5">
                <Lamp className="w-4 h-4 text-[#FFD166]" />
                <span>04. Upstairs 3D Lanterns, Rug &amp; Planters</span>
              </h3>
              <span className="font-mono tabular-nums text-xs text-[#7CE0A3]">
                {studioConfig.furnishedItems.length}/6 placed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CANOPY_FURNISHING_KINDS.map((fKind) => {
                const spec = CANOPY_FURNISHING_CATALOG[fKind];
                const placed = studioConfig.furnishedItems.includes(fKind);
                return (
                  <button
                    key={fKind}
                    type="button"
                    onClick={() => handleToggleFurnishing(fKind)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
                      placed
                        ? 'bg-[#1B2F23] border-[#7CE0A3]'
                        : 'bg-[#142119] border-[#8FB996]/25 hover:border-[#FFD166]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#FFFFFF]">
                        {spec.label}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          placed ? 'text-[#7CE0A3]' : 'text-[#9DC0A6]'
                        }`}
                      >
                        {placed ? 'PLACED ✓' : 'PLACE'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#C8DDD0] leading-snug">
                      {spec.placementNote}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {errorMsg && (
            <div className="rounded-xl bg-[#2B1614] border border-[#F87171]/60 p-3.5 text-sm font-medium text-[#FECACA]">
              {errorMsg}
            </div>
          )}
          {saveFeedback && (
            <div className="rounded-xl bg-[#162C20] border border-[#7CE0A3]/60 p-3.5 text-sm font-medium text-[#DCFCE7]">
              {saveFeedback}
            </div>
          )}

          {/* Footer Persistence Actions */}
          <div className="pt-4 border-t border-[#8FB996]/25 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#18261E] border border-[#8FB996]/35 text-xs sm:text-sm font-semibold text-[#E5EFE8] hover:border-[#FFD166] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#E5A93C]" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {authReady && !user && (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleSignIn}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1E3125] border border-[#7CE0A3]/55 text-xs sm:text-sm font-semibold text-[#F7F4EB] hover:border-[#FFD166] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#7CE0A3]" />
                  <span>{authBusy ? 'Signing In...' : 'Google Sign-In'}</span>
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E5A93C] text-[#150E07] text-sm font-bold hover:bg-[#FFD166] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
              >
                {saving
                  ? 'Saving Studio...'
                  : user
                    ? 'Save Upstairs to Account'
                    : 'Save Upstairs Layout'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
