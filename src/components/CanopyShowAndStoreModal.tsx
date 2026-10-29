import React, { useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Check,
  Compass,
  Eye,
  Flame,
  Hammer,
  Layers,
  Lightbulb,
  LogIn,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  CANOPY_FURNISHING_CATALOG,
  CANOPY_FURNISHING_KINDS,
  CANOPY_TRADE_FOCUSES,
  CanopyFurnishingKind,
  CanopyStudioConfig,
  CanopyTradeFocus,
  OperationType,
  STORE_NOTE_MAX_LENGTH,
  STORE_NOTE_MIN_LENGTH,
  STORE_PRICE_MAX,
  STORE_PRICE_MIN,
  STORE_TITLE_MAX_LENGTH,
  STORE_TITLE_MIN_LENGTH,
  TOOL_NAME_MAX_LENGTH,
  TOOL_NAME_MIN_LENGTH,
  TOOL_STORY_MAX_LENGTH,
  TOOL_STORY_MIN_LENGTH,
  TOOL_TRADE_CATEGORIES,
  TOOL_VISUAL_CATALOG,
  TOOL_VISUAL_KINDS,
  ToolTradeCategory,
  ToolVisualKind,
  TreeProgressState,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  VALID_DOC_ID_REGEX,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import { CanopyInspectAngle } from '../types/game';
import {
  evaluateEthicalIdeaForTokens,
  screenBootsOnGroundCensor,
  screenForHarmToHumansOrAnimals,
} from '../utils/ethicalGuard';

export type CanopyModalTab = 'inspect' | 'tools' | 'ideas' | 'store';

export interface StowedToolRecord {
  id: string;
  ownerId: string;
  username: string;
  toolName: string;
  tradeCategory: ToolTradeCategory;
  visualKind: ToolVisualKind;
  showAndTellStory: string;
  isSharedShowAndTell: boolean;
  createdAtMs: number;
  source: 'local' | 'cloud';
}

interface EthicalIdeaRecord {
  id: string;
  title: string;
  description: string;
  tokensAwarded: number;
  pillars: string[];
  createdAtMs: number;
}

interface StoreListingRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  itemKind: CanopyFurnishingKind;
  title: string;
  craftNote: string;
  priceTokens: number;
  status: 'available' | 'sold' | 'cancelled';
  buyerId: string;
  proceedsClaimed: boolean;
  createdAtMs: number;
}

export const LOCAL_TOOLS_STORAGE_KEY = 'jays_job_club_tools_of_trade_v1';
const LOCAL_ETHICAL_IDEAS_KEY = 'jays_job_club_ethical_ideas_v1';
const FIRST_TOOL_BONUS_KEY = 'jays_job_club_first_tool_bonus_v1';

export function loadLocalStowedTools(): StowedToolRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_TOOLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object'
      )
      .map((item, idx) => {
        const rawVisual = String(item.visualKind || '');
        const visualKind: ToolVisualKind = TOOL_VISUAL_KINDS.includes(
          rawVisual as ToolVisualKind
        )
          ? (rawVisual as ToolVisualKind)
          : 'joinery_plane';
        const rawCat = String(item.tradeCategory || '');
        const tradeCategory: ToolTradeCategory = TOOL_TRADE_CATEGORIES.includes(
          rawCat as ToolTradeCategory
        )
          ? (rawCat as ToolTradeCategory)
          : TOOL_VISUAL_CATALOG[visualKind].defaultCategory;

        return {
          id:
            typeof item.id === 'string' && VALID_DOC_ID_REGEX.test(item.id)
              ? item.id
              : `local_tool_${Date.now()}_${idx}`,
          ownerId: String(item.ownerId || 'local'),
          username: String(item.username || 'Club Member').slice(
            0,
            USERNAME_MAX_LENGTH
          ),
          toolName: String(item.toolName || 'Workshop Tool').slice(
            0,
            TOOL_NAME_MAX_LENGTH
          ),
          tradeCategory,
          visualKind,
          showAndTellStory: String(item.showAndTellStory || '').slice(
            0,
            TOOL_STORY_MAX_LENGTH
          ),
          isSharedShowAndTell: Boolean(item.isSharedShowAndTell),
          createdAtMs:
            typeof item.createdAtMs === 'number' ? item.createdAtMs : Date.now(),
          source: 'local' as const,
        };
      });
  } catch {
    return [];
  }
}

function saveLocalStowedTools(records: StowedToolRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_TOOLS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore restricted storage errors
  }
}

function loadLocalEthicalIdeas(): EthicalIdeaRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_ETHICAL_IDEAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is EthicalIdeaRecord =>
        Boolean(i) && typeof i === 'object' && typeof i.title === 'string'
    );
  } catch {
    return [];
  }
}

function saveLocalEthicalIdeas(records: EthicalIdeaRecord[]): void {
  try {
    window.localStorage.setItem(LOCAL_ETHICAL_IDEAS_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage errors
  }
}

function sanitizeUsername(raw: string): string {
  const trimmed = raw.trim().slice(0, USERNAME_MAX_LENGTH);
  return trimmed.length >= USERNAME_MIN_LENGTH ? trimmed : 'Club Member';
}

interface CanopyShowAndStoreModalProps {
  isOpen: boolean;
  initialTab?: CanopyModalTab;
  user: User | null;
  authReady: boolean;
  progress: TreeProgressState;
  studioConfig: CanopyStudioConfig;
  cloudStudioExists: boolean;
  inspectAngle: CanopyInspectAngle;
  canopyZoom: number;
  roofCutaway: boolean;
  onSelectInspectAngle: (angle: CanopyInspectAngle) => void;
  onChangeZoom: (zoom: number) => void;
  onToggleRoofCutaway: (cutaway: boolean) => void;
  onResetOrbit: () => void;
  onStowedToolsChanged: (visualKinds: ToolVisualKind[]) => void;
  onAwardTreehouseTokens: (amount: number, bannerMsg: string) => void;
  onPurchaseFurnishing: (
    kind: CanopyFurnishingKind,
    priceTokens: number,
    sellerLabel: string
  ) => void;
  onClaimSellerProceeds: (priceTokens: number, itemLabel: string) => void;
  onUpdatePlacedFurnishings: (nextFurnished: CanopyFurnishingKind[]) => void;
  onOpenFloorCustomizer: () => void;
  onClose: () => void;
}

const INSPECT_ANGLE_SPECS: {
  angle: CanopyInspectAngle;
  label: string;
  detail: string;
}[] = [
  {
    angle: 'overview',
    label: 'Canopy Overview',
    detail: 'Full 33m summit framing with beacons, pulley dock & eaves',
  },
  {
    angle: 'interior',
    label: 'Interior & Floor',
    detail: 'Close look inside your Personal Trade booth & non-slip floor',
  },
  {
    angle: 'tools_rack',
    label: 'Tools Show & Tell Rack',
    detail: 'Zoom onto the left cedar pegboard & stowed Tools of the Trade',
  },
  {
    angle: 'lanterns_floor',
    label: 'Lanterns & Furnishings',
    detail: 'Inspect hanging brass lanterns, garlands, rugs & planter boxes',
  },
];

const ETHICAL_STARTER_PROMPTS: { title: string; description: string }[] = [
  {
    title: 'Neighborhood Solar Lantern Repair Bench',
    description:
      'Set up a quiet weekend bench where neighbors mend broken low-voltage solar path lights using reclaimed cedar and safe soldering tools instead of tossing them out.',
  },
  {
    title: 'Humane Pollinator & Songbird Cedar Nesting Boxes',
    description:
      'Build untreated red cedar nesting shelters and native fern planter boxes with bee-safe finishes to give local songbirds and pollinators safe refuge.',
  },
  {
    title: 'Sensory-Friendly Loom & Textile Mending Share',
    description:
      'Organize step-by-step wool darning and shuttle weaving cards so all-ages community members can repair winter coats and blankets at their own pace.',
  },
];

export const CanopyShowAndStoreModal: React.FC<CanopyShowAndStoreModalProps> = ({
  isOpen,
  initialTab = 'inspect',
  user,
  authReady,
  progress,
  studioConfig,
  cloudStudioExists,
  inspectAngle,
  canopyZoom,
  roofCutaway,
  onSelectInspectAngle,
  onChangeZoom,
  onToggleRoofCutaway,
  onResetOrbit,
  onStowedToolsChanged,
  onAwardTreehouseTokens,
  onPurchaseFurnishing,
  onClaimSellerProceeds,
  onUpdatePlacedFurnishings,
  onOpenFloorCustomizer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<CanopyModalTab>(initialTab);
  const [authBusy, setAuthBusy] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [safetyBlockMsg, setSafetyBlockMsg] = useState<string | null>(null);

  // PublicProfile state for Firestore relational rules
  const [profileExists, setProfileExists] = useState(false);
  const [memberHandle, setMemberHandle] = useState('Club Member');

  // Tools of the Trade state
  const [localTools, setLocalTools] = useState<StowedToolRecord[]>(() =>
    loadLocalStowedTools()
  );
  const [cloudMyTools, setCloudMyTools] = useState<StowedToolRecord[]>([]);
  const [clubSharedTools, setClubSharedTools] = useState<StowedToolRecord[]>([]);
  const [toolComposerOpen, setToolComposerOpen] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolVisual, setToolVisual] = useState<ToolVisualKind>('joinery_plane');
  const [toolCategory, setToolCategory] = useState<ToolTradeCategory>(
    'Woodcraft & Joinery'
  );
  const [toolStory, setToolStory] = useState('');
  const [shareToolInClub, setShareToolInClub] = useState(true);
  const [savingTool, setSavingTool] = useState(false);

  // Ethical Idea Bench state
  const [ethicalIdeas, setEthicalIdeas] = useState<EthicalIdeaRecord[]>(() =>
    loadLocalEthicalIdeas()
  );
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDescription, setIdeaDescription] = useState('');
  const [ideaVerdictNotice, setIdeaVerdictNotice] = useState<{
    tone: 'ok' | 'warn';
    text: string;
  } | null>(null);

  // Store state
  const [availableListings, setAvailableListings] = useState<
    StoreListingRecord[]
  >([]);
  const [mySellerListings, setMySellerListings] = useState<StoreListingRecord[]>(
    []
  );
  const [listingComposerOpen, setListingComposerOpen] = useState(false);
  const [listingKind, setListingKind] = useState<CanopyFurnishingKind>(
    'brass_hanging_lantern'
  );
  const [listingTitle, setListingTitle] = useState('');
  const [listingNote, setListingNote] = useState('');
  const [listingPrice, setListingPrice] = useState<number>(3);
  const [savingListing, setSavingListing] = useState(false);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load signed-in member's PublicProfile
  useEffect(() => {
    if (!authReady || !user) {
      setProfileExists(false);
      setMemberHandle('Club Member');
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          setProfileExists(true);
          setMemberHandle(
            sanitizeUsername(String(data.username || user.displayName || 'Club Member'))
          );
        } else {
          setProfileExists(false);
          setMemberHandle(sanitizeUsername(user.displayName || 'Club Member'));
        }
      } catch (err) {
        if (!cancelled && !isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.GET, `publicProfiles/${user.uid}`);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Listen to signed-in member's stowed tools + Club Show & Tell Gallery
  useEffect(() => {
    if (!authReady || !user) {
      setCloudMyTools([]);
      setClubSharedTools([]);
      return;
    }

    const myQuery = query(
      collection(db, 'toolsOfTrade'),
      where('ownerId', '==', user.uid),
      limit(30)
    );
    const sharedQuery = query(
      collection(db, 'toolsOfTrade'),
      where('isSharedShowAndTell', '==', true),
      limit(40)
    );

    const parseToolSnap = (d: Record<string, unknown>, id: string): StowedToolRecord => {
      const rawVis = String(d.visualKind || '');
      const visualKind: ToolVisualKind = TOOL_VISUAL_KINDS.includes(
        rawVis as ToolVisualKind
      )
        ? (rawVis as ToolVisualKind)
        : 'joinery_plane';
      const rawCat = String(d.tradeCategory || '');
      const tradeCategory: ToolTradeCategory = TOOL_TRADE_CATEGORIES.includes(
        rawCat as ToolTradeCategory
      )
        ? (rawCat as ToolTradeCategory)
        : TOOL_VISUAL_CATALOG[visualKind].defaultCategory;
      const createdTs = d.createdAt as Timestamp | null;
      return {
        id,
        ownerId: String(d.ownerId || ''),
        username: String(d.username || 'Club Member'),
        toolName: String(d.toolName || 'Workshop Tool'),
        tradeCategory,
        visualKind,
        showAndTellStory: String(d.showAndTellStory || ''),
        isSharedShowAndTell: Boolean(d.isSharedShowAndTell),
        createdAtMs: createdTs?.toMillis ? createdTs.toMillis() : Date.now(),
        source: 'cloud',
      };
    };

    const unsubMine = onSnapshot(
      myQuery,
      (snap) => {
        const list: StowedToolRecord[] = [];
        snap.forEach((docSnap) =>
          list.push(parseToolSnap(docSnap.data(), docSnap.id))
        );
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setCloudMyTools(list);
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'toolsOfTrade');
        }
      }
    );

    const unsubShared = onSnapshot(
      sharedQuery,
      (snap) => {
        const list: StowedToolRecord[] = [];
        snap.forEach((docSnap) =>
          list.push(parseToolSnap(docSnap.data(), docSnap.id))
        );
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setClubSharedTools(list);
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'toolsOfTrade');
        }
      }
    );

    return () => {
      unsubMine();
      unsubShared();
    };
  }, [authReady, user]);

  // Listen to Player-to-Player Store Listings when signed in and store tab open
  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setAvailableListings([]);
      setMySellerListings([]);
      return;
    }

    const parseListing = (
      d: Record<string, unknown>,
      id: string
    ): StoreListingRecord => {
      const rawKind = String(d.itemKind || '');
      const itemKind: CanopyFurnishingKind = CANOPY_FURNISHING_KINDS.includes(
        rawKind as CanopyFurnishingKind
      )
        ? (rawKind as CanopyFurnishingKind)
        : 'brass_hanging_lantern';
      const createdTs = d.createdAt as Timestamp | null;
      const rawStatus = String(d.status || 'available');
      const status: 'available' | 'sold' | 'cancelled' =
        rawStatus === 'sold' || rawStatus === 'cancelled'
          ? rawStatus
          : 'available';

      return {
        id,
        sellerId: String(d.sellerId || ''),
        sellerName: String(d.sellerName || 'Club Crafter'),
        itemKind,
        title: String(d.title || CANOPY_FURNISHING_CATALOG[itemKind].label),
        craftNote: String(d.craftNote || ''),
        priceTokens:
          typeof d.priceTokens === 'number'
            ? Math.max(1, Math.floor(d.priceTokens))
            : 3,
        status,
        buyerId: String(d.buyerId || ''),
        proceedsClaimed: Boolean(d.proceedsClaimed),
        createdAtMs: createdTs?.toMillis ? createdTs.toMillis() : Date.now(),
      };
    };

    const availQ = query(
      collection(db, 'storeListings'),
      where('status', '==', 'available'),
      limit(50)
    );
    const sellerQ = query(
      collection(db, 'storeListings'),
      where('sellerId', '==', user.uid),
      limit(30)
    );

    const unsubAvail = onSnapshot(
      availQ,
      (snap) => {
        const list: StoreListingRecord[] = [];
        snap.forEach((docSnap) =>
          list.push(parseListing(docSnap.data(), docSnap.id))
        );
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setAvailableListings(list);
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'storeListings');
        }
      }
    );

    const unsubSeller = onSnapshot(
      sellerQ,
      (snap) => {
        const list: StoreListingRecord[] = [];
        snap.forEach((docSnap) =>
          list.push(parseListing(docSnap.data(), docSnap.id))
        );
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setMySellerListings(list);
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'storeListings');
        }
      }
    );

    return () => {
      unsubAvail();
      unsubSeller();
    };
  }, [isOpen, authReady, user]);

  // Synchronize active 3D pegboard visual tools whenever local/cloud tools change
  const activeMyTools = useMemo(() => {
    if (!user) return localTools;
    // Combine cloud tools + any unsynced local tools so 3D pegboard never loses a tool
    const byVisual = new Map<string, StowedToolRecord>();
    cloudMyTools.forEach((t) => byVisual.set(t.id, t));
    localTools.forEach((t) => byVisual.set(t.id, t));
    return Array.from(byVisual.values()).sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
  }, [user, cloudMyTools, localTools]);

  useEffect(() => {
    const kinds = Array.from(new Set(activeMyTools.map((t) => t.visualKind)));
    onStowedToolsChanged(kinds);
  }, [activeMyTools, onStowedToolsChanged]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setSafetyBlockMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setBannerNotice('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // --- TAB 2 HANDLERS: TOOLS OF THE TRADE SHOW & TELL ---
  const handleStowTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSafetyBlockMsg(null);
    setBannerNotice(null);

    const cleanName = toolName.trim().slice(0, TOOL_NAME_MAX_LENGTH);
    const cleanStory = toolStory.trim().slice(0, TOOL_STORY_MAX_LENGTH);
    const cleanHandle = sanitizeUsername(memberHandle);

    if (cleanName.length < TOOL_NAME_MIN_LENGTH) {
      setSafetyBlockMsg(
        `Tool name must be between ${TOOL_NAME_MIN_LENGTH} and ${TOOL_NAME_MAX_LENGTH} characters.`
      );
      return;
    }
    if (cleanStory.length < TOOL_STORY_MIN_LENGTH) {
      setSafetyBlockMsg(
        `Please share at least ${TOOL_STORY_MIN_LENGTH} characters explaining how this tool helps your craft or outreach.`
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanName} ${cleanStory}`,
      'Canopy Tools Rack'
    );
    if (!censor.allowed) {
      setSafetyBlockMsg(
        censor.reason ||
          'Tree "Boots on Ground" Censor: Please remove rude or unsuitable language before mounting this tool.'
      );
      return;
    }

    const screen = screenForHarmToHumansOrAnimals(
      `${cleanName} ${cleanStory}`
    );
    if (!screen.safe) {
      setSafetyBlockMsg(
        screen.reason ||
          'Blocked: Tools representing harm to humans or animals cannot be stored in the Canopy.'
      );
      return;
    }

    setSavingTool(true);
    const awardFirstToolBonusIfEligible = () => {
      try {
        if (!window.localStorage.getItem(FIRST_TOOL_BONUS_KEY)) {
          window.localStorage.setItem(FIRST_TOOL_BONUS_KEY, '1');
          onAwardTreehouseTokens(
            1,
            `Stowed "${cleanName}" on your Canopy Show & Tell Rack · +1 Treehouse Token earned!`
          );
          return true;
        }
      } catch {
        // Ignore storage errors
      }
      return false;
    };

    if (user && VALID_DOC_ID_REGEX.test(user.uid)) {
      const newToolRef = doc(collection(db, 'toolsOfTrade'));
      const toolPath = `toolsOfTrade/${newToolRef.id}`;
      try {
        const batch = writeBatch(db);
        if (!profileExists) {
          batch.set(doc(db, 'publicProfiles', user.uid), {
            uid: user.uid,
            username: cleanHandle,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        batch.set(newToolRef, {
          ownerId: user.uid,
          username: cleanHandle,
          toolName: cleanName,
          tradeCategory: toolCategory,
          visualKind: toolVisual,
          showAndTellStory: cleanStory,
          isSharedShowAndTell: shareToolInClub,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        setProfileExists(true);
        setToolComposerOpen(false);
        setToolName('');
        setToolStory('');
        onSelectInspectAngle('tools_rack');
        const gotBonus = awardFirstToolBonusIfEligible();
        setBannerNotice(
          gotBonus
            ? `Mounted "${cleanName}" on the 3D Show & Tell Rack · +1 Treehouse Token awarded!`
            : `Mounted "${cleanName}" on your 3D Canopy Show & Tell Rack.`
        );
      } catch (err) {
        if (isQuotaExceededError(err)) {
          setSafetyBlockMsg(
            'Daily Firestore quota reached. Saving locally on this device instead.'
          );
        } else {
          handleFirestoreError(err, OperationType.CREATE, toolPath);
        }
      } finally {
        setSavingTool(false);
      }
      return;
    }

    // Local stow when signed out
    const now = Date.now();
    const record: StowedToolRecord = {
      id: `local_tool_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId: 'local',
      username: cleanHandle,
      toolName: cleanName,
      tradeCategory: toolCategory,
      visualKind: toolVisual,
      showAndTellStory: cleanStory,
      isSharedShowAndTell: shareToolInClub,
      createdAtMs: now,
      source: 'local',
    };
    const nextLocal = [record, ...localTools];
    setLocalTools(nextLocal);
    saveLocalStowedTools(nextLocal);
    setSavingTool(false);
    setToolComposerOpen(false);
    setToolName('');
    setToolStory('');
    onSelectInspectAngle('tools_rack');
    const gotBonus = awardFirstToolBonusIfEligible();
    setBannerNotice(
      gotBonus
        ? `Mounted "${cleanName}" on the 3D Show & Tell Rack · +1 Treehouse Token awarded!`
        : `Mounted "${cleanName}" on your 3D Canopy Show & Tell Rack.`
    );
  };

  const handleRemoveTool = async (tool: StowedToolRecord) => {
    if (tool.source === 'cloud' && user) {
      const targetPath = `toolsOfTrade/${tool.id}`;
      try {
        await deleteDoc(doc(db, 'toolsOfTrade', tool.id));
      } catch (err) {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.DELETE, targetPath);
        }
      }
      return;
    }
    const next = localTools.filter((t) => t.id !== tool.id);
    setLocalTools(next);
    saveLocalStowedTools(next);
  };

  // --- TAB 3 HANDLERS: ETHICAL IDEA BENCH (TREEHOUSE TOKENS) ---
  const handleEvaluateIdea = (e: React.FormEvent) => {
    e.preventDefault();
    setSafetyBlockMsg(null);
    setBannerNotice(null);
    setIdeaVerdictNotice(null);

    const verdict = evaluateEthicalIdeaForTokens(ideaTitle, ideaDescription);
    if (verdict.isHarmful) {
      setSafetyBlockMsg(verdict.feedback);
      setIdeaVerdictNotice({ tone: 'warn', text: verdict.feedback });
      return;
    }

    if (!verdict.isSoundAndEthical || verdict.tokensAwarded <= 0) {
      setBannerNotice(verdict.feedback);
      setIdeaVerdictNotice({ tone: 'warn', text: verdict.feedback });
      return;
    }

    const normalizedTitle = ideaTitle.trim().toLowerCase();
    const normalizedDesc = ideaDescription.trim().toLowerCase();
    if (
      ethicalIdeas.some(
        (prev) =>
          prev.title.trim().toLowerCase() === normalizedTitle &&
          prev.description.trim().toLowerCase() === normalizedDesc
      )
    ) {
      const dupMsg =
        'This exact ethical idea & description is already recorded in your ledger. Add a new step, angle, or title to earn additional Treehouse Tokens!';
      setBannerNotice(dupMsg);
      setIdeaVerdictNotice({ tone: 'warn', text: dupMsg });
      return;
    }

    const newIdea: EthicalIdeaRecord = {
      id: `idea_${Date.now()}`,
      title: ideaTitle.trim().slice(0, 100),
      description: ideaDescription.trim().slice(0, 800),
      tokensAwarded: verdict.tokensAwarded,
      pillars: verdict.pillars,
      createdAtMs: Date.now(),
    };

    const nextIdeas = [newIdea, ...ethicalIdeas];
    setEthicalIdeas(nextIdeas);
    saveLocalEthicalIdeas(nextIdeas);
    setIdeaTitle('');
    setIdeaDescription('');
    onAwardTreehouseTokens(verdict.tokensAwarded, verdict.feedback);
    setBannerNotice(verdict.feedback);
    setIdeaVerdictNotice({ tone: 'ok', text: verdict.feedback });
  };

  // --- TAB 4 HANDLERS: PLAYER-TO-PLAYER LANTERN & DECOR STORE ---
  const persistStudioFurnishingsToCloud = async (
    nextFurnished: CanopyFurnishingKind[]
  ) => {
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;
    const studioRef = doc(db, 'canopyStudios', user.uid);
    const studioPath = `canopyStudios/${user.uid}`;
    try {
      if (cloudStudioExists) {
        await updateDoc(studioRef, {
          studioName: studioConfig.studioName,
          tradeFocus: studioConfig.tradeFocus,
          floorStyle: studioConfig.floorStyle,
          trimAccent: studioConfig.trimAccent,
          safetyGateClosed: studioConfig.safetyGateClosed,
          furnishedItems: nextFurnished,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(studioRef, {
          uid: user.uid,
          studioName: studioConfig.studioName,
          tradeFocus: studioConfig.tradeFocus,
          floorStyle: studioConfig.floorStyle,
          trimAccent: studioConfig.trimAccent,
          safetyGateClosed: studioConfig.safetyGateClosed,
          furnishedItems: nextFurnished,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        handleFirestoreError(
          err,
          cloudStudioExists ? OperationType.UPDATE : OperationType.CREATE,
          studioPath
        );
      }
    }
  };

  const handleTogglePlacedFurnishing = (kind: CanopyFurnishingKind) => {
    const currentlyPlaced = studioConfig.furnishedItems.includes(kind);
    const nextFurnished = currentlyPlaced
      ? studioConfig.furnishedItems.filter((k) => k !== kind)
      : Array.from(new Set([...studioConfig.furnishedItems, kind])).slice(0, 6);

    onUpdatePlacedFurnishings(nextFurnished);
    onSelectInspectAngle('lanterns_floor');
    void persistStudioFurnishingsToCloud(nextFurnished);
    setBannerNotice(
      currentlyPlaced
        ? `Stowed ${CANOPY_FURNISHING_CATALOG[kind].label} in your Canopy chest.`
        : `Placed & illuminated ${CANOPY_FURNISHING_CATALOG[kind].label} in your 33m Canopy!`
    );
  };

  const handlePublishPlayerListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;

    setSafetyBlockMsg(null);
    setBannerNotice(null);

    const cleanTitle = listingTitle.trim().slice(0, STORE_TITLE_MAX_LENGTH);
    const cleanNote = listingNote.trim().slice(0, STORE_NOTE_MAX_LENGTH);
    const cleanSeller = sanitizeUsername(memberHandle);
    const cleanPrice = Math.min(
      STORE_PRICE_MAX,
      Math.max(STORE_PRICE_MIN, Math.floor(listingPrice))
    );

    if (cleanTitle.length < STORE_TITLE_MIN_LENGTH) {
      setSafetyBlockMsg(
        `Listing title must be at least ${STORE_TITLE_MIN_LENGTH} characters.`
      );
      return;
    }
    if (cleanNote.length < STORE_NOTE_MIN_LENGTH) {
      setSafetyBlockMsg(
        `Craft note must be at least ${STORE_NOTE_MIN_LENGTH} characters.`
      );
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanTitle} ${cleanNote}`,
      'Canopy Lantern Store'
    );
    if (!censor.allowed) {
      setSafetyBlockMsg(
        censor.reason ||
          'Tree "Boots on Ground" Censor: Please remove rude or unsuitable language from your craft listing.'
      );
      return;
    }

    const screen = screenForHarmToHumansOrAnimals(`${cleanTitle} ${cleanNote}`);
    if (!screen.safe) {
      setSafetyBlockMsg(
        screen.reason ||
          'Blocked: Store listings representing harm to humans or animals are prohibited.'
      );
      return;
    }

    setSavingListing(true);
    const newListingRef = doc(collection(db, 'storeListings'));
    const listingPath = `storeListings/${newListingRef.id}`;

    try {
      const batch = writeBatch(db);
      if (!profileExists) {
        batch.set(doc(db, 'publicProfiles', user.uid), {
          uid: user.uid,
          username: cleanSeller,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(newListingRef, {
        sellerId: user.uid,
        sellerName: cleanSeller,
        itemKind: listingKind,
        title: cleanTitle,
        craftNote: cleanNote,
        priceTokens: cleanPrice,
        status: 'available',
        buyerId: '',
        proceedsClaimed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setProfileExists(true);
      setListingComposerOpen(false);
      setListingTitle('');
      setListingNote('');
      setBannerNotice(
        `Listed "${cleanTitle}" in the Player Lantern & Furnishings Store for ${cleanPrice} Treehouse Tokens.`
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setSafetyBlockMsg('Daily Firestore quota reached. Please try again tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.CREATE, listingPath);
      }
    } finally {
      setSavingListing(false);
    }
  };

  const handleBuyFromOtherPlayer = async (listing: StoreListingRecord) => {
    if (!user) return;
    if (progress.treehouseTokens < listing.priceTokens) {
      setSafetyBlockMsg(
        `You need ${listing.priceTokens} Treehouse Tokens (currently ${progress.treehouseTokens}). Share a sound ethical idea in the Ethical Idea tab to earn more!`
      );
      return;
    }

    setBusyListingId(listing.id);
    setSafetyBlockMsg(null);
    const targetPath = `storeListings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'storeListings', listing.id), {
        status: 'sold',
        buyerId: user.uid,
        updatedAt: serverTimestamp(),
      });
      onPurchaseFurnishing(
        listing.itemKind,
        listing.priceTokens,
        listing.sellerName
      );
      const nextPlaced = Array.from(
        new Set([...studioConfig.furnishedItems, listing.itemKind])
      ).slice(0, 6);
      void persistStudioFurnishingsToCloud(nextPlaced);
      onSelectInspectAngle('lanterns_floor');
      setBannerNotice(
        `Purchased "${listing.title}" from ${listing.sellerName} and placed it in your 3D Canopy!`
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setSafetyBlockMsg('Daily Firestore quota reached. Please try again tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.UPDATE, targetPath);
      }
    } finally {
      setBusyListingId(null);
    }
  };

  const handleClaimSoldListing = async (listing: StoreListingRecord) => {
    if (!user) return;
    setBusyListingId(listing.id);
    const targetPath = `storeListings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'storeListings', listing.id), {
        proceedsClaimed: true,
        updatedAt: serverTimestamp(),
      });
      onClaimSellerProceeds(listing.priceTokens, listing.title);
      setBannerNotice(
        `Claimed +${listing.priceTokens} Treehouse Tokens from your sold craft "${listing.title}"!`
      );
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, targetPath);
      }
    } finally {
      setBusyListingId(null);
    }
  };

  const handleCancelMyListing = async (listing: StoreListingRecord) => {
    if (!user) return;
    setBusyListingId(listing.id);
    const targetPath = `storeListings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'storeListings', listing.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      setBannerNotice(`Removed "${listing.title}" from the store.`);
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, targetPath);
      }
    } finally {
      setBusyListingId(null);
    }
  };

  const handleBuyFromCoopSupply = (kind: CanopyFurnishingKind) => {
    setSafetyBlockMsg(null);
    const spec = CANOPY_FURNISHING_CATALOG[kind];
    if (progress.ownedFurnishings.includes(kind)) {
      handleTogglePlacedFurnishing(kind);
      return;
    }
    if (progress.treehouseTokens < spec.coopSupplyPrice) {
      setSafetyBlockMsg(
        `Needs ${spec.coopSupplyPrice} Treehouse Tokens (you have ${progress.treehouseTokens}). Open the "Ethical Ideas" tab to earn Treehouse Tokens for sound, humane ideas!`
      );
      return;
    }

    onPurchaseFurnishing(kind, spec.coopSupplyPrice, 'Workshop Co-op Supply');
    const nextPlaced = Array.from(
      new Set([...studioConfig.furnishedItems, kind])
    ).slice(0, 6);
    void persistStudioFurnishingsToCloud(nextPlaced);
    onSelectInspectAngle('lanterns_floor');
    setBannerNotice(
      `Acquired ${spec.label} (${spec.coopSupplyPrice} Treehouse Tokens) and illuminated it in your 3D Canopy!`
    );
  };

  const otherPlayersAvailableListings = availableListings.filter(
    (l) => !user || l.sellerId !== user.uid
  );
  const unclaimedSoldListings = mySellerListings.filter(
    (l) => l.status === 'sold' && !l.proceedsClaimed
  );
  const myActiveListings = mySellerListings.filter(
    (l) => l.status === 'available'
  );

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex items-stretch justify-end p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="canopy-inspect-store-heading"
    >
      <div className="pointer-events-auto w-full max-w-[560px] h-full flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="canopy-inspect-store-heading"
                className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Canopy Inspector · Show &amp; Tell · Lantern Store
              </h2>
              <p className="mt-0.5 text-xs text-[#C6D2C9] font-mono tabular-nums">
                Treehouse Tokens:{' '}
                <strong className="text-[#E5A93C]">
                  {progress.treehouseTokens}
                </strong>{' '}
                · Stowed Tools: {activeMyTools.length} · Lit Furnishings:{' '}
                {studioConfig.furnishedItems.length}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Canopy Inspector and Store"
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>

          {/* 4-Way Functional Segmented Tab Bar */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#101914] rounded-lg border border-[#F7F4EB]/12"
            role="tablist"
            aria-label="Canopy features"
          >
            {(
              [
                ['inspect', 'Inspect 3D', Eye],
                ['tools', 'Show & Tell', Hammer],
                ['ideas', 'Ethical Ideas', Lightbulb],
                ['store', 'Lantern Store', ShoppingBag],
              ] as const
            ).map(([tabId, label, Icon]) => {
              const selected = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setActiveTab(tabId);
                    setSafetyBlockMsg(null);
                    setBannerNotice(null);
                    if (tabId === 'tools') onSelectInspectAngle('tools_rack');
                    if (tabId === 'store') onSelectInspectAngle('lanterns_floor');
                  }}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-[#E5A93C] text-[#101813]'
                      : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Safety Charter Block Notice */}
          {safetyBlockMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-[#2B1916] border border-[#F4A261]/65 text-xs text-[#F7F4EB] flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-[#F4A261] shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-[#F4A261]">
                  Humane &amp; Ethical Workshop Protection
                </p>
                <p className="leading-relaxed text-[#F2E3DC]">{safetyBlockMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => setSafetyBlockMsg(null)}
                className="text-[#C8B8B0] hover:text-[#F7F4EB] font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Positive Feedback Notice */}
          {bannerNotice && (
            <div className="p-3.5 rounded-lg bg-[#17281E] border border-[#7CE0A3]/45 text-xs text-[#F7F4EB] flex items-center justify-between gap-3">
              <span>{bannerNotice}</span>
              <button
                type="button"
                onClick={() => setBannerNotice(null)}
                className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =========================================================
              TAB 1: HOW TO INSPECT THE 33M CANOPY
             ========================================================= */}
          {activeTab === 'inspect' && (
            <div className="space-y-6">
              <section className="space-y-2.5">
                <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                  01. How to Inspect Your 33m Canopy Anytime
                </h3>
                <div className="space-y-2 text-xs text-[#D2DDD5] leading-relaxed">
                  <p>
                    <strong className="text-[#F7F4EB]">
                      1. Instant Summit Camera (No Climb Required):
                    </strong>{' '}
                    Opening this panel (`V`) glides your camera straight up to
                    the 33m Canopy even while your Lift rests safely at `0m`.
                  </p>
                  <p>
                    <strong className="text-[#F7F4EB]">
                      2. Live 360° Drag-to-Orbit &amp; Wheel Zoom:
                    </strong>{' '}
                    Drag horizontally or vertically anywhere on the open 3D
                    viewport on the left to orbit around your Canopy, and roll
                    your mouse wheel to zoom in close.
                  </p>
                  <p>
                    <strong className="text-[#F7F4EB]">
                      3. Lift the Shingle Roof Cutaway:
                    </strong>{' '}
                    Toggle Roof Cutaway below to raise the octagonal roof and
                    peer straight inside at your Show &amp; Tell tool rack,
                    lanterns, rugs, and non-slip floor.
                  </p>
                </div>
              </section>

              {/* 4 Dedicated Camera Inspection Angles */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-[#F7F4EB]">
                    02. Select Canopy Camera Focus
                  </h3>
                  <span className="text-xs font-mono text-[#9FB0A4]">
                    4 Summit Angles
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {INSPECT_ANGLE_SPECS.map((spec) => {
                    const active = inspectAngle === spec.angle;
                    return (
                      <button
                        key={spec.angle}
                        type="button"
                        onClick={() => onSelectInspectAngle(spec.angle)}
                        className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#1D2E24] border-[#E5A93C]'
                            : 'bg-[#15211A] border-[#F7F4EB]/14 hover:border-[#F7F4EB]/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#F7F4EB]">
                            {spec.label}
                          </span>
                          {active && (
                            <Check className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-[#B8C6BC] leading-snug">
                          {spec.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Roof Cutaway, Zoom Slider & Orbit Reset */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#F7F4EB]">
                      03. Shingle Roof Cutaway &amp; Optical Zoom
                    </h3>
                    <p className="mt-0.5 text-xs text-[#B8C6BC]">
                      Raise the Canopy roof for unobstructed interior inspection.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleRoofCutaway(!roofCutaway)}
                    className={`min-h-[40px] px-4 py-2 rounded-lg border text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      roofCutaway
                        ? 'bg-[#E5A93C] text-[#101813] border-[#E5A93C]'
                        : 'bg-[#18261E] text-[#F7F4EB] border-[#F7F4EB]/20 hover:border-[#E5A93C]'
                    }`}
                  >
                    {roofCutaway ? 'Roof Cutaway: Open' : 'Lift Roof Cutaway'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="canopy-zoom-slider"
                      className="font-semibold text-[#D6E0D9] inline-flex items-center gap-1.5"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Inspection Zoom</span>
                    </label>
                    <span className="font-mono tabular-nums text-[#E5A93C]">
                      {Math.round(canopyZoom * 100)}%
                    </span>
                  </div>
                  <input
                    id="canopy-zoom-slider"
                    type="range"
                    min={0.65}
                    max={1.55}
                    step={0.05}
                    value={canopyZoom}
                    onChange={(e) => onChangeZoom(parseFloat(e.target.value))}
                    className="w-full accent-[#E5A93C] cursor-pointer"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onResetOrbit}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#18261E] border border-[#F7F4EB]/16 text-xs font-semibold text-[#D6E0D9] hover:text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Reset Camera Orbit &amp; Zoom</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenFloorCustomizer}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#18261E] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Customize Floor &amp; Hatch (T)</span>
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* =========================================================
              TAB 2: STORE 'TOOLS OF THE TRADE' FOR SHOW & TELL
             ========================================================= */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <section className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                      Tools of the Trade · Show &amp; Tell Locker
                    </h3>
                    <p className="text-xs text-[#C6D2C9]">
                      Mount your safe craft or outreach tools on the 3D Canopy
                      pegboard for Show and Tell.
                    </p>
                  </div>

                  {!toolComposerOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setToolComposerOpen(true);
                        setSafetyBlockMsg(null);
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Store Tool for Show &amp; Tell</span>
                    </button>
                  )}
                </div>

                {toolComposerOpen && (
                  <form
                    onSubmit={handleStowTool}
                    className="p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/45 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#F7F4EB]">
                        Mount a Tool on Your 3D Show &amp; Tell Pegboard
                      </span>
                      <button
                        type="button"
                        onClick={() => setToolComposerOpen(false)}
                        className="text-xs text-[#B8C6BC] hover:text-[#F7F4EB] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* 3D Pegboard Visual Slot Picker */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#D6E0D9]">
                        3D Pegboard Tool Model
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {TOOL_VISUAL_KINDS.map((vk) => {
                          const spec = TOOL_VISUAL_CATALOG[vk];
                          const active = toolVisual === vk;
                          return (
                            <button
                              key={vk}
                              type="button"
                              onClick={() => {
                                setToolVisual(vk);
                                setToolCategory(spec.defaultCategory);
                              }}
                              className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#1F3327] border-[#E5A93C]'
                                  : 'bg-[#111B15] border-[#F7F4EB]/12 hover:border-[#F7F4EB]/35'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#F7F4EB]">
                                {spec.label}
                              </div>
                              <div className="mt-0.5 text-[11px] text-[#9FB0A4]">
                                {spec.slotNote}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="stow-tool-name"
                          className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                        >
                          Tool Name
                        </label>
                        <input
                          id="stow-tool-name"
                          type="text"
                          required
                          minLength={TOOL_NAME_MIN_LENGTH}
                          maxLength={TOOL_NAME_MAX_LENGTH}
                          value={toolName}
                          onChange={(e) => setToolName(e.target.value)}
                          placeholder="e.g., Grandfather's Cedar Block Plane"
                          className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="stow-tool-category"
                          className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                        >
                          Trade or Outreach Focus
                        </label>
                        <select
                          id="stow-tool-category"
                          value={toolCategory}
                          onChange={(e) =>
                            setToolCategory(e.target.value as ToolTradeCategory)
                          }
                          className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB] focus:outline-none focus:border-[#E5A93C]"
                        >
                          {TOOL_TRADE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="stow-tool-story"
                          className="text-xs font-semibold text-[#D6E0D9]"
                        >
                          Show &amp; Tell Story (How You Use It Safely)
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-[#9FB0A4]">
                          {toolStory.trim().length}/{TOOL_STORY_MAX_LENGTH}
                        </span>
                      </div>
                      <textarea
                        id="stow-tool-story"
                        rows={3}
                        required
                        minLength={TOOL_STORY_MIN_LENGTH}
                        maxLength={TOOL_STORY_MAX_LENGTH}
                        value={toolStory}
                        onChange={(e) => setToolStory(e.target.value)}
                        placeholder="Describe what you craft, repair, or organize with this tool..."
                        className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-[#D6E0D9] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareToolInClub}
                        onChange={(e) => setShareToolInClub(e.target.checked)}
                        className="accent-[#E5A93C]"
                      />
                      <span>
                        Display in the Club Show &amp; Tell Gallery when signed in
                      </span>
                    </label>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={savingTool}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {savingTool ? 'Stowing...' : 'Mount on 3D Pegboard'}
                      </button>
                    </div>
                  </form>
                )}
              </section>

              {/* Player's Stowed Tools List */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                    Your Stowed Canopy Tools ({activeMyTools.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => onSelectInspectAngle('tools_rack')}
                    className="text-xs font-semibold text-[#E5A93C] hover:underline cursor-pointer"
                  >
                    Zoom to 3D Rack
                  </button>
                </div>

                {activeMyTools.length === 0 ? (
                  <p className="p-4 rounded-lg bg-[#15211A] border border-[#F7F4EB]/10 text-xs text-[#B8C6BC]">
                    Your 3D Show &amp; Tell pegboard is empty. Store your first
                    ethical Tool of the Trade above to see it mounted live in your
                    Canopy (+1 Treehouse Token)!
                  </p>
                ) : (
                  <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
                    {activeMyTools.map((tool) => (
                      <div key={tool.id} className="py-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#B8C6BC]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#E5A93C]">
                              {TOOL_VISUAL_CATALOG[tool.visualKind].label}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{tool.tradeCategory}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTool(tool)}
                            aria-label={`Remove ${tool.toolName}`}
                            className="inline-flex items-center gap-1 text-xs text-[#B8C6BC] hover:text-[#F4A261] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Unmount</span>
                          </button>
                        </div>
                        <p className="font-display text-sm font-bold text-[#F7F4EB]">
                          {tool.toolName}
                        </p>
                        <p className="text-xs text-[#DCE3DD] leading-relaxed">
                          {tool.showAndTellStory}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Club Show & Tell Gallery */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                  Club Show &amp; Tell Gallery
                </h4>
                {!user ? (
                  <div className="p-4 rounded-lg bg-[#15211A] border border-[#F7F4EB]/12 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#C6D2C9] max-w-xs">
                      Sign in with Google to share your Show &amp; Tell tools with
                      other club members and browse their racks.
                    </p>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleGoogleSignIn}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{authBusy ? 'Signing In...' : 'Sign In'}</span>
                    </button>
                  </div>
                ) : clubSharedTools.length === 0 ? (
                  <p className="text-xs text-[#B8C6BC]">
                    No shared Show &amp; Tell tools posted yet. Mount a tool with
                    gallery sharing enabled to kick off the showcase!
                  </p>
                ) : (
                  <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
                    {clubSharedTools.map((item) => (
                      <div key={item.id} className="py-3 space-y-1">
                        <div className="text-xs text-[#B8C6BC]">
                          <strong className="text-[#F7F4EB]">
                            {item.username}
                          </strong>{' '}
                          · {TOOL_VISUAL_CATALOG[item.visualKind].label} ·{' '}
                          <span className="text-[#E5A93C]">
                            {item.tradeCategory}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#F7F4EB]">
                          {item.toolName}
                        </p>
                        <p className="text-xs text-[#D0DBD3] leading-relaxed">
                          {item.showAndTellStory}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* =========================================================
              TAB 3: ETHICAL IDEA BENCH (BLOCKS HARM, AWARDS TOKENS)
             ========================================================= */}
          {activeTab === 'ideas' && (
            <div className="space-y-6">
              <section className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#7CE0A3] shrink-0" />
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Humane &amp; Ethical Idea Bench (+2 to +4 Treehouse Tokens)
                  </h3>
                </div>
                <p className="text-xs text-[#D2DDD5] leading-relaxed">
                  Propose a practical trade, repair project, wildlife-safe craft,
                  or inclusive community outreach step. Any idea depicting harm to{' '}
                  <strong className="text-[#F7F4EB]">humans or animals</strong> is
                  strictly blocked. Sound, humane ideas earn{' '}
                  <strong className="text-[#E5A93C]">Treehouse Tokens</strong> to
                  furnish your Canopy with lanterns and rugs!
                </p>

                {/* Quick Starter Templates */}
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[11px] font-semibold text-[#9FB0A4]">
                    Load an example ethical workshop idea or write your own:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ETHICAL_STARTER_PROMPTS.map((sample) => (
                      <button
                        key={sample.title}
                        type="button"
                        onClick={() => {
                          setIdeaTitle(sample.title);
                          setIdeaDescription(sample.description);
                          setSafetyBlockMsg(null);
                          setIdeaVerdictNotice(null);
                        }}
                        className="min-h-[32px] px-2.5 py-1 rounded-md bg-[#18261E] border border-[#F7F4EB]/14 text-[11px] font-medium text-[#D6E0D9] hover:border-[#E5A93C] hover:text-[#F7F4EB] transition-colors cursor-pointer"
                      >
                        {sample.title}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={handleEvaluateIdea}
                  className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/16 space-y-3.5"
                >
                  <div>
                    <label
                      htmlFor="ethical-idea-title"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      Idea Title
                    </label>
                    <input
                      id="ethical-idea-title"
                      type="text"
                      required
                      maxLength={100}
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      placeholder="e.g., Community Tool Repair & Pollinator Planter Bench"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ethical-idea-desc"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      How It Helps Safely &amp; Ethically
                    </label>
                    <textarea
                      id="ethical-idea-desc"
                      rows={4}
                      required
                      maxLength={800}
                      value={ideaDescription}
                      onChange={(e) => setIdeaDescription(e.target.value)}
                      placeholder="Describe the materials, safe tools, humane wildlife care, or neighborly benefit..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono tabular-nums text-[#B8C6BC]">
                      Current Balance: {progress.treehouseTokens} Treehouse Tokens
                    </span>
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Verify &amp; Earn Treehouse Tokens</span>
                    </button>
                  </div>

                  {ideaVerdictNotice && (
                    <div
                      role="status"
                      className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start justify-between gap-2.5 ${
                        ideaVerdictNotice.tone === 'ok'
                          ? 'bg-[#173222] border-[#7CE0A3]/55 text-[#E8F5EC]'
                          : 'bg-[#2C1816] border-[#F28B82]/55 text-[#FADAD7]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {ideaVerdictNotice.tone === 'ok' ? (
                          <Check className="w-4 h-4 text-[#7CE0A3] shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-[#F28B82] shrink-0 mt-0.5" />
                        )}
                        <span>{ideaVerdictNotice.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIdeaVerdictNotice(null)}
                        className="text-[11px] underline shrink-0 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </form>
              </section>

              {/* Verified Ethical Ideas Ledger */}
              {ethicalIdeas.length > 0 && (
                <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                  <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                    Verified Sound &amp; Ethical Ideas ({ethicalIdeas.length})
                  </h4>
                  <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
                    {ethicalIdeas.map((idea) => (
                      <div key={idea.id} className="py-3 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                          <span className="font-sans text-[#7CE0A3]">
                            {idea.pillars.join(' · ')}
                          </span>
                          <span className="text-[#E5A93C] font-semibold">
                            +{idea.tokensAwarded} Treehouse Tokens
                          </span>
                        </div>
                        <p className="font-display text-sm font-bold text-[#F7F4EB]">
                          {idea.title}
                        </p>
                        <p className="text-xs text-[#D0DBD3] leading-relaxed">
                          {idea.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* =========================================================
              TAB 4: PLAYER-TO-PLAYER LANTERN & FURNISHINGS STORE
             ========================================================= */}
          {activeTab === 'store' && (
            <div className="space-y-6">
              {/* Balance & Seller Proceeds Banner */}
              <section className="p-4 rounded-xl bg-[#16241C] border border-[#E5A93C]/40 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#C6D2C9]">
                    Available Canopy Store Purse
                  </div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#E5A93C]">
                    {progress.treehouseTokens} Treehouse Tokens
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ideas')}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1C2D23] border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    + Earn Tokens (Ethical Ideas)
                  </button>
                  {user && !listingComposerOpen && (
                    <button
                      type="button"
                      onClick={() => setListingComposerOpen(true)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Sell Crafted Item</span>
                    </button>
                  )}
                </div>
              </section>

              {/* Unclaimed Seller Proceeds */}
              {unclaimedSoldListings.length > 0 && (
                <section className="p-4 rounded-xl bg-[#1B2D22] border border-[#7CE0A3]/55 space-y-2.5">
                  <h4 className="font-display text-sm font-bold text-[#7CE0A3]">
                    Fellow Players Bought Your Crafts!
                  </h4>
                  {unclaimedSoldListings.map((sold) => (
                    <div
                      key={sold.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span>
                        <strong className="text-[#F7F4EB]">{sold.title}</strong> ·
                        Sold for {sold.priceTokens} Treehouse Tokens
                      </span>
                      <button
                        type="button"
                        disabled={busyListingId === sold.id}
                        onClick={() => handleClaimSoldListing(sold)}
                        className="min-h-[34px] px-3 py-1 rounded-md bg-[#E5A93C] text-[#101813] font-bold cursor-pointer"
                      >
                        Claim +{sold.priceTokens} Tokens
                      </button>
                    </div>
                  ))}
                </section>
              )}

              {/* Craft & List Form for Signed-In Players */}
              {user && listingComposerOpen && (
                <form
                  onSubmit={handlePublishPlayerListing}
                  className="p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/45 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-[#F7F4EB]">
                      List a Crafted Lantern or Canopy Furnishing for Other Players
                    </span>
                    <button
                      type="button"
                      onClick={() => setListingComposerOpen(false)}
                      className="text-xs text-[#B8C6BC] hover:text-[#F7F4EB] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="store-item-kind"
                        className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                      >
                        3D Canopy Furnishing Type
                      </label>
                      <select
                        id="store-item-kind"
                        value={listingKind}
                        onChange={(e) =>
                          setListingKind(e.target.value as CanopyFurnishingKind)
                        }
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                      >
                        {CANOPY_FURNISHING_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {CANOPY_FURNISHING_CATALOG[k].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="store-item-price"
                        className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                      >
                        Price (Treehouse Tokens)
                      </label>
                      <input
                        id="store-item-price"
                        type="number"
                        min={STORE_PRICE_MIN}
                        max={STORE_PRICE_MAX}
                        required
                        value={listingPrice}
                        onChange={(e) =>
                          setListingPrice(parseInt(e.target.value || '1', 10))
                        }
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs font-mono tabular-nums text-[#F7F4EB]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="store-item-title"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      Custom Craft Title
                    </label>
                    <input
                      id="store-item-title"
                      type="text"
                      required
                      minLength={STORE_TITLE_MIN_LENGTH}
                      maxLength={STORE_TITLE_MAX_LENGTH}
                      value={listingTitle}
                      onChange={(e) => setListingTitle(e.target.value)}
                      placeholder="e.g., Hand-Beaten Beeswax Brass Rafter Lantern"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="store-item-note"
                      className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                    >
                      Craftsmanship Note
                    </label>
                    <textarea
                      id="store-item-note"
                      rows={2}
                      required
                      minLength={STORE_NOTE_MIN_LENGTH}
                      maxLength={STORE_NOTE_MAX_LENGTH}
                      value={listingNote}
                      onChange={(e) => setListingNote(e.target.value)}
                      placeholder="Describe the joinery, amber glass glow, or natural wool dye..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingListing}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] cursor-pointer"
                    >
                      {savingListing ? 'Listing...' : 'Post to Player Store'}
                    </button>
                  </div>
                </form>
              )}

              {/* 01. Your Owned Canopy Lanterns & Furnishings (Place / Light Toggle) */}
              {progress.ownedFurnishings.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                      Your Canopy Furnishings ({progress.ownedFurnishings.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => onSelectInspectAngle('lanterns_floor')}
                      className="text-xs font-semibold text-[#E5A93C] hover:underline cursor-pointer"
                    >
                      View in 3D Canopy
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {progress.ownedFurnishings.map((kind) => {
                      const spec = CANOPY_FURNISHING_CATALOG[kind];
                      const placed = studioConfig.furnishedItems.includes(kind);
                      return (
                        <div
                          key={kind}
                          className="p-3 rounded-lg bg-[#15221B] border border-[#F7F4EB]/14 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#F7F4EB] truncate">
                              {spec.label}
                            </div>
                            <div className="text-[11px] text-[#9FB0A4] truncate">
                              {placed ? 'Illuminated in 3D Canopy' : 'Stowed'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTogglePlacedFurnishing(kind)}
                            className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-bold shrink-0 cursor-pointer ${
                              placed
                                ? 'bg-[#E5A93C] text-[#101813]'
                                : 'bg-[#1D2E24] text-[#D6E0D9] border border-[#F7F4EB]/18'
                            }`}
                          >
                            {placed ? 'Lit' : 'Place'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 02. Buy Crafted Lanterns & Decor from Other Players */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                    Player-to-Player Lantern &amp; Craft Exchange
                  </h4>
                  <span className="text-xs font-mono text-[#9FB0A4]">
                    Live Member Listings
                  </span>
                </div>

                {!user ? (
                  <div className="p-4 rounded-lg bg-[#15211A] border border-[#F7F4EB]/12 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#C6D2C9] max-w-xs">
                      Sign in with Google to buy handcrafted lanterns from fellow
                      players or list your own Canopy furnishings for Treehouse
                      Tokens.
                    </p>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleGoogleSignIn}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{authBusy ? 'Signing In...' : 'Sign In'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {otherPlayersAvailableListings.length === 0 ? (
                      <p className="text-xs text-[#B8C6BC]">
                        No other player listings are waiting right now—you can
                        post a crafted lantern above for fellow climbers, or pick
                        up lanterns immediately from the Workshop Co-op Supply
                        below!
                      </p>
                    ) : (
                      <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
                        {otherPlayersAvailableListings.map((listing) => (
                          <div
                            key={listing.id}
                            className="py-3.5 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="text-xs text-[#B8C6BC]">
                                Crafted by{' '}
                                <strong className="text-[#F7F4EB]">
                                  {listing.sellerName}
                                </strong>{' '}
                                ·{' '}
                                {CANOPY_FURNISHING_CATALOG[listing.itemKind].label}
                              </div>
                              <p className="font-display text-sm font-bold text-[#F7F4EB]">
                                {listing.title}
                              </p>
                              <p className="text-xs text-[#D0DBD3]">
                                {listing.craftNote}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={busyListingId === listing.id}
                              onClick={() => handleBuyFromOtherPlayer(listing)}
                              className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Buy · {listing.priceTokens} Tokens
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {myActiveListings.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <span className="block text-xs font-semibold text-[#9FB0A4]">
                          Your Open Listings for Other Players:
                        </span>
                        {myActiveListings.map((mine) => (
                          <div
                            key={mine.id}
                            className="p-2.5 rounded-lg bg-[#15211A] border border-[#F7F4EB]/10 flex items-center justify-between gap-2 text-xs"
                          >
                            <span>
                              <strong className="text-[#F7F4EB]">
                                {mine.title}
                              </strong>{' '}
                              · {mine.priceTokens} Tokens
                            </span>
                            <button
                              type="button"
                              disabled={busyListingId === mine.id}
                              onClick={() => handleCancelMyListing(mine)}
                              className="text-[#B8C6BC] hover:text-[#F4A261] cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* 03. Workshop Co-op Craft Supply (Always-Available Lanterns & Furnishings) */}
              <section className="pt-4 border-t border-[#F7F4EB]/12 space-y-3">
                <div>
                  <h4 className="font-display text-sm font-bold text-[#F7F4EB] inline-flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#E5A93C]" />
                    <span>Workshop Co-op Lantern &amp; Furnishing Bench</span>
                  </h4>
                  <p className="mt-0.5 text-xs text-[#B8C6BC]">
                    Redeem your Treehouse Tokens anytime to hang warm lanterns,
                    garlands, rugs, and native fern boxes inside your 33m Canopy.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {CANOPY_FURNISHING_KINDS.map((kind) => {
                    const spec = CANOPY_FURNISHING_CATALOG[kind];
                    const owned = progress.ownedFurnishings.includes(kind);
                    const placed = studioConfig.furnishedItems.includes(kind);

                    return (
                      <div
                        key={kind}
                        className="p-3.5 rounded-xl bg-[#15211A] border border-[#F7F4EB]/14 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-sm font-bold text-[#F7F4EB]">
                              {spec.label}
                            </span>
                            <span className="text-[#8FA395]" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-xs text-[#E5A93C]">
                              {owned
                                ? 'Owned'
                                : `${spec.coopSupplyPrice} Treehouse Tokens`}
                            </span>
                          </div>
                          <p className="text-xs text-[#C8D4CB]">
                            {spec.craftSummary}
                          </p>
                          <p className="text-[11px] text-[#9FB0A4]">
                            {spec.placementNote}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBuyFromCoopSupply(kind)}
                          className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                            owned
                              ? placed
                                ? 'bg-[#1D2E24] border border-[#E5A93C] text-[#E5A93C]'
                                : 'bg-[#1D2E24] border border-[#F7F4EB]/22 text-[#F7F4EB]'
                              : 'bg-[#E5A93C] text-[#101813] hover:bg-[#F0B84D]'
                          }`}
                        >
                          {owned ? (
                            <span>{placed ? 'Lit in Canopy' : 'Place in Canopy'}</span>
                          ) : (
                            <>
                              <Compass className="w-3.5 h-3.5" />
                              <span>Buy ({spec.coopSupplyPrice} Tokens)</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
