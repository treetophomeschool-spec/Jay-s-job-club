import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Flame,
  HeartHandshake,
  Layers,
  MessageSquareText,
  Mic,
  Pause,
  ShoppingBag,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CRAFT_CATALOG,
  CameraPreset,
  CraftKind,
  GameScreen,
  HudSnapshot,
  PACE_MODE_LABELS,
  PaceMode,
  ZoneType,
} from '../types/game';
import { formatDualCalendarBanner } from '../utils/dualCalendar';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  dockCollapsed: boolean;
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
  onToggleDock: () => void;
  onToggleMute: () => void;
  onPauseToggle: () => void;
  onHoldAscend: (active: boolean) => void;
  onHoldDescend: (active: boolean) => void;
  onGlideToElevation: (meters: number, label: string) => void;
  onToggleAutoGather: () => void;
  onSelectRootCraft: (kind: CraftKind) => void;
  onPrimaryAction: () => void;
  onTrade: () => void;
  onMastery: () => void;
  onReturnToRoots: () => void;
  onTogglePace: () => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onResume: () => void;
  onResetSession: () => void;
}

const ZONE_LABELS: Record<ZoneType, string> = {
  [ZoneType.ROOT_SANCTUARY]: 'Ground Floor · Sanctuary',
  [ZoneType.TRUNK_CABLE]: 'Vertical Cable',
  [ZoneType.CANOPY_SUMMIT]: 'Canopy · Trade Area',
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  dockCollapsed,
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
  onToggleDock,
  onToggleMute,
  onPauseToggle,
  onHoldAscend,
  onHoldDescend,
  onGlideToElevation,
  onToggleAutoGather,
  onSelectRootCraft,
  onPrimaryAction,
  onTrade,
  onMastery,
  onReturnToRoots,
  onTogglePace,
  onSelectCamera,
  onResume,
  onResetSession,
}) => {
  const [showBlueprintNote, setShowBlueprintNote] = useState(false);
  const [dualDateBanner, setDualDateBanner] = useState(() =>
    formatDualCalendarBanner()
  );

  // Refresh UK + Islamic (Hijri) date banner once per minute
  useEffect(() => {
    const id = window.setInterval(() => {
      setDualDateBanner(formatDualCalendarBanner());
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  const elevationPct = Math.min(
    100,
    Math.max(0, (hud.elevationMeters / hud.maxElevationMeters) * 100)
  );

  const poiseStateLabel =
    hud.poisePercent >= 75
      ? 'Grounded'
      : hud.poisePercent >= 45
        ? 'Steady'
        : 'Rest Suggested';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
      {/* TOP PERIMETER CLUSTER: Minimal Brand Banner + Tabular Status Readouts + Board/Audio/Pause */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Spec, UK+Islamic Date, Daily Streak & Express Altitude Readout */}
        <div className="pointer-events-auto bg-[#111A15]/94 border border-[#F7F4EB]/16 rounded-xl px-4 py-3 text-[#F7F4EB] max-w-2xl">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="font-display text-base sm:text-lg font-bold tracking-tight whitespace-nowrap">
                JAY&apos;S JOB CLUB
              </span>
              <span className="text-xs text-[#E5A93C] font-semibold">
                Passion to Trade &amp; Outreach
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[#C9D5CC]">
              {dualDateBanner.combined}
            </span>
          </div>

          {/* Unboxed Tabular Status Strip (Zero Static Pills) */}
          <div className="mt-2 pt-2 border-t border-[#F7F4EB]/12 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
            {/* Daily Mastery Streak */}
            <div
              className="flex items-center gap-1.5 font-mono tabular-nums"
              title="Consecutive days accessing your 33m Canopy or updating your Personal Journal (includes 1-day compassionate grace buffer)"
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  hud.dailyStreak > 0 ? 'text-[#E5A93C]' : 'text-[#8FA395]'
                }`}
              />
              <span className="text-[#B8C6BC]">Streak:</span>
              <span className="font-bold text-[#E5A93C]">
                {hud.dailyStreak}d
              </span>
              {hud.bestStreak > 1 && (
                <span className="text-[11px] text-[#8FA395]">
                  (Best {hud.bestStreak}d)
                </span>
              )}
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Lift:</span>
              <span className="font-semibold text-[#F7F4EB]">
                {hud.elevationMeters.toFixed(1)}m
              </span>
              <span className="text-[#8FA395]">·</span>
              <span className="font-sans font-semibold text-[#E5A93C]">
                {ZONE_LABELS[hud.zone]}
              </span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Poise:</span>
              <span className="font-semibold text-[#F7F4EB]">
                {hud.poisePercent}%
              </span>
              <span className="font-sans text-[#B8C6BC]">({poiseStateLabel})</span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            {/* Summit Beacons ▲ ▲ ▲ */}
            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Summit:</span>
              <span
                className="inline-flex items-center gap-1"
                aria-label={`${hud.beaconsLit} of 3 Mastery Beacons lit`}
              >
                {[0, 1, 2].map((idx) => {
                  const active = idx < hud.beaconsLit;
                  return (
                    <svg
                      key={idx}
                      viewBox="0 0 14 12"
                      className="w-3.5 h-3"
                      aria-hidden="true"
                    >
                      <polygon
                        points="7,1 13,11 1,11"
                        fill={active ? '#E5A93C' : 'none'}
                        stroke={active ? '#FFD166' : '#6F8275'}
                        strokeWidth="1.5"
                      />
                    </svg>
                  );
                })}
              </span>
              <span className="text-[#F7F4EB] font-semibold">
                {hud.beaconsLit}/3
              </span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Trying:</span>
              <span className="font-semibold text-[#E5A93C]">
                {hud.tryingTokens}
              </span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Gathering:</span>
              <span className="font-semibold text-[#7CE0A3]">
                {hud.gatheringTokens}
              </span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Treehouse:</span>
              <span className="font-semibold text-[#E5A93C]">
                {hud.treehouseTokens}
              </span>
            </div>

            <span className="text-[#F7F4EB]/25" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="text-[#B8C6BC]">Community:</span>
              <span className="font-semibold text-[#F7F4EB]">
                {hud.communityTokens}
              </span>
            </div>
          </div>

          {/* Linear Predictable Cable Progress Track + 1-Click Express Lift Stops (Removes Transit Bottlenecks) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onGlideToElevation(0, 'Ground Sanctuary (0m)')}
              className={`min-h-[26px] px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                hud.zone === ZoneType.ROOT_SANCTUARY
                  ? 'bg-[#213328] border-[#E5A93C]/50 text-[#F7F4EB]'
                  : 'bg-[#17231C] border-[#F7F4EB]/12 text-[#B8C6BC] hover:text-[#F7F4EB]'
              }`}
            >
              0m Roots
            </button>

            <div className="relative flex-1 min-w-[96px] h-2 bg-[#1D2B23] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#E5A93C] transition-transform duration-100 origin-left"
                style={{ transform: `scaleX(${elevationPct / 100})` }}
              />
            </div>

            <button
              type="button"
              onClick={() => onGlideToElevation(18, '18m Ideas & Papers Perch')}
              className="min-h-[26px] px-2 py-0.5 rounded bg-[#17231C] border border-[#F7F4EB]/12 text-[11px] font-mono text-[#B8C6BC] hover:text-[#F7F4EB] hover:border-[#7CE0A3]/50 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              18m Bough
            </button>

            <button
              type="button"
              onClick={() => onGlideToElevation(32.65, '33m Canopy Summit')}
              className={`min-h-[26px] px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                hud.zone === ZoneType.CANOPY_SUMMIT
                  ? 'bg-[#213328] border-[#E5A93C]/55 text-[#E5A93C]'
                  : 'bg-[#17231C] border-[#F7F4EB]/12 text-[#B8C6BC] hover:text-[#F7F4EB] hover:border-[#E5A93C]/50'
              }`}
            >
              33m Canopy
            </button>

            <button
              type="button"
              onClick={onToggleAutoGather}
              className={`min-h-[26px] px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                hud.autoGatherEnabled
                  ? 'bg-[#18291F] border-[#7CE0A3]/45 text-[#7CE0A3]'
                  : 'bg-[#17231C] border-[#F7F4EB]/12 text-[#9FB0A4]'
              }`}
            >
              Auto-Gather: {hud.autoGatherEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Top-Right Minimal Controls: Bookstall, Show & Tell Prep, Open Skills, Live Collab, Kiosk, Journal, Board, Canopy, Debug/Privacy, Audio, Pause */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 max-w-2xl">
          <button
            type="button"
            onClick={onOpenShop}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#E5A93C]/55 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Bookstall (P)</span>
          </button>

          <button
            type="button"
            onClick={onOpenGroundPrep}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Mic className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Show &amp; Tell Prep (O)</span>
          </button>

          <button
            type="button"
            onClick={onOpenSupport}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#7CE0A3]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <HeartHandshake className="w-3.5 h-3.5 text-[#7CE0A3]" />
            <span>Open Skills (N)</span>
          </button>

          <button
            type="button"
            onClick={onOpenCollab}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#7CE0A3]/40 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Users className="w-3.5 h-3.5 text-[#7CE0A3]" />
            <span>Collab ({hud.onlineCollaborators} · L)</span>
          </button>

          <button
            type="button"
            onClick={onOpenWelcome}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#E5A93C]/40 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Compass className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Kiosk (G)</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#7CE0A3]/40 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#7CE0A3]" />
            <span>Journal (J)</span>
          </button>

          <button
            type="button"
            onClick={onOpenBoard}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#F7F4EB]/22 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <MessageSquareText className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Board (B)</span>
          </button>

          <button
            type="button"
            onClick={onOpenShowAndStore}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Eye className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Canopy (V)</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#F7F4EB]/22 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Layers className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Floor (T)</span>
          </button>

          <button
            type="button"
            onClick={onOpenDebug}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#7CE0A3]/35 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] hover:bg-[#19261E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Bug className="w-3.5 h-3.5 text-[#7CE0A3]" />
            <span>Debug &amp; GDPR (D)</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5 text-[#E5A93C]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#E5A93C]" />
            )}
          </button>

          <button
            type="button"
            onClick={onPauseToggle}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C]"
          >
            <Pause className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Pause</span>
          </button>
        </div>
      </div>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (Zero Left/Right Flank Clutter) */}
      <div className="mx-auto w-full max-w-[940px] flex flex-col items-center">
        {/* Collapse / Expand Drawer Tab */}
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto mb-1.5 min-h-[34px] px-3.5 py-1.5 rounded-lg bg-[#111A15]/94 border border-[#F7F4EB]/16 text-xs font-semibold text-[#DCE3DD] hover:text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>Show Pulley Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        {/* Main Dock Surface — Compositor-only transform transition */}
        <div
          className={`w-full transition-all duration-200 ease-out ${
            dockCollapsed
              ? 'opacity-0 translate-y-6 pointer-events-none h-0 overflow-hidden'
              : 'opacity-100 translate-y-0 pointer-events-auto'
          }`}
        >
          <div className="bg-[#111A15]/95 border border-[#F7F4EB]/18 rounded-xl p-4 text-[#F7F4EB]">
            {/* Contextual Guidance Line */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#F7F4EB]/12 text-xs">
              <p className="text-[#E6ECE7] font-medium">
                {hud.gustWarningActive && hud.gustBandMeters !== null
                  ? `Breeze sweeping near ${hud.gustBandMeters}m · Wait calmly at your pace or press Space to Latch Brake.`
                  : hud.statusBanner}
              </p>
              <div className="font-mono tabular-nums text-[#C4D0C7] whitespace-nowrap">
                {hud.zone === ZoneType.CANOPY_SUMMIT
                  ? `${hud.studioName} · ${hud.safetyHatchLatched ? 'Floor Hatch Secured' : 'Floor Hatch Open'} · `
                  : ''}
                {hud.carriedCraft
                  ? `Cargo: ${CRAFT_CATALOG[hud.carriedCraft].label}`
                  : 'Cargo: Empty'}
                {hud.boughTokensCarried > 0
                  ? ` · +${hud.boughTokensCarried} Bough Token${hud.boughTokensCarried > 1 ? 's' : ''}`
                  : ''}
              </div>
            </div>

            {/* Control Row: Pulley Haul | Zone Context Actions | Camera & Pace */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 1. Manual Lift Pulley Paddles (Hold to Move, Zero Forced Speed) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={() => onHoldAscend(true)}
                  onPointerUp={() => onHoldAscend(false)}
                  onPointerLeave={() => onHoldAscend(false)}
                  onPointerCancel={() => onHoldAscend(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1E2E24] border border-[#F7F4EB]/20 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] active:bg-[#E5A93C] active:text-[#101813] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4 text-[#E5A93C]" />
                  <span>Ascend (W)</span>
                </button>

                <button
                  type="button"
                  onPointerDown={() => onHoldDescend(true)}
                  onPointerUp={() => onHoldDescend(false)}
                  onPointerLeave={() => onHoldDescend(false)}
                  onPointerCancel={() => onHoldDescend(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1E2E24] border border-[#F7F4EB]/20 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] active:bg-[#E5A93C] active:text-[#101813] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowDown className="w-4 h-4 text-[#E5A93C]" />
                  <span>Descend (S)</span>
                </button>

                <button
                  type="button"
                  onClick={onReturnToRoots}
                  className="min-h-[42px] px-3 py-2 rounded-lg bg-[#17231C] border border-[#F7F4EB]/14 text-xs font-medium text-[#D0DBD3] hover:text-[#F7F4EB] hover:border-[#F7F4EB]/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Root Rest (R)
                </button>
              </div>

              {/* 2. Zone-Adaptive Craft / Brake / Canopy Exchange Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {hud.zone === ZoneType.ROOT_SANCTUARY && (
                  <>
                    <div
                      className="flex items-center gap-1 p-1 bg-[#18251E] rounded-lg border border-[#F7F4EB]/10"
                      role="group"
                      aria-label="Select workshop craft"
                    >
                      {(
                        [
                          [CraftKind.CEDAR_JOINERY, 'Cedar'],
                          [CraftKind.COPPER_LANTERN, 'Brass'],
                          [CraftKind.LOOMED_TAPESTRY, 'Weave'],
                        ] as const
                      ).map(([kind, shortLabel]) => {
                        const active =
                          (hud.carriedCraft ?? hud.selectedRootCraft) === kind;
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => onSelectRootCraft(kind)}
                            className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              active
                                ? 'bg-[#E5A93C] text-[#101813]'
                                : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                            }`}
                          >
                            {shortLabel}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={onPrimaryAction}
                      className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {hud.carriedCraft ? 'Cycle Craft (Space)' : 'Load Craft (Space)'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenWelcome}
                      className="min-h-[42px] px-3 py-2 rounded-lg bg-[#1A2820] border border-[#E5A93C]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Kiosk Leaflets (G)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenGroundPrep}
                      className="min-h-[42px] px-3 py-2 rounded-lg bg-[#1A2820] border border-[#E5A93C]/55 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Lanterns &amp; Prep (O)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenJournal}
                      className="min-h-[42px] px-3 py-2 rounded-lg bg-[#1A2820] border border-[#7CE0A3]/50 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#7CE0A3]" />
                      <span>Journal (J)</span>
                    </button>
                  </>
                )}

                {hud.zone === ZoneType.TRUNK_CABLE && (
                  <button
                    type="button"
                    onClick={onPrimaryAction}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {hud.nearbyTokenAvailable
                      ? 'Gather Bundle (+1 Gathering · Space)'
                      : hud.isBraced
                        ? 'Brake Latched'
                        : 'Latch Brake (Space)'}
                  </button>
                )}

                {hud.zone === ZoneType.CANOPY_SUMMIT && (
                  <>
                    <button
                      type="button"
                      onClick={onOpenShowAndStore}
                      className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#E5A93C]/55 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Show &amp; Tell / Store (V)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenStudio}
                      className="min-h-[42px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/24 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Custom Floor (T)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onTrade}
                      className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/60 text-xs font-semibold text-[#F7F4EB] hover:bg-[#273B2E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Trade Work (1)
                    </button>
                    <button
                      type="button"
                      onClick={onMastery}
                      className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Dedicate Mastery (2)
                    </button>
                  </>
                )}
              </div>

              {/* 3. Pace Gear & Camera Preset Selector */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTogglePace}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#18251E] border border-[#F7F4EB]/14 text-xs font-semibold text-[#D6E0D9] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Pace: {PACE_MODE_LABELS[hud.paceMode].short}
                </button>

                <div
                  className="hidden md:flex items-center gap-1 p-1 bg-[#18251E] rounded-lg border border-[#F7F4EB]/10"
                  role="group"
                  aria-label="Camera view presets"
                >
                  {(
                    [
                      [CameraPreset.LIFT_FOLLOW, 'Lift'],
                      [CameraPreset.DIAGRAM_WIDE, 'Diagram'],
                      [CameraPreset.CANOPY_SUMMIT, 'Canopy'],
                      [CameraPreset.ROOT_SANCTUARY, 'Roots'],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onSelectCamera(preset)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        hud.cameraPreset === preset
                          ? 'bg-[#2C4134] text-[#F7F4EB]'
                          : 'text-[#B2C0B6] hover:text-[#F7F4EB]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAUSE / SANCTUARY GUIDE MODAL */}
      {hud.screen === GameScreen.PAUSED && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-[#0B120E]/82 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#131E18] border border-[#F7F4EB]/20 rounded-xl p-6 sm:p-8 text-[#F7F4EB]">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Workshop Paused
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#E5A93C]">
              Jay&apos;s Job Club · Turn a Special Interest into a Trade or Community Outreach
            </p>

            <div className="mt-5 space-y-2.5 text-sm text-[#DCE3DD] leading-relaxed">
              <p>
                <strong className="text-[#F7F4EB]">
                  Manual Pulley &amp; Bottleneck-Free Express Stops:
                </strong>{' '}
                Hold{' '}
                <span className="font-mono text-xs text-[#E5A93C]">W / S</span>{' '}
                to haul at your pace, click{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">
                  0m / 18m / 33m
                </span>{' '}
                for smooth Express Lift stops, and keep{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">
                  Auto-Gather
                </span>{' '}
                active to collect Bough Bundles without mid-cable stops.
              </p>
              <p>
                <strong className="text-[#F7F4EB]">
                  Ground Show &amp; Tell Prep, Bookstall &amp; Open Skills:
                </strong>{' '}
                Press <span className="font-mono text-xs text-[#E5A93C]">O</span>{' '}
                to buy Ground Lanterns, Virtual Drinks &amp; Welcome Packs, or
                record Mini-Lectures &amp; Community Outreach;{' '}
                <span className="font-mono text-xs text-[#E5A93C]">P</span> for
                the <em>Drazella Sprinkles</em> PayPal Bookstall;{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">N</span> for
                the Open Skills Hub; or{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">L</span> for
                Live Collaboration.
              </p>
              <p>
                <strong className="text-[#F7F4EB]">
                  Boots-on-Ground Censor, Debug &amp; UK GDPR:
                </strong>{' '}
                Press <span className="font-mono text-xs text-[#E5A93C]">B</span>{' '}
                for the moderated Job Board,{' '}
                <span className="font-mono text-xs text-[#E5A93C]">V / T</span>{' '}
                for your 33m Canopy Studio, or{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">D</span> for
                the Debug Console, UK GDPR Privacy tools, and{' '}
                <span className="font-mono text-xs text-[#7CE0A3]">
                  /jaysjobclub
                </span>{' '}
                easy link.
              </p>
            </div>

            {showBlueprintNote && (
              <pre className="mt-4 p-3 rounded-lg bg-[#0D1511] text-[11px] leading-snug font-mono text-[#D5E0D8] overflow-x-auto">
{`        ▲ ▲ ▲
     ( CANOPY )      Personal Trade Area & Custom Secure Flooring
    / [=======] \\
          ║          Vertical Cable (Linear & Clear)
         [■]         Manual Lift (Moving at Your Pace)
          ║
     ═════╩═════     Ground Floor · Job Board, Collabs & Sanctuary`}
              </pre>
            )}

            <div className="mt-6 pt-5 border-t border-[#F7F4EB]/12 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowBlueprintNote((v) => !v)}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] text-xs font-semibold text-[#D0DBD3] hover:text-[#F7F4EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {showBlueprintNote ? 'Hide Diagram' : 'View Tree Diagram'}
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onResetSession}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Restart Session
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="min-h-[40px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Resume
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANOPY MASTERY COMPLETE MODAL (▲ ▲ ▲ ALL LIT) */}
      {hud.screen === GameScreen.MASTERY_COMPLETE && (
        <div className="fixed inset-0 z-30 pointer-events-auto bg-[#0B120E]/82 flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#131E18] border border-[#E5A93C]/50 rounded-xl p-6 sm:p-8 text-[#F7F4EB]">
            <div className="flex items-center gap-2 mb-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <svg key={i} viewBox="0 0 18 15" className="w-5 h-4">
                  <polygon points="9,1 17,14 1,14" fill="#E5A93C" />
                </svg>
              ))}
            </div>

            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Canopy Mastery Illuminated
            </h2>
            <p className="mt-2 text-sm text-[#DCE3DD] leading-relaxed">
              Every Summit Beacon shines above the treehouse. Moving strictly at
              your own pace, you carried craft from the Root Sanctuary up the
              central Vertical Cable into lasting purpose.
            </p>

            <div className="mt-5 pt-4 border-t border-[#F7F4EB]/12 flex items-center gap-6 text-xs font-mono tabular-nums text-[#C9D5CC]">
              <span>Beacons: 3/3</span>
              <span>·</span>
              <span>Trades: {hud.tradesCompleted}</span>
              <span>·</span>
              <span>Community Tokens: {hud.communityTokens}</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onResetSession}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1B2A22] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                New Apprentice Session
              </button>
              <button
                type="button"
                onClick={onResume}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Continue Free Climb
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
