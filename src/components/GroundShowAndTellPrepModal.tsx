import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Coffee,
  Download,
  Flame,
  HeartHandshake,
  Mic,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import drinksCarafeImg from '../assets/images/show_tell_drinks_carafe_1793008699569.jpg';
import welcomePackImg from '../assets/images/show_tell_welcome_pack_1793008699723.jpg';
import {
  CANOPY_FURNISHING_CATALOG,
  CANOPY_FURNISHING_KINDS,
  CANOPY_TRADE_FOCUSES,
  CanopyFurnishingKind,
  CanopyStudioConfig,
  CanopyTradeFocus,
  TreeProgressState,
} from '../firebase';
import { formatDualTimestamp } from '../utils/dualCalendar';
import {
  evaluateEthicalIdeaForTokens,
  screenBootsOnGroundCensor,
} from '../utils/ethicalGuard';

export type ShowAndTellPrepTab =
  | 'lanterns'
  | 'virtual_shop'
  | 'lectures'
  | 'outreach';

export type VirtualTokenKind = 'trying' | 'gathering' | 'treehouse';

export interface VirtualSupplySpec {
  id: string;
  title: string;
  category: 'Drinks & Refreshments' | 'Welcome Packs & Notes' | 'Session Comfort';
  description: string;
  tokenCost: number;
  preferredToken: VirtualTokenKind;
  imageUrl?: string;
}

export const VIRTUAL_SHOW_AND_TELL_CATALOG: VirtualSupplySpec[] = [
  {
    id: 'spiced_apple_herbal_carafe',
    title: 'Warm Spiced Apple & Herbal Drinks Carafe',
    category: 'Drinks & Refreshments',
    description:
      'Insulated amber glass carafe with cinnamon-apple infusion and four stoneware cups for Show & Tell guests.',
    tokenCost: 1,
    preferredToken: 'trying',
    imageUrl: drinksCarafeImg,
  },
  {
    id: 'guest_welcome_packs',
    title: 'Show & Tell Guest Welcome Packs (Set of 6)',
    category: 'Welcome Packs & Notes',
    description:
      'Recycled cotton & kraft welcome packs with printed session leaflets, wooden name badges, stitched notebooks, and brass pencils.',
    tokenCost: 1,
    preferredToken: 'gathering',
    imageUrl: welcomePackImg,
  },
  {
    id: 'elderflower_berry_jug',
    title: 'Chilled Elderflower & Woodland Berry Press',
    category: 'Drinks & Refreshments',
    description:
      'Refreshing zero-alcohol botanical drink pitcher so presenters and listeners stay hydrated during mini-lectures.',
    tokenCost: 1,
    preferredToken: 'trying',
  },
  {
    id: 'printed_skill_handouts',
    title: 'Step-by-Step Skill Recipe Cards & Sketch Pads',
    category: 'Welcome Packs & Notes',
    description:
      'Thick cream index cards so fellow members can take home clear diagrams from your mini-lecture.',
    tokenCost: 1,
    preferredToken: 'gathering',
  },
  {
    id: 'calm_cushion_tea_tray',
    title: 'Quiet Listening Cushions & Chamomile Tray',
    category: 'Session Comfort',
    description:
      'Floor cushions and decaf chamomile tea service for relaxed, unhurried Q&A around the bench.',
    tokenCost: 2,
    preferredToken: 'treehouse',
  },
];

export type VirtualSupplyInventory = Record<string, number>;

export interface MiniLectureRecord {
  id: string;
  title: string;
  tradeTopic: CanopyTradeFocus;
  keySteps: string;
  audioDataUrl?: string;
  durationSec: number;
  createdAtMs: number;
}

export interface OutreachProjectRecord {
  id: string;
  projectTitle: string;
  communityWhoBenefits: string;
  actionSteps: string;
  impactNotes: string;
  audioDataUrl?: string;
  durationSec: number;
  tokensEarned: number;
  createdAtMs: number;
}

export const LOCAL_VIRTUAL_SUPPLIES_KEY =
  'jays_job_club_virtual_supplies_v1';
export const LOCAL_MINI_LECTURES_KEY = 'jays_job_club_mini_lectures_v1';
export const LOCAL_OUTREACH_PROJECTS_KEY =
  'jays_job_club_outreach_projects_v1';

export function loadVirtualSupplies(): VirtualSupplyInventory {
  try {
    const raw = window.localStorage.getItem(LOCAL_VIRTUAL_SUPPLIES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: VirtualSupplyInventory = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        clean[k] = Math.min(99, Math.floor(v));
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveVirtualSupplies(inv: VirtualSupplyInventory): void {
  try {
    window.localStorage.setItem(
      LOCAL_VIRTUAL_SUPPLIES_KEY,
      JSON.stringify(inv)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadMiniLectures(): MiniLectureRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_MINI_LECTURES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is MiniLectureRecord =>
        Boolean(x) && typeof x === 'object' && typeof x.title === 'string'
    );
  } catch {
    return [];
  }
}

function saveMiniLectures(list: MiniLectureRecord[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_MINI_LECTURES_KEY,
      JSON.stringify(list.slice(0, 25))
    );
  } catch {
    // Fallback without audio blobs if localStorage is near capacity
    try {
      const slim = list
        .slice(0, 25)
        .map(({ audioDataUrl: _omit, ...rest }) => rest);
      window.localStorage.setItem(
        LOCAL_MINI_LECTURES_KEY,
        JSON.stringify(slim)
      );
    } catch {
      // Ignore
    }
  }
}

export function loadOutreachProjects(): OutreachProjectRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_OUTREACH_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is OutreachProjectRecord =>
        Boolean(x) &&
        typeof x === 'object' &&
        typeof x.projectTitle === 'string'
    );
  } catch {
    return [];
  }
}

function saveOutreachProjects(list: OutreachProjectRecord[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_OUTREACH_PROJECTS_KEY,
      JSON.stringify(list.slice(0, 25))
    );
  } catch {
    try {
      const slim = list
        .slice(0, 25)
        .map(({ audioDataUrl: _omit, ...rest }) => rest);
      window.localStorage.setItem(
        LOCAL_OUTREACH_PROJECTS_KEY,
        JSON.stringify(slim)
      );
    } catch {
      // Ignore
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not encode audio'));
    };
    reader.onerror = () => reject(new Error('Audio read error'));
    reader.readAsDataURL(blob);
  });
}

interface GroundShowAndTellPrepModalProps {
  isOpen: boolean;
  initialTab?: ShowAndTellPrepTab;
  progress: TreeProgressState;
  studioConfig: CanopyStudioConfig;
  onPurchaseGroundLantern: (
    kind: CanopyFurnishingKind,
    priceTokens: number
  ) => void;
  onTogglePlacedFurnishing: (nextFurnished: CanopyFurnishingKind[]) => void;
  onConvertStarterTokensToTreehouse: () => boolean;
  onSpendVirtualToken: (
    tokenKind: VirtualTokenKind,
    amount: number,
    itemLabel: string
  ) => boolean;
  onRewardMiniLecture: (lectureTitle: string) => void;
  onRewardOutreachProject: (
    projectTitle: string,
    treehouseBonus: number
  ) => void;
  onShareToCollab: (title: string, summary: string) => void;
  onGlideToCanopy: () => void;
  onClose: () => void;
}

export const GroundShowAndTellPrepModal: React.FC<
  GroundShowAndTellPrepModalProps
> = ({
  isOpen,
  initialTab = 'lanterns',
  progress,
  studioConfig,
  onPurchaseGroundLantern,
  onTogglePlacedFurnishing,
  onConvertStarterTokensToTreehouse,
  onSpendVirtualToken,
  onRewardMiniLecture,
  onRewardOutreachProject,
  onShareToCollab,
  onGlideToCanopy,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ShowAndTellPrepTab>(initialTab);
  const [supplies, setSupplies] = useState<VirtualSupplyInventory>(() =>
    loadVirtualSupplies()
  );
  const [lectures, setLectures] = useState<MiniLectureRecord[]>(() =>
    loadMiniLectures()
  );
  const [outreachList, setOutreachList] = useState<OutreachProjectRecord[]>(
    () => loadOutreachProjects()
  );
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{
    tone: 'ok' | 'warn';
    text: string;
  } | null>(null);

  // Mini-lecture form + audio recorder state
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureTopic, setLectureTopic] =
    useState<CanopyTradeFocus>('Woodcraft & Joinery');
  const [lectureSteps, setLectureSteps] = useState('');
  const [lectureAudioUrl, setLectureAudioUrl] = useState<string | undefined>(
    undefined
  );
  const [lectureDuration, setLectureDuration] = useState(0);

  // Outreach project form + audio recorder state
  const [outreachTitle, setOutreachTitle] = useState('');
  const [outreachBeneficiaries, setOutreachBeneficiaries] = useState('');
  const [outreachSteps, setOutreachSteps] = useState('');
  const [outreachImpact, setOutreachImpact] = useState('');
  const [outreachAudioUrl, setOutreachAudioUrl] = useState<string | undefined>(
    undefined
  );
  const [outreachDuration, setOutreachDuration] = useState(0);

  // Shared single MediaRecorder controller
  const [recordingTarget, setRecordingTarget] = useState<
    'lecture' | 'outreach' | null
  >(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
      setSupplies(loadVirtualSupplies());
    }
  }, [isOpen, initialTab]);

  const stopActiveRecorderCleanup = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setRecordingTarget(null);
  };

  useEffect(() => {
    if (!isOpen) {
      stopActiveRecorderCleanup();
    }
    return () => stopActiveRecorderCleanup();
  }, [isOpen]);

  const totalDrinksCount = useMemo(
    () =>
      (supplies.spiced_apple_herbal_carafe || 0) +
      (supplies.elderflower_berry_jug || 0),
    [supplies]
  );

  const totalPacksCount = useMemo(
    () =>
      (supplies.guest_welcome_packs || 0) +
      (supplies.printed_skill_handouts || 0),
    [supplies]
  );

  if (!isOpen) return null;

  const startVoiceRecording = async (target: 'lecture' | 'outreach') => {
    setNotice(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setNotice({
        tone: 'warn',
        text: 'Browser microphone capture is unavailable in this frame—your written mini-lecture or outreach steps will still save and earn full tokens!',
      });
      return;
    }

    try {
      stopActiveRecorderCleanup();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      let elapsed = 0;
      setRecordingSeconds(0);
      setRecordingTarget(target);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        try {
          const dataUrl =
            blob.size <= 650_000
              ? await blobToDataUrl(blob)
              : URL.createObjectURL(blob);
          if (target === 'lecture') {
            setLectureAudioUrl(dataUrl);
            setLectureDuration(Math.max(1, elapsed));
          } else {
            setOutreachAudioUrl(dataUrl);
            setOutreachDuration(Math.max(1, elapsed));
          }
          setNotice({
            tone: 'ok',
            text: `Recorded ${Math.max(1, elapsed)}s voice note—press play below to preview before saving.`,
          });
        } catch {
          setNotice({
            tone: 'warn',
            text: 'Could not finalize audio clip, but you can still save your written notes.',
          });
        }
      };

      recorder.start(250);
      recordTimerRef.current = window.setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= 60) {
          stopActiveRecorderCleanup();
        }
      }, 1000);
    } catch {
      setRecordingTarget(null);
      setNotice({
        tone: 'warn',
        text: 'Microphone permission was declined or unavailable. You can still record your complete mini-lecture or outreach project using written steps!',
      });
    }
  };

  const handleBuyGroundLantern = (kind: CanopyFurnishingKind) => {
    const spec = CANOPY_FURNISHING_CATALOG[kind];
    const owned = progress.ownedFurnishings.includes(kind);
    if (owned) {
      const placed = studioConfig.furnishedItems.includes(kind);
      const next = placed
        ? studioConfig.furnishedItems.filter((k) => k !== kind)
        : [...studioConfig.furnishedItems, kind].slice(0, 6);
      onTogglePlacedFurnishing(next);
      setNotice({
        tone: 'ok',
        text: placed
          ? `Stowed ${spec.label} safely for your next Show & Tell.`
          : `Prepared & lit ${spec.label} in your 33m Canopy ahead of Show & Tell!`,
      });
      return;
    }

    if (progress.treehouseTokens < spec.coopSupplyPrice) {
      setNotice({
        tone: 'warn',
        text: `Need ${spec.coopSupplyPrice} Treehouse Tokens for ${spec.label} (you have ${progress.treehouseTokens}). Verify an Ethical Idea, record an Outreach Project, or convert 1 Trying + 1 Gathering Token below!`,
      });
      return;
    }

    onPurchaseGroundLantern(kind, spec.coopSupplyPrice);
    setNotice({
      tone: 'ok',
      text: `Purchased ${spec.label} from the Ground-Floor Prep Counter and lit it in your Canopy for Show & Tell!`,
    });
  };

  const handleBuyVirtualSupply = (item: VirtualSupplySpec) => {
    // Allow spending preferred token, or fall back to any token the player holds
    const order: VirtualTokenKind[] = [
      item.preferredToken,
      'trying',
      'gathering',
      'treehouse',
    ];
    let chosen: VirtualTokenKind | null = null;
    for (const candidate of order) {
      const bal =
        candidate === 'trying'
          ? progress.tryingTokens
          : candidate === 'gathering'
            ? progress.gatheringTokens
            : progress.treehouseTokens;
      if (bal >= item.tokenCost) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) {
      setNotice({
        tone: 'warn',
        text: `You need ${item.tokenCost} virtual token to pick up "${item.title}". Check in at the Welcome Desk or collect a Kiosk Leaflet to earn tokens!`,
      });
      return;
    }

    const ok = onSpendVirtualToken(chosen, item.tokenCost, item.title);
    if (!ok) return;

    const nextInv: VirtualSupplyInventory = {
      ...supplies,
      [item.id]: (supplies[item.id] || 0) + 1,
    };
    setSupplies(nextInv);
    saveVirtualSupplies(nextInv);

    const tokenLabel =
      chosen === 'trying'
        ? 'Trying'
        : chosen === 'gathering'
          ? 'Gathering'
          : 'Treehouse';
    setNotice({
      tone: 'ok',
      text: `Added "${item.title}" to your Show & Tell table (spent ${item.tokenCost} ${tokenLabel} Token)!`,
    });
  };

  const handleSaveMiniLecture = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = lectureTitle.trim().slice(0, 90);
    const cleanSteps = lectureSteps.trim().slice(0, 1200);

    if (cleanTitle.length < 3 || cleanSteps.length < 8) {
      setNotice({
        tone: 'warn',
        text: 'Please add a clear skill title and at least a short teaching outline (8+ characters).',
      });
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanTitle} ${cleanSteps}`,
      'mini-lecture'
    );
    if (!censor.allowed) {
      setNotice({
        tone: 'warn',
        text:
          censor.reason ||
          "Tree 'Boots on Ground' Censor: Please keep mini-lectures respectful and suitable for all ages.",
      });
      return;
    }

    const created: MiniLectureRecord = {
      id: `lec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      tradeTopic: lectureTopic,
      keySteps: cleanSteps,
      audioDataUrl: lectureAudioUrl,
      durationSec: lectureDuration,
      createdAtMs: Date.now(),
    };

    const next = [created, ...lectures];
    setLectures(next);
    saveMiniLectures(next);
    setLectureTitle('');
    setLectureSteps('');
    setLectureAudioUrl(undefined);
    setLectureDuration(0);

    onRewardMiniLecture(cleanTitle);
    setNotice({
      tone: 'ok',
      text: `Saved mini-lecture "${cleanTitle}" · Awarded +1 Trying Token & +1 Treehouse Token for teaching others!`,
    });
  };

  const handleSaveOutreachProject = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = outreachTitle.trim().slice(0, 90);
    const cleanWho = outreachBeneficiaries.trim().slice(0, 120);
    const cleanSteps = outreachSteps.trim().slice(0, 1200);
    const cleanImpact = outreachImpact.trim().slice(0, 600);

    if (cleanTitle.length < 3 || cleanSteps.length < 8) {
      setNotice({
        tone: 'warn',
        text: 'Please enter your outreach project title and practical steps taken (8+ characters).',
      });
      return;
    }

    const combined = `${cleanTitle} ${cleanWho} ${cleanSteps} ${cleanImpact}`;
    const censor = screenBootsOnGroundCensor(combined, 'community-outreach');
    if (!censor.allowed) {
      setNotice({
        tone: 'warn',
        text:
          censor.reason ||
          "Tree 'Boots on Ground' Censor: Outreach logs must use welcoming, respectful language.",
      });
      return;
    }

    const ethical = evaluateEthicalIdeaForTokens(
      cleanTitle,
      `${cleanWho} ${cleanSteps} ${cleanImpact}`
    );
    const bonusTokens = ethical.isSoundAndEthical
      ? Math.max(2, ethical.tokensAwarded)
      : 2;

    const record: OutreachProjectRecord = {
      id: `outreach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      projectTitle: cleanTitle,
      communityWhoBenefits: cleanWho || 'Local Neighbours & Club Members',
      actionSteps: cleanSteps,
      impactNotes: cleanImpact,
      audioDataUrl: outreachAudioUrl,
      durationSec: outreachDuration,
      tokensEarned: bonusTokens,
      createdAtMs: Date.now(),
    };

    const next = [record, ...outreachList];
    setOutreachList(next);
    saveOutreachProjects(next);
    setOutreachTitle('');
    setOutreachBeneficiaries('');
    setOutreachSteps('');
    setOutreachImpact('');
    setOutreachAudioUrl(undefined);
    setOutreachDuration(0);

    onRewardOutreachProject(cleanTitle, bonusTokens);
    setNotice({
      tone: 'ok',
      text: `Recorded Community Outreach Project "${cleanTitle}" · Awarded +${bonusTokens} Treehouse Tokens & +1 Gathering Token!`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ground-show-tell-heading"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="ground-show-tell-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Ground-Floor Show &amp; Tell Prep, Virtual Shop &amp; Outreach Studio
              </h2>
              <p className="mt-0.5 text-xs text-[#C6D2C9]">
                Ground Sanctuary (0m) · Buy Show &amp; Tell lanterns, stock virtual drinks &amp; welcome packs, record mini-lectures, and log community outreach
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onGlideToCanopy();
                  onClose();
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#E5A93C]/45 text-xs font-semibold text-[#E5A93C] hover:text-[#F7F4EB] hover:border-[#E5A93C] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ascend to 33m Show &amp; Tell
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 text-[#E5A93C]" />
                <span>Close (Esc)</span>
              </button>
            </div>
          </div>

          {/* Readiness + Token Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div
              className="flex flex-wrap items-center gap-1 p-1 bg-[#101914] rounded-lg border border-[#F7F4EB]/12"
              role="tablist"
            >
              {(
                [
                  ['lanterns', '01. Ground Lanterns'],
                  ['virtual_shop', '02. Virtual Shop (Drinks & Packs)'],
                  ['lectures', `03. Mini-Lectures (${lectures.length})`],
                  ['outreach', `04. Outreach Projects (${outreachList.length})`],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tabId}
                  onClick={() => {
                    setNotice(null);
                    setActiveTab(tabId);
                  }}
                  className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tabId
                      ? 'bg-[#E5A93C] text-[#101813]'
                      : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 font-mono tabular-nums text-xs text-[#D0DBD3]">
              <span>
                Trying: <strong className="text-[#E5A93C]">{progress.tryingTokens}</strong>
              </span>
              <span>·</span>
              <span>
                Gathering:{' '}
                <strong className="text-[#7CE0A3]">{progress.gatheringTokens}</strong>
              </span>
              <span>·</span>
              <span>
                Treehouse:{' '}
                <strong className="text-[#E5A93C]">{progress.treehouseTokens}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Show & Tell Readiness Summary Strip */}
          <div className="p-3.5 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#D6E0D9] font-mono tabular-nums">
              <span className="font-sans font-semibold text-[#F7F4EB]">
                Show &amp; Tell Prep Status:
              </span>
              <span>
                Lanterns Owned: <strong className="text-[#E5A93C]">{progress.ownedFurnishings.length}</strong>
              </span>
              <span>·</span>
              <span>
                Drinks Stocked: <strong className="text-[#7CE0A3]">{totalDrinksCount}</strong>
              </span>
              <span>·</span>
              <span>
                Welcome Packs: <strong className="text-[#7CE0A3]">{totalPacksCount}</strong>
              </span>
              <span>·</span>
              <span>
                Mini-Lectures: <strong className="text-[#E5A93C]">{lectures.length}</strong>
              </span>
            </div>

            {progress.tryingTokens >= 1 && progress.gatheringTokens >= 1 && (
              <button
                type="button"
                onClick={() => {
                  const ok = onConvertStarterTokensToTreehouse();
                  if (ok) {
                    setNotice({
                      tone: 'ok',
                      text: 'Exchanged 1 Trying + 1 Gathering Token for +1 Treehouse Token at the Ground Lantern Desk!',
                    });
                  }
                }}
                className="min-h-[32px] px-3 py-1 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/50 text-xs font-semibold text-[#E5A93C] hover:text-[#F7F4EB] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Exchange 1 Trying + 1 Gathering → +1 Treehouse Token
              </button>
            )}
          </div>

          {notice && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                notice.tone === 'ok'
                  ? 'bg-[#17291E] border-[#7CE0A3]/50 text-[#F7F4EB]'
                  : 'bg-[#261C15] border-[#F4A261]/55 text-[#F4A261]'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-xs font-semibold text-[#C8D4CB] hover:text-[#F7F4EB] shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: GROUND-FLOOR LANTERN PREP COUNTER */}
          {activeTab === 'lanterns' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#F7F4EB]">
                    Ground-Floor Lantern &amp; Show-and-Tell Furnishing Counter
                  </h3>
                  <p className="text-xs text-[#C6D2C9]">
                    Pick up warm spun-brass lanterns, string garlands, reading lamps, and rugs right here on the Ground Floor (0m) so your Show &amp; Tell venue is illuminated before guests arrive.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {CANOPY_FURNISHING_KINDS.map((kind) => {
                  const spec = CANOPY_FURNISHING_CATALOG[kind];
                  const owned = progress.ownedFurnishings.includes(kind);
                  const placed = studioConfig.furnishedItems.includes(kind);
                  return (
                    <div
                      key={kind}
                      className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-base font-bold text-[#F7F4EB]">
                            {spec.label}
                          </span>
                          <span className="font-mono tabular-nums text-xs font-bold text-[#E5A93C]">
                            {owned ? 'Owned' : `${spec.coopSupplyPrice} Treehouse`}
                          </span>
                        </div>
                        <p className="text-xs text-[#D0DBD3] leading-relaxed">
                          {spec.craftSummary}
                        </p>
                        <p className="text-[11px] font-mono text-[#9FB0A4]">
                          {spec.placementNote}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F7F4EB]/10">
                        <span className="text-xs font-mono text-[#9FB0A4]">
                          {owned
                            ? placed
                              ? 'Lit & Ready for Show & Tell'
                              : 'Owned · Stowed'
                            : 'Ground Prep Stock Ready'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleBuyGroundLantern(kind)}
                          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                            owned
                              ? placed
                                ? 'bg-[#1E2E24] border border-[#E5A93C] text-[#E5A93C]'
                                : 'bg-[#1E2E24] border border-[#F7F4EB]/22 text-[#F7F4EB]'
                              : 'bg-[#E5A93C] text-[#101813] hover:bg-[#F0B84D]'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>
                            {owned
                              ? placed
                                ? 'Lit in Show & Tell'
                                : 'Light for Session'
                              : `Buy Lantern (${spec.coopSupplyPrice} Tokens)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: VIRTUAL SHOW & TELL HOSPITALITY SHOP */}
          {activeTab === 'virtual_shop' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#F7F4EB]">
                  Virtual Show &amp; Tell Shop · Drinks, Welcome Packs &amp; Handouts
                </h3>
                <p className="text-xs text-[#C6D2C9]">
                  100% virtual token shop—use your Trying, Gathering, or Treehouse Tokens to stock herbal drinks, welcome packs, and skill cards for fellow learners attending your Show &amp; Tell.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {VIRTUAL_SHOW_AND_TELL_CATALOG.map((item) => {
                  const ownedCount = supplies[item.id] || 0;
                  const showImg = item.imageUrl && !imgFailed[item.id];
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[4/3] w-full bg-[#0F1813] border-b border-[#F7F4EB]/10 overflow-hidden">
                          {showImg ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setImgFailed((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1B2D22] to-[#101914]">
                              {item.category === 'Drinks & Refreshments' ? (
                                <Coffee className="w-9 h-9 text-[#E5A93C] mb-2" />
                              ) : (
                                <Package className="w-9 h-9 text-[#7CE0A3] mb-2" />
                              )}
                              <span className="font-display text-sm font-bold text-[#F7F4EB]">
                                {item.category}
                              </span>
                              <span className="text-[11px] text-[#9FB0A4] mt-0.5">
                                Virtual Show &amp; Tell Supply
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="p-4 space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#7CE0A3]">
                              {item.category}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-[#E5A93C]">
                              {item.tokenCost} Virtual Token
                              {item.tokenCost > 1 ? 's' : ''}
                            </span>
                          </div>
                          <h4 className="font-display text-sm font-bold text-[#F7F4EB] leading-snug">
                            {item.title}
                          </h4>
                          <p className="text-xs text-[#C8D4CB] leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pb-4 pt-2 border-t border-[#F7F4EB]/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono tabular-nums text-[#9FB0A4]">
                          Stocked: <strong className="text-[#F7F4EB]">{ownedCount}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBuyVirtualSupply(item)}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Get for Session</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MINI-LECTURES RECORDER */}
          {activeTab === 'lectures' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <form
                onSubmit={handleSaveMiniLecture}
                className="lg:col-span-6 p-5 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 space-y-4"
              >
                <div>
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Record a Mini-Lecture to Teach Others Skills
                  </h3>
                  <p className="mt-0.5 text-xs text-[#C6D2C9]">
                    Capture an optional 60-second voice explanation plus your clear written skill steps (+1 Trying Token &amp; +1 Treehouse Token).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="mini-lec-title"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Mini-Lecture Title
                  </label>
                  <input
                    id="mini-lec-title"
                    type="text"
                    required
                    maxLength={90}
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                    placeholder="e.g., How to Mark Out a Clean Cedar Dovetail Joint"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="mini-lec-topic"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Skill / Trade Area
                  </label>
                  <select
                    id="mini-lec-topic"
                    value={lectureTopic}
                    onChange={(e) =>
                      setLectureTopic(e.target.value as CanopyTradeFocus)
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  >
                    {CANOPY_TRADE_FOCUSES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="mini-lec-steps"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Key Teaching Steps &amp; Tips
                  </label>
                  <textarea
                    id="mini-lec-steps"
                    rows={4}
                    required
                    maxLength={1200}
                    value={lectureSteps}
                    onChange={(e) => setLectureSteps(e.target.value)}
                    placeholder="1. Clamp timber level at elbow height...&#10;2. Score baseline lightly with marking knife...&#10;3. Saw just on the waste side of your line..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                {/* Voice Recorder Box */}
                <div className="p-3.5 rounded-lg bg-[#101914] border border-[#F7F4EB]/14 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#D6E0D9]">
                      Voice Audio Mini-Lecture (Optional · up to 60s)
                    </span>
                    {recordingTarget === 'lecture' ? (
                      <button
                        type="button"
                        onClick={stopActiveRecorderCleanup}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-[#F4A261] text-[#101813] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">
                          Stop ({recordingSeconds}s)
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startVoiceRecording('lecture')}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {lectureAudioUrl
                            ? 'Re-record Voice Note'
                            : 'Record Voice Mini-Lecture'}
                        </span>
                      </button>
                    )}
                  </div>

                  {lectureAudioUrl && (
                    <div className="space-y-1.5">
                      <audio
                        controls
                        src={lectureAudioUrl}
                        className="w-full h-9"
                      />
                      <span className="block text-[11px] font-mono text-[#9FB0A4]">
                        Recorded clip ({lectureDuration}s) ready to attach
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Save Mini-Lecture (+1 Trying &amp; +1 Treehouse Token)</span>
                </button>
              </form>

              <div className="lg:col-span-6 space-y-3">
                <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                  Recorded Mini-Lectures ({lectures.length})
                </h3>
                {lectures.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#16231C] border border-[#F7F4EB]/12 text-xs text-[#B8C6BC] leading-relaxed">
                    No mini-lectures recorded yet. Record a short skill guide on the left to teach fellow club members during Show &amp; Tell!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lectures.map((lec) => (
                      <article
                        key={lec.id}
                        className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#E5A93C]">
                            {lec.tradeTopic}
                          </span>
                          <span className="font-mono text-[11px] text-[#9FB0A4]">
                            {formatDualTimestamp(lec.createdAtMs)}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                          {lec.title}
                        </h4>
                        <p className="text-xs text-[#D2DDD5] whitespace-pre-wrap leading-relaxed">
                          {lec.keySteps}
                        </p>
                        {lec.audioDataUrl && (
                          <div className="pt-1 space-y-1">
                            <audio
                              controls
                              src={lec.audioDataUrl}
                              className="w-full h-9"
                            />
                            <a
                              href={lec.audioDataUrl}
                              download={`${lec.title
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')}.webm`}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#7CE0A3] hover:underline"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download Audio ({lec.durationSec}s)</span>
                            </a>
                          </div>
                        )}
                        <div className="pt-2 border-t border-[#F7F4EB]/10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onShareToCollab(
                                `Mini-Lecture: ${lec.title}`,
                                `${lec.tradeTopic} — ${lec.keySteps}`
                              );
                            }}
                            className="min-h-[32px] px-3 py-1 rounded-md bg-[#18261E] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Teach in Live Collab</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = lectures.filter(
                                (item) => item.id !== lec.id
                              );
                              setLectures(next);
                              saveMiniLectures(next);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-[#B8C6BC] hover:text-[#F4A261] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: COMMUNITY OUTREACH PROJECT RECORDER */}
          {activeTab === 'outreach' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <form
                onSubmit={handleSaveOutreachProject}
                className="lg:col-span-6 p-5 rounded-xl bg-[#16231C] border border-[#7CE0A3]/40 space-y-4"
              >
                <div>
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Record Your Community Outreach Project
                  </h3>
                  <p className="mt-0.5 text-xs text-[#C6D2C9]">
                    Document how you are putting workshop skills into neighbourhood kindness, repair, or nature care (+2 to +4 Treehouse Tokens &amp; +1 Gathering Token).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="outreach-title"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Outreach Project Title
                  </label>
                  <input
                    id="outreach-title"
                    type="text"
                    required
                    maxLength={90}
                    value={outreachTitle}
                    onChange={(e) => setOutreachTitle(e.target.value)}
                    placeholder="e.g., Community Garden Tool Sharpening & Seed Box Morning"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="outreach-who"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Who Benefits (Neighbours / Wildlife / Local Group)
                  </label>
                  <input
                    id="outreach-who"
                    type="text"
                    maxLength={120}
                    value={outreachBeneficiaries}
                    onChange={(e) => setOutreachBeneficiaries(e.target.value)}
                    placeholder="e.g., Local allotment elders, library visitors & songbirds"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="outreach-steps"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Outreach Actions &amp; Practical Steps
                  </label>
                  <textarea
                    id="outreach-steps"
                    rows={3}
                    required
                    maxLength={1200}
                    value={outreachSteps}
                    onChange={(e) => setOutreachSteps(e.target.value)}
                    placeholder="Describe what you built, repaired, or organised for the community..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="outreach-impact"
                    className="block text-xs font-semibold text-[#D6E0D9] mb-1"
                  >
                    Impact / Next Gathering Step (Optional)
                  </label>
                  <input
                    id="outreach-impact"
                    type="text"
                    maxLength={600}
                    value={outreachImpact}
                    onChange={(e) => setOutreachImpact(e.target.value)}
                    placeholder="e.g., 8 hand trowels restored; next session first Saturday"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                  />
                </div>

                {/* Optional Voice Field Note */}
                <div className="p-3.5 rounded-lg bg-[#101914] border border-[#F7F4EB]/14 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#D6E0D9]">
                      Outreach Voice Field Note (Optional)
                    </span>
                    {recordingTarget === 'outreach' ? (
                      <button
                        type="button"
                        onClick={stopActiveRecorderCleanup}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-[#F4A261] text-[#101813] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums">
                          Stop ({recordingSeconds}s)
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startVoiceRecording('outreach')}
                        className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {outreachAudioUrl
                            ? 'Re-record Field Note'
                            : 'Record Voice Note'}
                        </span>
                      </button>
                    )}
                  </div>
                  {outreachAudioUrl && (
                    <audio
                      controls
                      src={outreachAudioUrl}
                      className="w-full h-9"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#93E8B4] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Log Community Outreach Project (+Tokens)</span>
                </button>
              </form>

              <div className="lg:col-span-6 space-y-3">
                <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                  Your Community Outreach Log ({outreachList.length})
                </h3>
                {outreachList.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#16231C] border border-[#F7F4EB]/12 text-xs text-[#B8C6BC] leading-relaxed">
                    No outreach projects logged yet. Record your first neighbourhood repair, welcome event, or wildlife shelter project on the left!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {outreachList.map((proj) => (
                      <article
                        key={proj.id}
                        className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#7CE0A3]">
                            For: {proj.communityWhoBenefits}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-[#E5A93C]">
                            +{proj.tokensEarned} Treehouse ·{' '}
                            {formatDualTimestamp(proj.createdAtMs)}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-[#F7F4EB]">
                          {proj.projectTitle}
                        </h4>
                        <p className="text-xs text-[#D2DDD5] whitespace-pre-wrap leading-relaxed">
                          {proj.actionSteps}
                        </p>
                        {proj.impactNotes && (
                          <p className="text-xs font-mono text-[#9FB8A7]">
                            Outcome: {proj.impactNotes}
                          </p>
                        )}
                        {proj.audioDataUrl && (
                          <audio
                            controls
                            src={proj.audioDataUrl}
                            className="w-full h-9 pt-1"
                          />
                        )}
                        <div className="pt-2 border-t border-[#F7F4EB]/10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onShareToCollab(
                                `Outreach: ${proj.projectTitle}`,
                                `${proj.communityWhoBenefits} — ${proj.actionSteps}`
                              )
                            }
                            className="min-h-[32px] px-3 py-1 rounded-md bg-[#18261E] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Invite Helpers in Collab</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = outreachList.filter(
                                (item) => item.id !== proj.id
                              );
                              setOutreachList(next);
                              saveOutreachProjects(next);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-[#B8C6BC] hover:text-[#F4A261] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
