import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  Compass,
  Eye,
  FileText,
  Flame,
  HeartHandshake,
  Link2,
  MessageSquareText,
  Mic,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { TreeProgressState } from '../firebase';
import { SharePathwayKind } from '../types/game';
import { formatDualCalendarBanner } from '../utils/dualCalendar';
import { ShowAndTellPrepTab } from './GroundShowAndTellPrepModal';

interface WelcomeAscentModalProps {
  isOpen: boolean;
  progress: TreeProgressState;
  onWelcomeCheckIn: () => void;
  onGatherWelcomeSheet: () => void;
  onOpenShop: () => void;
  onOpenSupport: () => void;
  onOpenBoard: () => void;
  onOpenJournal: () => void;
  onOpenShowAndStore: () => void;
  onOpenGroundPrep: (tab: ShowAndTellPrepTab) => void;
  onOpenPrivacyAndLink: () => void;
  onFocusGroundCamera: () => void;
  onRedeemPathway: (
    pathway: SharePathwayKind,
    tryingCost: number,
    gatheringCost: number
  ) => void;
  onClose: () => void;
}

interface PathwaySpec {
  id: SharePathwayKind;
  title: string;
  subtitle: string;
  tryingCost: number;
  gatheringCost: number;
  outcomeNote: string;
}

interface KioskLeafletSpec {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  details: string[];
  actionLabel?: string;
  actionKind?:
    | 'lanterns'
    | 'virtual_shop'
    | 'lectures'
    | 'outreach'
    | 'bookstall'
    | 'board'
    | 'privacy';
}

const LOCAL_COLLECTED_LEAFLETS_KEY = 'jays_job_club_kiosk_leaflets_v1';

function loadCollectedLeaflets(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(LOCAL_COLLECTED_LEAFLETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCollectedLeaflets(map: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(
      LOCAL_COLLECTED_LEAFLETS_KEY,
      JSON.stringify(map)
    );
  } catch {
    // Ignore storage errors
  }
}

const KIOSK_WELCOME_LEAFLETS: KioskLeafletSpec[] = [
  {
    id: 'leaflet_orientation',
    kicker: 'Leaflet 01 · Sanctuary Orientation',
    title: 'Welcome to Jay’s Job Club & Unhurried Pulley Guide',
    summary:
      'How the 0m Ground Sanctuary, 18m Bough Perch, and 33m Canopy Summit work together with UK & Islamic Hijri dates.',
    details: [
      'Move the central manual pulley strictly at your own pace (W / S or 1-click Express Stops at 0m, 18m, and 33m).',
      'Check in at the Ground Desk for Trying Tokens, gather bundles along the boughs, and verify ethical ideas for Treehouse Tokens.',
      'Every notice and journal entry records both UK and Islamic (Hijri) calendar timestamps.',
    ],
  },
  {
    id: 'leaflet_lantern_prep',
    kicker: 'Leaflet 02 · Ground Show & Tell Prep',
    title: 'Buying Show & Tell Lanterns & Virtual Hospitality on Ground Floor',
    summary:
      'Prepare lighting, warm spiced herbal drinks, and guest welcome packs right from 0m before hosting at 33m.',
    details: [
      'Pick up Spun Brass Rafter Lanterns, String Garlands, and Reading Lamps directly from the Ground-Floor Prep Counter.',
      'Visit the Virtual Show & Tell Shop to stock herbal drinks carafes, elderflower jugs, and guest welcome packs using virtual tokens.',
      'Exchange 1 Trying + 1 Gathering Token anytime if you need an extra Treehouse Token for your session lantern.',
    ],
    actionLabel: 'Open Ground Lanterns & Virtual Shop',
    actionKind: 'virtual_shop',
  },
  {
    id: 'leaflet_lectures_outreach',
    kicker: 'Leaflet 03 · Teaching & Neighbourhood Impact',
    title: 'Recording Mini-Lectures & Community Outreach Projects',
    summary:
      'Teach fellow members practical skills with short voice/written mini-lectures and log real neighbourhood outreach.',
    details: [
      'Record up to 60-second voice audio mini-lectures paired with clear step-by-step skill notes (+1 Trying & +1 Treehouse Token).',
      'Document your Community Outreach Project—who benefits, practical actions taken, and next steps (+2 to +4 Treehouse Tokens).',
      'Send any mini-lecture or outreach plan straight into a Live Collaboration room to invite helpers.',
    ],
    actionLabel: 'Record Mini-Lecture or Outreach',
    actionKind: 'lectures',
  },
  {
    id: 'leaflet_boots_charter',
    kicker: 'Leaflet 04 · Ground Floor Charter',
    title: 'Tree ‘Boots on Ground’ Censor & Respectful Job Board Rules',
    summary:
      'Keeping the Job & Collab Board welcoming, practical, and free from rude language or exploitative listings.',
    details: [
      'Our Tree "Boots on Ground" Censor screens all board notices, mini-lectures, and chat for rude words, insults, scams, and harm.',
      'Unsuitable submissions are held back immediately with clear guidance so members can rephrase respectfully.',
      'Share genuine craft opportunities, tool loans, collaborations, and constructive workshop advice.',
    ],
    actionLabel: 'Visit Ground Job Board',
    actionKind: 'board',
  },
  {
    id: 'leaflet_drazella_book',
    kicker: 'Leaflet 05 · Welcome Bookstall',
    title: 'Featured Book: Drazella Sprinkles (Clothbound Edition)',
    summary:
      'Browse the updated Welcome Stall featuring the gold-foil clothbound storybook Drazella Sprinkles (£9.99 GBP).',
    details: [
      'Available at the 0m Welcome Bookstall via PayPal Orders v2 checkout or Ground Sanctuary Desk pickup reservation.',
      'Includes +2 bonus Canopy Treehouse Tokens with every verified order or reservation.',
    ],
    actionLabel: 'Browse Drazella Sprinkles Bookstall',
    actionKind: 'bookstall',
  },
  {
    id: 'leaflet_gdpr_easy_link',
    kicker: 'Leaflet 06 · Privacy & Bookmark Guide',
    title: 'Easy Club URL (/jaysjobclub) & Your UK GDPR Privacy Controls',
    summary:
      'How to bookmark the easy club address, sign in privately, export your JSON archive, or erase your data anytime.',
    details: [
      'Easy-to-remember link: add /jaysjobclub (or /club) to this site address to jump straight to the workshop.',
      'Your email is never displayed on public boards; Private Journal entries are owner-locked.',
      'Download a portable JSON copy of your data (Art. 15/20) or erase local & cloud data (Art. 17) anytime in Privacy & Link.',
    ],
    actionLabel: 'Open Privacy & Easy Link',
    actionKind: 'privacy',
  },
];

const SHARE_PATHWAYS: PathwaySpec[] = [
  {
    id: 'collab_ready',
    title: 'Share for Collab',
    subtitle: 'Organize special interest notes & papers for a partner project',
    tryingCost: 1,
    gatheringCost: 1,
    outcomeNote: '+15 Community · Ready for Ground Collab Board',
  },
  {
    id: 'trade_building',
    title: 'Trade Building',
    subtitle: 'Turn gathered items & ideas into a repeatable craft setup',
    tryingCost: 1,
    gatheringCost: 2,
    outcomeNote: '+25 Community · Fits Pulley Counterweight Balance',
  },
  {
    id: 'job_steps',
    title: 'Practical Job Steps',
    subtitle: 'Break an interest into clear, calm step-by-step job tasks',
    tryingCost: 2,
    gatheringCost: 1,
    outcomeNote: '+25 Community · Fits Brass Wind-Shield Louvers',
  },
  {
    id: 'trade_sharing',
    title: 'Canopy Trade Sharing',
    subtitle: 'Share your gathered trade or outreach bundle from the Summit',
    tryingCost: 2,
    gatheringCost: 2,
    outcomeNote: '+35 Community · Illuminates a Canopy Beacon (▲)',
  },
];

export const WelcomeAscentModal: React.FC<WelcomeAscentModalProps> = ({
  isOpen,
  progress,
  onWelcomeCheckIn,
  onGatherWelcomeSheet,
  onOpenShop,
  onOpenSupport,
  onOpenBoard,
  onOpenJournal,
  onOpenShowAndStore,
  onOpenGroundPrep,
  onOpenPrivacyAndLink,
  onFocusGroundCamera,
  onRedeemPathway,
  onClose,
}) => {
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [expandedLeafletId, setExpandedLeafletId] = useState<string | null>(
    'leaflet_lantern_prep'
  );
  const [collectedLeaflets, setCollectedLeaflets] = useState<
    Record<string, boolean>
  >(() => loadCollectedLeaflets());

  if (!isOpen) return null;

  const handleCollectLeaflet = (leaflet: KioskLeafletSpec) => {
    if (collectedLeaflets[leaflet.id]) {
      setFeedbackNote(`"${leaflet.title}" is already tucked in your Kiosk folder.`);
      return;
    }
    const next = { ...collectedLeaflets, [leaflet.id]: true };
    setCollectedLeaflets(next);
    saveCollectedLeaflets(next);
    onGatherWelcomeSheet();
    setFeedbackNote(
      `Picked up "${leaflet.title}" from the Ground Kiosk rack (+1 Gathering Token)!`
    );
  };

  const triggerLeafletAction = (kind: KioskLeafletSpec['actionKind']) => {
    if (!kind) return;
    if (kind === 'lanterns') onOpenGroundPrep('lanterns');
    else if (kind === 'virtual_shop') onOpenGroundPrep('virtual_shop');
    else if (kind === 'lectures') onOpenGroundPrep('lectures');
    else if (kind === 'outreach') onOpenGroundPrep('outreach');
    else if (kind === 'bookstall') onOpenShop();
    else if (kind === 'board') onOpenBoard();
    else if (kind === 'privacy') onOpenPrivacyAndLink();
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex items-stretch justify-end p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-ascent-heading"
    >
      <div className="pointer-events-auto w-full max-w-[560px] h-full flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#F7F4EB]/14 bg-[#15211A] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="welcome-ascent-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Ground-Floor Kiosk · Leaflets, Show &amp; Tell Prep &amp; Tokens
              </h2>
              <p className="mt-0.5 text-xs font-mono text-[#C6D2C9]">
                {formatDualCalendarBanner().combined}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onFocusGroundCamera}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>View Ground Kiosk (0m)</span>
            </button>

            <button
              type="button"
              onClick={onOpenPrivacyAndLink}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>/jaysjobclub &amp; Privacy</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Ground Kiosk"
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Workshop Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          {feedbackNote && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#18291F] border border-[#E5A93C]/45 text-xs text-[#F7F4EB]">
              <span>{feedbackNote}</span>
              <button
                type="button"
                onClick={() => setFeedbackNote(null)}
                className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 01. Welcome Area Orientation & Ground Show-and-Tell Quick Prep */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                01. Ground-Floor Welcome Desk &amp; Show-and-Tell Prep
              </h3>
              <span className="text-xs font-mono text-[#B8C6BC]">
                0m Sanctuary
              </span>
            </div>

            <p className="text-sm text-[#D2DDD5] leading-relaxed">
              Check in at the Welcome Lectern, browse the Kiosk Leaflet Rack
              below, buy Show &amp; Tell lanterns and virtual drinks/welcome
              packs right here on the Ground Floor, or record a mini-lecture and
              community outreach project.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  onWelcomeCheckIn();
                  setFeedbackNote(
                    progress.welcomeCheckedIn
                      ? 'Welcome Kiosk refreshed · Ready on steady ground.'
                      : 'Welcome check-in complete · Earned +1 Level 1 Trying Token!'
                  );
                }}
                className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  progress.welcomeCheckedIn
                    ? 'bg-[#1A2A21] border border-[#7CE0A3]/50 text-[#7CE0A3]'
                    : 'bg-[#E5A93C] text-[#101813] hover:bg-[#F0B84D]'
                }`}
              >
                {progress.welcomeCheckedIn ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Checked In at Welcome Desk</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    <span>Check In at Welcome Desk (+1 Trying Token)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onGatherWelcomeSheet();
                  setFeedbackNote(
                    'Picked up a Special Interest Starter Sheet (+1 Gathering Token)!'
                  );
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#18261E] border border-[#F7F4EB]/16 text-xs font-semibold text-[#DCE5DE] hover:border-[#7CE0A3] hover:text-[#F7F4EB] transition-colors cursor-pointer"
              >
                Starter Idea Sheet (+1 Gathering)
              </button>
            </div>

            {/* Ground Show & Tell Prep, Virtual Shop, Mini-Lectures & Outreach Launch Grid */}
            <div className="mt-3 p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#E5A93C]">
                  Ground-Floor Show &amp; Tell &amp; Outreach Studio (Shortcut O)
                </span>
                <span className="font-mono tabular-nums text-[#9FB0A4]">
                  Streak: {progress.dailyStreak ?? 0}d (Best {progress.bestStreak ?? 0}d)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenGroundPrep('lanterns')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                  <span>Buy Ground Lanterns</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenGroundPrep('virtual_shop')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5 text-[#7CE0A3] shrink-0" />
                  <span>Virtual Shop (Drinks &amp; Packs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenGroundPrep('lectures')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-[#E5A93C] shrink-0" />
                  <span>Record Mini-Lecture</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenGroundPrep('outreach')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-[#7CE0A3] shrink-0" />
                  <span>Record Outreach Project</span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#F7F4EB]/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenShop}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#19271F] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#E5A93C]" />
                  <span>Drazella Sprinkles Stall (P)</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSupport}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#19271F] border border-[#7CE0A3]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#7CE0A3]" />
                  <span>Open Skills &amp; Support (N)</span>
                </button>
              </div>
            </div>
          </section>

          {/* 02. Ground-Floor Kiosk Welcome Leaflets Rack */}
          <section className="pt-6 border-t border-[#F7F4EB]/12 space-y-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#E5A93C]" />
                <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                  02. Ground-Floor Kiosk Welcome Leaflets ({KIOSK_WELCOME_LEAFLETS.length})
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#7CE0A3]">
                Collected:{' '}
                {Object.keys(collectedLeaflets).length}/
                {KIOSK_WELCOME_LEAFLETS.length}
              </span>
            </div>

            <p className="text-xs text-[#C6D2C9] leading-relaxed">
              Open any leaflet from the Ground Kiosk rack to read practical club
              guides and collect +1 Gathering Token per leaflet:
            </p>

            <div className="space-y-2.5">
              {KIOSK_WELCOME_LEAFLETS.map((leaflet) => {
                const isExpanded = expandedLeafletId === leaflet.id;
                const isCollected = Boolean(collectedLeaflets[leaflet.id]);
                return (
                  <div
                    key={leaflet.id}
                    className="rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLeafletId(isExpanded ? null : leaflet.id)
                      }
                      className="w-full px-4 py-3 text-left flex items-start justify-between gap-3 hover:bg-[#1A2921] transition-colors cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-mono text-[#E5A93C]">
                          {leaflet.kicker}
                          {isCollected ? ' · Collected' : ''}
                        </div>
                        <div className="font-display text-sm font-bold text-[#F7F4EB]">
                          {leaflet.title}
                        </div>
                        <p className="text-xs text-[#C6D2C9]">
                          {leaflet.summary}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#E5A93C] shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#9FB0A4] shrink-0 mt-1" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-[#F7F4EB]/10 space-y-3 bg-[#131E18]">
                        <ul className="space-y-1.5 text-xs text-[#D6E0D9] leading-relaxed list-disc pl-4">
                          {leaflet.details.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCollectLeaflet(leaflet)}
                            className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                              isCollected
                                ? 'bg-[#1A2A21] border border-[#7CE0A3]/45 text-[#7CE0A3]'
                                : 'bg-[#7CE0A3] text-[#101813] hover:bg-[#93E8B4]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {isCollected
                                ? 'Leaflet Collected'
                                : 'Take Leaflet (+1 Gathering)'}
                            </span>
                          </button>

                          {leaflet.actionLabel && leaflet.actionKind && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerLeafletAction(leaflet.actionKind)
                              }
                              className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/50 text-xs font-semibold text-[#E5A93C] hover:text-[#F7F4EB] cursor-pointer"
                            >
                              {leaflet.actionLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03. Two-Tier Tokens for Trying & Ethical Idea Tokens */}
          <section className="pt-6 border-t border-[#F7F4EB]/12 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                03. Your Workshop Token Balances
              </h3>
              <span className="text-xs font-mono tabular-nums text-[#B8C6BC]">
                Shares Completed: {progress.sharesCompleted}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#E5A93C]">
                      Level 1 · Trying Token
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums text-[#F7F4EB]">
                      {progress.tryingTokens}
                    </span>
                  </div>
                  <p className="text-xs text-[#C8D4CB] leading-relaxed">
                    Earned for checking in, posting on the Job Board, or
                    recording a mini-lecture.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenBoard}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquareText className="w-3.5 h-3.5 text-[#E5A93C]" />
                  <span>Post on Job Board (+1 Trying)</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#16231C] border border-[#7CE0A3]/35 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-[#7CE0A3]">
                      Level 2 · Gathering Token
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums text-[#F7F4EB]">
                      {progress.gatheringTokens}
                    </span>
                  </div>
                  <p className="text-xs text-[#C8D4CB] leading-relaxed">
                    Earned for collecting Kiosk leaflets, Bough bundles, Journal
                    notes, and Outreach logs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenJournal}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#7CE0A3]" />
                  <span>Write Ideas / Papers (+1 Gathering)</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xs font-semibold text-[#E5A93C]">
                    Canopy · Treehouse Tokens
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-[#F7F4EB]">
                    {progress.treehouseTokens}
                  </span>
                </div>
                <p className="text-xs text-[#C8D4CB] leading-relaxed">
                  Verify any ethical idea on the Ethical Idea Bench (+2 to +4
                  Tokens) or spend them on Ground &amp; Canopy lanterns!
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenShowAndStore}
                className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Verify Ethical Ideas (V)
              </button>
            </div>
          </section>

          {/* 04. Ready to Share: Collab, Trade Building, Job Steps & Trade Sharing */}
          <section className="pt-6 border-t border-[#F7F4EB]/12 space-y-3.5">
            <div>
              <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                04. Put Trying &amp; Gathering Tokens to Work
              </h3>
              <p className="mt-1 text-xs text-[#C6D2C9] leading-relaxed">
                Combine your Trying &amp; Gathering Tokens whenever you feel
                ready to turn special interest items, ideas, or papers into
                action:
              </p>
            </div>

            <div className="space-y-2.5">
              {SHARE_PATHWAYS.map((pathway) => {
                const canAfford =
                  progress.tryingTokens >= pathway.tryingCost &&
                  progress.gatheringTokens >= pathway.gatheringCost;

                return (
                  <div
                    key={pathway.id}
                    className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold text-[#F7F4EB]">
                          {pathway.title}
                        </span>
                        <span className="text-[#8FA395]" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-xs text-[#E5A93C]">
                          {pathway.tryingCost} Trying + {pathway.gatheringCost}{' '}
                          Gathering
                        </span>
                      </div>
                      <p className="text-xs text-[#C8D4CB]">{pathway.subtitle}</p>
                      <p className="text-[11px] font-mono text-[#9FB8A7]">
                        {pathway.outcomeNote}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        onRedeemPathway(
                          pathway.id,
                          pathway.tryingCost,
                          pathway.gatheringCost
                        );
                        setFeedbackNote(
                          `${pathway.title} activated · ${pathway.outcomeNote}!`
                        );
                      }}
                      className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                        canAfford
                          ? 'bg-[#E5A93C] text-[#101813] hover:bg-[#F0B84D]'
                          : 'bg-[#1A261F] text-[#7D8F83] border border-[#F7F4EB]/10 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{canAfford ? 'Put to Work' : 'Gather Tokens'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
