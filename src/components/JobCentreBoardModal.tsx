import { signInWithPopup, User } from 'firebase/auth';
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
import React, { useEffect, useMemo, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { RealtimeCollabController } from '../collab/useRealtimeCollab';
import {
  auth,
  CanopyTradeFocus,
  db,
  getDocWithTimeout,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  JOB_COLLAB_MODES,
  JOB_COLLAB_ROLES,
  JOB_COLLAB_STATIONS,
  JOB_PLEDGE_MAX,
  JOB_PLEDGE_MIN,
  JOB_STEPS_MAX,
  JOB_STEPS_MIN,
  JOB_SUMMARY_MAX,
  JOB_SUMMARY_MIN,
  JOB_TITLE_MAX,
  JOB_TITLE_MIN,
  JOB_VACANCY_PACING,
  JOB_VACANCY_TRADES,
  JOB_VACANCY_ZONES,
  JobCentreCollaboratorRecord,
  JobCentreVacancyRecord,
  JobCollaborationMode,
  JobCollaboratorRole,
  JobCollaboratorStation,
  JobVacancyLocationZone,
  JobVacancyPacingStyle,
  JobVacancyTradeCategory,
  MAX_TOKEN_COUNT,
  OperationType,
  subscribeSafeAuth,
  TreeProgressState,
  TreetopTradeTrack,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import { CollabStepStatus } from '../shared/workshopCatalog';
import { ActiveCanopySession } from '../utils/canopySessionStore';

const LOCAL_VACANCIES_KEY = 'jays_job_club_local_vacancies_v1';
const LOCAL_PLEDGES_KEY = 'jays_job_club_local_pledges_v1';
const ACTIVE_JOB_SLIP_KEY = 'jays_job_club_active_job_slip_v1';
const EASY_READ_MODE_KEY = 'jays_job_club_job_board_easy_read_v1';

export const JAY_BETA_RESEARCHER_CARD_ID = 'jc_real_jays_beta_researcher';
export const DRAZELLA_SPRINKES_CARD_ID = 'jc_real_drazella_sprinkes_publishing';
export const BANK_EXCHEQUER_CARD_ID = 'jc_real_bank_of_treetop_exchequer';

const FEATURED_REAL_CARD_IDS = new Set<string>([
  JAY_BETA_RESEARCHER_CARD_ID,
  DRAZELLA_SPRINKES_CARD_ID,
  BANK_EXCHEQUER_CARD_ID,
]);

export const CURATED_JOB_CENTRE_CARDS: JobCentreVacancyRecord[] = [
  {
    id: JAY_BETA_RESEARCHER_CARD_ID,
    referenceCode: 'JC-001',
    jobTitle: "Beta User Researcher — Jay's Job Centre",
    tradeCategory: 'Digital & Systems Craft',
    locationZone: '0m Courtyard Workbench',
    pacingStyle: 'Flexible Drop-In',
    cardSummary:
      "Official Jay's Job Centre notice: we are looking for real Beta User Researchers to walk through the 0m Courtyard Job Centre, Agarwood Lift paces, Entry Kiosk, and 33m Safe Chill Pods and tell us what feels clear, welcoming, or tricky.",
    keySteps:
      '1. Browse 0m Job Centre slips & try Easy Read mode · 2. Test Lift paces & a 33m Safe Chill Pod · 3. Share a 2-minute UX Beta note on what worked or needs adjusting.',
    collaborationMode: 'Open Team-Up & Skill Swap',
    collaborationOpen: true,
    rewardTokens: 5,
    creatorId: 'sanctuary_steward',
    creatorName: "Jay's Job Centre",
    status: 'open',
    createdAtMs: 1730000201000,
    source: 'curated',
  },
  {
    id: DRAZELLA_SPRINKES_CARD_ID,
    referenceCode: 'JC-002',
    jobTitle:
      'Youth Development Publishing: Easy Read Neurobiological Books (Digital Art)',
    tradeCategory: 'Digital & Systems Craft',
    locationZone: '33m Mezzanine Library & Refreshments',
    pacingStyle: 'Paired Quiet Bench',
    cardSummary:
      'Drazella Sprinkes advert for Youth Development Publishing: co-create friendly neurobiological books in Easy Read for visually impaired readers, seniors, and speakers of other languages using bold, high-contrast digital art.',
    keySteps:
      '1. Write 1-idea-per-line Easy Read pages on calm brain & body cues · 2. Illustrate bold high-contrast digital art panels · 3. Check clarity for low-vision, senior & multilingual readers.',
    collaborationMode: 'Open Team-Up & Skill Swap',
    collaborationOpen: true,
    rewardTokens: 5,
    creatorId: 'sanctuary_steward',
    creatorName: 'Drazella Sprinkes',
    status: 'open',
    createdAtMs: 1730000202000,
    source: 'curated',
  },
  {
    id: BANK_EXCHEQUER_CARD_ID,
    referenceCode: 'JC-003',
    jobTitle: 'Exchequer (Unpaid Volunteer Role) — Bank of Treetop',
    tradeCategory: 'Digital & Systems Craft',
    locationZone: '33m Canopy Workshop',
    pacingStyle: 'Flexible Drop-In',
    cardSummary:
      "Unpaid volunteer role open to any member of Jay's Job Club at the Bank of Treetop (Disclaimer: Bank of Treetop is NOT a real bank and holds zero real money). Help fellow makers save symbolic club tokens toward Special-Interest Starter Stock.",
    keySteps:
      '1. Check the Not-a-Real-Bank disclaimer is clear · 2. Show members how to save symbolic tokens in a Special-Interest Stock Pot · 3. Log a calm 3-step Exchequer tally.',
    collaborationMode: 'Open Team-Up & Skill Swap',
    collaborationOpen: true,
    rewardTokens: 5,
    creatorId: 'sanctuary_steward',
    creatorName: 'Bank of Treetop',
    status: 'open',
    createdAtMs: 1730000203000,
    source: 'curated',
  },
  {
    id: 'jc_card_101',
    referenceCode: 'JC-101',
    jobTitle: 'Cedar Birdbox & Mortise Joiner',
    tradeCategory: 'Woodcraft & Joinery',
    locationZone: '33m Canopy Workshop',
    pacingStyle: 'Paired Quiet Bench',
    cardSummary:
      'Cut, sand, and dry-fit aromatic cedar birdbox panels at the 33m Canopy bench. Clear templates provided; zero rush.',
    keySteps:
      '1. Mark cedar boards with brass gauge · 2. Plane edges smooth · 3. Dry-fit mortise joints with buddy.',
    collaborationMode: 'Open Team-Up & Skill Swap',
    collaborationOpen: true,
    rewardTokens: 3,
    creatorId: 'sanctuary_steward',
    creatorName: 'Workshop Steward',
    status: 'open',
    createdAtMs: 1730000101000,
    source: 'curated',
  },
  {
    id: 'jc_card_102',
    referenceCode: 'JC-102',
    jobTitle: 'Agarwood Essential Oil Bottler & Labeller',
    tradeCategory: 'Botanical & Essential Oils',
    locationZone: '33m Canopy Workshop',
    pacingStyle: 'Self-Paced Solo',
    cardSummary:
      'Pipette small-batch distilled heartwood oils into UV amber dropper vials and stamp high-contrast batch cards.',
    keySteps:
      '1. Rinse & rack 10ml amber vials · 2. Measure batch with brass funnel · 3. Stamp batch origin card.',
    collaborationMode: 'Solo or Optional Buddy',
    collaborationOpen: true,
    rewardTokens: 4,
    creatorId: 'sanctuary_steward',
    creatorName: 'Botanical Bench',
    status: 'open',
    createdAtMs: 1730000102000,
    source: 'curated',
  },
  {
    id: 'jc_card_103',
    referenceCode: 'JC-103',
    jobTitle: 'Spun Brass Rafter Lantern Assembler',
    tradeCategory: 'Metalwork & Lanterns',
    locationZone: '0m Courtyard Workbench',
    pacingStyle: 'Small Collab Crew (2-4)',
    cardSummary:
      'Wire low-voltage warm LED cores into spun brass lantern housings and test storm-glass latches at 0m Courtyard.',
    keySteps:
      '1. Seat frosted glass cylinder · 2. Connect low-volt warm filament · 3. Test warm glow & brass latch.',
    collaborationMode: 'Mentor + Apprentice Pair',
    collaborationOpen: true,
    rewardTokens: 4,
    creatorId: 'sanctuary_steward',
    creatorName: 'Lantern Guild',
    status: 'open',
    createdAtMs: 1730000103000,
    source: 'curated',
  },
  {
    id: 'jc_card_104',
    referenceCode: 'JC-104',
    jobTitle: 'Plant-Dyed Sanctuary Rug Weaver',
    tradeCategory: 'Textiles & Weaving',
    locationZone: '33m Canopy Workshop',
    pacingStyle: 'Paired Quiet Bench',
    cardSummary:
      'Wind hardwood shuttles with sage & ochre wool and weave acoustic floor runners for the Canopy and Chill Pods.',
    keySteps:
      '1. Wind dyed wool onto boat shuttle · 2. Weave steady selvedge rows · 3. Bind non-curling hem.',
    collaborationMode: 'Open Team-Up & Skill Swap',
    collaborationOpen: true,
    rewardTokens: 3,
    creatorId: 'sanctuary_steward',
    creatorName: 'Textile Loom Bench',
    status: 'open',
    createdAtMs: 1730000104000,
    source: 'curated',
  },
  {
    id: 'jc_card_105',
    referenceCode: 'JC-105',
    jobTitle: 'Mezzanine Library & Tea Steward',
    tradeCategory: 'Botanical & Community Outreach',
    locationZone: '33m Mezzanine Library & Refreshments',
    pacingStyle: 'Flexible Drop-In',
    cardSummary:
      'Keep trade handbooks tidy on the Mezzanine shelves, brew chamomile & rooibos urns, and check vacant Chill Pod linens.',
    keySteps:
      '1. Order pocket trade guides · 2. Refresh copper herbal tea urn · 3. Fold fresh vegan & feather quilts.',
    collaborationMode: 'Shared Outreach Crew',
    collaborationOpen: true,
    rewardTokens: 3,
    creatorId: 'sanctuary_steward',
    creatorName: 'Mezzanine Host',
    status: 'open',
    createdAtMs: 1730000105000,
    source: 'curated',
  },
  {
    id: 'jc_card_106',
    referenceCode: 'JC-106',
    jobTitle: 'Community Tool Library & Repair Clerk',
    tradeCategory: 'Repair & Maker Tools',
    locationZone: '0m Courtyard Workbench',
    pacingStyle: 'Small Collab Crew (2-4)',
    cardSummary:
      'Clean plane irons, oil brass callipers, and prepare starter tool rolls for new makers arriving at the 0m Welcome Area.',
    keySteps:
      '1. Wipe cedar planes with camellia oil · 2. Check calliper zero · 3. Tag starter kit for outreach workshop.',
    collaborationMode: 'Shared Outreach Crew',
    collaborationOpen: true,
    rewardTokens: 3,
    creatorId: 'sanctuary_steward',
    creatorName: 'Repair Bench',
    status: 'open',
    createdAtMs: 1730000106000,
    source: 'curated',
  },
];

const CURATED_CARDS_BY_ID = new Map<string, JobCentreVacancyRecord>(
  CURATED_JOB_CENTRE_CARDS.map((card) => [card.id, card])
);

function loadEasyReadMode(): boolean {
  try {
    return window.localStorage.getItem(EASY_READ_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveEasyReadMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(EASY_READ_MODE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore storage quota
  }
}

function loadLocalVacancies(): JobCentreVacancyRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_VACANCIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JobCentreVacancyRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocalVacancies(items: JobCentreVacancyRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_VACANCIES_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota
  }
}

function loadLocalPledges(): JobCentreCollaboratorRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_PLEDGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as JobCentreCollaboratorRecord[])
      : [];
  } catch {
    return [];
  }
}

function saveLocalPledges(items: JobCentreCollaboratorRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_PLEDGES_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota
  }
}

export function loadSavedActiveJobSlip(): JobCentreVacancyRecord | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_JOB_SLIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobCentreVacancyRecord;
    if (!parsed || typeof parsed.referenceCode !== 'string') return null;
    const curated = CURATED_CARDS_BY_ID.get(parsed.id);
    if (curated) {
      return { ...parsed, ...curated };
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveActiveJobSlip(card: JobCentreVacancyRecord | null): void {
  try {
    if (!card) {
      window.localStorage.removeItem(ACTIVE_JOB_SLIP_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_JOB_SLIP_KEY, JSON.stringify(card));
    }
  } catch {
    // Ignore storage quota
  }
}

function mapTradeToCanopyFocus(
  trade: JobVacancyTradeCategory
): CanopyTradeFocus {
  if (
    trade === 'Woodcraft & Joinery' ||
    trade === 'Metalwork & Lanterns' ||
    trade === 'Textiles & Weaving' ||
    trade === 'Repair & Maker Tools'
  ) {
    return trade;
  }
  return 'Community Outreach';
}

function splitEasyReadSteps(rawSteps: string): string[] {
  const parts = rawSteps
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [rawSteps.trim()];
}

const DrazellaDigitalArtSpecimen: React.FC<{ easyRead: boolean }> = ({
  easyRead,
}) => {
  return (
    <div
      className="rounded-xl bg-[#091A12] border-2 border-[#D4AF37] p-3.5 text-[#FFFDF7] space-y-3"
      aria-label="Drazella Sprinkes Easy Read and High-Contrast Digital Art Book Specimen"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/15 pb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#FFE082]">
          DRAZELLA SPRINKES · EASY READ + DIGITAL ART SPECIMEN
        </span>
        <span className="font-mono text-[11px] text-[#A7F3D0]">
          High-Contrast · Large Print · Multilingual Visual Cues
        </span>
      </div>

      <div className="space-y-2.5">
        {/* Panel 1: Brain & Vagus Calm Signal */}
        <div className="grid grid-cols-[76px_1fr] items-center gap-3 rounded-lg bg-[#0F291D] border border-[#FFE082]/45 p-2.5">
          <svg
            viewBox="0 0 80 80"
            className="w-[72px] h-[72px] shrink-0 rounded-lg bg-[#050E09] border border-[#FFE082]/60 p-1"
            role="img"
            aria-label="High-contrast digital art: Brain sending calm signal down vagus pathway to heart"
          >
            <circle
              cx="40"
              cy="24"
              r="14"
              fill="#123826"
              stroke="#FFE082"
              strokeWidth="3.5"
            />
            <path
              d="M32 24 C35 18, 45 18, 48 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M40 38 L40 53"
              fill="none"
              stroke="#7CE0A3"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <polygon points="34,49 40,57 46,49" fill="#7CE0A3" />
            <path
              d="M40 69 C31 62, 28 56, 33 52 C36 50, 40 53, 40 56 C40 53, 44 50, 47 52 C52 56, 49 62, 40 69 Z"
              fill="#FDBA74"
              stroke="#FFFDF7"
              strokeWidth="2.2"
            />
          </svg>
          <div>
            <div className="font-mono text-[11px] font-bold text-[#FFE082]">
              PAGE 1 · CALM PATHWAY · EN / ES / AR / CY
            </div>
            <p
              className={`${
                easyRead ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              } font-semibold leading-snug text-[#FFFFFF] mt-0.5`}
            >
              Your brain sends calm safety signals down to your heart and
              breathing.
            </p>
          </div>
        </div>

        {/* Panel 2: Sensory Overload Cue */}
        <div className="grid grid-cols-[76px_1fr] items-center gap-3 rounded-lg bg-[#0F291D] border border-[#7CE0A3]/45 p-2.5">
          <svg
            viewBox="0 0 80 80"
            className="w-[72px] h-[72px] shrink-0 rounded-lg bg-[#050E09] border border-[#7CE0A3]/60 p-1"
            role="img"
            aria-label="High-contrast digital art: Gentle ear protection and dimmed glare for sensory comfort"
          >
            <path
              d="M22 44 C22 26, 58 26, 58 44"
              fill="none"
              stroke="#FFE082"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <rect
              x="15"
              y="40"
              width="12"
              height="20"
              rx="5"
              fill="#7CE0A3"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <rect
              x="53"
              y="40"
              width="12"
              height="20"
              rx="5"
              fill="#7CE0A3"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <circle cx="40" cy="48" r="7" fill="#FFE082" />
          </svg>
          <div>
            <div className="font-mono text-[11px] font-bold text-[#7CE0A3]">
              PAGE 2 · SENSORY ENERGY · VISUAL FIRST
            </div>
            <p
              className={`${
                easyRead ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              } font-semibold leading-snug text-[#FFFFFF] mt-0.5`}
            >
              Bright glare or loud noise uses extra brain energy. Choosing quiet
              space protects focus.
            </p>
          </div>
        </div>

        {/* Panel 3: Safe Rest & Co-Regulation */}
        <div className="grid grid-cols-[76px_1fr] items-center gap-3 rounded-lg bg-[#0F291D] border border-[#FDBA74]/50 p-2.5">
          <svg
            viewBox="0 0 80 80"
            className="w-[72px] h-[72px] shrink-0 rounded-lg bg-[#050E09] border border-[#FDBA74]/60 p-1"
            role="img"
            aria-label="High-contrast digital art: Warm cup and sheltered pod arch for safe nervous-system rest"
          >
            <path
              d="M16 62 L16 34 C16 18, 64 18, 64 34 L64 62 Z"
              fill="#143828"
              stroke="#FFE082"
              strokeWidth="3.5"
            />
            <rect
              x="28"
              y="40"
              width="20"
              height="16"
              rx="3"
              fill="#FDBA74"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <path
              d="M48 43 C54 43, 54 53, 48 53"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <path
              d="M34 34 C34 29, 38 29, 38 25 M42 34 C42 29, 46 29, 46 25"
              fill="none"
              stroke="#7CE0A3"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div className="font-mono text-[11px] font-bold text-[#FDBA74]">
              PAGE 3 · SAFE RESET · ALL AGES &amp; LANGUAGES
            </div>
            <p
              className={`${
                easyRead ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              } font-semibold leading-snug text-[#FFFFFF] mt-0.5`}
            >
              Slow breathing, warm tea, and enclosed rest help your nervous
              system feel safe again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface JobCentreBoardModalProps {
  isOpen: boolean;
  collab: RealtimeCollabController;
  localProgress: TreeProgressState;
  activeJobSlip: JobCentreVacancyRecord | null;
  initialSelectedCardId?: string | null;
  onSelectActiveJobSlip: (card: JobCentreVacancyRecord | null) => void;
  onUpdateLocalProgress: (
    progress: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onLaunchJobStation: (
    card: JobCentreVacancyRecord,
    canopySession?: ActiveCanopySession
  ) => void;
  onOpenBetaResearch?: () => void;
  onOpenBankOfTreetop?: (initialTab?: 'savings' | 'exchequer') => void;
  onClose: () => void;
}

export const JobCentreBoardModal: React.FC<JobCentreBoardModalProps> = ({
  isOpen,
  collab,
  localProgress,
  activeJobSlip,
  initialSelectedCardId,
  onSelectActiveJobSlip,
  onUpdateLocalProgress,
  onLaunchJobStation,
  onOpenBetaResearch,
  onOpenBankOfTreetop,
  onClose,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [boardView, setBoardView] = useState<'rack' | 'collab' | 'pin_new'>(
    'rack'
  );
  const [zoneFilter, setZoneFilter] = useState<
    'all' | 'featured_real' | 'ground' | 'canopy' | 'collab_open'
  >('all');
  const [easyReadMode, setEasyReadMode] = useState<boolean>(() =>
    loadEasyReadMode()
  );
  const [drazellaSpecimenOpen, setDrazellaSpecimenOpen] =
    useState<boolean>(true);

  const [cloudVacancies, setCloudVacancies] = useState<
    JobCentreVacancyRecord[]
  >([]);
  const [localVacancies, setLocalVacancies] = useState<
    JobCentreVacancyRecord[]
  >(() => loadLocalVacancies());

  const [selectedCardId, setSelectedCardId] = useState<string>(
    CURATED_JOB_CENTRE_CARDS[0].id
  );
  const [cloudCollaborators, setCloudCollaborators] = useState<
    JobCentreCollaboratorRecord[]
  >([]);
  const [localPledges, setLocalPledges] = useState<
    JobCentreCollaboratorRecord[]
  >(() => loadLocalPledges());

  // Collaboration Role Pledge Form
  const [collabRole, setCollabRole] =
    useState<JobCollaboratorRole>('Co-Maker Buddy');
  const [preferredStation, setPreferredStation] =
    useState<JobCollaboratorStation>('Canopy Workbench');
  const [pledgeNote, setPledgeNote] = useState<string>(
    'Happy to prepare parts side-by-side or tick off shared steps at a calm pace.'
  );
  const [newStepText, setNewStepText] = useState<string>('');
  const [newChatText, setNewChatText] = useState<string>('');
  const [handleInput, setHandleInput] = useState<string>(collab.displayName);

  // Pin New Job Card Form
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTrade, setNewTrade] = useState<JobVacancyTradeCategory>(
    'Woodcraft & Joinery'
  );
  const [newZone, setNewZone] = useState<JobVacancyLocationZone>(
    '33m Canopy Workshop'
  );
  const [newPacing, setNewPacing] =
    useState<JobVacancyPacingStyle>('Paired Quiet Bench');
  const [newCollabMode, setNewCollabMode] = useState<JobCollaborationMode>(
    'Open Team-Up & Skill Swap'
  );
  const [newSummary, setNewSummary] = useState<string>('');
  const [newSteps, setNewSteps] = useState<string>('');
  const [newRewardTokens, setNewRewardTokens] = useState<number>(3);

  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [busySubmit, setBusySubmit] = useState<boolean>(false);

  useEffect(() => {
    return subscribeSafeAuth((u) => setCurrentUser(u));
  }, []);

  useEffect(() => {
    setHandleInput(collab.displayName);
  }, [collab.displayName]);

  useEffect(() => {
    if (isOpen && initialSelectedCardId) {
      setSelectedCardId(initialSelectedCardId);
      setBoardView('rack');
      if (initialSelectedCardId === DRAZELLA_SPRINKES_CARD_ID) {
        setDrazellaSpecimenOpen(true);
      }
    }
  }, [isOpen, initialSelectedCardId]);

  // Subscribe to live cloud vacancies matching firestore.rules `status in ['open', 'filled']`
  useEffect(() => {
    if (!isOpen || !currentUser) {
      setCloudVacancies([]);
      return;
    }
    const q = query(
      collection(db, 'jobCentreVacancies'),
      where('status', 'in', ['open', 'filled'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: JobCentreVacancyRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          list.push({
            id: docSnap.id,
            referenceCode: String(d.referenceCode || 'JC-200'),
            jobTitle: String(d.jobTitle || 'Workshop Role'),
            tradeCategory:
              (d.tradeCategory as JobVacancyTradeCategory) ||
              'Woodcraft & Joinery',
            locationZone:
              (d.locationZone as JobVacancyLocationZone) ||
              '33m Canopy Workshop',
            pacingStyle:
              (d.pacingStyle as JobVacancyPacingStyle) || 'Self-Paced Solo',
            cardSummary: String(d.cardSummary || ''),
            keySteps: String(d.keySteps || ''),
            collaborationMode:
              (d.collaborationMode as JobCollaborationMode) ||
              'Open Team-Up & Skill Swap',
            collaborationOpen: Boolean(d.collaborationOpen),
            rewardTokens: Number(d.rewardTokens || 3),
            creatorId: String(d.creatorId || ''),
            creatorName: String(d.creatorName || 'Sanctuary Maker'),
            status:
              d.status === 'filled'
                ? 'filled'
                : d.status === 'archived'
                  ? 'archived'
                  : 'open',
            createdAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          });
        });
        setCloudVacancies(list);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'jobCentreVacancies');
      }
    );
    return () => unsub();
  }, [isOpen, currentUser]);

  // Merge curated + local + cloud vacancies while protecting authoritative copy & attribution on curated notices
  const allCards = useMemo(() => {
    const byId = new Map<string, JobCentreVacancyRecord>();
    for (const c of CURATED_JOB_CENTRE_CARDS) {
      byId.set(c.id, c);
    }
    for (const l of localVacancies) {
      if (!CURATED_CARDS_BY_ID.has(l.id)) {
        byId.set(l.id, l);
      }
    }
    for (const cl of cloudVacancies) {
      const curated = CURATED_CARDS_BY_ID.get(cl.id);
      if (curated) {
        byId.set(cl.id, {
          ...cl,
          referenceCode: curated.referenceCode,
          jobTitle: curated.jobTitle,
          tradeCategory: curated.tradeCategory,
          locationZone: curated.locationZone,
          pacingStyle: curated.pacingStyle,
          cardSummary: curated.cardSummary,
          keySteps: curated.keySteps,
          collaborationMode: curated.collaborationMode,
          collaborationOpen: true,
          rewardTokens: curated.rewardTokens,
          creatorName: curated.creatorName,
        });
      } else {
        byId.set(cl.id, cl);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.referenceCode.localeCompare(b.referenceCode)
    );
  }, [cloudVacancies, localVacancies]);

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (zoneFilter === 'featured_real') {
        return FEATURED_REAL_CARD_IDS.has(card.id);
      }
      if (zoneFilter === 'ground') {
        return card.locationZone.startsWith('0m');
      }
      if (zoneFilter === 'canopy') {
        return card.locationZone.startsWith('33m');
      }
      if (zoneFilter === 'collab_open') {
        return card.collaborationOpen;
      }
      return true;
    });
  }, [allCards, zoneFilter]);

  const selectedCard =
    allCards.find((c) => c.id === selectedCardId) || allCards[0];

  // Subscribe to cloud collaborators when viewing collaboration for a card
  useEffect(() => {
    if (
      !isOpen ||
      !currentUser ||
      !selectedCard ||
      !VALID_DOC_ID_REGEX.test(selectedCard.id)
    ) {
      setCloudCollaborators([]);
      return;
    }
    const q = query(
      collection(db, 'jobCentreVacancies', selectedCard.id, 'collaborators'),
      where('status', 'in', ['active', 'completed'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: JobCentreCollaboratorRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const ts = d.updatedAt as Timestamp | undefined;
          rows.push({
            id: docSnap.id,
            vacancyId: String(d.vacancyId || selectedCard.id),
            memberId: String(d.memberId || docSnap.id),
            memberName: String(d.memberName || 'Collaborator'),
            collabRole:
              (d.collabRole as JobCollaboratorRole) || 'Co-Maker Buddy',
            pledgeNote: String(d.pledgeNote || ''),
            preferredStation:
              (d.preferredStation as JobCollaboratorStation) ||
              'Canopy Workbench',
            status: d.status === 'completed' ? 'completed' : 'active',
            updatedAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          });
        });
        setCloudCollaborators(rows);
      },
      () => {
        // Parent doc may be curated-only until first cloud pledge materializes it; ignore quietly
        setCloudCollaborators([]);
      }
    );
    return () => unsub();
  }, [isOpen, currentUser, selectedCard]);

  if (!isOpen) return null;

  const toggleEasyReadMode = () => {
    setEasyReadMode((prev) => {
      const next = !prev;
      saveEasyReadMode(next);
      soundEngine.unlock();
      soundEngine.playCraftLoad();
      return next;
    });
  };

  const ensurePublicProfileExists = async (
    user: User,
    displayName: string
  ): Promise<boolean> => {
    const profileRef = doc(db, 'publicProfiles', user.uid);
    const { snap, timedOut } = await getDocWithTimeout(profileRef);
    if (timedOut) return false;
    if (!snap || !snap.exists()) {
      const safeName =
        displayName.trim().length >= 2
          ? displayName.trim().slice(0, 40)
          : 'Sanctuary Maker';
      const { settled } = await withCloudWriteTimeout(
        setDoc(profileRef, {
          uid: user.uid,
          username: safeName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      return settled;
    }
    return true;
  };

  const handleOpenCollabForCard = (card: JobCentreVacancyRecord) => {
    setSelectedCardId(card.id);
    setBoardView('collab');
    const roomId = `job-${card.referenceCode.toLowerCase()}`;
    collab.joinRoom(
      roomId,
      `${card.referenceCode} · ${card.jobTitle}`,
      `Job Card ${card.referenceCode} (${card.collaborationMode}): ${card.keySteps}`
    );
    soundEngine.unlock();
    soundEngine.playCraftLoad();
  };

  const buildSessionForCard = (
    card: JobCentreVacancyRecord,
    updatedProgress: TreeProgressState
  ): ActiveCanopySession => {
    const steps = splitEasyReadSteps(card.keySteps);
    const mappedTrack: TreetopTradeTrack =
      card.tradeCategory === 'Botanical & Essential Oils'
        ? 'Botanical & Community Outreach'
        : card.tradeCategory;
    return {
      id: `job_${card.referenceCode.toLowerCase()}_${Date.now()}`,
      entrantHandle: collab.displayName || 'Sanctuary Maker',
      specialInterest: card.tradeCategory,
      matchedJobRole: `${card.referenceCode} · ${card.jobTitle}`,
      tradeTrack: mappedTrack,
      canopyFocus: mapTradeToCanopyFocus(card.tradeCategory),
      sessionMode: 'work',
      tryingDelta: 1,
      gatheringDelta: Math.max(1, Math.min(3, card.rewardTokens)),
      canopyDelta: 1,
      totalTryingAfter: updatedProgress.tryingTokens,
      totalGatheringAfter: updatedProgress.gatheringTokens,
      totalCanopyAfter: updatedProgress.treehouseTokens,
      steps,
      completedSteps: steps.map(() => false),
      sessionCompleted: false,
      createdAtMs: Date.now(),
    };
  };

  const handleChooseJobAndGo = (card: JobCentreVacancyRecord) => {
    soundEngine.unlock();
    soundEngine.playCanopyDelivery(false);
    saveActiveJobSlip(card);
    onSelectActiveJobSlip(card);

    // Reward +1 Trying Token & Gathering Tokens for choosing a real job slip
    const updatedProgress: TreeProgressState = {
      ...localProgress,
      tryingTokens: Math.min(MAX_TOKEN_COUNT, localProgress.tryingTokens + 1),
      gatheringTokens: Math.min(
        MAX_TOKEN_COUNT,
        localProgress.gatheringTokens +
          Math.max(1, Math.min(3, card.rewardTokens))
      ),
    };
    onUpdateLocalProgress(
      updatedProgress,
      `Job Slip ${card.referenceCode} (${card.jobTitle}) taken · Heading to ${card.locationZone}!`
    );

    // Join the card's live collaboration room so peers see who is working on this slip
    const roomId = `job-${card.referenceCode.toLowerCase()}`;
    collab.joinRoom(roomId, `${card.referenceCode} · ${card.jobTitle}`);

    const session = buildSessionForCard(card, updatedProgress);
    onLaunchJobStation(card, session);
  };

  const handleLaunchBetaResearchNotice = (card: JobCentreVacancyRecord) => {
    soundEngine.unlock();
    soundEngine.playTokenCollect();
    saveActiveJobSlip(card);
    onSelectActiveJobSlip(card);
    if (onOpenBetaResearch) {
      onOpenBetaResearch();
    } else {
      handleChooseJobAndGo(card);
    }
  };

  const handlePledgeCollaborationRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard) return;

    const cleanNote = pledgeNote.trim();
    if (cleanNote.length < JOB_PLEDGE_MIN) {
      setFeedbackBanner(
        `Please write a short note of at least ${JOB_PLEDGE_MIN} characters so collaborators know how you'd like to help.`
      );
      return;
    }

    const cleanHandle =
      handleInput.trim().length >= 2
        ? handleInput.trim().slice(0, 32)
        : 'Apprentice Maker';
    collab.setDisplayName(cleanHandle);

    setBusySubmit(true);
    setFeedbackBanner(null);

    try {
      // Broadcast role pledge to the live WebSocket workbench room immediately
      const roomId = `job-${selectedCard.referenceCode.toLowerCase()}`;
      if (collab.activeRoomId !== roomId) {
        collab.joinRoom(
          roomId,
          `${selectedCard.referenceCode} · ${selectedCard.jobTitle}`
        );
      }
      collab.addStep(`[${collabRole}] ${cleanNote.slice(0, 95)}`, cleanHandle);
      collab.sendChatMessage(
        `Joined ${selectedCard.referenceCode} as ${collabRole} (${preferredStation}): ${cleanNote}`
      );

      const canWriteCloud = Boolean(
        currentUser &&
          currentUser.emailVerified &&
          VALID_DOC_ID_REGEX.test(currentUser.uid)
      );

      const localEntry: JobCentreCollaboratorRecord = {
        id: currentUser?.uid || collab.clientId || `local_${Date.now()}`,
        vacancyId: selectedCard.id,
        memberId: currentUser?.uid || collab.clientId,
        memberName: cleanHandle,
        collabRole,
        pledgeNote: cleanNote.slice(0, JOB_PLEDGE_MAX),
        preferredStation,
        status: 'active',
        updatedAtMs: Date.now(),
        source: canWriteCloud ? 'cloud' : 'local',
      };

      const nextLocal = [
        ...localPledges.filter(
          (p) =>
            !(
              p.vacancyId === selectedCard.id &&
              p.memberId === localEntry.memberId
            )
        ),
        localEntry,
      ];
      setLocalPledges(nextLocal);
      saveLocalPledges(nextLocal);

      if (canWriteCloud && currentUser) {
        try {
          const profileReady = await ensurePublicProfileExists(
            currentUser,
            cleanHandle
          );

          if (profileReady) {
            // Ensure parent vacancy document exists in Firestore before writing to collaborators subcollection
            const parentRef = doc(db, 'jobCentreVacancies', selectedCard.id);
            const { snap: parentSnap, timedOut: parentTimedOut } =
              await getDocWithTimeout(parentRef);
            if (!parentTimedOut) {
              if (!parentSnap || !parentSnap.exists()) {
                const preservedCreatorName =
                  selectedCard.creatorName.trim().length >= 2
                    ? selectedCard.creatorName.trim().slice(0, 40)
                    : cleanHandle;
                await withCloudWriteTimeout(
                  setDoc(parentRef, {
                    referenceCode: selectedCard.referenceCode,
                    jobTitle: selectedCard.jobTitle,
                    tradeCategory: selectedCard.tradeCategory,
                    locationZone: selectedCard.locationZone,
                    pacingStyle: selectedCard.pacingStyle,
                    cardSummary: selectedCard.cardSummary,
                    keySteps: selectedCard.keySteps,
                    collaborationMode: selectedCard.collaborationMode,
                    collaborationOpen: true,
                    rewardTokens: Math.min(
                      15,
                      Math.max(1, Math.round(selectedCard.rewardTokens))
                    ),
                    creatorId: currentUser.uid,
                    creatorName: preservedCreatorName,
                    status: 'open',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  })
                );
              }

              const collabRef = doc(
                db,
                'jobCentreVacancies',
                selectedCard.id,
                'collaborators',
                currentUser.uid
              );
              const { snap: existingCollab, timedOut: collabTimedOut } =
                await getDocWithTimeout(collabRef);
              if (!collabTimedOut) {
                if (!existingCollab || !existingCollab.exists()) {
                  await withCloudWriteTimeout(
                    setDoc(collabRef, {
                      vacancyId: selectedCard.id,
                      memberId: currentUser.uid,
                      memberName: cleanHandle,
                      collabRole,
                      pledgeNote: cleanNote.slice(0, JOB_PLEDGE_MAX),
                      preferredStation,
                      status: 'active',
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    })
                  );
                } else {
                  await withCloudWriteTimeout(
                    updateDoc(collabRef, {
                      memberName: cleanHandle,
                      collabRole,
                      pledgeNote: cleanNote.slice(0, JOB_PLEDGE_MAX),
                      preferredStation,
                      status: 'active',
                      updatedAt: serverTimestamp(),
                    })
                  );
                }
              }
            }
          }
        } catch (err) {
          if (
            !isQuotaExceededError(err) &&
            !isTransientOfflineOrTokenError(err)
          ) {
            handleFirestoreError(
              err,
              OperationType.WRITE,
              `jobCentreVacancies/${selectedCard.id}/collaborators/${currentUser.uid}`
            );
          }
        }
      }

      soundEngine.unlock();
      soundEngine.playTokenCollect();
      setFeedbackBanner(
        `Added your ${collabRole} pledge to ${selectedCard.referenceCode} and synced a shared checklist step!`
      );
    } finally {
      setBusySubmit(false);
    }
  };

  const handlePinNewVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    const summary = newSummary.trim();
    const steps = newSteps.trim();

    if (title.length < JOB_TITLE_MIN) {
      setFeedbackBanner(
        `Job Title needs at least ${JOB_TITLE_MIN} characters.`
      );
      return;
    }
    if (summary.length < JOB_SUMMARY_MIN) {
      setFeedbackBanner(
        `Card Summary needs at least ${JOB_SUMMARY_MIN} characters so people know what the job involves.`
      );
      return;
    }
    if (steps.length < JOB_STEPS_MIN) {
      setFeedbackBanner(
        `Key Steps need at least ${JOB_STEPS_MIN} characters.`
      );
      return;
    }

    setBusySubmit(true);
    setFeedbackBanner(null);

    const maxExistingNum = allCards.reduce((maxNum, c) => {
      const m = /^JC-(\d+)/i.exec(c.referenceCode.trim());
      if (!m) return maxNum;
      const parsed = Number.parseInt(m[1], 10);
      return Number.isFinite(parsed) ? Math.max(maxNum, parsed) : maxNum;
    }, 106);
    const nextNum = maxExistingNum + 1;
    const referenceCode = `JC-${String(nextNum).padStart(3, '0')}`;
    const docId = `jc_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const creatorName =
      (handleInput.trim().length >= 2
        ? handleInput.trim()
        : collab.displayName
      ).slice(0, 40) || 'Sanctuary Maker';

    const canWriteCloud = Boolean(
      currentUser &&
        currentUser.emailVerified &&
        VALID_DOC_ID_REGEX.test(currentUser.uid)
    );

    const record: JobCentreVacancyRecord = {
      id: docId,
      referenceCode,
      jobTitle: title.slice(0, JOB_TITLE_MAX),
      tradeCategory: newTrade,
      locationZone: newZone,
      pacingStyle: newPacing,
      cardSummary: summary.slice(0, JOB_SUMMARY_MAX),
      keySteps: steps.slice(0, JOB_STEPS_MAX),
      collaborationMode: newCollabMode,
      collaborationOpen: true,
      rewardTokens: Math.min(15, Math.max(1, Math.round(newRewardTokens))),
      creatorId: currentUser?.uid || collab.clientId,
      creatorName,
      status: 'open',
      createdAtMs: Date.now(),
      source: canWriteCloud ? 'cloud' : 'local',
    };

    try {
      const updatedLocal = [...localVacancies, record];
      setLocalVacancies(updatedLocal);
      saveLocalVacancies(updatedLocal);

      if (canWriteCloud && currentUser) {
        try {
          const profileReady = await ensurePublicProfileExists(
            currentUser,
            creatorName
          );
          if (profileReady) {
            await withCloudWriteTimeout(
              setDoc(doc(db, 'jobCentreVacancies', docId), {
                referenceCode: record.referenceCode,
                jobTitle: record.jobTitle,
                tradeCategory: record.tradeCategory,
                locationZone: record.locationZone,
                pacingStyle: record.pacingStyle,
                cardSummary: record.cardSummary,
                keySteps: record.keySteps,
                collaborationMode: record.collaborationMode,
                collaborationOpen: true,
                rewardTokens: record.rewardTokens,
                creatorId: currentUser.uid,
                creatorName: record.creatorName,
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
        } catch (err) {
          if (
            !isQuotaExceededError(err) &&
            !isTransientOfflineOrTokenError(err)
          ) {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `jobCentreVacancies/${docId}`
            );
          }
        }
      }

      soundEngine.unlock();
      soundEngine.playCanopyDelivery(false);
      setNewTitle('');
      setNewSummary('');
      setNewSteps('');
      setSelectedCardId(docId);
      setBoardView('rack');
      setFeedbackBanner(
        `Pinned new Vacancy Card ${referenceCode} (${record.jobTitle}) to Jay's Job Centre rack!`
      );
    } finally {
      setBusySubmit(false);
    }
  };

  // Combine cloud & local collaborators for the selected card
  const cardCollaborators = useMemo(() => {
    const map = new Map<string, JobCentreCollaboratorRecord>();
    for (const lp of localPledges) {
      if (lp.vacancyId === selectedCard.id && lp.status !== 'stepped_back') {
        map.set(lp.memberId, lp);
      }
    }
    for (const cp of cloudCollaborators) {
      if (cp.vacancyId === selectedCard.id) {
        map.set(cp.memberId, cp);
      }
    }
    return Array.from(map.values());
  }, [localPledges, cloudCollaborators, selectedCard.id]);

  const nextStepStatus = (current: CollabStepStatus): CollabStepStatus => {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'done';
    return 'todo';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Jay's Job Centre — Official Notices, Drazella Sprinkes Publishing Advert & Collaboration Rack"
      className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-5 bg-black/75 pointer-events-auto"
    >
      <div className="w-full max-w-6xl max-h-[93vh] flex flex-col rounded-2xl bg-[#10281D] border-2 border-[#D4AF37] text-[#F7F4EB] shadow-2xl overflow-hidden">
        {/* Classic British Heritage Bottle-Green & Brass Enamel Signboard Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-[#0B3B24] border-b-2 border-[#D4AF37] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#FFE082]">
              <span>0m Courtyard Pavilion · Pegged Index Rack</span>
              <span>·</span>
              <span>
                {collab.connected
                  ? `Live Collab Online (${Math.max(1, collab.peers.length)})`
                  : 'Local Collab Ready'}
              </span>
            </div>
            <h2 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-[#FFFDF7]">
              JAY&apos;S JOB CENTRE · REAL NOTICES &amp; VACANCY CARDS
            </h2>
            <p className="text-xs sm:text-sm text-[#D7ECE0]">
              Featuring Jay&apos;s Beta User Researcher notice (JC-001) &amp;
              Drazella Sprinkes&apos; Easy Read + Digital Art publishing advert
              (JC-002).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleEasyReadMode}
              aria-pressed={easyReadMode}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer touch-manipulation transition-colors ${
                easyReadMode
                  ? 'bg-[#FFE082] border-[#FFFDF7] text-[#111A14]'
                  : 'bg-[#164A31] border-[#FFE082]/60 hover:border-[#FFE082] text-[#FFE082]'
              }`}
            >
              {easyReadMode
                ? '✓ Easy Read · Large Print: ON'
                : 'Easy Read · Large Print'}
            </button>

            {!currentUser && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithPopup(auth, googleProvider);
                  } catch {
                    // User closed popup
                  }
                }}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#164A31] border border-[#7CE0A3]/60 hover:border-[#7CE0A3] text-xs font-semibold text-[#A7F3D0] cursor-pointer touch-manipulation"
              >
                Sign In for Cloud Sync
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-1.5 rounded-xl bg-[#241810] border border-[#FFE082]/70 hover:bg-[#332216] text-[#FFE082] text-xs sm:text-sm font-bold cursor-pointer touch-manipulation"
            >
              Close Board ✕
            </button>
          </div>
        </div>

        {/* Mode Switcher Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#133223] border-b border-white/15 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBoardView('rack')}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer touch-manipulation transition-colors ${
                boardView === 'rack'
                  ? 'bg-[#F5EEDB] border-[#D4AF37] text-[#0E291C]'
                  : 'bg-[#193F2C] border-white/20 text-[#F7F4EB] hover:border-[#FFE082]'
              }`}
            >
              1. Vacancy Card Rack ({allCards.length})
            </button>
            <button
              type="button"
              onClick={() => handleOpenCollabForCard(selectedCard)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer touch-manipulation transition-colors ${
                boardView === 'collab'
                  ? 'bg-[#F5EEDB] border-[#D4AF37] text-[#0E291C]'
                  : 'bg-[#193F2C] border-white/20 text-[#F7F4EB] hover:border-[#FFE082]'
              }`}
            >
              2. Team Up &amp; Collaborate ({selectedCard.referenceCode})
            </button>
            <button
              type="button"
              onClick={() => setBoardView('pin_new')}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer touch-manipulation transition-colors ${
                boardView === 'pin_new'
                  ? 'bg-[#F5EEDB] border-[#D4AF37] text-[#0E291C]'
                  : 'bg-[#193F2C] border-white/20 text-[#F7F4EB] hover:border-[#FFE082]'
              }`}
            >
              + Pin New Job / Collab Card
            </button>
          </div>

          {activeJobSlip && (
            <div className="flex items-center gap-2 text-xs bg-[#1E4631] border border-[#7CE0A3]/60 rounded-xl px-3 py-1.5">
              <span className="font-mono font-bold text-[#FFE082]">
                Held Slip: {activeJobSlip.referenceCode}
              </span>
              <span className="text-[#E6F6EC] truncate max-w-[180px]">
                {activeJobSlip.jobTitle}
              </span>
              <button
                type="button"
                onClick={() => {
                  saveActiveJobSlip(null);
                  onSelectActiveJobSlip(null);
                }}
                className="min-h-[32px] px-2 text-[#FDA4AF] underline font-semibold cursor-pointer touch-manipulation"
              >
                Return Slip
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto mobile-touch-scroll p-4 sm:p-5 space-y-4 bg-[#17281F]">
          {feedbackBanner && (
            <div className="rounded-xl bg-[#1E3B2B] border border-[#7CE0A3] px-4 py-3 text-xs sm:text-sm text-[#F1FBF4]">
              {feedbackBanner}
            </div>
          )}

          {/* VIEW 1: HERITAGE PEGGED INDEX-CARD DISPLAY RACK */}
          {boardView === 'rack' && (
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All Display Cards' },
                      {
                        id: 'featured_real',
                        label: 'Featured Real Notices (3)',
                      },
                      { id: 'ground', label: '0m Courtyard Jobs' },
                      { id: 'canopy', label: '33m Canopy & Mezzanine Jobs' },
                      { id: 'collab_open', label: 'Open for Collaboration' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setZoneFilter(f.id)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer touch-manipulation ${
                        zoneFilter === f.id
                          ? 'bg-[#D4AF37] border-[#FFE082] text-[#141008]'
                          : 'bg-[#1D3528] border-white/15 text-[#D8EAE0] hover:border-[#D4AF37]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#C6DDD0]">
                  JC-001 Beta Researcher · JC-002 Drazella Sprinkes Easy Read ·
                  JC-003 Bank of Treetop Unpaid Exchequer (Not a Real Bank).
                </span>
              </div>

              {/* Physical Index Card Grid */}
              <div
                className={`grid grid-cols-1 ${
                  easyReadMode
                    ? 'lg:grid-cols-2 gap-5'
                    : 'md:grid-cols-2 lg:grid-cols-3 gap-4'
                }`}
              >
                {filteredCards.map((card, idx) => {
                  const isHeld = activeJobSlip?.id === card.id;
                  const isJaysBetaNotice =
                    card.id === JAY_BETA_RESEARCHER_CARD_ID;
                  const isDrazellaAdvert =
                    card.id === DRAZELLA_SPRINKES_CARD_ID;
                  const isBankExchequerCard =
                    card.id === BANK_EXCHEQUER_CARD_ID;
                  const isFeaturedNotice =
                    isJaysBetaNotice ||
                    isDrazellaAdvert ||
                    isBankExchequerCard;
                  const parsedSteps = splitEasyReadSteps(card.keySteps);

                  const paperTint = isJaysBetaNotice
                    ? 'bg-[#FFFDF3]'
                    : isDrazellaAdvert
                      ? 'bg-[#F3FBF6]'
                      : isBankExchequerCard
                        ? 'bg-[#FFF9E8]'
                        : idx % 2 === 0
                          ? 'bg-[#FAF5E6]'
                          : 'bg-[#EAF5EC]';

                  const borderTint = isHeld
                    ? 'border-[#D97706]'
                    : isFeaturedNotice
                      ? 'border-[#D4AF37]'
                      : 'border-[#B8A98A]';

                  return (
                    <article
                      key={card.id}
                      className={`relative rounded-xl ${paperTint} text-[#14231A] border-2 ${borderTint} shadow-lg flex flex-col justify-between overflow-hidden ${
                        isFeaturedNotice && !easyReadMode
                          ? 'md:col-span-1 lg:col-span-1'
                          : ''
                      }`}
                    >
                      {/* Top Brass Peg Hole & Official Job Centre Header Strip */}
                      <div
                        className={`px-4 py-2.5 ${
                          isDrazellaAdvert
                            ? 'bg-[#143828]'
                            : isBankExchequerCard
                              ? 'bg-[#1E2E1C]'
                              : isJaysBetaNotice
                                ? 'bg-[#093822]'
                                : 'bg-[#0E4429]'
                        } text-[#FFFDF7] border-b-2 border-[#D4AF37] space-y-1`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold tracking-wider text-[#FFE082]">
                            {isJaysBetaNotice
                              ? `OFFICIAL NOTICE · ${card.referenceCode}`
                              : isDrazellaAdvert
                                ? `PUBLISHING ADVERT · ${card.referenceCode}`
                                : isBankExchequerCard
                                  ? `UNPAID CLUB ROLE · ${card.referenceCode}`
                                  : `VACANCY REF: ${card.referenceCode}`}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#A7F3D0]">
                            {isBankExchequerCard
                              ? `Unpaid · +${card.rewardTokens} Club Tokens`
                              : `+${card.rewardTokens} Tokens`}
                          </span>
                        </div>
                        {isJaysBetaNotice && (
                          <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#A7F3D0]">
                            JAY&apos;S JOB CENTRE · LIVE BETA USER RESEARCH CALL
                          </div>
                        )}
                        {isDrazellaAdvert && (
                          <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#FFE082]">
                            DRAZELLA SPRINKES · YOUTH DEVELOPMENT PUBLISHING
                          </div>
                        )}
                        {isBankExchequerCard && (
                          <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#FFE082]">
                            OPEN TO ANY MEMBER OF JAY&apos;S JOB CLUB · NOT A REAL BANK
                          </div>
                        )}
                      </div>

                      {/* Typed Index Card Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2.5">
                          <h3
                            className={`${
                              easyReadMode
                                ? 'text-lg sm:text-xl'
                                : 'text-base sm:text-lg'
                            } font-bold leading-snug text-[#0D2116]`}
                          >
                            {card.jobTitle}
                          </h3>

                          <div
                            className={`${
                              easyReadMode ? 'text-xs sm:text-sm' : 'text-xs'
                            } font-semibold text-[#1E4B33] space-y-0.5 border-y border-[#14231A]/15 py-2`}
                          >
                            <div>
                              <span className="font-mono uppercase text-[#4A5D52]">
                                {isDrazellaAdvert
                                  ? 'ADVERTISER: '
                                  : 'POSTED BY: '}
                              </span>
                              <span className="font-bold text-[#0B2E1C]">
                                {card.creatorName}
                              </span>
                            </div>
                            <div>
                              <span className="font-mono uppercase text-[#4A5D52]">
                                WHERE:{' '}
                              </span>
                              {card.locationZone}
                            </div>
                            <div>
                              <span className="font-mono uppercase text-[#4A5D52]">
                                PACING:{' '}
                              </span>
                              {card.pacingStyle} · {card.collaborationMode}
                            </div>
                          </div>

                          {isJaysBetaNotice && (
                            <div className="text-xs font-bold text-[#0F3D24]">
                              TESTING FOCUS: Easy Read Slips · Lift Speeds · 33m
                              Safe Chill Pods · Carer &amp; Mobile Comfort
                            </div>
                          )}

                          {isDrazellaAdvert && (
                            <div className="text-xs font-bold text-[#0F3D24]">
                              READERS SERVED: Visually Impaired · Seniors ·
                              Speakers of Other Languages · Digital Art First
                            </div>
                          )}

                          {isBankExchequerCard && (
                            <div className="rounded-lg bg-[#2B1D0E] text-[#FFFBEB] border border-[#D4AF37] px-3 py-2 text-xs space-y-0.5">
                              <div className="font-bold text-[#FFE082]">
                                Disclaimer: Bank of Treetop Is NOT a Real Bank
                              </div>
                              <div>
                                Zero real money or deposits. Unpaid volunteer
                                role open to any member of Jay&apos;s Job Club
                                using symbolic practice tokens only.
                              </div>
                            </div>
                          )}

                          <p
                            className={`${
                              easyReadMode
                                ? 'text-sm sm:text-base leading-relaxed'
                                : 'text-xs sm:text-sm leading-relaxed'
                            } text-[#1A2920]`}
                          >
                            {card.cardSummary}
                          </p>

                          <div className="rounded-lg bg-black/5 px-3 py-2.5 text-[#1E3226]">
                            <div
                              className={`${
                                easyReadMode ? 'text-xs sm:text-sm' : 'text-xs'
                              } font-bold text-[#0E3620] mb-1`}
                            >
                              Step-by-Step Duties (One Clear Idea at a Time):
                            </div>
                            {easyReadMode || isFeaturedNotice ? (
                              <ul
                                className={`space-y-1 ${
                                  easyReadMode
                                    ? 'text-xs sm:text-sm'
                                    : 'text-xs'
                                } font-medium`}
                              >
                                {parsedSteps.map((st, sIdx) => (
                                  <li key={sIdx} className="leading-snug">
                                    {st}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs">{card.keySteps}</div>
                            )}
                          </div>

                          {/* Interactive Specimen Toggle on Drazella Sprinkes' Publishing Advert */}
                          {isDrazellaAdvert && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setDrazellaSpecimenOpen((prev) => !prev)
                                }
                                aria-expanded={drazellaSpecimenOpen}
                                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#143828] hover:bg-[#1B4B36] border border-[#D4AF37] text-[#FFE082] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation transition-colors"
                              >
                                {drazellaSpecimenOpen
                                  ? 'Hide Easy Read + Digital Art Specimen ▲'
                                  : 'Preview Easy Read + Digital Art Specimen ▼'}
                              </button>
                              {drazellaSpecimenOpen && (
                                <DrazellaDigitalArtSpecimen
                                  easyRead={easyReadMode}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 space-y-2">
                          {isJaysBetaNotice && onOpenBetaResearch && (
                            <button
                              type="button"
                              onClick={() =>
                                handleLaunchBetaResearchNotice(card)
                              }
                              className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#143828] hover:bg-[#1B4B36] border border-[#D4AF37] text-[#FFE082] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation transition-colors"
                            >
                              Open UX Beta Research Form →
                            </button>
                          )}
                          {isBankExchequerCard && onOpenBankOfTreetop && (
                            <button
                              type="button"
                              onClick={() => onOpenBankOfTreetop('savings')}
                              className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#1E2E1C] hover:bg-[#273D24] border border-[#D4AF37] text-[#FFE082] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation transition-colors"
                            >
                              How to Save Up for Special-Interest Stock →
                            </button>
                          )}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              onClick={() => handleChooseJobAndGo(card)}
                              className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#0E4429] hover:bg-[#145C38] text-[#FFFDF7] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation transition-colors"
                            >
                              {isHeld
                                ? '✓ Chosen · Go to Station'
                                : isDrazellaAdvert
                                  ? 'Choose & Open Easy Read Book'
                                  : isBankExchequerCard
                                    ? 'Volunteer as Unpaid Exchequer'
                                    : 'Choose Job & Go'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCollabForCard(card)}
                              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#E5A93C] hover:bg-[#F3BD56] text-[#181009] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation transition-colors"
                            >
                              Collaborate
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: COLLABORATION & LIVE MULTI-USER TEAM-UP DRAWER */}
          {boardView === 'collab' && selectedCard && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Card Summary + Role Pledge Form + Roster */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-xl bg-[#FAF5E6] text-[#14231A] border-2 border-[#D4AF37] p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#0E4429]">
                      {selectedCard.referenceCode} · {selectedCard.creatorName}{' '}
                      · {selectedCard.locationZone}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleChooseJobAndGo(selectedCard)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0E4429] text-[#FFFDF7] text-xs font-bold cursor-pointer touch-manipulation"
                    >
                      Take Job Slip &amp; Go
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-[#0D2116]">
                    {selectedCard.jobTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#24382C]">
                    {selectedCard.cardSummary}
                  </p>
                  <p className="text-xs font-medium text-[#1E4B33]">
                    {selectedCard.keySteps}
                  </p>

                  {selectedCard.id === DRAZELLA_SPRINKES_CARD_ID && (
                    <div className="pt-2">
                      <DrazellaDigitalArtSpecimen easyRead={easyReadMode} />
                    </div>
                  )}
                </div>

                {/* Pledge a Specific Collaborator Role */}
                <form
                  onSubmit={handlePledgeCollaborationRole}
                  className="rounded-xl bg-[#1A3125] border border-white/15 p-4 space-y-3"
                >
                  <h4 className="text-sm sm:text-base font-bold text-[#FFE082]">
                    Pledge Your Role on {selectedCard.referenceCode}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block text-xs text-[#D5E8DC]">
                      Your Maker Name
                      <input
                        type="text"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value)}
                        maxLength={32}
                        className="mt-1 w-full rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                      />
                    </label>
                    <label className="block text-xs text-[#D5E8DC]">
                      Collaborator Role
                      <select
                        value={collabRole}
                        onChange={(e) =>
                          setCollabRole(e.target.value as JobCollaboratorRole)
                        }
                        className="mt-1 w-full rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                      >
                        {JOB_COLLAB_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-xs text-[#D5E8DC]">
                    Preferred Station / Pacing
                    <select
                      value={preferredStation}
                      onChange={(e) =>
                        setPreferredStation(
                          e.target.value as JobCollaboratorStation
                        )
                      }
                      className="mt-1 w-full rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                    >
                      {JOB_COLLAB_STATIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs text-[#D5E8DC]">
                    How You&apos;d Like to Contribute
                    <textarea
                      rows={2}
                      value={pledgeNote}
                      onChange={(e) => setPledgeNote(e.target.value)}
                      maxLength={JOB_PLEDGE_MAX}
                      className="mt-1 w-full rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-sm text-[#F7F4EB]"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busySubmit}
                    className="w-full min-h-[44px] rounded-xl bg-[#7CE0A3] hover:bg-[#9BEBB9] text-[#0D2014] font-bold text-sm cursor-pointer touch-manipulation"
                  >
                    {busySubmit
                      ? 'Saving Role Pledge...'
                      : 'Join Crew & Add Role to Card'}
                  </button>
                </form>

                {/* Collaborator Roster */}
                <div className="rounded-xl bg-[#14261D] border border-white/12 p-4 space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-[#7CE0A3]">
                    Registered Collaborators on {selectedCard.referenceCode} (
                    {cardCollaborators.length})
                  </h4>
                  {cardCollaborators.length === 0 ? (
                    <p className="text-xs text-[#BDD4C5]">
                      No one has claimed a sub-role on this card yet — pledge a
                      role above to start the crew!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cardCollaborators.map((c) => (
                        <div
                          key={c.memberId}
                          className="rounded-lg bg-[#1C3327] border border-white/10 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-[#FFE082]">
                            <span>
                              {c.memberName} · {c.collabRole}
                            </span>
                            <span className="text-[#9EE6B8]">
                              {c.preferredStation}
                            </span>
                          </div>
                          <p className="mt-1 text-[#E5F2EA]">{c.pledgeNote}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Multi-User Shared Checklist & Workbench Notes (WebSockets) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-xl bg-[#1A3125] border border-[#7CE0A3]/45 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-[#FFE082]">
                        Live Shared Task Checklist ({collab.activeRoomId})
                      </h4>
                      <p className="text-xs text-[#C9DFD1]">
                        Real-time WebSocket sync across everyone testing the
                        Beta URL. Tap any task to cycle Todo → Doing → Done.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[210px] overflow-y-auto mobile-touch-scroll pr-1">
                    {collab.roomState.steps.length === 0 ? (
                      <p className="text-xs text-[#B9D1C2]">
                        Add the first shared step below (or tap &ldquo;Join
                        Crew&rdquo; on the left).
                      </p>
                    ) : (
                      collab.roomState.steps.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[#112119] border border-white/12 px-3 py-2 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              collab.cycleStepStatus(
                                step.id,
                                nextStepStatus(step.status)
                              )
                            }
                            className="flex-1 min-h-[38px] text-left flex items-center gap-2 cursor-pointer touch-manipulation"
                          >
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded ${
                                step.status === 'done'
                                  ? 'bg-[#7CE0A3] text-[#0E2015]'
                                  : step.status === 'in_progress'
                                    ? 'bg-[#FFE082] text-[#1A1208]'
                                    : 'bg-white/15 text-[#F7F4EB]'
                              }`}
                            >
                              {step.status === 'in_progress'
                                ? 'DOING'
                                : step.status.toUpperCase()}
                            </span>
                            <span
                              className={
                                step.status === 'done'
                                  ? 'line-through text-[#9AB5A4]'
                                  : 'text-[#F7F4EB] font-medium'
                              }
                            >
                              {step.title}
                            </span>
                          </button>
                          <span className="text-[11px] text-[#9DC2AC] shrink-0">
                            {step.ownerName}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newStepText.trim().length >= 3) {
                        collab.addStep(newStepText.trim());
                        setNewStepText('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                      placeholder="Add a shared job step (e.g. Review Easy Read page 2)..."
                      maxLength={140}
                      className="flex-1 rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-xs sm:text-sm text-[#F7F4EB]"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation"
                    >
                      + Step
                    </button>
                  </form>
                </div>

                {/* Live Async / Parallel Workbench Notes */}
                <div className="rounded-xl bg-[#14261D] border border-white/15 p-4 space-y-3">
                  <h4 className="text-sm font-bold text-[#FFE082]">
                    Workbench Handover &amp; Buddy Notes
                  </h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto mobile-touch-scroll pr-1">
                    {collab.roomState.messages.length === 0 ? (
                      <p className="text-xs text-[#BDD4C5]">
                        Leave a calm written note for teammates working on{' '}
                        {selectedCard.referenceCode}.
                      </p>
                    ) : (
                      collab.roomState.messages.slice(-12).map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg bg-[#1B3126] px-3 py-2 text-xs"
                        >
                          <span className="font-bold text-[#7CE0A3]">
                            {m.senderName}:{' '}
                          </span>
                          <span className="text-[#F7F4EB]">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newChatText.trim()) {
                        collab.sendChatMessage(newChatText.trim());
                        setNewChatText('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      placeholder="Post a workbench note to teammates..."
                      maxLength={320}
                      className="flex-1 rounded-lg bg-[#102018] border border-white/20 px-3 py-2 text-xs sm:text-sm text-[#F7F4EB]"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#7CE0A3] hover:bg-[#9BEBB9] text-[#0E2015] font-bold text-xs sm:text-sm cursor-pointer touch-manipulation"
                    >
                      Post
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: PIN A NEW VACANCY / COLLABORATION CARD */}
          {boardView === 'pin_new' && (
            <form
              onSubmit={handlePinNewVacancy}
              className="max-w-2xl mx-auto rounded-2xl bg-[#FAF5E6] text-[#14231A] border-2 border-[#D4AF37] p-5 space-y-4"
            >
              <div className="border-b border-[#14231A]/15 pb-3">
                <span className="font-mono text-xs font-bold text-[#0E4429]">
                  NEW JAY&apos;S JOB CENTRE INDEX SLIP
                </span>
                <h3 className="text-lg font-bold text-[#0D2116]">
                  Pin a New Job or Collaboration Notice to the Board
                </h3>
                <p className="text-xs text-[#314A3C]">
                  Post a real workshop task, outreach helper role, or creative
                  publishing commission so community members can choose it or
                  team up.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Poster / Organisation Name
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. Drazella Sprinkes / Jay's Job Centre"
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Job Title
                  <input
                    type="text"
                    required
                    minLength={JOB_TITLE_MIN}
                    maxLength={JOB_TITLE_MAX}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Pollinator Seed-Packet Printer"
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  />
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Trade Category
                  <select
                    value={newTrade}
                    onChange={(e) =>
                      setNewTrade(e.target.value as JobVacancyTradeCategory)
                    }
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  >
                    {JOB_VACANCY_TRADES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Location Zone
                  <select
                    value={newZone}
                    onChange={(e) =>
                      setNewZone(e.target.value as JobVacancyLocationZone)
                    }
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  >
                    {JOB_VACANCY_ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Sensory Pacing Style
                  <select
                    value={newPacing}
                    onChange={(e) =>
                      setNewPacing(e.target.value as JobVacancyPacingStyle)
                    }
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  >
                    {JOB_VACANCY_PACING.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A]">
                  Collaboration Mode
                  <select
                    value={newCollabMode}
                    onChange={(e) =>
                      setNewCollabMode(e.target.value as JobCollaborationMode)
                    }
                    className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  >
                    {JOB_COLLAB_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-[#1B3B2A] sm:col-span-2">
                  Token Appreciation (1–15)
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={newRewardTokens}
                    onChange={(e) =>
                      setNewRewardTokens(Number(e.target.value) || 3)
                    }
                    className="mt-1 w-full sm:w-44 rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold text-[#1B3B2A]">
                Job Card Summary (Easy Read, Plain Description)
                <textarea
                  rows={2}
                  required
                  minLength={JOB_SUMMARY_MIN}
                  maxLength={JOB_SUMMARY_MAX}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Describe what is being made or researched and who it supports..."
                  className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                />
              </label>

              <label className="block text-xs font-bold text-[#1B3B2A]">
                Clear Step-by-Step Duties (Separate steps with · )
                <textarea
                  rows={2}
                  required
                  minLength={JOB_STEPS_MIN}
                  maxLength={JOB_STEPS_MAX}
                  value={newSteps}
                  onChange={(e) => setNewSteps(e.target.value)}
                  placeholder="1. Fold recycled kraft packets · 2. Stamp wildflower label · 3. Pack in dry cedar tray"
                  className="mt-1 w-full rounded-lg bg-white border border-[#94A89B] px-3 py-2 text-sm text-[#14231A]"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBoardView('rack')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#14231A]/30 text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busySubmit}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0E4429] hover:bg-[#145C38] text-[#FFFDF7] text-xs sm:text-sm font-bold cursor-pointer touch-manipulation"
                >
                  {busySubmit ? 'Pinning Card...' : 'Pin Vacancy Card to Board'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
