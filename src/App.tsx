/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeCollab } from './collab/useRealtimeCollab';
import { AgarwoodLiftDock } from './components/AgarwoodLiftDock';
import {
  BankOfTreetopModal,
  BankOfTreetopTab,
} from './components/BankOfTreetopModal';
import { BetaShareModal } from './components/BetaShareModal';
import { CanopyPaypalStoreModal } from './components/CanopyPaypalStoreModal';
import { CanopySessionPanel } from './components/CanopySessionPanel';
import { CanopyStudioModal } from './components/CanopyStudioModal';
import { CarerRemindersModal } from './components/CarerRemindersModal';
import { EntryKioskModal } from './components/EntryKioskModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  BANK_EXCHEQUER_CARD_ID,
  DRAZELLA_SPRINKES_CARD_ID,
  JAY_BETA_RESEARCHER_CARD_ID,
  JobCentreBoardModal,
  loadSavedActiveJobSlip,
} from './components/JobCentreBoardModal';
import { MeltingPopupOverlay } from './components/MeltingPopupOverlay';
import { PassiveUserDashboard } from './components/PassiveUserDashboard';
import {
  CHILL_POD_CATALOG,
  MezzanineTab,
  TreetopMezzanineModal,
} from './components/TreetopMezzanineModal';
import { WelcomeShoeSelectorModal } from './components/WelcomeShoeSelectorModal';
import {
  CANOPY_FLOOR_STYLES,
  CANOPY_FURNISHING_KINDS,
  CANOPY_TRADE_FOCUSES,
  CANOPY_TRIM_ACCENTS,
  CanopyFloorStyle,
  CanopyFurnishingKind,
  CanopyStudioConfig,
  CanopyTradeFocus,
  CanopyTrimAccent,
  CHILL_POD_IDS,
  ChillPodDocId,
  ChillPodStateRecord,
  ChillQuiltChoice,
  db,
  DEFAULT_CANOPY_STUDIO,
  DEFAULT_TREE_PROGRESS,
  getSafeCurrentUser,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  JobCentreVacancyRecord,
  OperationType,
  subscribeSafeAuth,
  TreeProgressState,
  UxFeedbackFocusArea,
  VALID_DOC_ID_REGEX,
} from './firebase';
import {
  loadLocalShoeSelection,
  saveLocalShoeSelection,
  ShoeCharacterSelection,
} from './shared/shoeCharacterCatalog';
import { TreehouseEngine } from './three/TreehouseEngine';
import {
  CanopyInspectAngle,
  ChillPodVisualConfig,
  HudSnapshot,
  PACE_MODE_ORDER,
  PaceMode,
  WellyPlushieId,
} from './types/game';
import {
  ActiveCanopySession,
  loadActiveCanopySession,
  saveActiveCanopySession,
} from './utils/canopySessionStore';
import {
  CARER_REMINDERS_CHANGED_EVENT,
  CARER_REMINDERS_STORAGE_KEY,
  CarerRemindersState,
  loadCarerRemindersState,
  saveCarerRemindersState,
} from './utils/carerRemindersStore';
import { loadLocalDailyHabitState } from './utils/dailyHabitStore';

const LOCAL_STUDIO_STORAGE_KEY = 'jays_job_club_canopy_studio_v1';
const LOCAL_CHILL_PODS_KEY = 'jays_job_club_chill_pods_v1';
const LOCAL_CLIENT_KEY_STORAGE = 'jays_job_club_pod_visitor_key_v1';
const LOCAL_WELLY_PLUSHIE_KEY = 'jays_job_club_welly_plushie_v1';
const LOCAL_HIGH_CONTRAST_FLOOR_KEY = 'jays_job_club_high_contrast_floor_v1';
const LOCAL_LIFT_PACE_KEY = 'jays_job_club_lift_pace_v1';
const VALID_WELLY_PLUSHIES: WellyPlushieId[] = [
  'mossy_green',
  'sunny_yellow',
  'bramble_berry',
  'oatie_cream',
];

function loadLocalLiftPace(): PaceMode {
  if (typeof window === 'undefined') return PaceMode.STEADY;
  try {
    const raw = window.localStorage.getItem(LOCAL_LIFT_PACE_KEY);
    if (raw && PACE_MODE_ORDER.includes(raw as PaceMode)) {
      return raw as PaceMode;
    }
    return PaceMode.STEADY;
  } catch {
    return PaceMode.STEADY;
  }
}

function saveLocalLiftPace(mode: PaceMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_LIFT_PACE_KEY, mode);
  } catch {
    // Ignore storage quota issues
  }
}

function loadLocalWellyPlushie(): WellyPlushieId | null {
  if (typeof window === 'undefined') return 'mossy_green';
  try {
    const raw = window.localStorage.getItem(LOCAL_WELLY_PLUSHIE_KEY);
    if (!raw) return 'mossy_green';
    if (raw === 'none') return null;
    return VALID_WELLY_PLUSHIES.includes(raw as WellyPlushieId)
      ? (raw as WellyPlushieId)
      : 'mossy_green';
  } catch {
    return 'mossy_green';
  }
}

function saveLocalWellyPlushie(id: WellyPlushieId | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_WELLY_PLUSHIE_KEY, id ?? 'none');
  } catch {
    // Ignore storage quota issues
  }
}

function loadLocalHighContrastFloor(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LOCAL_HIGH_CONTRAST_FLOOR_KEY);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

function saveLocalHighContrastFloor(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_HIGH_CONTRAST_FLOOR_KEY,
      enabled ? '1' : '0'
    );
  } catch {
    // Ignore storage quota issues
  }
}

const STARTER_STUDIO_CONFIG: CanopyStudioConfig = {
  ...DEFAULT_CANOPY_STUDIO,
  furnishedItems: [
    'brass_hanging_lantern',
    'amber_floor_lantern',
    'starlight_garland',
    'woven_sanctuary_rug',
  ],
};

function getOrCreateLocalPodVisitorKey(): string {
  if (typeof window === 'undefined') return 'local_visitor';
  try {
    const existing = window.localStorage.getItem(LOCAL_CLIENT_KEY_STORAGE);
    if (existing && VALID_DOC_ID_REGEX.test(existing)) {
      return existing;
    }
    const next = `visitor_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(LOCAL_CLIENT_KEY_STORAGE, next);
    return next;
  } catch {
    return 'local_visitor';
  }
}

function buildDefaultChillPodsMap(): Record<
  ChillPodDocId,
  ChillPodStateRecord
> {
  const map = {} as Record<ChillPodDocId, ChillPodStateRecord>;
  for (const podId of CHILL_POD_IDS) {
    map[podId] = {
      podId,
      podLabel: CHILL_POD_CATALOG[podId].podLabel,
      occupantId: '',
      occupantName: '',
      occupancyStatus: 'vacant',
      fanEnabled: false,
      heaterEnabled: false,
      lightsOffCalm: false,
      flotationEnabled: false,
      quiltType: 'none',
      updatedAtMs: 0,
      source: 'local',
    };
  }
  return map;
}

function loadLocalChillPodsMap(): Record<ChillPodDocId, ChillPodStateRecord> {
  const base = buildDefaultChillPodsMap();
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(LOCAL_CHILL_PODS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<
      Record<ChillPodDocId, ChillPodStateRecord>
    >;
    for (const podId of CHILL_POD_IDS) {
      if (parsed[podId]) {
        base[podId] = { ...base[podId], ...parsed[podId], podId };
      }
    }
    return base;
  } catch {
    return base;
  }
}

function saveLocalChillPodsMap(
  map: Record<ChillPodDocId, ChillPodStateRecord>
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CHILL_PODS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota issues
  }
}

function loadLocalStudioConfig(): CanopyStudioConfig {
  if (typeof window === 'undefined') return STARTER_STUDIO_CONFIG;
  try {
    const raw = window.localStorage.getItem(LOCAL_STUDIO_STORAGE_KEY);
    if (!raw) return STARTER_STUDIO_CONFIG;
    const d = JSON.parse(raw) as Partial<CanopyStudioConfig>;
    return {
      studioName:
        typeof d.studioName === 'string' && d.studioName.trim().length >= 2
          ? d.studioName.trim().slice(0, 42)
          : STARTER_STUDIO_CONFIG.studioName,
      tradeFocus: CANOPY_TRADE_FOCUSES.includes(
        d.tradeFocus as CanopyTradeFocus
      )
        ? (d.tradeFocus as CanopyTradeFocus)
        : STARTER_STUDIO_CONFIG.tradeFocus,
      floorStyle: CANOPY_FLOOR_STYLES.includes(d.floorStyle as CanopyFloorStyle)
        ? (d.floorStyle as CanopyFloorStyle)
        : STARTER_STUDIO_CONFIG.floorStyle,
      trimAccent: CANOPY_TRIM_ACCENTS.includes(d.trimAccent as CanopyTrimAccent)
        ? (d.trimAccent as CanopyTrimAccent)
        : STARTER_STUDIO_CONFIG.trimAccent,
      safetyGateClosed:
        typeof d.safetyGateClosed === 'boolean' ? d.safetyGateClosed : true,
      furnishedItems: Array.isArray(d.furnishedItems)
        ? d.furnishedItems.filter((k): k is CanopyFurnishingKind =>
            CANOPY_FURNISHING_KINDS.includes(k as CanopyFurnishingKind)
          )
        : STARTER_STUDIO_CONFIG.furnishedItems,
    };
  } catch {
    return STARTER_STUDIO_CONFIG;
  }
}

function saveLocalStudioConfig(config: CanopyStudioConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_STUDIO_STORAGE_KEY,
      JSON.stringify(config)
    );
  } catch {
    // Ignore storage quota issues
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TreehouseEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    getSafeCurrentUser()
  );
  const [localPodVisitorKey] = useState<string>(() =>
    getOrCreateLocalPodVisitorKey()
  );

  const collab = useRealtimeCollab(currentUser?.displayName ?? null);

  const [localProgress, setLocalProgress] = useState<TreeProgressState>(
    DEFAULT_TREE_PROGRESS
  );
  const [studioConfig, setStudioConfig] = useState<CanopyStudioConfig>(() =>
    loadLocalStudioConfig()
  );
  const [shoeSelection, setShoeSelection] = useState<ShoeCharacterSelection>(
    () => loadLocalShoeSelection()
  );

  const [kioskOpen, setKioskOpen] = useState<boolean>(false);
  const [shoeModalOpen, setShoeModalOpen] = useState<boolean>(false);
  const [canopyCustomizerOpen, setCanopyCustomizerOpen] =
    useState<boolean>(false);
  const [canopyPaypalStoreOpen, setCanopyPaypalStoreOpen] =
    useState<boolean>(false);
  const [jobBoardOpen, setJobBoardOpen] = useState<boolean>(false);
  const [jobBoardInitialCardId, setJobBoardInitialCardId] = useState<
    string | null
  >(null);
  const [mezzanineOpen, setMezzanineOpen] = useState<boolean>(false);
  const [mezzanineInitialTab, setMezzanineInitialTab] =
    useState<MezzanineTab>('pods');
  const [mezzanineInitialPod, setMezzanineInitialPod] =
    useState<ChillPodDocId | null>('pod_1');
  const [betaModalOpen, setBetaModalOpen] = useState<boolean>(false);
  const [betaInitialFocusArea, setBetaInitialFocusArea] =
    useState<UxFeedbackFocusArea>('Overall Navigation & Readability');
  const [carerModalOpen, setCarerModalOpen] = useState<boolean>(false);
  const [bankModalOpen, setBankModalOpen] = useState<boolean>(false);
  const [bankInitialTab, setBankInitialTab] =
    useState<BankOfTreetopTab>('savings');
  const [carerReminders, setCarerReminders] = useState<CarerRemindersState>(
    () => loadCarerRemindersState()
  );

  const [activeJobSlip, setActiveJobSlip] =
    useState<JobCentreVacancyRecord | null>(() => loadSavedActiveJobSlip());

  const [localPodsById, setLocalPodsById] = useState<
    Record<ChillPodDocId, ChillPodStateRecord>
  >(() => loadLocalChillPodsMap());
  const [cloudPodsById, setCloudPodsById] = useState<
    Partial<Record<ChillPodDocId, ChillPodStateRecord>>
  >({});
  const [calmScreenDimEnabled, setCalmScreenDimEnabled] =
    useState<boolean>(false);
  const [wellyPlushieId, setWellyPlushieId] =
    useState<WellyPlushieId | null>(() => loadLocalWellyPlushie());
  const [highContrastFloor, setHighContrastFloor] = useState<boolean>(() =>
    loadLocalHighContrastFloor()
  );

  const [activeCanopySession, setActiveCanopySession] =
    useState<ActiveCanopySession | null>(() => loadActiveCanopySession());
  const [canopySessionHidden, setCanopySessionHidden] =
    useState<boolean>(false);

  const [replayNonce, setReplayNonce] = useState<number>(0);
  const [noticesDismissed, setNoticesDismissed] = useState<boolean>(false);
  const [noticesActive, setNoticesActive] = useState<boolean>(true);

  useEffect(() => {
    return subscribeSafeAuth((u) => setCurrentUser(u));
  }, []);

  useEffect(() => {
    const syncCarerState = () => {
      setCarerReminders(loadCarerRemindersState());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CARER_REMINDERS_STORAGE_KEY) {
        syncCarerState();
      }
    };
    window.addEventListener(CARER_REMINDERS_CHANGED_EVENT, syncCarerState);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CARER_REMINDERS_CHANGED_EVENT, syncCarerState);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const dismissMeltingNotices = useCallback(() => {
    setNoticesDismissed(true);
    setNoticesActive(false);
  }, []);

  const closeAllModals = useCallback(() => {
    setKioskOpen(false);
    setShoeModalOpen(false);
    setCanopyCustomizerOpen(false);
    setCanopyPaypalStoreOpen(false);
    setJobBoardOpen(false);
    setMezzanineOpen(false);
    setBetaModalOpen(false);
    setCarerModalOpen(false);
    setBankModalOpen(false);
  }, []);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new TreehouseEngine(mountEl, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    engine.setOnOpenEntryKiosk(() => {
      dismissMeltingNotices();
      closeAllModals();
      setKioskOpen(true);
    });

    engine.setOnOpenShoeSelector(() => {
      dismissMeltingNotices();
      closeAllModals();
      setShoeModalOpen(true);
    });

    engine.setOnOpenCanopyPaypalStore(() => {
      dismissMeltingNotices();
      closeAllModals();
      setCanopyPaypalStoreOpen(true);
    });

    engine.setOnOpenCanopyCustomizer(() => {
      dismissMeltingNotices();
      closeAllModals();
      setCanopyCustomizerOpen(true);
    });

    engine.setOnOpenJobBoard((cardId) => {
      dismissMeltingNotices();
      closeAllModals();
      setJobBoardInitialCardId(cardId ?? null);
      setJobBoardOpen(true);
    });

    engine.setOnOpenMezzanine((tab, podId) => {
      dismissMeltingNotices();
      closeAllModals();
      setMezzanineInitialTab(tab);
      if (podId) {
        setMezzanineInitialPod(podId);
      }
      setMezzanineOpen(true);
    });

    const initialStudio = loadLocalStudioConfig();
    const initialShoes = loadLocalShoeSelection();
    engine.applyCanopyStudioConfig(initialStudio, false);
    engine.applyShoeCharacter(
      initialShoes.shoeKind,
      initialShoes.colorway,
      initialShoes.characterNickname,
      false
    );
    engine.applyTreeProgress(DEFAULT_TREE_PROGRESS);
    engine.applyPassiveHabitUpgrades(
      loadLocalDailyHabitState().lifetimeEnergyEarned
    );
    engine.setTactileFloorHighContrast(loadLocalHighContrastFloor());
    engine.setPaceMode(loadLocalLiftPace(), true);

    // Handle URL query deep-links for UX Beta testers (?station=job-centre, ?station=chill-pods, ?station=mezzanine, ?station=carer, ?beta=1)
    try {
      const params = new URLSearchParams(window.location.search);
      const station = params.get('station');
      const betaFlag = params.get('beta');
      if (station === 'job-centre') {
        dismissMeltingNotices();
        setJobBoardOpen(true);
        engine.focusJobBoard();
      } else if (station === 'chill-pods') {
        dismissMeltingNotices();
        setMezzanineInitialTab('pods');
        setMezzanineOpen(true);
        engine.focusMezzanine('chill_pod', 'pod_1');
      } else if (station === 'mezzanine') {
        dismissMeltingNotices();
        setMezzanineInitialTab('library');
        setMezzanineOpen(true);
        engine.focusMezzanine('mezzanine_library');
      } else if (station === 'kiosk') {
        dismissMeltingNotices();
        setKioskOpen(true);
        engine.focusEntryKiosk();
      } else if (station === 'carer') {
        dismissMeltingNotices();
        setCarerModalOpen(true);
      } else if (station === 'bank') {
        dismissMeltingNotices();
        setBankInitialTab('savings');
        setBankModalOpen(true);
      } else if (betaFlag === '1') {
        dismissMeltingNotices();
        setBetaModalOpen(true);
      }
    } catch {
      // Ignore query parsing errors
    }

    return () => {
      engine.setOnOpenEntryKiosk(undefined);
      engine.setOnOpenShoeSelector(undefined);
      engine.setOnOpenCanopyPaypalStore(undefined);
      engine.setOnOpenCanopyCustomizer(undefined);
      engine.setOnOpenJobBoard(undefined);
      engine.setOnOpenMezzanine(undefined);
      engineRef.current = null;
      engine.dispose();
    };
  }, [closeAllModals, dismissMeltingNotices]);

  // Live Firestore listener for 1-per-person Private Chill Pod Occupancy
  useEffect(() => {
    if (!currentUser) {
      setCloudPodsById({});
      return;
    }
    const q = query(
      collection(db, 'chillPodOccupancy'),
      where('podId', 'in', ['pod_1', 'pod_2', 'pod_3', 'pod_4'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const nextCloud: Partial<Record<ChillPodDocId, ChillPodStateRecord>> =
          {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const pid = d.podId as ChillPodDocId;
          if (!CHILL_POD_IDS.includes(pid)) return;
          const ts = d.updatedAt as Timestamp | undefined;
          nextCloud[pid] = {
            podId: pid,
            podLabel:
              typeof d.podLabel === 'string' && d.podLabel.trim()
                ? d.podLabel
                : CHILL_POD_CATALOG[pid].podLabel,
            occupantId: String(d.occupantId || ''),
            occupantName: String(d.occupantName || ''),
            occupancyStatus:
              d.occupancyStatus === 'occupied' ? 'occupied' : 'vacant',
            fanEnabled: Boolean(d.fanEnabled),
            heaterEnabled: Boolean(d.heaterEnabled),
            lightsOffCalm: Boolean(d.lightsOffCalm),
            flotationEnabled: Boolean(d.flotationEnabled),
            quiltType:
              d.quiltType === 'vegan' || d.quiltType === 'natural_duck_feather'
                ? (d.quiltType as ChillQuiltChoice)
                : 'none',
            updatedAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          };
        });
        setCloudPodsById(nextCloud);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'chillPodOccupancy');
      }
    );
    return () => unsub();
  }, [currentUser]);

  const actorPodKey =
    currentUser && VALID_DOC_ID_REGEX.test(currentUser.uid)
      ? currentUser.uid
      : localPodVisitorKey;

  // Merge cloud & local pod states cleanly so optimistic mobile actions (signed-in or guest/offline) are never overwritten by stale cloud state
  const mergedPodsById = useMemo(() => {
    const merged = { ...localPodsById };
    const STALE_POD_MS = 2 * 60 * 60 * 1000;
    for (const pid of CHILL_POD_IDS) {
      const cloud = cloudPodsById[pid];
      const local = localPodsById[pid];
      if (!cloud) {
        merged[pid] = local;
        continue;
      }

      const cloudOccupiedByOther =
        cloud.occupancyStatus === 'occupied' &&
        cloud.occupantId !== '' &&
        cloud.occupantId !== actorPodKey &&
        Date.now() - cloud.updatedAtMs <= STALE_POD_MS;

      if (cloudOccupiedByOther) {
        merged[pid] = cloud;
      } else if (
        local.updatedAtMs > cloud.updatedAtMs &&
        (local.occupantId === actorPodKey || local.occupancyStatus === 'vacant')
      ) {
        merged[pid] = local;
      } else if (
        !currentUser &&
        local.occupancyStatus === 'occupied' &&
        local.occupantId === localPodVisitorKey &&
        cloud.occupancyStatus === 'vacant'
      ) {
        merged[pid] = local;
      } else {
        merged[pid] = cloud;
      }
    }
    return merged;
  }, [
    actorPodKey,
    cloudPodsById,
    currentUser,
    localPodVisitorKey,
    localPodsById,
  ]);

  // Sync low-vision tactile guide floor contrast boost onto the 3D Mezzanine floor
  useEffect(() => {
    engineRef.current?.setTactileFloorHighContrast(highContrastFloor);
  }, [highContrastFloor]);

  // Push live 3D visual updates to the 4 Mezzanine Private Chill Pods
  useEffect(() => {
    const visualConfigs: ChillPodVisualConfig[] = CHILL_POD_IDS.map((pid) => {
      const st = mergedPodsById[pid];
      const occupied = st.occupancyStatus === 'occupied';
      const isCurrentUser = occupied && st.occupantId === actorPodKey;
      return {
        podId: pid,
        occupied,
        isCurrentUser,
        fanEnabled: st.fanEnabled,
        heaterEnabled: st.heaterEnabled,
        lightsOffCalm: st.lightsOffCalm,
        flotationEnabled: st.flotationEnabled,
        quiltType: st.quiltType,
        wellyPlushieId: isCurrentUser ? wellyPlushieId : null,
      };
    });
    engineRef.current?.applyChillPodsVisualState(visualConfigs);
  }, [actorPodKey, mergedPodsById, wellyPlushieId]);

  // Sync live WebSocket collaborators onto the 3D Agarwood trunk & report local altitude
  useEffect(() => {
    engineRef.current?.syncRemoteCollaborators(collab.peers, collab.clientId);
  }, [collab.peers, collab.clientId]);

  useEffect(() => {
    if (!hud) return;
    collab.reportLocalAltitude(hud.elevationMeters, hud.zone);
    saveLocalLiftPace(hud.paceMode);
  }, [collab, hud]);

  const anyModalOpen =
    kioskOpen ||
    shoeModalOpen ||
    canopyCustomizerOpen ||
    canopyPaypalStoreOpen ||
    jobBoardOpen ||
    mezzanineOpen ||
    betaModalOpen ||
    carerModalOpen ||
    bankModalOpen;

  useEffect(() => {
    engineRef.current?.setExternalModalOpen(
      anyModalOpen,
      canopyCustomizerOpen || mezzanineOpen || bankModalOpen,
      kioskOpen || shoeModalOpen || jobBoardOpen
    );
  }, [
    anyModalOpen,
    bankModalOpen,
    canopyCustomizerOpen,
    jobBoardOpen,
    kioskOpen,
    mezzanineOpen,
    shoeModalOpen,
  ]);

  // Global Escape key closes active drawer/modal cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeAllModals]);

  const handleOpenEntryKiosk = useCallback(() => {
    dismissMeltingNotices();
    closeAllModals();
    setKioskOpen(true);
    engineRef.current?.focusEntryKiosk();
  }, [closeAllModals, dismissMeltingNotices]);

  const handleToggleEntryKiosk = useCallback(() => {
    setKioskOpen((prev) => {
      const next = !prev;
      if (next) {
        dismissMeltingNotices();
        setShoeModalOpen(false);
        setCanopyCustomizerOpen(false);
        setCanopyPaypalStoreOpen(false);
        setJobBoardOpen(false);
        setMezzanineOpen(false);
        setBetaModalOpen(false);
        setCarerModalOpen(false);
        setBankModalOpen(false);
        engineRef.current?.focusEntryKiosk();
      }
      return next;
    });
  }, [dismissMeltingNotices]);

  const handleOpenShoeSelector = useCallback(() => {
    dismissMeltingNotices();
    closeAllModals();
    setShoeModalOpen(true);
    engineRef.current?.focusWelcomeShoeBench();
  }, [closeAllModals, dismissMeltingNotices]);

  const handleOpenJobBoard = useCallback(
    (cardId?: string) => {
      dismissMeltingNotices();
      closeAllModals();
      setJobBoardInitialCardId(cardId ?? null);
      setJobBoardOpen(true);
      engineRef.current?.focusJobBoard();
    },
    [closeAllModals, dismissMeltingNotices]
  );

  const handleOpenMezzanine = useCallback(
    (tab: MezzanineTab = 'pods', podId?: ChillPodDocId) => {
      dismissMeltingNotices();
      closeAllModals();
      setMezzanineInitialTab(tab);

      let resolvedPodId: ChillPodDocId | undefined = podId;
      if (tab === 'pods' && !resolvedPodId) {
        const STALE_POD_MS = 2 * 60 * 60 * 1000;
        const mine = CHILL_POD_IDS.find(
          (id) =>
            mergedPodsById[id]?.occupancyStatus === 'occupied' &&
            mergedPodsById[id]?.occupantId === actorPodKey
        );
        const firstVacant = CHILL_POD_IDS.find((id) => {
          const p = mergedPodsById[id];
          return (
            !p ||
            p.occupancyStatus === 'vacant' ||
            (p.updatedAtMs > 0 && Date.now() - p.updatedAtMs > STALE_POD_MS)
          );
        });
        resolvedPodId = mine || firstVacant || 'pod_1';
      }

      if (resolvedPodId) {
        setMezzanineInitialPod(resolvedPodId);
      }
      setMezzanineOpen(true);
      const angle: CanopyInspectAngle =
        tab === 'library'
          ? 'mezzanine_library'
          : tab === 'refreshments'
            ? 'mezzanine_refreshments'
            : 'chill_pod';
      engineRef.current?.focusMezzanine(angle, resolvedPodId);
    },
    [actorPodKey, closeAllModals, dismissMeltingNotices, mergedPodsById]
  );

  const handleOpenBetaModal = useCallback(
    (focus?: UxFeedbackFocusArea) => {
      dismissMeltingNotices();
      closeAllModals();
      setBetaInitialFocusArea(focus ?? 'Overall Navigation & Readability');
      setBetaModalOpen(true);
    },
    [closeAllModals, dismissMeltingNotices]
  );

  const handleOpenCarerReminders = useCallback(() => {
    dismissMeltingNotices();
    closeAllModals();
    setCarerModalOpen(true);
  }, [closeAllModals, dismissMeltingNotices]);

  const handleChangeCarerReminders = useCallback(
    (next: CarerRemindersState) => {
      const stamped: CarerRemindersState = {
        ...next,
        updatedAtMs: Date.now(),
      };
      setCarerReminders(stamped);
      saveCarerRemindersState(stamped);
    },
    []
  );

  const handleDismissCarerStrip = useCallback(() => {
    setCarerReminders((prev) => {
      const next: CarerRemindersState = {
        ...prev,
        pinnedStripVisible: false,
        updatedAtMs: Date.now(),
      };
      saveCarerRemindersState(next);
      return next;
    });
  }, []);

  const handleOpenCanopyCustomizer = useCallback(() => {
    dismissMeltingNotices();
    closeAllModals();
    setCanopyCustomizerOpen(true);
    engineRef.current?.focusCanopyStudio();
  }, [closeAllModals, dismissMeltingNotices]);

  const handleOpenCanopyPaypalStore = useCallback(() => {
    dismissMeltingNotices();
    closeAllModals();
    setCanopyPaypalStoreOpen(true);
    engineRef.current?.focusCanopyPaypalStore();
  }, [closeAllModals, dismissMeltingNotices]);

  const handleOpenBankOfTreetop = useCallback(
    (tab: BankOfTreetopTab = 'savings') => {
      dismissMeltingNotices();
      closeAllModals();
      setBankInitialTab(tab);
      setBankModalOpen(true);
    },
    [closeAllModals, dismissMeltingNotices]
  );

  const handleChangeStudioConfig = useCallback(
    (next: CanopyStudioConfig, celebrate = true) => {
      setStudioConfig(next);
      saveLocalStudioConfig(next);
      engineRef.current?.applyCanopyStudioConfig(next, celebrate);
    },
    []
  );

  const handleChangeShoeSelection = useCallback(
    (next: ShoeCharacterSelection, celebrate = true) => {
      setShoeSelection(next);
      saveLocalShoeSelection(next);
      engineRef.current?.applyShoeCharacter(
        next.shoeKind,
        next.colorway,
        next.characterNickname,
        celebrate
      );
    },
    []
  );

  const handleUpdateLocalPod = useCallback((pod: ChillPodStateRecord) => {
    setLocalPodsById((prev) => {
      const next = { ...prev, [pod.podId]: pod };
      saveLocalChillPodsMap(next);
      return next;
    });
  }, []);

  const handleSelectInspectAngle = useCallback((angle: CanopyInspectAngle) => {
    engineRef.current?.setCanopyInspectAngle(angle);
  }, []);

  const handleSelectWellyPlushie = useCallback((next: WellyPlushieId | null) => {
    setWellyPlushieId(next);
    saveLocalWellyPlushie(next);
  }, []);

  const handleToggleHighContrastFloor = useCallback((enabled: boolean) => {
    setHighContrastFloor(enabled);
    saveLocalHighContrastFloor(enabled);
  }, []);

  const handleFocusMezzanineAngle = useCallback(
    (angle: CanopyInspectAngle, podId?: ChillPodDocId) => {
      if (
        angle === 'mezzanine_overview' ||
        angle === 'mezzanine_relaxation' ||
        angle === 'mezzanine_library' ||
        angle === 'mezzanine_refreshments' ||
        angle === 'chill_pod'
      ) {
        engineRef.current?.focusMezzanine(angle, podId);
      } else {
        engineRef.current?.setCanopyInspectAngle(angle);
      }
    },
    []
  );

  const handleEnjoyRefreshment = useCallback((label: string) => {
    engineRef.current?.restorePoiseFromRefreshment(label);
  }, []);

  const handleToggleRoofCutaway = useCallback((enabled: boolean) => {
    engineRef.current?.setRoofCutaway(enabled);
  }, []);

  const handleHoldAscend = useCallback((active: boolean) => {
    engineRef.current?.setUiHoldAscend(active);
  }, []);

  const handleHoldDescend = useCallback((active: boolean) => {
    engineRef.current?.setUiHoldDescend(active);
  }, []);

  const handleToggleContinuous = useCallback(
    (direction: 'ascend' | 'descend') => {
      engineRef.current?.toggleContinuousLift(direction);
    },
    []
  );

  const handleStopLift = useCallback(() => {
    engineRef.current?.stopLift();
  }, []);

  const handleGlideTo = useCallback((meters: number, label: string) => {
    engineRef.current?.glideToElevation(meters, label);
  }, []);

  const handleSelectPace = useCallback((mode: PaceMode) => {
    saveLocalLiftPace(mode);
    engineRef.current?.setPaceMode(mode);
  }, []);

  const handleTogglePace = useCallback(() => {
    engineRef.current?.togglePaceMode();
  }, []);

  const handleHabitEnergyEarned = useCallback(
    (
      milestoneLabel: string,
      energyAwarded: number,
      lifetimeEnergyEarned: number
    ) => {
      engineRef.current?.awardMasteryHabitEnergy(
        milestoneLabel,
        energyAwarded,
        lifetimeEnergyEarned
      );
    },
    []
  );

  const handleHabitPassiveSync = useCallback((lifetimeEnergyEarned: number) => {
    engineRef.current?.applyPassiveHabitUpgrades(lifetimeEnergyEarned);
  }, []);

  const handleSpendEnergyClimbBoost = useCallback(
    (targetElevationMeters: number, label: string, energySpent: number) => {
      engineRef.current?.triggerEnergyClimbBoost(
        targetElevationMeters,
        label,
        energySpent
      );
    },
    []
  );

  const handleSyncTreeProgress = useCallback(
    (progress: TreeProgressState, bannerMessage?: string) => {
      setLocalProgress(progress);
      engineRef.current?.applyTreeProgress(progress, bannerMessage);
    },
    []
  );

  const handleUpdateCanopySession = useCallback(
    (next: ActiveCanopySession | null) => {
      setActiveCanopySession(next);
      saveActiveCanopySession(next);
    },
    []
  );

  const handleLaunchCanopySession = useCallback(
    (session: ActiveCanopySession, summaryBanner: string) => {
      dismissMeltingNotices();
      setActiveCanopySession(session);
      saveActiveCanopySession(session);
      setCanopySessionHidden(false);
      closeAllModals();

      setStudioConfig((prev) => {
        const updated: CanopyStudioConfig = {
          ...prev,
          tradeFocus: session.canopyFocus,
        };
        saveLocalStudioConfig(updated);
        engineRef.current?.applyCanopyStudioConfig(updated, false);
        return updated;
      });

      engineRef.current?.glideToElevation(33, summaryBanner);
      window.requestAnimationFrame(() => {
        engineRef.current?.glideToElevation(33, summaryBanner);
      });
    },
    [closeAllModals, dismissMeltingNotices]
  );

  const handleLaunchJobStation = useCallback(
    (card: JobCentreVacancyRecord, canopySession?: ActiveCanopySession) => {
      closeAllModals();
      if (canopySession) {
        setActiveCanopySession(canopySession);
        saveActiveCanopySession(canopySession);
        setCanopySessionHidden(false);
      }

      if (card.id === JAY_BETA_RESEARCHER_CARD_ID) {
        engineRef.current?.glideToElevation(
          0,
          `${card.referenceCode} · Beta User Researcher — Jay's Job Centre`
        );
        setBetaInitialFocusArea('Old-Style Job Centre & Collaboration');
        setBetaModalOpen(true);
        return;
      }

      if (card.id === BANK_EXCHEQUER_CARD_ID) {
        engineRef.current?.glideToElevation(
          33,
          `${card.referenceCode} · Bank of Treetop (Unpaid Exchequer · Not a Real Bank)`
        );
        setBankInitialTab('exchequer');
        setBankModalOpen(true);
        return;
      }

      if (
        card.id === DRAZELLA_SPRINKES_CARD_ID ||
        card.locationZone.includes('Mezzanine')
      ) {
        engineRef.current?.glideToElevation(
          33,
          card.id === DRAZELLA_SPRINKES_CARD_ID
            ? `${card.referenceCode} · Drazella Sprinkes Easy Read Library`
            : `${card.referenceCode} · Mezzanine Station`
        );
        setMezzanineInitialTab('library');
        setMezzanineOpen(true);
        engineRef.current?.focusMezzanine(
          card.id === DRAZELLA_SPRINKES_CARD_ID
            ? 'mezzanine_library'
            : 'mezzanine_overview'
        );
        return;
      }

      if (card.locationZone.startsWith('33m')) {
        engineRef.current?.glideToElevation(
          33,
          `${card.referenceCode} · ${card.jobTitle}`
        );
      } else {
        engineRef.current?.glideToElevation(
          0,
          `${card.referenceCode} · 0m Courtyard Workbench`
        );
      }
    },
    [closeAllModals]
  );

  const handleBetaJumpToStation = useCallback(
    (
      target:
        | 'job_centre'
        | 'chill_pods'
        | 'library'
        | 'refreshments'
        | 'kiosk'
    ) => {
      setBetaModalOpen(false);
      if (target === 'job_centre') {
        handleOpenJobBoard();
      } else if (target === 'chill_pods') {
        handleOpenMezzanine('pods', 'pod_1');
      } else if (target === 'library') {
        handleOpenMezzanine('library');
      } else if (target === 'refreshments') {
        handleOpenMezzanine('refreshments');
      } else {
        handleOpenEntryKiosk();
      }
    },
    [handleOpenEntryKiosk, handleOpenJobBoard, handleOpenMezzanine]
  );

  const handleReplayNotices = useCallback(() => {
    setNoticesDismissed(false);
    setNoticesActive(true);
    setReplayNonce((n) => n + 1);
  }, []);

  const handleAllSlidesMelted = useCallback(() => {
    setNoticesActive(false);
  }, []);

  const webglFallback = hud?.webglFallback ?? false;
  const elevationRatio = Math.min(
    1,
    Math.max(0, (hud?.elevationMeters ?? 0) / 33)
  );
  const fallbackCarriageY = Math.round(306 - elevationRatio * 184);

  const myCalmPodLightsOff = CHILL_POD_IDS.some(
    (pid) =>
      mergedPodsById[pid].occupancyStatus === 'occupied' &&
      mergedPodsById[pid].occupantId === actorPodKey &&
      mergedPodsById[pid].lightsOffCalm
  );

  return (
    <ErrorBoundary>
      <main className="relative w-screen h-screen h-[100dvh] overflow-hidden bg-[#16241C] select-none">
        {/* Interactive 3D Agarwood Treehouse Sanctuary, Old-Style Job Centre, Mezzanine Chill Pods & Canopy Store */}
        <div
          ref={canvasMountRef}
          className="absolute inset-0 w-full h-full"
          aria-label="3D Agarwood Treehouse Sanctuary with 0m Old-Style Job Centre, Welcome Boot Bench, 33m Canopy Studio, PayPal Store, and Treetop Mezzanine Library, Refreshments & Private Chill Pods"
        />

        {/* Gentle Dark Sensory Calm Veil when resting inside a Private Chill Pod with Lights Off */}
        {myCalmPodLightsOff && calmScreenDimEnabled && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-10 bg-[#05080F]/55 pointer-events-none transition-opacity duration-500"
          />
        )}

        {/* Architectural Agarwood Tree Diagram Fallback if WebGL is Unavailable */}
        {webglFallback && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1A2D22] via-[#15241B] to-[#0E1812]"
            aria-label="Architectural Sanctuary Diagram"
          >
            <svg
              viewBox="0 0 640 430"
              className="w-full max-w-4xl h-auto opacity-95"
            >
              {/* Three Illuminated Canopy Summit Beacons */}
              <polygon points="282,42 292,22 302,42" fill="#E5A93C" />
              <polygon points="310,36 320,16 330,36" fill="#FFD166" />
              <polygon points="338,42 348,22 358,42" fill="#E5A93C" />

              {/* Treetop Mezzanine Button in Fallback */}
              <g
                onClick={() => handleOpenMezzanine('pods', 'pod_1')}
                className="cursor-pointer"
                role="button"
                aria-label="Open 33m Treetop Mezzanine Library, Refreshments and Private Chill Pods"
              >
                <rect
                  x="210"
                  y="46"
                  width="220"
                  height="36"
                  rx="6"
                  fill="#13291E"
                  stroke="#7CE0A3"
                  strokeWidth="2"
                />
                <text
                  x="320"
                  y="63"
                  textAnchor="middle"
                  fill="#7CE0A3"
                  fontSize="10"
                  fontWeight="700"
                >
                  33m MEZZANINE · CHILL PODS (1/PERSON)
                </text>
                <text
                  x="320"
                  y="76"
                  textAnchor="middle"
                  fill="#F7F4EB"
                  fontSize="9"
                >
                  Library · Refreshments · Fan · Heater · Flotation · Quilts
                </text>
              </g>

              {/* Resinous Agarwood Trunk Silhouette */}
              <rect
                x="264"
                y="118"
                width="112"
                height="240"
                rx="14"
                fill="#22160E"
                stroke="#8A5A2B"
                strokeWidth="2"
              />

              {/* Interactive 33m Canopy Studio Customiser & PayPal Store in Fallback */}
              <g
                onClick={handleOpenCanopyCustomizer}
                className="cursor-pointer"
                role="button"
                aria-label="Customise 33m Upstairs Canopy"
              >
                <rect
                  x="84"
                  y="88"
                  width="124"
                  height="46"
                  rx="6"
                  fill="#17271E"
                  stroke="#FFD166"
                  strokeWidth="2"
                />
                <text
                  x="146"
                  y="110"
                  textAnchor="middle"
                  fill="#FFD166"
                  fontSize="10"
                  fontWeight="700"
                >
                  CUSTOMISE UPSTAIRS
                </text>
                <text
                  x="146"
                  y="125"
                  textAnchor="middle"
                  fill="#F7F4EB"
                  fontSize="9"
                >
                  Floor · Hatch · Lanterns
                </text>
              </g>

              <g
                onClick={handleOpenCanopyPaypalStore}
                className="cursor-pointer"
                role="button"
                aria-label="Open 33m Canopy PayPal Maker Store"
              >
                <rect
                  x="432"
                  y="88"
                  width="124"
                  height="46"
                  rx="6"
                  fill="#17271E"
                  stroke="#7CE0A3"
                  strokeWidth="2"
                />
                <text
                  x="494"
                  y="110"
                  textAnchor="middle"
                  fill="#7CE0A3"
                  fontSize="10"
                  fontWeight="700"
                >
                  CANOPY PAYPAL STORE
                </text>
                <text
                  x="494"
                  y="125"
                  textAnchor="middle"
                  fill="#FFD166"
                  fontSize="9"
                >
                  Sell &amp; Buy Maker Work
                </text>
              </g>

              {/* Interactive Ground Entry Kiosk in Fallback Diagram */}
              <g
                onClick={handleOpenEntryKiosk}
                className="cursor-pointer"
                role="button"
                aria-label="Open Ground Entry Kiosk Sign-Up Dashboard"
              >
                <rect
                  x="58"
                  y="286"
                  width="112"
                  height="66"
                  rx="6"
                  fill="#1C130C"
                  stroke="#FFD166"
                  strokeWidth="2.5"
                />
                <text
                  x="114"
                  y="314"
                  textAnchor="middle"
                  fill="#FFD166"
                  fontSize="11"
                  fontWeight="700"
                >
                  ENTRY KIOSK
                </text>
                <text
                  x="114"
                  y="334"
                  textAnchor="middle"
                  fill="#7CE0A3"
                  fontSize="10"
                >
                  Map Interest →
                </text>
              </g>

              {/* Interactive Visible Old-Style Job Centre Board in Fallback Diagram */}
              <g
                onClick={() => handleOpenJobBoard()}
                className="cursor-pointer"
                role="button"
                aria-label="Open 0m Jay's Job Centre Vacancy Board"
              >
                <rect
                  x="392"
                  y="222"
                  width="184"
                  height="56"
                  rx="6"
                  fill="#0E4429"
                  stroke="#FFD166"
                  strokeWidth="2.5"
                />
                <text
                  x="484"
                  y="246"
                  textAnchor="middle"
                  fill="#FFFDF7"
                  fontSize="11"
                  fontWeight="700"
                >
                  JAY&apos;S JOB CENTRE
                </text>
                <text
                  x="484"
                  y="264"
                  textAnchor="middle"
                  fill="#FFE082"
                  fontSize="9.5"
                >
                  Beta Research · Drazella Easy Read
                </text>
              </g>

              {/* Interactive Welcome Boot & Shoe Character Bench in Fallback Diagram */}
              <g
                onClick={handleOpenShoeSelector}
                className="cursor-pointer"
                role="button"
                aria-label="Open Welcome Area Boot and Shoe Character Selector"
              >
                <rect
                  x="418"
                  y="290"
                  width="148"
                  height="62"
                  rx="6"
                  fill="#15241B"
                  stroke="#7CE0A3"
                  strokeWidth="2.5"
                />
                <text
                  x="492"
                  y="316"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="700"
                >
                  SHOE CHARACTERS
                </text>
                <text
                  x="492"
                  y="336"
                  textAnchor="middle"
                  fill="#FFD166"
                  fontSize="10"
                >
                  Wellies &amp; Work Shoes
                </text>
              </g>

              {/* Canopy Treehouse Platform */}
              <rect
                x="248"
                y="94"
                width="144"
                height="24"
                rx="4"
                fill="#1D2E24"
                stroke="#F7F4EB"
                strokeWidth="2"
              />

              {/* Central Vertical Pulley Cable */}
              <line
                x1="316"
                y1="118"
                x2="316"
                y2="356"
                stroke="#F7F4EB"
                strokeWidth="2.5"
              />
              <line
                x1="324"
                y1="118"
                x2="324"
                y2="356"
                stroke="#E5A93C"
                strokeWidth="2.5"
              />

              {/* Dynamic Pulley Lift Carriage */}
              <rect
                x="294"
                y={fallbackCarriageY}
                width="52"
                height="40"
                rx="5"
                fill="#141F19"
                stroke="#E5A93C"
                strokeWidth="2.5"
              />
              <rect
                x="306"
                y={fallbackCarriageY + 10}
                width="28"
                height="20"
                rx="2"
                fill="#7CE0A3"
              />

              {/* Root Sanctuary Base */}
              <line
                x1="48"
                y1="358"
                x2="592"
                y2="358"
                stroke="#F7F4EB"
                strokeWidth="3.5"
              />
            </svg>
          </div>
        )}

        {/* Per-User Sanctuary Top Bar */}
        <PassiveUserDashboard
          hud={hud}
          localProgress={localProgress}
          anyModalOpen={anyModalOpen}
          kioskOpen={kioskOpen}
          jobBoardOpen={jobBoardOpen}
          mezzanineOpen={mezzanineOpen}
          carerModalOpen={carerModalOpen}
          betaModalOpen={betaModalOpen}
          canopyStoreOpen={canopyPaypalStoreOpen}
          bankModalOpen={bankModalOpen}
          activeJobRefCode={activeJobSlip?.referenceCode ?? null}
          carerReminders={carerReminders}
          noticesVisible={noticesActive && !noticesDismissed && !anyModalOpen}
          onToggleEntryKiosk={handleToggleEntryKiosk}
          onOpenJobBoard={() => handleOpenJobBoard()}
          onOpenMezzanine={() => handleOpenMezzanine('pods')}
          onOpenCarerReminders={handleOpenCarerReminders}
          onDismissCarerStrip={handleDismissCarerStrip}
          onOpenBetaModal={() => handleOpenBetaModal()}
          onOpenCanopyPaypalStore={handleOpenCanopyPaypalStore}
          onOpenBankOfTreetop={() => handleOpenBankOfTreetop('savings')}
          onOpenShoeSelector={handleOpenShoeSelector}
          onReplayNotices={handleReplayNotices}
          onDismissNotices={dismissMeltingNotices}
          onSyncTreeProgress={handleSyncTreeProgress}
          onHabitEnergyEarned={handleHabitEnergyEarned}
          onHabitPassiveSync={handleHabitPassiveSync}
          onSpendEnergyClimbBoost={handleSpendEnergyClimbBoost}
        />

        {/* Non-Blocking Large-Font Pop-Up Notices That Melt Into the Canopy */}
        {!anyModalOpen && (
          <MeltingPopupOverlay
            replayNonce={replayNonce}
            dismissed={noticesDismissed}
            onAllSlidesMelted={handleAllSlidesMelted}
          />
        )}

        {/* Hideable 33m Canopy Active Session Card (Trade, Work, or Community) */}
        <CanopySessionPanel
          session={activeCanopySession}
          isHidden={canopySessionHidden}
          elevationMeters={hud?.elevationMeters ?? 0}
          anyDrawerOpen={anyModalOpen}
          localProgress={localProgress}
          onToggleHidden={setCanopySessionHidden}
          onUpdateSession={handleUpdateCanopySession}
          onUpdateLocalProgress={handleSyncTreeProgress}
          onGlideToCanopy={() =>
            handleGlideTo(33, '33m Treetop Canopy Session')
          }
          onOpenEntryKiosk={handleOpenEntryKiosk}
          onOpenCanopyCustomizer={handleOpenCanopyCustomizer}
          onOpenCanopyPaypalStore={handleOpenCanopyPaypalStore}
        />

        {/* Compact Ground Entry Kiosk Pop-Up */}
        <EntryKioskModal
          isOpen={kioskOpen}
          localProgress={localProgress}
          onUpdateLocalProgress={handleSyncTreeProgress}
          onLaunchCanopySession={handleLaunchCanopySession}
          onOpenShoeSelector={handleOpenShoeSelector}
          onClose={() => setKioskOpen(false)}
        />

        {/* 0m Courtyard Visible Old-Style Job Centre & Collaboration Rack */}
        <JobCentreBoardModal
          isOpen={jobBoardOpen}
          collab={collab}
          localProgress={localProgress}
          activeJobSlip={activeJobSlip}
          initialSelectedCardId={jobBoardInitialCardId}
          onSelectActiveJobSlip={setActiveJobSlip}
          onUpdateLocalProgress={handleSyncTreeProgress}
          onLaunchJobStation={handleLaunchJobStation}
          onOpenBetaResearch={() =>
            handleOpenBetaModal('Old-Style Job Centre & Collaboration')
          }
          onOpenBankOfTreetop={(tab) =>
            handleOpenBankOfTreetop(tab ?? 'savings')
          }
          onClose={() => setJobBoardOpen(false)}
        />

        {/* 33m Treetop Mezzanine — Library, Refreshments & 1-Per-Person Private Chill Pods */}
        <TreetopMezzanineModal
          isOpen={mezzanineOpen}
          initialTab={mezzanineInitialTab}
          initialPodId={mezzanineInitialPod}
          podsById={mergedPodsById}
          localClientKey={localPodVisitorKey}
          poisePercent={hud?.poisePercent ?? 100}
          calmScreenDimEnabled={calmScreenDimEnabled}
          selectedWellyPlushie={wellyPlushieId}
          highContrastFloor={highContrastFloor}
          onToggleCalmScreenDim={setCalmScreenDimEnabled}
          onSelectWellyPlushie={handleSelectWellyPlushie}
          onToggleHighContrastFloor={handleToggleHighContrastFloor}
          onUpdateLocalPod={handleUpdateLocalPod}
          onFocusMezzanineAngle={handleFocusMezzanineAngle}
          onEnjoyRefreshment={handleEnjoyRefreshment}
          onClose={() => setMezzanineOpen(false)}
        />

        {/* Carer Going-Out Checklist & Lift Pace Selector */}
        <CarerRemindersModal
          isOpen={carerModalOpen}
          remindersState={carerReminders}
          paceMode={hud?.paceMode ?? PaceMode.STEADY}
          onChangeReminders={handleChangeCarerReminders}
          onSelectPaceMode={handleSelectPace}
          onGlideTo={handleGlideTo}
          onClose={() => setCarerModalOpen(false)}
        />

        {/* Public Beta URL & UX Testing Walkthrough Modal */}
        <BetaShareModal
          isOpen={betaModalOpen}
          initialFocusArea={betaInitialFocusArea}
          onJumpToStation={handleBetaJumpToStation}
          onClose={() => setBetaModalOpen(false)}
        />

        {/* 0m Welcome Area Boot & Shoe Character Selector (Wellies & Work Shoes) */}
        <WelcomeShoeSelectorModal
          isOpen={shoeModalOpen}
          selection={shoeSelection}
          onChangeSelection={handleChangeShoeSelection}
          onFocusWelcomeBench={() => engineRef.current?.focusWelcomeShoeBench()}
          onFocusLiftCarriage={() =>
            engineRef.current?.glideToElevation(0, '0m Lift Footwear View')
          }
          onClose={() => setShoeModalOpen(false)}
        />

        {/* 33m Upstairs Canopy Customiser */}
        <CanopyStudioModal
          isOpen={canopyCustomizerOpen}
          studioConfig={studioConfig}
          inspectAngle={hud?.canopyInspectAngle ?? 'interior'}
          roofCutaway={hud?.roofCutaway ?? true}
          onChangeConfig={handleChangeStudioConfig}
          onSelectInspectAngle={handleSelectInspectAngle}
          onToggleRoofCutaway={handleToggleRoofCutaway}
          onOpenCanopyPaypalStore={handleOpenCanopyPaypalStore}
          onClose={() => setCanopyCustomizerOpen(false)}
        />

        {/* 33m Treetop Canopy PayPal Maker Store */}
        <CanopyPaypalStoreModal
          isOpen={canopyPaypalStoreOpen}
          localProgress={localProgress}
          onUpdateLocalProgress={handleSyncTreeProgress}
          onOpenCanopyCustomizer={handleOpenCanopyCustomizer}
          onOpenBankOfTreetop={() => handleOpenBankOfTreetop('savings')}
          onClose={() => setCanopyPaypalStoreOpen(false)}
        />

        {/* Bank of Treetop — Symbolic Special-Interest Stock Savings Guide & Unpaid Exchequer Desk (Not a Real Bank) */}
        <BankOfTreetopModal
          isOpen={bankModalOpen}
          initialTab={bankInitialTab}
          localProgress={localProgress}
          onUpdateLocalProgress={handleSyncTreeProgress}
          onOpenJobCentre={(cardId) => handleOpenJobBoard(cardId)}
          onOpenEntryKiosk={handleOpenEntryKiosk}
          onOpenCanopyStore={handleOpenCanopyPaypalStore}
          onClose={() => setBankModalOpen(false)}
        />

        {/* Embedded Agarwood Tree Lift Controls & Motivational Plaque Dock */}
        <AgarwoodLiftDock
          hud={hud}
          anyModalOpen={anyModalOpen}
          onHoldAscend={handleHoldAscend}
          onHoldDescend={handleHoldDescend}
          onToggleContinuous={handleToggleContinuous}
          onStopLift={handleStopLift}
          onGlideTo={handleGlideTo}
          onTogglePace={handleTogglePace}
          onSelectPace={handleSelectPace}
          onOpenCarerReminders={handleOpenCarerReminders}
          onOpenEntryKiosk={handleOpenEntryKiosk}
          onOpenJobBoard={() => handleOpenJobBoard()}
          onOpenMezzanine={() => handleOpenMezzanine('pods')}
          onOpenShoeSelector={handleOpenShoeSelector}
          onOpenCanopyCustomizer={handleOpenCanopyCustomizer}
          onOpenCanopyPaypalStore={handleOpenCanopyPaypalStore}
          onOpenBankOfTreetop={() => handleOpenBankOfTreetop('savings')}
        />
      </main>
    </ErrorBoundary>
  );
}
