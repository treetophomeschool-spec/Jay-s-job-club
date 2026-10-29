import { signInWithPopup, User } from 'firebase/auth';
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  auth,
  ChillPodDocId,
  ChillPodStateRecord,
  ChillQuiltChoice,
  db,
  getDocWithTimeout,
  getSafeCurrentUser,
  googleProvider,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  subscribeSafeAuth,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import { CanopyInspectAngle, WellyPlushieId } from '../types/game';

export type MezzanineTab = 'pods' | 'library' | 'refreshments';

interface WellyPlushieOption {
  id: WellyPlushieId;
  label: string;
  shortLabel: string;
  detail: string;
  swatchClass: string;
}

const WELLY_PLUSHIE_TUB_OPTIONS: WellyPlushieOption[] = [
  {
    id: 'mossy_green',
    label: 'Mossy · Forest Welly Plushie',
    shortLabel: 'Mossy Welly',
    detail: 'Soft woodland fleece boot · Cream sherpa cuff',
    swatchClass: 'bg-[#2E7D4F] border-[#A7F3D0]',
  },
  {
    id: 'sunny_yellow',
    label: 'Sunny · Puddle Welly Plushie',
    shortLabel: 'Sunny Welly',
    detail: 'Cheerful sunshine boot · Warm stitched smile',
    swatchClass: 'bg-[#F4C430] border-[#FEF08A]',
  },
  {
    id: 'bramble_berry',
    label: 'Bramble · Berry Welly Plushie',
    shortLabel: 'Bramble Welly',
    detail: 'Cosy heather fleece boot · Velvet pull-loops',
    swatchClass: 'bg-[#9E4770] border-[#FBCFE8]',
  },
  {
    id: 'oatie_cream',
    label: 'Oatie · Sherpa Welly Plushie',
    shortLabel: 'Oatie Welly',
    detail: 'Gentle lap-weight sherpa boot · Honey gum sole',
    swatchClass: 'bg-[#EADBC4] border-[#FDE68A]',
  },
];

export const CHILL_POD_CATALOG: Record<
  ChillPodDocId,
  {
    podId: ChillPodDocId;
    podLabel: string;
    shortMobileLabel: string;
    locationNote: string;
  }
> = {
  pod_1: {
    podId: 'pod_1',
    podLabel: 'Cedar Pod 01 · West Eaves',
    shortMobileLabel: 'Pod 01 · West',
    locationNote: 'Quiet far-west timber alcove beside the Mezzanine Library',
  },
  pod_2: {
    podId: 'pod_2',
    podLabel: 'Cedar Pod 02 · Inner Bough',
    shortMobileLabel: 'Pod 02 · Inner',
    locationNote: 'Sheltered north-west pod nestled against the Agarwood trunk',
  },
  pod_3: {
    podId: 'pod_3',
    podLabel: 'Cedar Pod 03 · Heartwood',
    shortMobileLabel: 'Pod 03 · Heart',
    locationNote: 'Warm north-east pod overlooking the Canopy rafters',
  },
  pod_4: {
    podId: 'pod_4',
    podLabel: 'Cedar Pod 04 · East Eaves',
    shortMobileLabel: 'Pod 04 · East',
    locationNote: 'Breezy far-east pod closest to the Herbal Refreshments Bar',
  },
};

const ALL_POD_IDS: ChillPodDocId[] = ['pod_1', 'pod_2', 'pod_3', 'pod_4'];

interface LibraryBook {
  id: string;
  shelfCode: string;
  title: string;
  subtitle: string;
  readingMinutes: string;
  chapters: { heading: string; body: string }[];
}

const MEZZANINE_LIBRARY_BOOKS: LibraryBook[] = [
  {
    id: 'drazella-sprinkes-easy-read-neurobiology',
    shelfCode: 'LIB-00',
    title:
      'Drazella Sprinkes: Neurobiology in Easy Read & Digital Art',
    subtitle:
      'Youth Development Publishing edition for visually impaired readers, seniors & speakers of other languages',
    readingMinutes: '3 min Easy Read',
    chapters: [
      {
        heading: '1. One Clear Idea + Bold Digital Art',
        body: 'Each page pairs high-contrast digital art with one short, calm sentence. Visually impaired readers, seniors, and multilingual learners can follow how the brain and body communicate without dense jargon.',
      },
      {
        heading: '2. Brain, Heart & Vagus Safety Cues',
        body: 'When a room feels predictable, step-free, and welcoming, your brain sends steady signals down the vagus nerve so your shoulders drop, your breathing slows, and thinking feels easier.',
      },
      {
        heading: '3. Sensory Energy & Welcoming Rest',
        body: 'Glare, rushing, or noisy crowds spend extra brain energy. Dimming lights, holding a soft Welly plushie, sipping warm herbal tea, or resting in a Safe Chill Pod helps your nervous system recharge.',
      },
    ],
  },
  {
    id: 'monotropism-pacing',
    shelfCode: 'LIB-01',
    title: 'Different, Not Less: Special Interests Into Real Work',
    subtitle: 'Practical handbook on turning deep focus into sustainable trades',
    readingMinutes: '3 min calm read',
    chapters: [
      {
        heading: '1. Deep Focus Is an Artisan Strength',
        body: 'In traditional workplaces, rapid task-switching is often mistaken for productivity. In craft, repair, joinery, botanical distillation, and systems organisation, steady single-focus attention produces the highest quality work.',
      },
      {
        heading: '2. Pacing Without Burnout',
        body: 'Alternate focused bench intervals at the 33m Canopy with genuine sensory recovery up here on the Mezzanine. Stepping into a Private Chill Pod before overwhelm builds keeps your energy steady all week.',
      },
      {
        heading: '3. Choosing Jobs That Fit Your Nervous System',
        body: 'Downstairs at the 0m Old-Style Job Centre, every vacancy slip states its Pacing Style — Solo, Paired Quiet Bench, or Small Collab Crew — so you know the sensory environment before you begin.',
      },
    ],
  },
  {
    id: 'cedar-joinery-primer',
    shelfCode: 'LIB-02',
    title: 'Unhurried Cedar & Oak Joinery Field Guide',
    subtitle: 'Marking gauges, hand planes, and non-slip workshop layout',
    readingMinutes: '4 min practical guide',
    chapters: [
      {
        heading: '1. Measure Twice with Calm Hands',
        body: 'Set your brass marking gauge under warm, glare-free bench light. Score across the grain lightly on the first pass, then deepen the shoulder line so your chisel drops naturally into the groove.',
      },
      {
        heading: '2. Reading Timber Grain Direction',
        body: 'Look along the edge of the board before planing. Plane uphill with the rising grain fibres so the cedar shavings curl cleanly without tear-out or chatter.',
      },
    ],
  },
  {
    id: 'agarwood-distillation',
    shelfCode: 'LIB-03',
    title: 'Resinous Heartwood & Botanical Hydro-Distillation',
    subtitle: 'Small-batch essential oil craft, batch labelling & fair trade',
    readingMinutes: '3 min craft notes',
    chapters: [
      {
        heading: '1. Sustainable Fallen-Bough Harvesting',
        body: 'Only naturally resinous, storm-pruned boughs and workshop offcuts are soaked for hydro-distillation. Slow, low-temperature copper still condensation preserves warm woody notes.',
      },
      {
        heading: '2. Amber Glass & Honest Batch Cards',
        body: 'Every vial sold at the Canopy PayPal Store carries a clear origin note, millimetre volume, and maker credit so community buyers know whose hands crafted their bottle.',
      },
    ],
  },
  {
    id: 'job-centre-collab-etiquette',
    shelfCode: 'LIB-04',
    title: 'Co-Op Workbench Collaboration Without Small-Talk Pressure',
    subtitle: 'How parallel makers team up on Job Centre cards',
    readingMinutes: '2 min team guide',
    chapters: [
      {
        heading: '1. Clear Roles, Zero Guessing',
        body: 'When teaming up on a Job Centre Vacancy Card, pick a specific role — Lead Maker, Co-Maker Buddy, Quiet Prep & Sorting, Finishing & Labelling, or Outreach Helper — so everyone knows their exact part.',
      },
      {
        heading: '2. Written Checklists Welcome',
        body: 'Use the shared live checklist on any Job Card to tick off steps asynchronously or side-by-side. Spoken chat is never required to be a valued collaborator.',
      },
    ],
  },
  {
    id: 'bank-of-treetop-stock-guide',
    shelfCode: 'LIB-05',
    title:
      'Bank of Treetop: Saving Up for Special-Interest Stock (Not a Real Bank)',
    subtitle:
      "Symbolic token guide & Unpaid Exchequer role for Jay's Job Club members",
    readingMinutes: '3 min Easy Read',
    chapters: [
      {
        heading: '1. Important Disclaimer: Not a Real Bank',
        body: "The Bank of Treetop is an educational practice counter inside Jay's Job Club — NOT a real bank or financial institution. It holds zero real money, deposits, or legal tender, and all tokens have zero cash value.",
      },
      {
        heading: '2. How to Save Up for Special-Interest Stock',
        body: "Earn Trying & Gathering Tokens at the 0m Entry Kiosk, Daily Habits bar, and Jay's Job Centre, plus Treehouse Tokens (+2 pot units) on 33m Canopy checklists. Set units aside in your Special-Interest Stock Pot until you hit 6–8 units to unlock starter craft stock.",
      },
      {
        heading: '3. Unpaid Exchequer Role (Ref JC-003)',
        body: "Any member of Jay's Job Club can volunteer in the unpaid Exchequer role (JC-003) to check the Not-a-Real-Bank disclaimer is clear and help fellow makers plan calm stock goals.",
      },
    ],
  },
];

interface RefreshmentOption {
  id: string;
  title: string;
  servingVessel: string;
  sensoryNote: string;
}

const REFRESHMENT_MENU: RefreshmentOption[] = [
  {
    id: 'chamomile-balm',
    title: 'Warm Chamomile & Lemon Balm Urn Tea',
    servingVessel: 'Stoneware Mug · Caffeine-Free',
    sensoryNote:
      'Gentle floral warmth from the copper urn; settles shoulders and restores Poise to 100%.',
  },
  {
    id: 'spring-water',
    title: 'Chilled Woodland Spring Water & Mint',
    servingVessel: 'Thick Glass Tumbler · Cool & Crisp',
    sensoryNote:
      'Clean, unscented hydration after focused bench work; refreshes alertness.',
  },
  {
    id: 'spiced-rooibos',
    title: 'Cinnamon & Vanilla Redbush Brew',
    servingVessel: 'Enamel Camp Cup · Naturally Sweet',
    sensoryNote:
      'Rich amber infusion with zero bitterness; pairs well with quiet reading.',
  },
  {
    id: 'oat-flapjack',
    title: 'Toasted Seed & Honey Oat Flapjack',
    servingVessel: 'Cedar Tray Slice · Steady Slow Energy',
    sensoryNote:
      'Soft-baked oats, pumpkin seeds, and local heather honey for grounded energy.',
  },
];

type PodSensoryPatch = Partial<
  Pick<
    ChillPodStateRecord,
    | 'fanEnabled'
    | 'heaterEnabled'
    | 'lightsOffCalm'
    | 'flotationEnabled'
    | 'quiltType'
  >
>;

interface TreetopMezzanineModalProps {
  isOpen: boolean;
  initialTab: MezzanineTab;
  initialPodId?: ChillPodDocId | null;
  podsById: Record<ChillPodDocId, ChillPodStateRecord>;
  localClientKey: string;
  poisePercent: number;
  calmScreenDimEnabled: boolean;
  selectedWellyPlushie: WellyPlushieId | null;
  highContrastFloor: boolean;
  onToggleCalmScreenDim: (enabled: boolean) => void;
  onSelectWellyPlushie: (plushie: WellyPlushieId | null) => void;
  onToggleHighContrastFloor: (enabled: boolean) => void;
  onUpdateLocalPod: (pod: ChillPodStateRecord) => void;
  onFocusMezzanineAngle: (
    angle: CanopyInspectAngle,
    podId?: ChillPodDocId
  ) => void;
  onEnjoyRefreshment: (label: string) => void;
  onClose: () => void;
}

export const TreetopMezzanineModal: React.FC<TreetopMezzanineModalProps> = ({
  isOpen,
  initialTab,
  initialPodId,
  podsById,
  localClientKey,
  poisePercent,
  calmScreenDimEnabled,
  selectedWellyPlushie,
  highContrastFloor,
  onToggleCalmScreenDim,
  onSelectWellyPlushie,
  onToggleHighContrastFloor,
  onUpdateLocalPod,
  onFocusMezzanineAngle,
  onEnjoyRefreshment,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MezzanineTab>(initialTab);
  const [selectedPodId, setSelectedPodId] = useState<ChillPodDocId>(
    initialPodId || 'pod_1'
  );
  const [selectedBookId, setSelectedBookId] = useState<string>(
    MEZZANINE_LIBRARY_BOOKS[0].id
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyPodAction, setBusyPodAction] = useState<boolean>(false);
  // On mobile phones (< 640px), default to 3D Peek height (64dvh) so the top 36% of the screen displays the live 3D Cedar Chill Pod
  const [mobileSheetExpanded, setMobileSheetExpanded] =
    useState<boolean>(false);
  const [audioMuted, setAudioMuted] = useState<boolean>(() =>
    soundEngine.isMuted()
  );
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    return subscribeSafeAuth((u) => setCurrentUser(u));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    if (initialPodId) {
      setSelectedPodId(initialPodId);
    }
    setAudioMuted(soundEngine.isMuted());
  }, [isOpen, initialTab, initialPodId]);

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          soundEngine.playSanctuaryRest();
          setStatusMessage(
            'Gentle rest interval complete — stay inside your Private Chill Pod as long as you wish, or step out when ready.'
          );
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [restSecondsLeft]);

  if (!isOpen) return null;

  const canSyncCloud = Boolean(
    currentUser &&
      currentUser.emailVerified &&
      VALID_DOC_ID_REGEX.test(currentUser.uid)
  );

  const actorId =
    currentUser && VALID_DOC_ID_REGEX.test(currentUser.uid)
      ? currentUser.uid
      : localClientKey;
  const rawActorName =
    currentUser?.displayName?.trim().slice(0, 40) || 'Sanctuary Member';
  const safeActorName =
    rawActorName.length >= 2 ? rawActorName : 'Sanctuary Member';

  const STALE_POD_MS = 2 * 60 * 60 * 1000;
  const isPodStale = (pod?: ChillPodStateRecord): boolean =>
    Boolean(
      pod &&
        pod.occupancyStatus === 'occupied' &&
        pod.updatedAtMs > 0 &&
        Date.now() - pod.updatedAtMs > STALE_POD_MS
    );

  // Strictly 1 pod per person
  const myOccupiedPod: ChillPodStateRecord | null =
    ALL_POD_IDS.map((id) => podsById[id]).find(
      (p) => p && p.occupancyStatus === 'occupied' && p.occupantId === actorId
    ) || null;

  const inspectedPod: ChillPodStateRecord = podsById[selectedPodId] || {
    podId: selectedPodId,
    podLabel: CHILL_POD_CATALOG[selectedPodId].podLabel,
    occupantId: '',
    occupantName: '',
    occupancyStatus: 'vacant',
    fanEnabled: false,
    heaterEnabled: false,
    lightsOffCalm: false,
    flotationEnabled: false,
    quiltType: 'none',
    updatedAtMs: Date.now(),
    source: 'local',
  };

  const isInspectedPodMine =
    inspectedPod.occupancyStatus === 'occupied' &&
    inspectedPod.occupantId === actorId;
  const isInspectedPodOther =
    inspectedPod.occupancyStatus === 'occupied' &&
    inspectedPod.occupantId !== '' &&
    inspectedPod.occupantId !== actorId &&
    !isPodStale(inspectedPod);

  const nextVacantPodId: ChillPodDocId | null =
    ALL_POD_IDS.find((id) => {
      const p = podsById[id];
      return (
        !p ||
        p.occupancyStatus === 'vacant' ||
        p.occupantId === actorId ||
        isPodStale(p)
      );
    }) || null;

  // Unified Firestore sync matching /firestore.rules chillPodOccupancy schema & transitions cleanly
  const syncPodOccupiedToCloud = async (record: ChillPodStateRecord) => {
    if (!canSyncCloud || !currentUser) return;
    const safeFan = Boolean(record.fanEnabled);
    const safeHeater = safeFan ? false : Boolean(record.heaterEnabled);
    const safeCalm = Boolean(record.lightsOffCalm);
    const safeFloat = Boolean(record.flotationEnabled);
    const safeQuilt: ChillQuiltChoice =
      record.quiltType === 'vegan' ||
      record.quiltType === 'natural_duck_feather'
        ? record.quiltType
        : 'none';
    const podLabel = CHILL_POD_CATALOG[record.podId].podLabel;

    const ref = doc(db, 'chillPodOccupancy', record.podId);
    try {
      const { snap, timedOut } = await getDocWithTimeout(ref);
      if (timedOut) return;

      if (!snap || !snap.exists()) {
        await withCloudWriteTimeout(
          setDoc(ref, {
            podId: record.podId,
            podLabel,
            occupantId: currentUser.uid,
            occupantName: safeActorName,
            occupancyStatus: 'occupied',
            fanEnabled: safeFan,
            heaterEnabled: safeHeater,
            lightsOffCalm: safeCalm,
            flotationEnabled: safeFloat,
            quiltType: safeQuilt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        return;
      }

      const cloudData = snap.data();
      const cloudUpdatedMs =
        cloudData?.updatedAt instanceof Timestamp
          ? cloudData.updatedAt.toMillis()
          : 0;
      const cloudIsStale =
        cloudUpdatedMs > 0 &&
        Date.now() - cloudUpdatedMs > STALE_POD_MS + 10_000;

      if (cloudData?.occupancyStatus === 'vacant' || cloudIsStale) {
        // Action 1 in firestore.rules: Claiming a vacant or stale (>2h) pod
        await withCloudWriteTimeout(
          updateDoc(ref, {
            podLabel,
            occupantId: currentUser.uid,
            occupantName: safeActorName,
            occupancyStatus: 'occupied',
            fanEnabled: safeFan,
            heaterEnabled: safeHeater,
            lightsOffCalm: safeCalm,
            flotationEnabled: safeFloat,
            quiltType: safeQuilt,
            updatedAt: serverTimestamp(),
          })
        );
      } else if (
        cloudData?.occupancyStatus === 'occupied' &&
        cloudData?.occupantId === currentUser.uid
      ) {
        // Action 2 in firestore.rules: Updating sensory settings inside own occupied pod
        await withCloudWriteTimeout(
          updateDoc(ref, {
            occupantName: safeActorName,
            fanEnabled: safeFan,
            heaterEnabled: safeHeater,
            lightsOffCalm: safeCalm,
            flotationEnabled: safeFloat,
            quiltType: safeQuilt,
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch (err) {
      if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
        return;
      }
      // Keep local pod session uninterrupted on mobile even if cloud sync hits a network drop
    }
  };

  const vacatePodInternal = async (podToVacate: ChillPodStateRecord) => {
    const vacatedLocal: ChillPodStateRecord = {
      ...podToVacate,
      occupantId: '',
      occupantName: '',
      occupancyStatus: 'vacant',
      fanEnabled: false,
      heaterEnabled: false,
      lightsOffCalm: false,
      flotationEnabled: false,
      quiltType: 'none',
      updatedAtMs: Date.now(),
    };
    onUpdateLocalPod(vacatedLocal);

    if (!canSyncCloud || !currentUser) return;
    const ref = doc(db, 'chillPodOccupancy', podToVacate.podId);
    try {
      const { snap, timedOut } = await getDocWithTimeout(ref);
      if (
        !timedOut &&
        snap &&
        snap.exists() &&
        snap.data()?.occupancyStatus === 'occupied' &&
        snap.data()?.occupantId === currentUser.uid
      ) {
        await withCloudWriteTimeout(
          updateDoc(ref, {
            occupantId: '',
            occupantName: '',
            occupancyStatus: 'vacant',
            fanEnabled: false,
            heaterEnabled: false,
            lightsOffCalm: false,
            flotationEnabled: false,
            quiltType: 'none',
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch {
      // Local vacate already succeeded
    }
  };

  const handleEnterPod = async (
    podId: ChillPodDocId,
    initialPatch?: PodSensoryPatch,
    customFeedback?: string
  ) => {
    const targetPod = podsById[podId];
    if (
      targetPod &&
      targetPod.occupancyStatus === 'occupied' &&
      targetPod.occupantId !== '' &&
      targetPod.occupantId !== actorId &&
      !isPodStale(targetPod)
    ) {
      setStatusMessage(
        `${targetPod.podLabel} is occupied (1 person max for privacy). Tap Switch to Vacant Pod to enter a free sanctuary pod.`
      );
      return;
    }

    setBusyPodAction(true);
    try {
      if (myOccupiedPod && myOccupiedPod.podId !== podId) {
        await vacatePodInternal(myOccupiedPod);
      }

      const fanEnabled = Boolean(initialPatch?.fanEnabled);
      const heaterEnabled = fanEnabled
        ? false
        : Boolean(initialPatch?.heaterEnabled);
      const lightsOffCalm = Boolean(initialPatch?.lightsOffCalm);
      const flotationEnabled = Boolean(initialPatch?.flotationEnabled);
      const quiltType: ChillQuiltChoice = initialPatch?.quiltType || 'none';

      const claimedRecord: ChillPodStateRecord = {
        podId,
        podLabel: CHILL_POD_CATALOG[podId].podLabel,
        occupantId: actorId,
        occupantName: safeActorName,
        occupancyStatus: 'occupied',
        fanEnabled,
        heaterEnabled,
        lightsOffCalm,
        flotationEnabled,
        quiltType,
        updatedAtMs: Date.now(),
        source: canSyncCloud ? 'cloud' : 'local',
      };

      onUpdateLocalPod(claimedRecord);
      setSelectedPodId(podId);
      onFocusMezzanineAngle('chill_pod', podId);
      onEnjoyRefreshment(`${CHILL_POD_CATALOG[podId].shortMobileLabel} Rest`);
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();

      setStatusMessage(
        customFeedback ||
          `Inside ${CHILL_POD_CATALOG[podId].podLabel} (1/1 Private) — Poise restored to 100%. Adjust fan, heater, lights-off calm, flotation water, or heavy quilt anytime.`
      );

      await syncPodOccupiedToCloud(claimedRecord);
    } finally {
      setBusyPodAction(false);
    }
  };

  // Reasonable Adjustment: Tapping ANY sensory button on a vacant pod auto-enters that pod and activates the sensory choice in 1 tap
  const handleUpdateSensoryPatch = async (
    patch: PodSensoryPatch,
    cue: 'fan' | 'heater' | 'calm' | 'water' | 'quilt',
    feedbackText: string
  ) => {
    if (isInspectedPodOther) {
      setStatusMessage(
        'This pod is occupied privately by another member. Tap a vacant green pod above to enter.'
      );
      return;
    }

    soundEngine.unlock();
    soundEngine.playPodSensoryCue(cue);

    if (!isInspectedPodMine) {
      await handleEnterPod(
        selectedPodId,
        patch,
        `Entered ${CHILL_POD_CATALOG[selectedPodId].shortMobileLabel} · ${feedbackText}`
      );
      return;
    }

    const mergedFan =
      patch.fanEnabled !== undefined
        ? patch.fanEnabled
        : inspectedPod.fanEnabled;
    const mergedHeater =
      patch.heaterEnabled !== undefined
        ? patch.heaterEnabled
        : inspectedPod.heaterEnabled;

    const updated: ChillPodStateRecord = {
      ...inspectedPod,
      ...patch,
      fanEnabled: mergedFan,
      heaterEnabled: mergedFan ? false : mergedHeater,
      occupantId: actorId,
      occupantName: safeActorName,
      occupancyStatus: 'occupied',
      updatedAtMs: Date.now(),
    };

    onUpdateLocalPod(updated);
    onFocusMezzanineAngle('chill_pod', inspectedPod.podId);
    setStatusMessage(feedbackText);
    await syncPodOccupiedToCloud(updated);
  };

  const handleStepOutOfPod = async () => {
    if (!myOccupiedPod) return;
    setBusyPodAction(true);
    try {
      onToggleCalmScreenDim(false);
      setRestSecondsLeft(null);
      await vacatePodInternal(myOccupiedPod);
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();
      setStatusMessage(
        `Stepped out of ${myOccupiedPod.podLabel}. Pod aired and lit green for the next person.`
      );
    } finally {
      setBusyPodAction(false);
    }
  };

  const handleToggleAudioMute = () => {
    const nextMuted = !audioMuted;
    soundEngine.setMuted(nextMuted);
    setAudioMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setStatusMessage(
        'Signed in — your Private Chill Pod occupancy now syncs across devices.'
      );
    } catch {
      setStatusMessage(
        'Local sanctuary mode active — all Private Chill Pod controls work on your phone without signing in.'
      );
    }
  };

  const formatTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const tempSummary = inspectedPod.fanEnabled
    ? 'Cool Fan ON'
    : inspectedPod.heaterEnabled
      ? 'Warm Heater ON'
      : 'Neutral Air';
  const lightSummary = inspectedPod.lightsOffCalm ? 'Calm Dark' : 'Warm Lamp';
  const baseSummary = inspectedPod.flotationEnabled
    ? 'Water Float'
    : 'Dry Daybed';
  const quiltSummary =
    inspectedPod.quiltType === 'vegan'
      ? 'Vegan Quilt'
      : inspectedPod.quiltType === 'natural_duck_feather'
        ? 'Duck Feather Quilt'
        : 'Open Quilt';
  const activePlushieMeta =
    WELLY_PLUSHIE_TUB_OPTIONS.find((p) => p.id === selectedWellyPlushie) ||
    null;

  const activeBook =
    MEZZANINE_LIBRARY_BOOKS.find((b) => b.id === selectedBookId) ||
    MEZZANINE_LIBRARY_BOOKS[0];

  const mobileMaxHeightClass =
    activeTab === 'pods'
      ? mobileSheetExpanded
        ? 'max-h-[92dvh]'
        : 'max-h-[64dvh]'
      : 'max-h-[88dvh]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="33m Treetop Mezzanine — Private Chill Pods, Library & Refreshments"
      className={`fixed inset-x-2 bottom-2 ${mobileMaxHeightClass} sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[min(560px,95vw)] sm:max-h-[calc(100dvh-1.5rem)] z-30 flex flex-col rounded-3xl sm:rounded-2xl bg-[#132019]/98 border border-[#E5A93C]/60 text-[#F7F4EB] shadow-2xl pointer-events-auto overflow-hidden transition-[max-height] duration-200`}
    >
      {/* Compact Accessible Header */}
      <div className="px-3.5 py-2.5 sm:px-5 sm:py-3.5 bg-[#192A20] border-b border-white/12 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#7CE0A3] truncate">
            33m Mezzanine · Sensory Reasonable Adjustment
          </p>
          <h2 className="text-base sm:text-xl font-bold text-[#FFD166] truncate">
            Private Chill Pods, Library &amp; Tea
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeTab === 'pods' && (
            <button
              type="button"
              onClick={() => setMobileSheetExpanded((prev) => !prev)}
              className="touch-manipulation touch-manipulation-btn sm:hidden min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#1F3528] border border-[#7CE0A3]/45 text-[#7CE0A3] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle between seeing the 3D Cedar Chill Pod above or expanding the control sheet"
            >
              {mobileSheetExpanded ? '3D View' : 'Expand'}
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleAudioMute}
            aria-pressed={audioMuted}
            className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              audioMuted
                ? 'bg-[#261D29] border-[#C4B5FD]/50 text-[#E9D5FF]'
                : 'bg-[#1B2D22] border-white/15 text-[#D4E4D7] hover:border-[#FFD166]'
            }`}
            title="Mute or unmute gentle sanctuary sound cues"
          >
            {audioMuted ? 'Muted' : 'Quiet Audio'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#241810] border border-[#E5A93C]/55 hover:border-[#FFD166] text-[#FFD166] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Close ✕
          </button>
        </div>
      </div>

      {/* Single-Line Accessible Section Tabs (>= 44px touch targets) */}
      <div className="px-3.5 py-2 sm:px-5 bg-[#15241B] border-b border-white/10 flex items-center gap-2 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('pods');
            onFocusMezzanineAngle('chill_pod', selectedPodId);
          }}
          className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'pods'
              ? 'bg-[#E5A93C] border-[#FFD166] text-[#181009]'
              : 'bg-[#1B2D22] border-white/15 text-[#F7F4EB] hover:border-[#FFD166]'
          }`}
        >
          Chill Pods (1/Person)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('library');
            soundEngine.unlock();
            soundEngine.playPodSensoryCue('book');
            onFocusMezzanineAngle('mezzanine_library');
          }}
          className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'library'
              ? 'bg-[#E5A93C] border-[#FFD166] text-[#181009]'
              : 'bg-[#1B2D22] border-white/15 text-[#F7F4EB] hover:border-[#FFD166]'
          }`}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('refreshments');
            onFocusMezzanineAngle('mezzanine_refreshments');
          }}
          className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'refreshments'
              ? 'bg-[#E5A93C] border-[#FFD166] text-[#181009]'
              : 'bg-[#1B2D22] border-white/15 text-[#F7F4EB] hover:border-[#FFD166]'
          }`}
        >
          Refreshments
        </button>
      </div>

      {/* Momentum Touch-Scrollable Body with touch-action: pan-y and overscroll-behavior: contain */}
      <div className="flex-1 min-h-0 touch-pan-y-contain mobile-touch-scroll px-3.5 sm:px-5 py-3 sm:py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3.5">
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl bg-[#1D3326] border border-[#7CE0A3]/60 px-3.5 py-2.5 text-xs sm:text-sm text-[#E9F7EE]"
          >
            {statusMessage}
          </div>
        )}

        {/* TAB 1: PRIVATE SENSORY CHILL PODS (1 PER PERSON) & WELLY PLUSHIE LAUNDRY TUB */}
        {activeTab === 'pods' && (
          <div className="space-y-3.5">
            {/* Safe Flooring, Height-Safe Enclosure & Low-Vision Wayfinding Bar */}
            <div className="rounded-2xl bg-[#18281F] border border-[#7CE0A3]/35 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#7CE0A3]">
                    Safe Sanctuary Floor &amp; Height-Protected Lounge
                  </p>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-[#D2E4D7] leading-relaxed">
                    Step-free cushioned non-slip cork-sage tiles · Cane &amp;
                    low-vision tactile strips · Solid 1.18m cedar walls (zero
                    open drops) · Dual brass doorway grab bars · Occupant-only
                    interior safety latch
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onFocusMezzanineAngle('mezzanine_relaxation')}
                  className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#21382B] border border-[#7CE0A3]/55 hover:border-[#FFD166] text-xs font-semibold text-[#F7F4EB] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  View Safe Floor &amp; Welly Tub
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onFocusMezzanineAngle('chill_pod', selectedPodId)
                  }
                  className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#1B2D22] border border-white/15 hover:border-[#FFD166] text-xs font-semibold text-[#DCEADF] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  View Selected Pod
                </button>
                <button
                  type="button"
                  aria-pressed={highContrastFloor}
                  onClick={() => {
                    const next = !highContrastFloor;
                    onToggleHighContrastFloor(next);
                    onFocusMezzanineAngle('mezzanine_relaxation');
                    setStatusMessage(
                      next
                        ? 'High-contrast low-vision tactile guide strips illuminated across the step-free floor.'
                        : 'Standard warm tactile floor contrast active.'
                    );
                  }}
                  className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    highContrastFloor
                      ? 'bg-[#2C2612] border-[#FFE066] text-[#FFF3B0]'
                      : 'bg-[#1B2D22] border-white/15 text-[#DCEADF] hover:border-[#FFE066]'
                  }`}
                >
                  {highContrastFloor
                    ? 'Tactile Contrast: Boosted'
                    : 'Tactile Contrast: Standard'}
                </button>
              </div>
            </div>

            {/* Compact 2x2 Pod Selector — Fits Above the Fold on Mobile Phones */}
            <div className="grid grid-cols-2 gap-2">
              {ALL_POD_IDS.map((podId) => {
                const spec = CHILL_POD_CATALOG[podId];
                const state = podsById[podId];
                const stale = isPodStale(state);
                const mine =
                  state?.occupancyStatus === 'occupied' &&
                  state?.occupantId === actorId;
                const occupied =
                  state?.occupancyStatus === 'occupied' && !stale;
                const selected = selectedPodId === podId;

                return (
                  <button
                    key={podId}
                    type="button"
                    onClick={() => {
                      setSelectedPodId(podId);
                      onFocusMezzanineAngle('chill_pod', podId);
                    }}
                    className={`touch-manipulation touch-manipulation-btn min-h-[52px] text-left rounded-xl px-3 py-2 border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#22382B] border-[#FFD166]'
                        : 'bg-[#18271E] border-white/12 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-[#F7F4EB] truncate">
                        <span className="sm:hidden">
                          {spec.shortMobileLabel}
                        </span>
                        <span className="hidden sm:inline">
                          {spec.podLabel}
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold whitespace-nowrap shrink-0 ${
                          mine
                            ? 'text-[#FFD166]'
                            : occupied
                              ? 'text-[#FDA4AF]'
                              : 'text-[#7CE0A3]'
                        }`}
                      >
                        {mine ? 'Yours' : occupied ? '1/1' : 'Vacant'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#C4D7C9] truncate">
                      {mine
                        ? 'Inside · Privacy Door Latched'
                        : occupied
                          ? `In use (${state?.occupantName || 'Member'})`
                          : spec.locationNote}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Welcoming Relaxation Lounge: Clothes-Washing Laundry Tub of Soft Welly Plushies */}
            <div className="rounded-2xl bg-[#192B22] border border-[#FFD166]/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#FFD166]">
                    Clothes-Washing Laundry Tub · Soft Welly Shoe Plushies
                  </h3>
                  <p className="mt-0.5 text-xs text-[#CFE3D4]">
                    Pick a freshly laundered fleece Welly boot plushie from the
                    ribbed vintage washing tub to cuddle on the rug or snuggle
                    inside your Private Chill Pod:
                  </p>
                </div>
                {selectedWellyPlushie && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectWellyPlushie(null);
                      onFocusMezzanineAngle('mezzanine_relaxation');
                      setStatusMessage(
                        'Tucked your Welly plushie gently back into the warm waffle-towel laundry tub.'
                      );
                    }}
                    className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#241A12] border border-[#E5A93C]/45 hover:border-[#FFD166] text-xs font-semibold text-[#FFD166] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Return to Tub
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WELLY_PLUSHIE_TUB_OPTIONS.map((plush) => {
                  const isPicked = selectedWellyPlushie === plush.id;
                  return (
                    <button
                      key={plush.id}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() => {
                        onSelectWellyPlushie(plush.id);
                        soundEngine.unlock();
                        soundEngine.playSanctuaryRest();
                        onEnjoyRefreshment(plush.shortLabel);
                        if (isInspectedPodMine) {
                          onFocusMezzanineAngle('chill_pod', selectedPodId);
                          setStatusMessage(
                            `Cuddling ${plush.label} inside your Private Chill Pod — Poise restored to 100%.`
                          );
                        } else {
                          onFocusMezzanineAngle('mezzanine_relaxation');
                          setStatusMessage(
                            `Picked ${plush.label} from the clothes-washing laundry tub (+100% Poise) — enter any Chill Pod to bring it inside with you.`
                          );
                        }
                      }}
                      className={`touch-manipulation touch-manipulation-btn min-h-[54px] px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        isPicked
                          ? 'bg-[#253D2E] border-[#FFD166] text-[#FFFFFF]'
                          : 'bg-[#142219] border-white/14 text-[#F7F4EB] hover:border-[#7CE0A3]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            aria-hidden="true"
                            className={`w-3.5 h-3.5 rounded-sm border shrink-0 ${plush.swatchClass}`}
                          />
                          <span className="text-xs sm:text-sm font-semibold truncate">
                            {plush.label}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#FFD166] whitespace-nowrap shrink-0">
                          {isPicked ? 'Holding' : 'Pick'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#C4D8CA] truncate">
                        {plush.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active / Selected Pod Interior Controls */}
            <div className="rounded-2xl bg-[#1A2B21] border border-[#E5A93C]/45 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                    {CHILL_POD_CATALOG[selectedPodId].podLabel}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#CFE3D4]">
                    {isInspectedPodMine
                      ? `Private 1/1 Sanctuary · Sliding Privacy Door Latched From Inside · Poise ${poisePercent}%`
                      : isInspectedPodOther
                        ? 'Occupied privately (1 person max) · Choose a vacant green pod'
                        : 'Step-free flush threshold & dual grab bars · Tap Enter or any sensory control below'}
                  </p>
                </div>

                {!isInspectedPodMine ? (
                  isInspectedPodOther && nextVacantPodId ? (
                    <button
                      type="button"
                      disabled={busyPodAction}
                      onClick={() => void handleEnterPod(nextVacantPodId)}
                      className="touch-manipulation touch-manipulation-btn min-h-[48px] w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#7CE0A3] hover:bg-[#9BEBB9] text-[#0E1D14] font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      Enter Vacant{' '}
                      {CHILL_POD_CATALOG[nextVacantPodId].shortMobileLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyPodAction || isInspectedPodOther}
                      onClick={() => void handleEnterPod(selectedPodId)}
                      className={`touch-manipulation touch-manipulation-btn min-h-[48px] w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        isInspectedPodOther
                          ? 'bg-[#2A2023] border border-[#FDA4AF]/40 text-[#FDA4AF] cursor-not-allowed'
                          : 'bg-[#7CE0A3] hover:bg-[#9BEBB9] text-[#0E1D14]'
                      }`}
                    >
                      {isInspectedPodOther
                        ? 'Pod Occupied (1/1)'
                        : myOccupiedPod
                          ? 'Move Into This Pod (1/1)'
                          : 'Enter Safe Private Pod (1/1)'}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={busyPodAction}
                    onClick={() => void handleStepOutOfPod()}
                    className="touch-manipulation touch-manipulation-btn min-h-[48px] w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#2A1C12] border border-[#FFD166] hover:bg-[#3A2719] text-[#FFD166] font-semibold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Unlatch &amp; Step Out
                  </button>
                )}
              </div>

              {/* Unboxed Live Sensory Readout Strip */}
              <p className="text-xs font-mono text-[#BCE0C7] leading-relaxed">
                {tempSummary} · {lightSummary} · {baseSummary} · {quiltSummary}{' '}
                · {activePlushieMeta ? activePlushieMeta.shortLabel : 'No Plushie'}{' '}
                · Poise {poisePercent}%
              </p>

              {/* 5 Sensory Controls — 1-Tap Auto-Entry Enabled on Vacant Pods */}
              <div
                className={`space-y-3 ${
                  isInspectedPodOther ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 1. Cool Down (with Fan) */}
                  <button
                    type="button"
                    disabled={busyPodAction || isInspectedPodOther}
                    onClick={() =>
                      void handleUpdateSensoryPatch(
                        {
                          fanEnabled: !inspectedPod.fanEnabled,
                          heaterEnabled: !inspectedPod.fanEnabled
                            ? false
                            : inspectedPod.heaterEnabled,
                        },
                        'fan',
                        !inspectedPod.fanEnabled
                          ? 'Ceiling breeze fan switched ON in 3D pod (heater paused for cool airflow).'
                          : 'Ceiling breeze fan switched OFF.'
                      )
                    }
                    aria-pressed={inspectedPod.fanEnabled}
                    className={`touch-manipulation touch-manipulation-btn min-h-[56px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      inspectedPod.fanEnabled
                        ? 'bg-[#193A3D] border-[#67E8F9] text-[#ECFEFF]'
                        : 'bg-[#142219] border-white/15 text-[#F7F4EB] hover:border-[#67E8F9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">
                        Cool Down (with Fan)
                      </span>
                      <span className="font-mono text-xs font-bold shrink-0">
                        {inspectedPod.fanEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#B9D6D9]">
                      Spins the quiet 4-blade cedar overhead fan
                    </p>
                  </button>

                  {/* 2. Put Heater On */}
                  <button
                    type="button"
                    disabled={busyPodAction || isInspectedPodOther}
                    onClick={() =>
                      void handleUpdateSensoryPatch(
                        {
                          heaterEnabled: !inspectedPod.heaterEnabled,
                          fanEnabled: !inspectedPod.heaterEnabled
                            ? false
                            : inspectedPod.fanEnabled,
                        },
                        'heater',
                        !inspectedPod.heaterEnabled
                          ? 'Warm ceramic hearth heater switched ON in 3D pod (fan paused).'
                          : 'Ceramic hearth heater switched OFF.'
                      )
                    }
                    aria-pressed={inspectedPod.heaterEnabled}
                    className={`touch-manipulation touch-manipulation-btn min-h-[56px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      inspectedPod.heaterEnabled
                        ? 'bg-[#3B2114] border-[#FDBA74] text-[#FFF7ED]'
                        : 'bg-[#142219] border-white/15 text-[#F7F4EB] hover:border-[#FDBA74]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">
                        Put the Heater On
                      </span>
                      <span className="font-mono text-xs font-bold shrink-0">
                        {inspectedPod.heaterEnabled ? 'WARM' : 'OFF'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#E8C9B0]">
                      Radiates gentle amber warmth from the low hearth
                    </p>
                  </button>

                  {/* 3. Enjoy Sensory Calm (Turn Light Off) */}
                  <button
                    type="button"
                    disabled={busyPodAction || isInspectedPodOther}
                    onClick={() => {
                      const nextCalm = !inspectedPod.lightsOffCalm;
                      onToggleCalmScreenDim(nextCalm);
                      void handleUpdateSensoryPatch(
                        { lightsOffCalm: nextCalm },
                        'calm',
                        nextCalm
                          ? 'Pod overhead light turned OFF for deep sensory calm.'
                          : 'Warm pod reading light restored.'
                      );
                    }}
                    aria-pressed={inspectedPod.lightsOffCalm}
                    className={`touch-manipulation touch-manipulation-btn min-h-[56px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      inspectedPod.lightsOffCalm
                        ? 'bg-[#171F30] border-[#A5B4FC] text-[#EEF2FF]'
                        : 'bg-[#142219] border-white/15 text-[#F7F4EB] hover:border-[#A5B4FC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">
                        Sensory Calm (Light Off)
                      </span>
                      <span className="font-mono text-xs font-bold shrink-0">
                        {inspectedPod.lightsOffCalm ? 'DARK' : 'LIT'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#C7D2FE]">
                      Switches off pod lamp &amp; softens bright glare
                    </p>
                  </button>

                  {/* 4. Sensory Flotation (Water) */}
                  <button
                    type="button"
                    disabled={busyPodAction || isInspectedPodOther}
                    onClick={() =>
                      void handleUpdateSensoryPatch(
                        { flotationEnabled: !inspectedPod.flotationEnabled },
                        'water',
                        !inspectedPod.flotationEnabled
                          ? 'Warm buoyant Epsom water flotation basin filled in 3D pod.'
                          : 'Sensory flotation water basin drained & dried.'
                      )
                    }
                    aria-pressed={inspectedPod.flotationEnabled}
                    className={`touch-manipulation touch-manipulation-btn min-h-[56px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      inspectedPod.flotationEnabled
                        ? 'bg-[#133337] border-[#5EEAD4] text-[#F0FDFA]'
                        : 'bg-[#142219] border-white/15 text-[#F7F4EB] hover:border-[#5EEAD4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">
                        Sensory Flotation (Water)
                      </span>
                      <span className="font-mono text-xs font-bold shrink-0">
                        {inspectedPod.flotationEnabled ? 'FLOAT' : 'DRY'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#99F6E4]">
                      Weightless warm mineral water flotation cradle
                    </p>
                  </button>
                </div>

                {inspectedPod.lightsOffCalm && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[#111824] border border-[#A5B4FC]/35 px-3.5 py-2 text-xs text-[#E0E7FF]">
                    <span>Extra screen-dimming calm veil</span>
                    <button
                      type="button"
                      onClick={() =>
                        onToggleCalmScreenDim(!calmScreenDimEnabled)
                      }
                      className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-lg bg-[#1E293B] border border-[#A5B4FC]/50 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {calmScreenDimEnabled ? 'Dim Veil: ON' : 'Dim Veil: OFF'}
                    </button>
                  </div>
                )}

                {/* 5. Heavy Weighted Quilt Selector: None / Vegan / Natural Duck Feather */}
                <div className="rounded-xl bg-[#142219] border border-white/15 p-3.5">
                  <p className="text-xs sm:text-sm font-semibold text-[#FFD166]">
                    Heavy Weighted Quilt (Deep Pressure Comfort)
                  </p>
                  <p className="text-xs text-[#C6DACB] mt-0.5">
                    Choose plant-based Vegan bamboo-linen or Natural Duck
                    Feather heavy quilt:
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        {
                          value: 'none',
                          label: 'No Quilt',
                          sub: 'Open Daybed',
                        },
                        {
                          value: 'vegan',
                          label: 'Vegan Heavy Quilt',
                          sub: 'Bamboo & Glass-Bead',
                        },
                        {
                          value: 'natural_duck_feather',
                          label: 'Natural Duck Feather',
                          sub: 'Ethical Down Heavy Quilt',
                        },
                      ] as {
                        value: ChillQuiltChoice;
                        label: string;
                        sub: string;
                      }[]
                    ).map((opt) => {
                      const active = inspectedPod.quiltType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={busyPodAction || isInspectedPodOther}
                          onClick={() =>
                            void handleUpdateSensoryPatch(
                              { quiltType: opt.value },
                              'quilt',
                              opt.value === 'vegan'
                                ? 'Draped the Vegan Bamboo-Linen Heavy Quilt across your 3D pod daybed.'
                                : opt.value === 'natural_duck_feather'
                                  ? 'Draped the Natural Duck Feather Heavy Quilt across your 3D pod daybed.'
                                  : 'Folded away the heavy quilt.'
                            )
                          }
                          aria-pressed={active}
                          className={`touch-manipulation touch-manipulation-btn min-h-[52px] px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#294433] border-[#7CE0A3] text-[#FFFFFF]'
                              : 'bg-[#192A20] border-white/12 text-[#DCEADF] hover:border-[#7CE0A3]'
                          }`}
                        >
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div className="text-[11px] text-[#B7CDBD]">
                            {opt.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gentle Zero-Pressure Rest Timer (Neurodivergent & Neurotypical Recovery Pacing) */}
                <div className="rounded-xl bg-[#142219] border border-white/12 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-[#CFE3D4]">
                    <span className="font-semibold text-[#F7F4EB]">
                      Gentle Rest Timer
                    </span>
                    <span className="ml-2 font-mono tabular-nums text-[#7CE0A3]">
                      {restSecondsLeft !== null
                        ? formatTimer(restSecondsLeft)
                        : 'Unhurried'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: '2m', sec: 120 },
                      { label: '5m', sec: 300 },
                      { label: '10m', sec: 600 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          if (!isInspectedPodMine && !isInspectedPodOther) {
                            void handleEnterPod(
                              selectedPodId,
                              undefined,
                              `Entered ${CHILL_POD_CATALOG[selectedPodId].shortMobileLabel} · ${preset.label} calm rest timer started.`
                            );
                          }
                          setRestSecondsLeft(preset.sec);
                        }}
                        className="touch-manipulation touch-manipulation-btn min-h-[44px] min-w-[44px] px-2.5 py-1.5 rounded-xl bg-[#1C2F23] border border-white/15 hover:border-[#7CE0A3] text-xs font-mono font-semibold text-[#F7F4EB] cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {restSecondsLeft !== null && (
                      <button
                        type="button"
                        onClick={() => setRestSecondsLeft(null)}
                        className="touch-manipulation touch-manipulation-btn min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#261A14] border border-[#E5A93C]/45 text-xs font-semibold text-[#FFD166] cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quiet Sync Status Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#B7CDBD]">
              <span>
                {canSyncCloud
                  ? 'Live cloud + phone sanctuary sync active'
                  : 'Works offline & locally on phone — no sign-in required'}
              </span>
              {!currentUser && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="touch-manipulation touch-manipulation-btn min-h-[44px] px-2 inline-flex items-center text-[#FFD166] underline font-semibold cursor-pointer"
                >
                  Optional Cloud Sign-In
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MEZZANINE LIBRARY */}
        {activeTab === 'library' && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-[#D4E4D7]">
              Quiet West Wing reading desk with green banker&apos;s lamp. Select
              any pocket handbook below for clear, large-print workshop notes:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MEZZANINE_LIBRARY_BOOKS.map((book) => {
                const selected = book.id === activeBook.id;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      setSelectedBookId(book.id);
                      soundEngine.unlock();
                      soundEngine.playPodSensoryCue('book');
                    }}
                    className={`touch-manipulation touch-manipulation-btn min-h-[56px] text-left rounded-xl p-3 border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#23392B] border-[#FFD166] text-[#F7F4EB]'
                        : 'bg-[#18271E] border-white/12 text-[#DCEADF] hover:border-white/30'
                    }`}
                  >
                    <div className="text-[11px] font-mono text-[#7CE0A3]">
                      {book.shelfCode} · {book.readingMinutes}
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-[#FFD166]">
                      {book.title}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Large-Print Book Reader */}
            <article className="rounded-2xl bg-[#F6F1E3] text-[#1A241E] border-2 border-[#D2B48C] p-4 sm:p-5 space-y-4">
              <div className="border-b border-[#1A241E]/15 pb-3">
                <span className="font-mono text-xs font-bold text-[#23533A]">
                  MEZZANINE FOLIO · {activeBook.shelfCode}
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-bold text-[#142019]">
                  {activeBook.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#394E41]">
                  {activeBook.subtitle}
                </p>
              </div>
              <div className="space-y-3.5">
                {activeBook.chapters.map((ch) => (
                  <section key={ch.heading}>
                    <h4 className="text-sm sm:text-base font-bold text-[#1B432E]">
                      {ch.heading}
                    </h4>
                    <p className="mt-1 text-sm sm:text-base leading-relaxed text-[#223027]">
                      {ch.body}
                    </p>
                  </section>
                ))}
              </div>
            </article>
          </div>
        )}

        {/* TAB 3: REFRESHMENTS BAR */}
        {activeTab === 'refreshments' && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-[#D4E4D7]">
              East Mezzanine Cedar &amp; Copper Tea Counter (accessible 0.88m
              height). Help yourself to a warm drink or oat slice anytime to
              restore your Canopy Poise to 100%:
            </p>
            <div className="space-y-2.5">
              {REFRESHMENT_MENU.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-[#18271E] border border-white/15 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-mono text-[#7CE0A3]">
                      {item.servingVessel}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-[#D2E2D6]">
                      {item.sensoryNote}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onEnjoyRefreshment(item.title);
                      setStatusMessage(
                        `Poured ${item.title} — Poise restored to 100%. Take all the time you need.`
                      );
                    }}
                    className="touch-manipulation touch-manipulation-btn min-h-[46px] px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Enjoy (+100% Poise)
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
