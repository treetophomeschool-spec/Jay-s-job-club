import React from 'react';
import {
  BookOpen,
  Bug,
  Compass,
  Eye,
  HeartHandshake,
  Layers,
  MessageSquareText,
  Mic,
  ShoppingBag,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDualCalendarBanner } from '../utils/dualCalendar';

interface TitleOverlayProps {
  onStart: () => void;
  onOpenWelcome: () => void;
  onOpenShop: () => void;
  onOpenGroundPrep: () => void;
  onOpenSupport: () => void;
  onOpenCollab: () => void;
  onOpenJournal: () => void;
  onOpenBoard: () => void;
  onOpenStudio: () => void;
  onOpenShowAndStore: () => void;
  onOpenDebug: () => void;
  dailyStreak: number;
  onlineCollaborators: number;
  muted: boolean;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  onStart,
  onOpenWelcome,
  onOpenShop,
  onOpenGroundPrep,
  onOpenSupport,
  onOpenCollab,
  onOpenJournal,
  onOpenBoard,
  onOpenStudio,
  onOpenShowAndStore,
  onOpenDebug,
  dailyStreak,
  onlineCollaborators,
  muted,
  onToggleMute,
}) => {
  const dualDateBanner = formatDualCalendarBanner();

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between bg-gradient-to-r from-[#0E1612]/92 via-[#0E1612]/58 to-transparent p-6 sm:p-10 lg:p-14">
      {/* Top Bar: UK + Islamic Date, Streak, Handcrafted Shop, Neuro Support, Live Collab & Workshop Tools */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-wide text-[#F7F4EB]/85">
          <span>Open All-Ages Community Workshop · Zero Forced Speed</span>
          <span className="text-[#E5A93C]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-[#DCE5DE]">
            {dualDateBanner.combined}
          </span>
          {dailyStreak > 0 && (
            <>
              <span className="text-[#E5A93C]" aria-hidden="true">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#E5A93C] font-semibold">
                Daily Streak: {dailyStreak}d
              </span>
            </>
          )}
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenShop}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#15201A] border border-[#E5A93C]/55 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <ShoppingBag className="w-4 h-4 text-[#E5A93C]" />
            <span>Drazella Bookstall (P)</span>
          </button>

          <button
            type="button"
            onClick={onOpenGroundPrep}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#15201A] border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Mic className="w-4 h-4 text-[#E5A93C]" />
            <span>Show &amp; Tell Prep (O)</span>
          </button>

          <button
            type="button"
            onClick={onOpenSupport}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#15201A] border border-[#7CE0A3]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <HeartHandshake className="w-4 h-4 text-[#7CE0A3]" />
            <span>Open Skills &amp; Support (N)</span>
          </button>

          <button
            type="button"
            onClick={onOpenCollab}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#15201A] border border-[#7CE0A3]/40 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Users className="w-4 h-4 text-[#7CE0A3]" />
            <span>Live Collab ({onlineCollaborators})</span>
          </button>

          <button
            type="button"
            onClick={onOpenWelcome}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#E5A93C]/35 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Compass className="w-4 h-4 text-[#E5A93C]" />
            <span>Kiosk Leaflets (G)</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <BookOpen className="w-4 h-4 text-[#7CE0A3]" />
            <span>Journal (J)</span>
          </button>

          <button
            type="button"
            onClick={onOpenBoard}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <MessageSquareText className="w-4 h-4 text-[#E5A93C]" />
            <span>Job Board (B)</span>
          </button>

          <button
            type="button"
            onClick={onOpenShowAndStore}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Eye className="w-4 h-4 text-[#E5A93C]" />
            <span>Canopy (V)</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Layers className="w-4 h-4 text-[#E5A93C]" />
            <span>Floor (T)</span>
          </button>

          <button
            type="button"
            onClick={onOpenDebug}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#7CE0A3]/35 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <Bug className="w-4 h-4 text-[#7CE0A3]" />
            <span>Debug &amp; GDPR (D)</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-[#15201A] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-[#E5A93C]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#E5A93C]" />
            )}
            <span>{muted ? 'Muted' : 'Sound'}</span>
          </button>
        </div>
      </div>

      {/* Left-Aligned Architectural SVG Lockup & Primary Start CTA (Leaving 60%+ Live 3D World Open) */}
      <div className="max-w-xl my-auto py-4">
        {/* Bespoke Inline SVG Vertical Pulley & Canopy Lockup */}
        <svg
          viewBox="0 0 360 156"
          className="w-72 sm:w-84 h-auto mb-5 overflow-visible"
          role="img"
          aria-label="Canopy Treehouse Summit, Manual Pulley Lift, and Root Base Workshop diagram"
        >
          {/* Three Summit Beacons: ▲ ▲ ▲ */}
          <polygon points="84,18 91,6 98,18" fill="#E5A93C" />
          <polygon points="107,15 114,3 121,15" fill="#FFD166" />
          <polygon points="130,18 137,6 144,18" fill="#E5A93C" />

          {/* Canopy Enclosure Arc & Platform [=======] */}
          <path
            d="M 62 42 C 52 31, 66 22, 114 22 C 162 22, 176 31, 166 42"
            fill="none"
            stroke="#8FB996"
            strokeWidth="2"
          />
          <rect
            x="76"
            y="34"
            width="76"
            height="10"
            rx="2"
            fill="#1D2B23"
            stroke="#F7F4EB"
            strokeWidth="1.75"
          />
          <line x1="84" y1="39" x2="144" y2="39" stroke="#E5A93C" strokeWidth="2" />

          {/* Vertical Guide Cable ║ */}
          <line x1="112" y1="45" x2="112" y2="128" stroke="#F7F4EB" strokeWidth="1.8" />
          <line x1="116" y1="45" x2="116" y2="128" stroke="#E5A93C" strokeWidth="1.8" />

          {/* The Manual Lift [■] */}
          <rect
            x="99"
            y="76"
            width="30"
            height="24"
            rx="3"
            fill="#141E18"
            stroke="#E5A93C"
            strokeWidth="2"
          />
          <rect x="106" y="82" width="16" height="12" rx="1.5" fill="#F7F4EB" />

          {/* Root Base Foundation ═════╩═════ */}
          <line x1="56" y1="129" x2="172" y2="129" stroke="#F7F4EB" strokeWidth="2.5" />
          <line x1="68" y1="134" x2="160" y2="134" stroke="#E5A93C" strokeWidth="2" />
          <rect x="106" y="123" width="16" height="6" rx="1" fill="#E5A93C" />

          {/* Clean Diagram Callout Labels */}
          <text
            x="186"
            y="41"
            fill="#F7F4EB"
            fontSize="11.5"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="600"
          >
            Canopy · Personal Trade Area &amp; Custom Floor
          </text>
          <text
            x="186"
            y="91"
            fill="#E5A93C"
            fontSize="11.5"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="600"
          >
            Manual Lift · Your Own Pace
          </text>
          <text
            x="186"
            y="133"
            fill="#C7D3C9"
            fontSize="11.5"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontWeight="600"
          >
            Ground Floor · Job Board &amp; Collabs
          </text>
        </svg>

        <h1
          className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-[#F7F4EB] leading-[1.06]"
          style={{ textWrap: 'balance' }}
        >
          JAY&apos;S JOB CLUB
        </h1>

        <p
          className="mt-2.5 text-lg sm:text-xl font-semibold text-[#E5A93C] tracking-wide"
          style={{ textWrap: 'balance' }}
        >
          Turn a Special Interest into a Trade or Community Outreach
        </p>

        <p className="mt-4 text-sm sm:text-base text-[#E2E6DF] leading-relaxed max-w-[54ch]">
          Browse the Ground Floor Job Board &amp; Collabs alongside the quiet
          Root Base workbench. Haul the central manual pulley upward at your own
          pace to your Personal Trade Area in the Canopy—complete with secure,
          non-slip flooring you can customize.
        </p>

        <div className="mt-7 pointer-events-auto flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={onStart}
            className="min-h-[48px] px-7 py-3 rounded-lg bg-[#E5A93C] text-[#101813] font-display text-base font-bold tracking-wide hover:bg-[#F0B84D] active:translate-y-px transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F7F4EB]"
          >
            Enter Workshop
          </button>
          <span className="text-xs font-mono text-[#C7D3C9]">
            Press Enter or Space
          </span>
        </div>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="text-xs sm:text-[13px] font-mono text-[#D6DDD7] tracking-wide">
        W / S Haul or Express Lift (0m / 18m / 33m) · O Show &amp; Tell Prep &amp; Outreach · P Drazella Bookstall · G Kiosk Leaflets · N Open Skills · B Moderated Board · D Debug &amp; /jaysjobclub
      </div>
    </div>
  );
};
