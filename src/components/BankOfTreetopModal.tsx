import { signInWithPopup, User } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Check, LogIn, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  auth,
  BANK_CUSTOM_GOAL_MAX,
  BANK_MAX_LIFETIME_UNITS,
  BANK_MAX_SAVED_UNITS,
  BANK_STOCK_BUNDLE_IDS,
  BankOfTreetopLedgerRecord,
  BankStockBundleId,
  db,
  getSafeCurrentUser,
  googleProvider,
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

export type BankOfTreetopTab = 'savings' | 'exchequer';

export const BANK_OF_TREETOP_STORAGE_KEY =
  'jays_job_club_bank_of_treetop_v1';

interface StockBundleOption {
  id: BankStockBundleId;
  title: string;
  specialInterestArea: string;
  targetUnits: number;
  contentsSummary: string;
  nextStepHint: string;
}

export const SPECIAL_INTEREST_STOCK_BUNDLES: StockBundleOption[] = [
  {
    id: 'stock_cedar_joinery',
    title: 'Aromatic Cedar Boards & Brass Hinges',
    specialInterestArea: 'Woodcraft & Joinery',
    targetUnits: 6,
    contentsSummary:
      '4 planed Western red cedar panels, solid brass box hinges, corner pins & natural beeswax block.',
    nextStepHint:
      'Craft dovetail tool caddies or birdboxes at the 33m Canopy Joinery Bench.',
  },
  {
    id: 'stock_agarwood_vials',
    title: 'Amber Dropper Vials & Tactile Batch Cards',
    specialInterestArea: 'Botanical & Essential Oils',
    targetUnits: 8,
    contentsSummary:
      '12 UV-protective 10ml amber glass dropper bottles, brass pipette funnel & high-contrast batch labels.',
    nextStepHint:
      'Bottle small-batch distilled heartwood or herbal oils for the Canopy Counter.',
  },
  {
    id: 'stock_drazella_publishing',
    title: 'Easy Read & Digital Art Print Cardstock',
    specialInterestArea: 'Youth Publishing & Digital Art',
    targetUnits: 6,
    contentsSummary:
      'Matte zero-glare thick cream & mint card pack, high-contrast ink swatches & lay-flat bindings.',
    nextStepHint:
      'Illustrate Easy Read neurobiology booklets for visually impaired, senior & multilingual readers.',
  },
  {
    id: 'stock_brass_lanterns',
    title: 'Spun Brass Hoods & Warm 2700K LED Cores',
    specialInterestArea: 'Metalwork & Sensory Lighting',
    targetUnits: 8,
    contentsSummary:
      '2 brushed solid brass lantern hoods, frosted glare-free glass diffusers & braided low-volt cords.',
    nextStepHint:
      'Assemble sensory-calm desk and rafter lanterns with zero overhead glare.',
  },
  {
    id: 'stock_plant_dyed_wool',
    title: 'Plant-Dyed Acoustic Loom Wool Cones',
    specialInterestArea: 'Textiles & Weaving',
    targetUnits: 6,
    contentsSummary:
      'Sage, heather & warm ochre British wool cones, smooth hardwood boat shuttle & selvedge binding tape.',
    nextStepHint:
      'Weave sound-softening workbench runners and cosy Chill Pod textiles.',
  },
  {
    id: 'stock_custom_interest',
    title: 'Custom Special-Interest Starter Stock',
    specialInterestArea: 'Your Own Special Interest',
    targetUnits: 7,
    contentsSummary:
      'Name the exact specialist parts, repair spares, study guides, or craft stock for your special interest.',
    nextStepHint:
      'Turn steady personal focus into a practical prototype or Show & Tell piece.',
  },
];

const DEFAULT_BANK_LEDGER: BankOfTreetopLedgerRecord = {
  selectedBundleId: 'stock_cedar_joinery',
  customInterestGoal: '',
  savedUnits: 0,
  lifetimeUnitsSaved: 0,
  bundlesRequisitioned: 0,
  exchequerChecksLogged: 0,
  disclaimerAccepted: true,
  updatedAtMs: 0,
  source: 'local',
};

function sanitizeLedger(
  raw: Partial<BankOfTreetopLedgerRecord> | null | undefined,
  source: 'cloud' | 'local'
): BankOfTreetopLedgerRecord {
  const selectedBundleId = BANK_STOCK_BUNDLE_IDS.includes(
    raw?.selectedBundleId as BankStockBundleId
  )
    ? (raw?.selectedBundleId as BankStockBundleId)
    : DEFAULT_BANK_LEDGER.selectedBundleId;

  const customInterestGoal =
    typeof raw?.customInterestGoal === 'string'
      ? raw.customInterestGoal.slice(0, BANK_CUSTOM_GOAL_MAX)
      : '';

  const savedUnits = Math.max(
    0,
    Math.min(BANK_MAX_SAVED_UNITS, Math.floor(Number(raw?.savedUnits) || 0))
  );
  const lifetimeUnitsSaved = Math.max(
    savedUnits,
    Math.min(
      BANK_MAX_LIFETIME_UNITS,
      Math.floor(Number(raw?.lifetimeUnitsSaved) || 0)
    )
  );
  const bundlesRequisitioned = Math.max(
    0,
    Math.min(9999, Math.floor(Number(raw?.bundlesRequisitioned) || 0))
  );
  const exchequerChecksLogged = Math.max(
    0,
    Math.min(9999, Math.floor(Number(raw?.exchequerChecksLogged) || 0))
  );
  const disclaimerAccepted =
    typeof raw?.disclaimerAccepted === 'boolean'
      ? raw.disclaimerAccepted
      : true;

  return {
    selectedBundleId,
    customInterestGoal,
    savedUnits,
    lifetimeUnitsSaved,
    bundlesRequisitioned,
    exchequerChecksLogged,
    disclaimerAccepted,
    updatedAtMs: Number(raw?.updatedAtMs) || 0,
    source,
  };
}

export function loadLocalBankLedger(): BankOfTreetopLedgerRecord {
  if (typeof window === 'undefined') return DEFAULT_BANK_LEDGER;
  try {
    const raw = window.localStorage.getItem(BANK_OF_TREETOP_STORAGE_KEY);
    if (!raw) return DEFAULT_BANK_LEDGER;
    return sanitizeLedger(JSON.parse(raw), 'local');
  } catch {
    return DEFAULT_BANK_LEDGER;
  }
}

function saveLocalBankLedger(record: BankOfTreetopLedgerRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BANK_OF_TREETOP_STORAGE_KEY,
      JSON.stringify(record)
    );
  } catch {
    // Ignore storage quota limits
  }
}

interface BankOfTreetopModalProps {
  isOpen: boolean;
  initialTab?: BankOfTreetopTab;
  localProgress: TreeProgressState;
  onUpdateLocalProgress: (
    next: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onOpenJobCentre: (cardId?: string) => void;
  onOpenEntryKiosk: () => void;
  onOpenCanopyStore: () => void;
  onClose: () => void;
}

const EXCHEQUER_TALLY_ITEMS = [
  'Checked that the "Bank of Treetop Is NOT a Real Bank (Zero Real Money)" disclaimer is clear and readable at the top of the counter.',
  'Verified that Special-Interest Stock Pots allow members to save symbolic Trying, Gathering, and Treehouse Tokens at their own pace with zero fees or penalties.',
  "Confirmed that fellow Jay's Job Club members can withdraw symbolic units back to their pocket or unlock starter stock whenever ready.",
];

export const BankOfTreetopModal: React.FC<BankOfTreetopModalProps> = ({
  isOpen,
  initialTab = 'savings',
  localProgress,
  onUpdateLocalProgress,
  onOpenJobCentre,
  onOpenEntryKiosk,
  onOpenCanopyStore,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<BankOfTreetopTab>(initialTab);
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [localLedger, setLocalLedger] = useState<BankOfTreetopLedgerRecord>(
    () => loadLocalBankLedger()
  );
  const [cloudLedger, setCloudLedger] =
    useState<BankOfTreetopLedgerRecord | null>(null);
  const [cloudDocExists, setCloudDocExists] = useState<boolean>(false);
  const [exchequerChecks, setExchequerChecks] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSafeAuth((u) => {
      setCurrentUser(u);
      if (!u) {
        setCloudLedger(null);
        setCloudDocExists(false);
      }
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (
      !isOpen ||
      !currentUser ||
      !VALID_DOC_ID_REGEX.test(currentUser.uid)
    ) {
      return;
    }
    const ledgerRef = doc(db, 'bankOfTreetopLedgers', currentUser.uid);
    const unsub = onSnapshot(
      ledgerRef,
      (snap) => {
        if (!snap.exists()) {
          setCloudDocExists(false);
          setCloudLedger(null);
          return;
        }
        setCloudDocExists(true);
        const d = snap.data();
        const ts = d.updatedAt as Timestamp | undefined;
        setCloudLedger(
          sanitizeLedger(
            {
              selectedBundleId: d.selectedBundleId as BankStockBundleId,
              customInterestGoal: String(d.customInterestGoal || ''),
              savedUnits: Number(d.savedUnits || 0),
              lifetimeUnitsSaved: Number(d.lifetimeUnitsSaved || 0),
              bundlesRequisitioned: Number(d.bundlesRequisitioned || 0),
              exchequerChecksLogged: Number(d.exchequerChecksLogged || 0),
              disclaimerAccepted: Boolean(d.disclaimerAccepted),
              updatedAtMs:
                ts && typeof ts.toMillis === 'function'
                  ? ts.toMillis()
                  : Date.now(),
            },
            'cloud'
          )
        );
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(
          err,
          OperationType.GET,
          `bankOfTreetopLedgers/${currentUser.uid}`
        );
      }
    );
    return () => unsub();
  }, [isOpen, currentUser]);

  const activeLedger = useMemo<BankOfTreetopLedgerRecord>(() => {
    if (!cloudLedger) return localLedger;
    if (cloudLedger.updatedAtMs >= localLedger.updatedAtMs) {
      return {
        ...cloudLedger,
        lifetimeUnitsSaved: Math.max(
          cloudLedger.lifetimeUnitsSaved,
          localLedger.lifetimeUnitsSaved,
          cloudLedger.savedUnits
        ),
        bundlesRequisitioned: Math.max(
          cloudLedger.bundlesRequisitioned,
          localLedger.bundlesRequisitioned
        ),
        exchequerChecksLogged: Math.max(
          cloudLedger.exchequerChecksLogged,
          localLedger.exchequerChecksLogged
        ),
      };
    }
    return localLedger;
  }, [cloudLedger, localLedger]);

  const selectedBundle =
    SPECIAL_INTEREST_STOCK_BUNDLES.find(
      (b) => b.id === activeLedger.selectedBundleId
    ) || SPECIAL_INTEREST_STOCK_BUNDLES[0];

  if (!isOpen) return null;

  const persistLedgerUpdate = async (next: BankOfTreetopLedgerRecord) => {
    const stamped: BankOfTreetopLedgerRecord = {
      ...next,
      lifetimeUnitsSaved: Math.max(next.lifetimeUnitsSaved, next.savedUnits),
      updatedAtMs: Date.now(),
      source: 'local',
    };
    setLocalLedger(stamped);
    saveLocalBankLedger(stamped);

    if (
      !currentUser ||
      !currentUser.emailVerified ||
      !VALID_DOC_ID_REGEX.test(currentUser.uid) ||
      !stamped.disclaimerAccepted
    ) {
      return;
    }

    const ledgerRef = doc(db, 'bankOfTreetopLedgers', currentUser.uid);
    const baseFields = {
      selectedBundleId: stamped.selectedBundleId,
      customInterestGoal: stamped.customInterestGoal.slice(
        0,
        BANK_CUSTOM_GOAL_MAX
      ),
      savedUnits: stamped.savedUnits,
      lifetimeUnitsSaved: stamped.lifetimeUnitsSaved,
      bundlesRequisitioned: stamped.bundlesRequisitioned,
      exchequerChecksLogged: stamped.exchequerChecksLogged,
      disclaimerAccepted: true,
      updatedAt: serverTimestamp(),
    };

    try {
      if (cloudDocExists) {
        await withCloudWriteTimeout(updateDoc(ledgerRef, baseFields), 2400);
      } else {
        await withCloudWriteTimeout(
          setDoc(ledgerRef, {
            uid: currentUser.uid,
            ...baseFields,
            createdAt: serverTimestamp(),
          }),
          2400
        );
      }
    } catch (err) {
      if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
        return;
      }
      handleFirestoreError(
        err,
        cloudDocExists ? OperationType.UPDATE : OperationType.CREATE,
        `bankOfTreetopLedgers/${currentUser.uid}`
      );
    }
  };

  const handleToggleDisclaimer = (checked: boolean) => {
    setErrorMessage(null);
    const next: BankOfTreetopLedgerRecord = {
      ...activeLedger,
      disclaimerAccepted: checked,
    };
    void persistLedgerUpdate(next);
  };

  const handleSelectBundle = (bundleId: BankStockBundleId) => {
    soundEngine.unlock();
    soundEngine.playCraftLoad();
    setErrorMessage(null);
    void persistLedgerUpdate({
      ...activeLedger,
      selectedBundleId: bundleId,
    });
  };

  const handleCustomGoalChange = (value: string) => {
    const clean = value.slice(0, BANK_CUSTOM_GOAL_MAX);
    void persistLedgerUpdate({
      ...activeLedger,
      customInterestGoal: clean,
    });
  };

  const handleDepositToken = (
    tokenKind: 'trying' | 'gathering' | 'treehouse'
  ) => {
    setErrorMessage(null);
    if (!activeLedger.disclaimerAccepted) {
      setErrorMessage(
        'Please tick the confirmation box above first to confirm you understand the Bank of Treetop is not a real bank.'
      );
      return;
    }

    if (tokenKind === 'trying' && localProgress.tryingTokens < 1) {
      setErrorMessage(
        "You have 0 Trying Tokens in your pocket right now. Check in at the Entry Kiosk, log a Daily Habit, or pick a Job Slip at Jay's Job Centre to earn symbolic tokens."
      );
      return;
    }
    if (tokenKind === 'gathering' && localProgress.gatheringTokens < 1) {
      setErrorMessage(
        "You have 0 Gathering Tokens right now. Choose a Job Slip at Jay's Job Centre to earn Gathering Tokens."
      );
      return;
    }
    if (tokenKind === 'treehouse' && localProgress.treehouseTokens < 1) {
      setErrorMessage(
        'You have 0 Treehouse Tokens right now. Complete a 33m Canopy Session checklist to earn Treehouse Tokens.'
      );
      return;
    }

    const unitsAdded = tokenKind === 'treehouse' ? 2 : 1;
    const nextSaved = Math.min(
      BANK_MAX_SAVED_UNITS,
      activeLedger.savedUnits + unitsAdded
    );
    const nextLifetime = Math.min(
      BANK_MAX_LIFETIME_UNITS,
      Math.max(activeLedger.lifetimeUnitsSaved + unitsAdded, nextSaved)
    );

    const updatedProgress: TreeProgressState = {
      ...localProgress,
      tryingTokens:
        tokenKind === 'trying'
          ? Math.max(0, localProgress.tryingTokens - 1)
          : localProgress.tryingTokens,
      gatheringTokens:
        tokenKind === 'gathering'
          ? Math.max(0, localProgress.gatheringTokens - 1)
          : localProgress.gatheringTokens,
      treehouseTokens:
        tokenKind === 'treehouse'
          ? Math.max(0, localProgress.treehouseTokens - 1)
          : localProgress.treehouseTokens,
    };

    soundEngine.unlock();
    soundEngine.playCraftLoad();

    const tokenLabel =
      tokenKind === 'treehouse'
        ? '1 Treehouse Token (+2 Stock Pot units)'
        : tokenKind === 'gathering'
          ? '1 Gathering Token (+1 Stock Pot unit)'
          : '1 Trying Token (+1 Stock Pot unit)';

    onUpdateLocalProgress(
      updatedProgress,
      `Set aside ${tokenLabel} in your symbolic Special-Interest Stock Pot (${nextSaved}/${selectedBundle.targetUnits}).`
    );

    void persistLedgerUpdate({
      ...activeLedger,
      savedUnits: nextSaved,
      lifetimeUnitsSaved: nextLifetime,
    });

    setStatusMessage(
      `Saved ${tokenLabel} toward "${selectedBundle.title}" (${nextSaved}/${selectedBundle.targetUnits} symbolic units).`
    );
  };

  const handleWithdrawUnit = () => {
    setErrorMessage(null);
    if (activeLedger.savedUnits < 1) return;

    const nextSaved = Math.max(0, activeLedger.savedUnits - 1);
    const updatedProgress: TreeProgressState = {
      ...localProgress,
      tryingTokens: Math.min(MAX_TOKEN_COUNT, localProgress.tryingTokens + 1),
    };

    soundEngine.unlock();
    soundEngine.playCraftLoad();
    onUpdateLocalProgress(
      updatedProgress,
      'Returned 1 symbolic unit from your Stock Pot back to your Trying Token pocket.'
    );
    void persistLedgerUpdate({
      ...activeLedger,
      savedUnits: nextSaved,
    });
    setStatusMessage(
      'Returned 1 symbolic unit back to your Trying Token pocket — zero fees, zero rush.'
    );
  };

  const handleRequisitionBundle = () => {
    setErrorMessage(null);
    if (!activeLedger.disclaimerAccepted) {
      setErrorMessage(
        'Please confirm the Not-a-Real-Bank disclaimer box above before requisitioning symbolic starter stock.'
      );
      return;
    }
    if (activeLedger.savedUnits < selectedBundle.targetUnits) {
      setErrorMessage(
        `You need ${selectedBundle.targetUnits - activeLedger.savedUnits} more symbolic unit(s) in your Stock Pot to unlock "${selectedBundle.title}".`
      );
      return;
    }

    const nextSaved = Math.max(
      0,
      activeLedger.savedUnits - selectedBundle.targetUnits
    );
    const nextBundles = Math.min(9999, activeLedger.bundlesRequisitioned + 1);

    const updatedProgress: TreeProgressState = {
      ...localProgress,
      tryingTokens: Math.min(MAX_TOKEN_COUNT, localProgress.tryingTokens + 1),
    };

    soundEngine.unlock();
    soundEngine.playCanopyDelivery(true);

    const goalName =
      selectedBundle.id === 'stock_custom_interest' &&
      activeLedger.customInterestGoal.trim()
        ? activeLedger.customInterestGoal.trim()
        : selectedBundle.title;

    onUpdateLocalProgress(
      updatedProgress,
      `Unlocked symbolic Special-Interest Starter Stock: "${goalName}" (+1 Trying Token encouragement)!`
    );

    void persistLedgerUpdate({
      ...activeLedger,
      savedUnits: nextSaved,
      bundlesRequisitioned: nextBundles,
    });

    setStatusMessage(
      `Starter Stock Requisition #${nextBundles} unlocked: "${goalName}"! You can now craft your piece and list real maker work at the 33m Canopy Store.`
    );
  };

  const handleCompleteExchequerTally = () => {
    setErrorMessage(null);
    if (!activeLedger.disclaimerAccepted) {
      setErrorMessage(
        'Please confirm the Not-a-Real-Bank disclaimer box at the top before logging an Exchequer tally.'
      );
      return;
    }
    if (!exchequerChecks.every(Boolean)) {
      setErrorMessage(
        'Tick all 3 calm Exchequer volunteer checks below before recording your ledger tally.'
      );
      return;
    }

    const nextChecks = Math.min(9999, activeLedger.exchequerChecksLogged + 1);
    const updatedProgress: TreeProgressState = {
      ...localProgress,
      tryingTokens: Math.min(MAX_TOKEN_COUNT, localProgress.tryingTokens + 1),
    };

    soundEngine.unlock();
    soundEngine.playCanopyDelivery(false);

    onUpdateLocalProgress(
      updatedProgress,
      `Logged Unpaid Exchequer Volunteer Tally #${nextChecks} at Bank of Treetop (+1 Symbolic Trying Token).`
    );

    void persistLedgerUpdate({
      ...activeLedger,
      exchequerChecksLogged: nextChecks,
    });

    setExchequerChecks([false, false, false]);
    setStatusMessage(
      `Thank you! Logged Unpaid Exchequer Tally #${nextChecks}. Note reminder: this is an unpaid Jay's Job Club volunteer role (+1 symbolic Trying Token of appreciation; zero cash pay).`
    );
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setErrorMessage(
        'Google Sign-In did not complete. Your symbolic Stock Pot continues saving locally on this device.'
      );
    }
  };

  const progressRatio = Math.min(
    1,
    activeLedger.savedUnits / Math.max(1, selectedBundle.targetUnits)
  );
  const totalPocketTokens =
    localProgress.tryingTokens +
    localProgress.gatheringTokens +
    localProgress.treehouseTokens;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-of-treetop-title"
      className="fixed inset-0 z-50 bg-[#0A130E]/82 flex items-center justify-center p-2 sm:p-4"
    >
      <div className="w-full max-w-5xl max-h-[92dvh] rounded-2xl bg-[#112018] border-2 border-[#D4AF37] text-[#F7F4EB] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-[#0B2A1A] border-b border-[#D4AF37]/45 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-mono tracking-wide text-[#FFE082] font-semibold">
              JAY&apos;S JOB CLUB PRACTICE COUNTER · SYMBOLIC TOKENS ONLY
            </div>
            <h2
              id="bank-of-treetop-title"
              className="text-lg sm:text-2xl font-display font-bold text-[#FFFFFF] leading-tight"
            >
              Bank of Treetop — Special-Interest Stock Guide &amp; Exchequer Desk
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bank of Treetop"
            className="touch-manipulation min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-[#183526] hover:bg-[#214734] border border-white/20 text-[#F7F4EB] inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mobile-touch-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* MANDATORY PROMINENT DISCLAIMER */}
          <section
            aria-label="Mandatory Not a Real Bank Disclaimer"
            className="rounded-xl bg-[#2B1D0E] border-2 border-[#FFD166] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#FFE082]">
                Important Disclaimer: The Bank of Treetop Is NOT a Real Bank
              </h3>
              <span className="font-mono text-xs text-[#FDE68A]">
                Zero Real Money · Educational Practice Only
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#FFFBEB] leading-relaxed">
              The <strong>Bank of Treetop</strong> is a fictional, educational
              practice counter inside <strong>Jay&apos;s Job Club</strong>. It is{' '}
              <strong>NOT a real bank</strong>, building society, credit union,
              or regulated financial institution. It accepts{' '}
              <strong>no real money, deposits, or bank details</strong>, and
              Trying Tokens, Gathering Tokens, Treehouse Tokens, and Stock
              Savings Pots have <strong>zero monetary or cash value</strong>.
              The <strong>Exchequer (Ref JC-003)</strong> is an{' '}
              <strong>unpaid volunteer club role</strong> open to any member of
              Jay&apos;s Job Club.
            </p>

            <label className="touch-manipulation min-h-[44px] flex items-start sm:items-center gap-3 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeLedger.disclaimerAccepted}
                onChange={(e) => handleToggleDisclaimer(e.target.checked)}
                className="mt-0.5 sm:mt-0 w-5 h-5 accent-[#FFD166] rounded shrink-0 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-semibold text-[#FFE082]">
                I understand that the Bank of Treetop is NOT a real bank, holds
                no real money, and uses symbolic Jay&apos;s Job Club tokens only.
              </span>
            </label>
          </section>

          {/* Segmented View Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 pb-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('savings')}
                className={`touch-manipulation min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border cursor-pointer transition-colors ${
                  activeTab === 'savings'
                    ? 'bg-[#D4AF37] border-[#FFE082] text-[#171108]'
                    : 'bg-[#183024] border-white/15 text-[#E4F0E8] hover:border-[#D4AF37]'
                }`}
              >
                01. How to Save Up for Special-Interest Stock
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exchequer')}
                className={`touch-manipulation min-h-[44px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border cursor-pointer transition-colors ${
                  activeTab === 'exchequer'
                    ? 'bg-[#7CE0A3] border-[#A7F3D0] text-[#0D1E14]'
                    : 'bg-[#183024] border-white/15 text-[#E4F0E8] hover:border-[#7CE0A3]'
                }`}
              >
                02. Unpaid Exchequer Role (JC-003 · Open to All Members)
              </button>
            </div>

            {!currentUser ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="touch-manipulation min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#1A3326] border border-[#7CE0A3]/50 hover:border-[#FFD166] text-xs font-semibold text-[#DCFCE7] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Optional Cloud Sync</span>
              </button>
            ) : (
              <span className="text-xs text-[#9EE6B8] font-mono">
                {currentUser.emailVerified
                  ? 'Ledger synced to your private account'
                  : 'Saved on this device (verify email for cloud sync)'}
              </span>
            )}
          </div>

          {statusMessage && (
            <div className="rounded-xl bg-[#163424] border border-[#7CE0A3]/60 px-4 py-3 text-xs sm:text-sm text-[#DCFCE7] font-medium">
              {statusMessage}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-[#341A1A] border border-[#FCA5A5]/60 px-4 py-3 text-xs sm:text-sm text-[#FEE2E2] font-medium">
              {errorMessage}
            </div>
          )}

          {/* TAB 1: HOW TO SAVE UP FOR SPECIAL-INTEREST STOCK */}
          {activeTab === 'savings' && (
            <div className="space-y-6">
              {/* Easy-Read 4-Step Guide */}
              <section className="rounded-xl bg-[#16291F] border border-white/15 p-4 sm:p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#FFE082]">
                    How to Save Up Symbolic Tokens to Buy Starter Stock for
                    Special Interests
                  </h3>
                  <p className="text-xs sm:text-sm text-[#D6E8DD]">
                    Follow these four unhurried steps at your own pace. Nothing
                    expires, there are no fees, and you never spend real money
                    here.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="rounded-lg bg-[#0F1E16] border border-white/10 p-3.5 space-y-1.5">
                    <div className="font-mono text-xs font-bold text-[#7CE0A3]">
                      01. Earn Trying &amp; Gathering Tokens (0m Courtyard)
                    </div>
                    <p className="text-xs sm:text-sm text-[#E8F3EC] leading-relaxed">
                      Map your special interest at the{' '}
                      <button
                        type="button"
                        onClick={onOpenEntryKiosk}
                        className="text-[#FFD166] underline font-semibold cursor-pointer"
                      >
                        Entry Kiosk
                      </button>
                      , log Daily Mastery Habits in the top bar, or choose a Job
                      Slip at{' '}
                      <button
                        type="button"
                        onClick={() => onOpenJobCentre()}
                        className="text-[#FFD166] underline font-semibold cursor-pointer"
                      >
                        Jay&apos;s Job Centre
                      </button>{' '}
                      to earn <strong>+1 Trying</strong> and{' '}
                      <strong>+1–3 Gathering</strong> tokens.
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#0F1E16] border border-white/10 p-3.5 space-y-1.5">
                    <div className="font-mono text-xs font-bold text-[#7CE0A3]">
                      02. Earn Treehouse Tokens (33m Canopy Bench)
                    </div>
                    <p className="text-xs sm:text-sm text-[#E8F3EC] leading-relaxed">
                      Tick off the step-by-step duties on your active{' '}
                      <strong>33m Canopy Session Card</strong> or pledge a buddy
                      role on a Job Centre card. Each Treehouse Token counts as{' '}
                      <strong>+2 Stock Pot units</strong>.
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#0F1E16] border border-white/10 p-3.5 space-y-1.5">
                    <div className="font-mono text-xs font-bold text-[#FFE082]">
                      03. Set Aside Units in Your Special-Interest Stock Pot
                    </div>
                    <p className="text-xs sm:text-sm text-[#E8F3EC] leading-relaxed">
                      Pick a starter stock bundle below (woodwork, botanical
                      vials, Drazella Easy Read digital art cardstock, lanterns,
                      loom wool, or your own custom goal) and move 1 symbolic
                      token at a time into your Stock Pot.
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#0F1E16] border border-white/10 p-3.5 space-y-1.5">
                    <div className="font-mono text-xs font-bold text-[#FFE082]">
                      04. Requisition Stock &amp; Showcase Your Craft
                    </div>
                    <p className="text-xs sm:text-sm text-[#E8F3EC] leading-relaxed">
                      When your pot reaches <strong>6–8 symbolic units</strong>,
                      unlock your Special-Interest Starter Stock batch, build
                      your piece calmly, and optionally list finished craft on
                      the{' '}
                      <button
                        type="button"
                        onClick={onOpenCanopyStore}
                        className="text-[#7CE0A3] underline font-semibold cursor-pointer"
                      >
                        33m Canopy Maker Store
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </section>

              {/* Two-Column Interactive Stock Pot + Bundle Picker */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left 7 Columns: Choose Special-Interest Stock Bundle */}
                <div className="lg:col-span-7 space-y-3">
                  <h3 className="text-sm sm:text-base font-bold text-[#FFFFFF]">
                    Choose Your Special-Interest Starter Stock Goal
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SPECIAL_INTEREST_STOCK_BUNDLES.map((bundle) => {
                      const selected = bundle.id === selectedBundle.id;
                      return (
                        <button
                          key={bundle.id}
                          type="button"
                          onClick={() => handleSelectBundle(bundle.id)}
                          aria-pressed={selected}
                          className={`touch-manipulation text-left rounded-xl p-3.5 border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                            selected
                              ? 'bg-[#1D3B2A] border-[#FFD166] text-[#FFFFFF]'
                              : 'bg-[#14241B] border-white/15 text-[#DCEADF] hover:border-[#7CE0A3]'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2 text-xs font-mono">
                              <span className="text-[#7CE0A3]">
                                {bundle.specialInterestArea}
                              </span>
                              <span className="tabular-nums font-bold text-[#FFE082]">
                                {bundle.targetUnits} units
                              </span>
                            </div>
                            <div className="text-sm font-bold text-[#FFFFFF] leading-snug">
                              {bundle.title}
                            </div>
                            <p className="text-xs text-[#C6DDD0] leading-relaxed">
                              {bundle.contentsSummary}
                            </p>
                          </div>
                          <div className="text-[11px] font-medium text-[#FFE082]">
                            {selected ? '✓ Active Stock Goal' : 'Select Goal →'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedBundle.id === 'stock_custom_interest' && (
                    <div className="rounded-xl bg-[#16291F] border border-[#FFD166]/45 p-3.5 space-y-1.5">
                      <label className="block text-xs font-semibold text-[#FFE082]">
                        Describe Your Custom Special-Interest Stock Goal (up to{' '}
                        {BANK_CUSTOM_GOAL_MAX} characters)
                        <input
                          type="text"
                          value={activeLedger.customInterestGoal}
                          onChange={(e) =>
                            handleCustomGoalChange(e.target.value)
                          }
                          maxLength={BANK_CUSTOM_GOAL_MAX}
                          placeholder="e.g. Braille & tactile constellation cards, clockwork gears, seed packets..."
                          className="mt-1.5 w-full min-h-[44px] rounded-lg bg-[#0D1A13] border border-white/25 px-3 py-2 text-sm text-[#FFFFFF]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Right 5 Columns: Symbolic Stock Savings Pot Ledger */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-xl bg-[#16291F] border-2 border-[#D4AF37]/65 p-4 sm:p-5 space-y-4">
                    <div className="space-y-1 border-b border-white/12 pb-3">
                      <div className="text-xs font-mono text-[#9EE6B8]">
                        SYMBOLIC STOCK POT · ZERO CASH VALUE
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-[#FFFFFF]">
                        {selectedBundle.id === 'stock_custom_interest' &&
                        activeLedger.customInterestGoal.trim()
                          ? activeLedger.customInterestGoal.trim()
                          : selectedBundle.title}
                      </h3>
                      <p className="text-xs text-[#C8DDD0]">
                        {selectedBundle.nextStepHint}
                      </p>
                    </div>

                    {/* Progress Readout */}
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2 text-xs sm:text-sm font-mono tabular-nums">
                        <span className="text-[#E4F0E8]">
                          Saved in Stock Pot:
                        </span>
                        <span className="text-base font-bold text-[#FFE082]">
                          {activeLedger.savedUnits} /{' '}
                          {selectedBundle.targetUnits} units
                        </span>
                      </div>
                      <div className="w-full h-3 rounded-md bg-[#0B1610] border border-white/15 overflow-hidden">
                        <div
                          className="h-full bg-[#7CE0A3] transition-all duration-300"
                          style={{ width: `${Math.round(progressRatio * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#B8D2C2]">
                        <span>
                          Bundles Unlocked: {activeLedger.bundlesRequisitioned}
                        </span>
                        <span>
                          Lifetime Units: {activeLedger.lifetimeUnitsSaved}
                        </span>
                      </div>
                    </div>

                    {/* Current Pocket Balances */}
                    <div className="rounded-lg bg-[#0E1B14] border border-white/12 p-3 space-y-2">
                      <div className="text-xs font-semibold text-[#FFE082]">
                        Your Symbolic Club Pocket Balances
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-xs">
                        <div className="rounded-md bg-[#16291F] p-2">
                          <div className="text-sm font-bold text-[#FFFFFF]">
                            {localProgress.tryingTokens}
                          </div>
                          <div className="text-[11px] text-[#B8D2C2]">
                            Trying
                          </div>
                        </div>
                        <div className="rounded-md bg-[#16291F] p-2">
                          <div className="text-sm font-bold text-[#7CE0A3]">
                            {localProgress.gatheringTokens}
                          </div>
                          <div className="text-[11px] text-[#B8D2C2]">
                            Gathering
                          </div>
                        </div>
                        <div className="rounded-md bg-[#16291F] p-2">
                          <div className="text-sm font-bold text-[#FFE082]">
                            {localProgress.treehouseTokens}
                          </div>
                          <div className="text-[11px] text-[#B8D2C2]">
                            Treehouse
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Deposit / Withdraw Controls */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={localProgress.tryingTokens < 1}
                        onClick={() => handleDepositToken('trying')}
                        className="touch-manipulation w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1D3E2C] hover:bg-[#255039] disabled:opacity-45 border border-[#7CE0A3]/60 text-xs sm:text-sm font-bold text-[#FFFFFF] cursor-pointer transition-colors"
                      >
                        Set Aside 1 Trying Token (+1 Stock Unit)
                      </button>

                      <button
                        type="button"
                        disabled={localProgress.gatheringTokens < 1}
                        onClick={() => handleDepositToken('gathering')}
                        className="touch-manipulation w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1D3E2C] hover:bg-[#255039] disabled:opacity-45 border border-[#7CE0A3]/60 text-xs sm:text-sm font-bold text-[#FFFFFF] cursor-pointer transition-colors"
                      >
                        Set Aside 1 Gathering Token (+1 Stock Unit)
                      </button>

                      <button
                        type="button"
                        disabled={localProgress.treehouseTokens < 1}
                        onClick={() => handleDepositToken('treehouse')}
                        className="touch-manipulation w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#2A381D] hover:bg-[#364925] disabled:opacity-45 border border-[#FFE082]/65 text-xs sm:text-sm font-bold text-[#FFE082] cursor-pointer transition-colors"
                      >
                        Set Aside 1 Treehouse Token (+2 Stock Units)
                      </button>

                      {activeLedger.savedUnits > 0 && (
                        <button
                          type="button"
                          onClick={handleWithdrawUnit}
                          className="touch-manipulation w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#122119] hover:bg-[#192E23] border border-white/20 text-xs font-semibold text-[#D6E8DD] cursor-pointer"
                        >
                          Return 1 Unit Back to Trying Pocket
                        </button>
                      )}
                    </div>

                    {/* Unlock Starter Stock CTA */}
                    <div className="pt-2 border-t border-white/12 space-y-2">
                      <button
                        type="button"
                        disabled={
                          activeLedger.savedUnits < selectedBundle.targetUnits
                        }
                        onClick={handleRequisitionBundle}
                        className="touch-manipulation w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] disabled:opacity-45 text-[#171008] font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                      >
                        {activeLedger.savedUnits >= selectedBundle.targetUnits
                          ? `Requisition Starter Stock Bundle (${selectedBundle.targetUnits} Units) →`
                          : `Save ${
                              selectedBundle.targetUnits -
                              activeLedger.savedUnits
                            } More Unit(s) to Unlock Stock`}
                      </button>

                      {totalPocketTokens === 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onOpenJobCentre()}
                            className="touch-manipulation min-h-[42px] px-2.5 py-1.5 rounded-lg bg-[#0E4429] border border-[#FFD166]/60 text-xs font-semibold text-[#FFFDF7] cursor-pointer"
                          >
                            Earn at Job Centre →
                          </button>
                          <button
                            type="button"
                            onClick={onOpenEntryKiosk}
                            className="touch-manipulation min-h-[42px] px-2.5 py-1.5 rounded-lg bg-[#1C2E24] border border-[#7CE0A3]/60 text-xs font-semibold text-[#DCFCE7] cursor-pointer"
                          >
                            Open Entry Kiosk →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UNPAID EXCHEQUER VOLUNTEER ROLE (JC-003) */}
          {activeTab === 'exchequer' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-xl bg-[#FAF5E6] text-[#14231A] border-2 border-[#D4AF37] p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#14231A]/15 pb-2">
                    <span className="font-mono text-xs font-bold text-[#0E4429]">
                      OFFICIAL CLUB ROLE · REF JC-003 · UNPAID VOLUNTEER
                    </span>
                    <span className="font-mono text-xs font-bold text-[#8A4B08]">
                      OPEN TO ANY MEMBER OF JAY&apos;S JOB CLUB
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-[#0D2116]">
                    Exchequer (Unpaid Volunteer Role) — Bank of Treetop
                  </h3>

                  <p className="text-xs sm:text-sm text-[#1E3327] leading-relaxed">
                    Any member of <strong>Jay&apos;s Job Club</strong> is
                    welcome to step in as volunteer{' '}
                    <strong>Exchequer of the Bank of Treetop</strong>. This is
                    an <strong>unpaid community practice role</strong> (zero
                    wages, zero employment contract, and zero real money
                    handled) designed for members who enjoy clear rules, calm
                    counting, and helping peers plan special-interest craft
                    goals without social rushing.
                  </p>

                  <div className="rounded-lg bg-[#0E4429]/10 p-3 space-y-1.5 text-xs sm:text-sm text-[#102A1B]">
                    <div className="font-bold">
                      What Any Jay&apos;s Job Club Member Does as Unpaid
                      Exchequer:
                    </div>
                    <p>
                      1. Remind visitors clearly that the{' '}
                      <strong>Bank of Treetop is NOT a real bank</strong> and
                      uses symbolic tokens only.
                    </p>
                    <p>
                      2. Show fellow makers how to earn Trying, Gathering, and
                      Treehouse Tokens and set them aside toward
                      Special-Interest Starter Stock.
                    </p>
                    <p>
                      3. Complete a calm 3-step Exchequer Ledger Tally whenever
                      you drop by — solo or with a buddy.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenJobCentre('jc_real_bank_of_treetop_exchequer')
                      }
                      className="touch-manipulation min-h-[44px] px-4 py-2 rounded-xl bg-[#0E4429] hover:bg-[#145C38] text-[#FFFDF7] font-bold text-xs sm:text-sm cursor-pointer"
                    >
                      View or Collaborate on Card JC-003 in Job Centre →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('savings')}
                      className="touch-manipulation min-h-[44px] px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] font-bold text-xs sm:text-sm cursor-pointer"
                    >
                      Open Stock Savings Pot →
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-xl bg-[#16291F] border border-[#7CE0A3]/50 p-4 sm:p-5 space-y-4">
                  <div className="flex items-baseline justify-between gap-2 border-b border-white/12 pb-2.5">
                    <h4 className="text-base font-bold text-[#FFE082]">
                      Unpaid Exchequer 3-Step Tally
                    </h4>
                    <span className="font-mono tabular-nums text-xs text-[#7CE0A3]">
                      Logged: {activeLedger.exchequerChecksLogged}
                    </span>
                  </div>

                  <p className="text-xs text-[#D2E6DA] leading-relaxed">
                    Practise the Exchequer role right now by ticking each calm
                    stewardship check below:
                  </p>

                  <div className="space-y-2.5">
                    {EXCHEQUER_TALLY_ITEMS.map((itemText, idx) => {
                      const checked = exchequerChecks[idx];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setExchequerChecks((prev) =>
                              prev.map((v, i) => (i === idx ? !v : v))
                            )
                          }
                          aria-pressed={checked}
                          className={`touch-manipulation w-full min-h-[48px] p-3 rounded-xl border text-left flex items-start gap-3 cursor-pointer transition-colors ${
                            checked
                              ? 'bg-[#1E3F2D] border-[#7CE0A3] text-[#FFFFFF]'
                              : 'bg-[#101F17] border-white/15 text-[#D8EAE0] hover:border-[#7CE0A3]/60'
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                              checked
                                ? 'bg-[#7CE0A3] border-[#7CE0A3] text-[#0B1E13]'
                                : 'border-white/35'
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <span className="text-xs leading-relaxed font-medium">
                            {itemText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleCompleteExchequerTally}
                    className="touch-manipulation w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#7CE0A3] hover:bg-[#A7F3D0] text-[#0B1E13] font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                  >
                    Record Unpaid Exchequer Tally (+1 Symbolic Trying Token)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
