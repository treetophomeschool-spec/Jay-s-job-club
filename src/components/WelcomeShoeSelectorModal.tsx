import { signInWithPopup, User } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Check, Eye, Footprints, LogIn, RotateCcw, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  auth,
  db,
  getDocWithTimeout,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  OperationType,
  SHOE_NICKNAME_MAX_LENGTH,
  SHOE_NICKNAME_MIN_LENGTH,
  subscribeSafeAuth,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import {
  DEFAULT_SHOE_SELECTION,
  SHOE_CHARACTER_CATALOG,
  SHOE_CHARACTER_KINDS,
  SHOE_COLORWAY_CATALOG,
  SHOE_COLORWAYS,
  ShoeCharacterKind,
  ShoeCharacterSelection,
  ShoeColorway,
} from '../shared/shoeCharacterCatalog';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

interface WelcomeShoeSelectorModalProps {
  isOpen: boolean;
  selection: ShoeCharacterSelection;
  onChangeSelection: (
    next: ShoeCharacterSelection,
    celebrate?: boolean
  ) => void;
  onFocusWelcomeBench: () => void;
  onFocusLiftCarriage: () => void;
  onClose: () => void;
}

type FamilyFilter = 'All' | 'Wellington Boots' | 'Work Boots' | 'Work Shoes';

export const WelcomeShoeSelectorModal: React.FC<
  WelcomeShoeSelectorModalProps
> = ({
  isOpen,
  selection,
  onChangeSelection,
  onFocusWelcomeBench,
  onFocusLiftCarriage,
  onClose,
}) => {
  const [user, setUser] = useState<User | null>(() => getSafeCurrentUser());
  const [cloudDocExists, setCloudDocExists] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('All');
  const [nicknameDraft, setNicknameDraft] = useState(
    selection.characterNickname
  );
  const [saving, setSaving] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setNicknameDraft(selection.characterNickname);
  }, [selection.characterNickname]);

  useEffect(() => {
    return subscribeSafeAuth((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setCloudDocExists(false);
        setSnapshotLoaded(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;
    const shoeRef = doc(db, 'shoeCharacters', user.uid);
    const unsub = onSnapshot(
      shoeRef,
      (snap) => {
        setSnapshotLoaded(true);
        setCloudDocExists(snap.exists());
        if (snap.exists()) {
          const d = snap.data();
          const kind = SHOE_CHARACTER_KINDS.includes(
            d.shoeKind as ShoeCharacterKind
          )
            ? (d.shoeKind as ShoeCharacterKind)
            : DEFAULT_SHOE_SELECTION.shoeKind;
          const color = SHOE_COLORWAYS.includes(d.colorway as ShoeColorway)
            ? (d.colorway as ShoeColorway)
            : SHOE_CHARACTER_CATALOG[kind].defaultColorway;
          const nick =
            typeof d.characterNickname === 'string' &&
            d.characterNickname.trim().length >= SHOE_NICKNAME_MIN_LENGTH
              ? d.characterNickname.trim().slice(0, SHOE_NICKNAME_MAX_LENGTH)
              : SHOE_CHARACTER_CATALOG[kind].shortLabel;
          onChangeSelection(
            { shoeKind: kind, colorway: color, characterNickname: nick },
            false
          );
        }
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(
          err,
          OperationType.GET,
          `shoeCharacters/${user.uid}`
        );
      }
    );
    return () => unsub();
  }, [user, onChangeSelection]);

  const filteredKinds = useMemo(() => {
    return SHOE_CHARACTER_KINDS.filter((k) => {
      if (familyFilter === 'All') return true;
      return SHOE_CHARACTER_CATALOG[k].footwearFamily === familyFilter;
    });
  }, [familyFilter]);

  if (!isOpen) return null;

  const activeSpec = SHOE_CHARACTER_CATALOG[selection.shoeKind];

  const handleSelectKind = (kind: ShoeCharacterKind) => {
    const spec = SHOE_CHARACTER_CATALOG[kind];
    setFeedback(null);
    setErrorMsg(null);
    const nextNick =
      nicknameDraft.trim() === activeSpec.shortLabel ||
      nicknameDraft.trim().length < SHOE_NICKNAME_MIN_LENGTH
        ? spec.shortLabel
        : nicknameDraft.trim();
    setNicknameDraft(nextNick);
    onChangeSelection(
      {
        shoeKind: kind,
        colorway: spec.defaultColorway,
        characterNickname: nextNick,
      },
      true
    );
  };

  const handleSelectColorway = (colorway: ShoeColorway) => {
    setFeedback(null);
    setErrorMsg(null);
    onChangeSelection(
      {
        ...selection,
        colorway,
      },
      true
    );
  };

  const handleNicknameInput = (val: string) => {
    const clipped = val.slice(0, SHOE_NICKNAME_MAX_LENGTH);
    setNicknameDraft(clipped);
    setFeedback(null);
    setErrorMsg(null);
    if (clipped.trim().length >= SHOE_NICKNAME_MIN_LENGTH) {
      const censor = screenBootsOnGroundCensor(clipped.trim());
      if (censor.allowed) {
        onChangeSelection(
          {
            ...selection,
            characterNickname: clipped.trim(),
          },
          false
        );
      }
    }
  };

  const handleResetWellies = () => {
    setNicknameDraft(DEFAULT_SHOE_SELECTION.characterNickname);
    setFeedback('Restored Classic Woodland Wellington Boots.');
    setErrorMsg(null);
    onChangeSelection({ ...DEFAULT_SHOE_SELECTION }, true);
  };

  const handleGoogleSignIn = async () => {
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

  const handleSaveCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nicknameDraft.trim().slice(0, SHOE_NICKNAME_MAX_LENGTH);
    if (cleanNick.length < SHOE_NICKNAME_MIN_LENGTH) {
      setErrorMsg(
        `Character footwear name must be at least ${SHOE_NICKNAME_MIN_LENGTH} characters.`
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(cleanNick);
    if (!censor.allowed) {
      setErrorMsg(
        censor.reason || 'Footwear nickname held by Boots-on-Ground Censor.'
      );
      return;
    }

    const finalSelection: ShoeCharacterSelection = {
      ...selection,
      characterNickname: cleanNick,
    };
    onChangeSelection(finalSelection, true);

    if (!user) {
      setFeedback(
        'Saved your Shoe Character on this device! Sign in anytime to sync across sessions.'
      );
      return;
    }

    if (!user.emailVerified) {
      setErrorMsg(
        'Saved locally! A verified Google email is required to sync to cloud storage.'
      );
      return;
    }

    if (!VALID_DOC_ID_REGEX.test(user.uid)) {
      setErrorMsg('Invalid account identifier.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    const path = `shoeCharacters/${user.uid}`;
    const ref = doc(db, 'shoeCharacters', user.uid);

    try {
      let existsNow = cloudDocExists;
      if (!existsNow && !snapshotLoaded) {
        const { snap, timedOut } = await getDocWithTimeout(ref);
        if (timedOut) {
          setFeedback(
            `Saved "${finalSelection.characterNickname}" on this device — cloud sync queued while reconnecting.`
          );
          return;
        }
        existsNow = Boolean(snap?.exists());
      }
      const writeOp = existsNow
        ? updateDoc(ref, {
            shoeKind: finalSelection.shoeKind,
            colorway: finalSelection.colorway,
            characterNickname: finalSelection.characterNickname,
            updatedAt: serverTimestamp(),
          })
        : setDoc(ref, {
            uid: user.uid,
            shoeKind: finalSelection.shoeKind,
            colorway: finalSelection.colorway,
            characterNickname: finalSelection.characterNickname,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

      const { settled } = await withCloudWriteTimeout(writeOp, 2200);
      if (settled) {
        setCloudDocExists(true);
        setSnapshotLoaded(true);
        setFeedback(
          `Synced "${finalSelection.characterNickname}" (${activeSpec.shortLabel}) to your Sanctuary profile.`
        );
      } else {
        setFeedback(
          `Saved "${finalSelection.characterNickname}" on this device — cloud sync queued while reconnecting.`
        );
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setErrorMsg(
          'Daily Firestore quota reached — your chosen footwear remains active locally.'
        );
      } else if (isTransientOfflineOrTokenError(err)) {
        setFeedback(
          `Saved "${finalSelection.characterNickname}" (${activeSpec.shortLabel}) on this device — cloud sync is currently offline.`
        );
      } else {
        handleFirestoreError(
          err,
          cloudDocExists ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-shoe-heading"
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-end p-3 sm:p-6"
    >
      <div className="pointer-events-auto w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#111C15] border-2 border-[#7CE0A3]/60 text-[#F7F4EB] shadow-2xl overflow-hidden">
        {/* High-Contrast Header */}
        <div className="px-5 py-4 sm:px-6 bg-[#16241B] border-b border-[#8FB996]/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#7CE0A3] font-semibold">
              0m Welcome Area · Boot &amp; Shoe Fitting Bench
            </p>
            <h2
              id="welcome-shoe-heading"
              className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-[#FFFFFF]"
            >
              Choose Your Shoe Character
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onFocusWelcomeBench}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1C2E23] border border-[#8FB996]/45 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#F7F4EB] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#7CE0A3]" />
              <span>3D Rack</span>
            </button>
            <button
              type="button"
              onClick={onFocusLiftCarriage}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1C2E23] border border-[#E5A93C]/50 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#FFD166] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Footprints className="w-4 h-4 text-[#FFD166]" />
              <span>View on Lift</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#261A11] border border-[#FFD166]/65 hover:bg-[#342316] text-xs sm:text-sm font-bold text-[#FFD166] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSaveCloud}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
          {/* Active Footwear Summary Card */}
          <div className="rounded-xl bg-[#0C1510] border border-[#7CE0A3]/40 p-4 space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base sm:text-lg font-bold text-[#FFD166]">
                Active Pair: {activeSpec.title}
              </span>
              <span className="font-mono text-xs sm:text-sm text-[#7CE0A3] font-semibold">
                {SHOE_COLORWAY_CATALOG[selection.colorway].label}
              </span>
            </div>
            <p className="text-sm text-[#E8F2EC] leading-relaxed">
              {activeSpec.tradeMatchNote}
            </p>
            <p className="text-xs sm:text-sm text-[#B9D6C3] leading-relaxed">
              Sensory &amp; Fit Note: {activeSpec.sensoryComfortNote}
            </p>
          </div>

          {/* 01. Footwear Family Filter & Character Grid */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#FFFFFF]">
                01. Select Footwear Type (Wellies, Work Boots &amp; Work Shoes)
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    'All',
                    'Wellington Boots',
                    'Work Boots',
                    'Work Shoes',
                  ] as FamilyFilter[]
                ).map((fam) => (
                  <button
                    key={fam}
                    type="button"
                    onClick={() => setFamilyFilter(fam)}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      familyFilter === fam
                        ? 'bg-[#E5A93C] text-[#140E08]'
                        : 'bg-[#17261D] border border-[#8FB996]/35 text-[#D8E8DD] hover:border-[#FFD166]'
                    }`}
                  >
                    {fam}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredKinds.map((kind) => {
                const spec = SHOE_CHARACTER_CATALOG[kind];
                const isSelected = selection.shoeKind === kind;
                const defaultSwatch =
                  SHOE_COLORWAY_CATALOG[spec.defaultColorway].primaryHex;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleSelectKind(kind)}
                    className={`text-left p-4 rounded-xl border-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1B2F23] border-[#FFD166]'
                        : 'bg-[#15231A] border-[#8FB996]/30 hover:border-[#7CE0A3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2.5 text-sm sm:text-base font-bold text-[#FFFFFF]">
                        <span
                          className="w-4 h-4 rounded-sm border border-[#FFFFFF]/40 shrink-0"
                          style={{ backgroundColor: defaultSwatch }}
                        />
                        <span>{spec.shortLabel}</span>
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#FFD166] shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs font-mono text-[#7CE0A3]">
                      {spec.footwearFamily}
                      {spec.hasSteelCap ? ' · Steel-Toe Shield' : ''}
                      {spec.hasBuckleStrap ? ' · Gusset Buckle' : ''}
                    </p>
                    <p className="mt-1.5 text-xs sm:text-sm text-[#D6E6DC] leading-snug">
                      {spec.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 02. Colourway Swatches */}
          <div className="pt-4 border-t border-[#8FB996]/25 space-y-2.5">
            <h3 className="text-base font-bold text-[#FFFFFF]">
              02. Footwear Upper &amp; Strap Colourway
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SHOE_COLORWAYS.map((cw) => {
                const cSpec = SHOE_COLORWAY_CATALOG[cw];
                const active = selection.colorway === cw;
                return (
                  <button
                    key={cw}
                    type="button"
                    onClick={() => handleSelectColorway(cw)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-left text-xs sm:text-sm font-semibold inline-flex items-center gap-2.5 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#1D3125] border-[#FFD166] text-[#FFFFFF]'
                        : 'bg-[#15221A] border-[#8FB996]/30 text-[#D8E8DD] hover:border-[#7CE0A3]'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-sm border border-[#FFFFFF]/40 shrink-0"
                      style={{ backgroundColor: cSpec.primaryHex }}
                    />
                    <span className="truncate">{cSpec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 03. Friendly Non-PII Character Label */}
          <div className="pt-4 border-t border-[#8FB996]/25 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="shoe-character-nickname"
                className="text-sm sm:text-base font-bold text-[#FFFFFF]"
              >
                03. Your Shoe Character Label (Non-PII)
              </label>
              <span className="font-mono tabular-nums text-xs text-[#9DC0A6]">
                {nicknameDraft.trim().length}/{SHOE_NICKNAME_MAX_LENGTH}
              </span>
            </div>
            <input
              id="shoe-character-nickname"
              type="text"
              minLength={SHOE_NICKNAME_MIN_LENGTH}
              maxLength={SHOE_NICKNAME_MAX_LENGTH}
              value={nicknameDraft}
              onChange={(e) => handleNicknameInput(e.target.value)}
              placeholder="e.g. Woodland Wellies or Cedar Joiner Boots"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-[#2A1614] border border-[#F87171]/60 p-3.5 text-sm font-medium text-[#FECACA]">
              {errorMsg}
            </div>
          )}
          {feedback && (
            <div className="rounded-xl bg-[#162C20] border border-[#7CE0A3]/60 p-3.5 text-sm font-medium text-[#DCFCE7]">
              {feedback}
            </div>
          )}

          {/* Persistence Footer */}
          <div className="pt-4 border-t border-[#8FB996]/25 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetWellies}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#18271E] border border-[#8FB996]/35 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#E5EFE8] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#E5A93C]" />
              <span>Reset to Green Wellies</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {!user && (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleGoogleSignIn}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1E3125] border border-[#7CE0A3]/55 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#F7F4EB] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-[#7CE0A3]" />
                  <span>{authBusy ? 'Signing In...' : 'Google Sign-In'}</span>
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] disabled:opacity-55 text-[#171008] font-bold text-sm sm:text-base whitespace-nowrap cursor-pointer"
              >
                {saving
                  ? 'Saving Footwear...'
                  : user
                    ? 'Lace Up & Save Character'
                    : 'Lace Up Character (Local)'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
};
