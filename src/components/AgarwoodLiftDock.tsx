import React, { useRef, useState } from 'react';
import { getAgarwoodMotivationForElevation } from '../shared/agarwoodMotivation';
import {
  HudSnapshot,
  PACE_MODE_LABELS,
  PACE_MODE_ORDER,
  PaceMode,
  TreeLiftControlAction,
} from '../types/game';

interface AgarwoodLiftDockProps {
  hud: HudSnapshot | null;
  anyModalOpen?: boolean;
  onHoldAscend: (active: boolean) => void;
  onHoldDescend: (active: boolean) => void;
  onToggleContinuous: (direction: 'ascend' | 'descend') => void;
  onStopLift: () => void;
  onGlideTo: (meters: number, label: string) => void;
  onTogglePace: () => void;
  onSelectPace: (mode: PaceMode) => void;
  onOpenCarerReminders: () => void;
  onOpenEntryKiosk: () => void;
  onOpenJobBoard: () => void;
  onOpenMezzanine: () => void;
  onOpenShoeSelector: () => void;
  onOpenCanopyCustomizer: () => void;
  onOpenCanopyPaypalStore: () => void;
  onOpenBankOfTreetop: () => void;
}

const CONTROL_LABELS: Record<TreeLiftControlAction, string> = {
  ascend: '▲ Haul Up',
  stop: '■ Rest / Hold',
  descend: '▼ Lower Down',
  glide_0: '0m Roots',
  glide_18: '18m Bough',
  glide_33: '33m Canopy',
};

export const AgarwoodLiftDock: React.FC<AgarwoodLiftDockProps> = ({
  hud,
  anyModalOpen = false,
  onHoldAscend,
  onHoldDescend,
  onToggleContinuous,
  onStopLift,
  onGlideTo,
  onTogglePace,
  onSelectPace,
  onOpenCarerReminders,
  onOpenEntryKiosk,
  onOpenJobBoard,
  onOpenMezzanine,
  onOpenShoeSelector,
  onOpenCanopyCustomizer,
  onOpenCanopyPaypalStore,
  onOpenBankOfTreetop,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const pressDownAtRef = useRef<number>(0);
  const activeHoldDirRef = useRef<'ascend' | 'descend' | null>(null);

  const elevation = hud?.elevationMeters ?? 0;
  const fallbackPlaque = getAgarwoodMotivationForElevation(elevation);
  const motivationalTitle =
    hud?.motivationalTitle || fallbackPlaque.carvedTitle;
  const motivationalMessage =
    hud?.motivationalMessage || fallbackPlaque.motivationalMessage;
  const motionState = hud?.liftMotionState ?? 'idle';
  const paceMode = hud?.paceMode ?? PaceMode.FINE;
  const hoveredTreeControl = hud?.hoveredTreeControl ?? null;
  const hoveredEntryKiosk = hud?.hoveredEntryKiosk ?? false;
  const hoveredWelcomeShoes = hud?.hoveredWelcomeShoes ?? false;
  const hoveredJobBoard = hud?.hoveredJobBoard ?? false;
  const hoveredCanopyStore = hud?.hoveredCanopyStore ?? false;
  const hoveredCanopyStudio = hud?.hoveredCanopyStudio ?? false;
  const hoveredMezzanine = hud?.hoveredMezzanine ?? false;
  const hoveredChillPodId = hud?.hoveredChillPodId ?? null;
  const activeShoeLabel = hud?.activeShoeLabel || 'Wellington Boots';

  const motionLabel =
    motionState === 'ascending'
      ? 'Hauling Upward'
      : motionState === 'descending'
        ? 'Lowering Gently'
        : motionState === 'gliding'
          ? 'Gliding to Waystation'
          : 'Resting Steady';

  const handleDirectionalPointerDown = (direction: 'ascend' | 'descend') => {
    pressDownAtRef.current = performance.now();
    activeHoldDirRef.current = direction;
    if (direction === 'ascend') {
      onHoldAscend(true);
    } else {
      onHoldDescend(true);
    }
  };

  const handleDirectionalPointerUp = (direction: 'ascend' | 'descend') => {
    if (activeHoldDirRef.current !== direction) return;
    const heldMs = performance.now() - pressDownAtRef.current;
    activeHoldDirRef.current = null;
    if (direction === 'ascend') {
      onHoldAscend(false);
    } else {
      onHoldDescend(false);
    }
    if (heldMs < 260) {
      onToggleContinuous(direction);
    }
  };

  const handleDirectionalPointerLeave = (direction: 'ascend' | 'descend') => {
    if (activeHoldDirRef.current !== direction) return;
    activeHoldDirRef.current = null;
    if (direction === 'ascend') {
      onHoldAscend(false);
    } else {
      onHoldDescend(false);
    }
  };

  if (collapsed) {
    return (
      <aside
        aria-label="Agarwood Tree Lift Controls"
        className={`${
          anyModalOpen ? 'hidden sm:block' : 'block'
        } fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pb-[env(safe-area-inset-bottom)] pointer-events-auto`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-[#1B120B]/96 border border-[#E5A93C]/55 text-[#F7F4EB] hover:border-[#FFD166] transition-colors shadow-xl font-medium text-xs sm:text-base flex items-center gap-2.5 cursor-pointer whitespace-nowrap"
        >
          <span className="text-[#FFD166] font-semibold">
            ▴ Lift &amp; Chill Pods
          </span>
          <span className="text-[#8FB996]">·</span>
          <span className="font-mono tabular-nums text-[#E5A93C]">
            {elevation.toFixed(1)}m / 33m
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Agarwood Tree Lift Console and Motivational Plaque"
      className={`${
        anyModalOpen ? 'hidden sm:block' : 'block'
      } fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(1220px,96vw)] pb-[env(safe-area-inset-bottom)] pointer-events-auto`}
    >
      {/* Ergonomic Mobile Thumb-Zone Dock (< 640px) — Keeps 3D Treehouse & Chill Pods Clear */}
      <div className="sm:hidden rounded-2xl bg-[#1B120B]/96 border border-[#E5A93C]/55 shadow-2xl px-3 py-2.5 text-[#F7F4EB] space-y-2">
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <span className="font-mono tabular-nums font-semibold text-[#FFD166] shrink-0">
            {elevation.toFixed(1)}m / 33m
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePace}
              className={`touch-manipulation min-h-[44px] px-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                paceMode === PaceMode.SONIC
                  ? 'bg-[#3B2810] border-[#FFD166] text-[#FFD166]'
                  : paceMode === PaceMode.SUPER_SLOW
                    ? 'bg-[#1F3528] border-[#7CE0A3] text-[#7CE0A3]'
                    : 'bg-[#23170F] border-[#C8B69E]/35 text-[#EFE7DA]'
              }`}
              title="Tap to cycle Super Slow, Gentle, Steady, and Sonic Busy-Day lift speed"
            >
              {paceMode === PaceMode.SONIC
                ? '⚡ Sonic'
                : PACE_MODE_LABELS[paceMode].short}
            </button>
            <button
              type="button"
              onClick={onOpenCarerReminders}
              className="touch-manipulation min-h-[44px] px-2.5 rounded-xl bg-[#1E3327] border border-[#7CE0A3]/55 text-[#A7F3D0] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Carer Check
            </button>
            <button
              type="button"
              onClick={() => setMobileMoreOpen((prev) => !prev)}
              className="touch-manipulation min-h-[44px] px-2.5 rounded-xl border border-[#C8B69E]/35 text-[#F7F4EB] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {mobileMoreOpen ? 'Less ▾' : 'More ▴'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onPointerDown={() => handleDirectionalPointerDown('ascend')}
            onPointerUp={() => handleDirectionalPointerUp('ascend')}
            onPointerLeave={() => handleDirectionalPointerLeave('ascend')}
            aria-pressed={motionState === 'ascending'}
            className={`touch-manipulation min-h-[46px] px-2 rounded-xl border font-bold text-xs whitespace-nowrap cursor-pointer ${
              motionState === 'ascending'
                ? 'bg-[#2C4A34] border-[#7CE0A3] text-[#F7F4EB]'
                : 'bg-[#281B11] border-[#E5A93C]/55 text-[#FFD166]'
            }`}
          >
            ▲ Up
          </button>
          <button
            type="button"
            onClick={onStopLift}
            className="touch-manipulation min-h-[46px] px-2 rounded-xl bg-[#332215] border border-[#E5A93C]/65 text-[#F7F4EB] font-semibold text-xs whitespace-nowrap cursor-pointer"
          >
            ■ Hold
          </button>
          <button
            type="button"
            onPointerDown={() => handleDirectionalPointerDown('descend')}
            onPointerUp={() => handleDirectionalPointerUp('descend')}
            onPointerLeave={() => handleDirectionalPointerLeave('descend')}
            aria-pressed={motionState === 'descending'}
            className={`touch-manipulation min-h-[46px] px-2 rounded-xl border font-bold text-xs whitespace-nowrap cursor-pointer ${
              motionState === 'descending'
                ? 'bg-[#2C4A34] border-[#7CE0A3] text-[#F7F4EB]'
                : 'bg-[#281B11] border-[#E5A93C]/55 text-[#F4C97A]'
            }`}
          >
            ▼ Down
          </button>
          <button
            type="button"
            onClick={onOpenMezzanine}
            className="touch-manipulation col-span-2 min-h-[46px] px-2.5 rounded-xl bg-[#1D4030] border border-[#7CE0A3] text-[#FFFFFF] font-bold text-xs whitespace-nowrap cursor-pointer"
          >
            Chill Pods
          </button>
        </div>

        {mobileMoreOpen && (
          <div className="pt-2 border-t border-white/12 space-y-2">
            <p className="text-xs text-[#F7F4EB] leading-snug">
              “{motivationalMessage}”
            </p>
            {/* 4-Mode Direct Lift Speed Bar on Mobile */}
            <div className="grid grid-cols-4 gap-1.5">
              {PACE_MODE_ORDER.map((mode) => {
                const active = paceMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPace(mode)}
                    className={`touch-manipulation min-h-[44px] px-1.5 rounded-xl border text-[11px] font-bold whitespace-nowrap truncate cursor-pointer ${
                      active
                        ? mode === PaceMode.SONIC
                          ? 'bg-[#3B2810] border-[#FFD166] text-[#FFD166]'
                          : 'bg-[#233D2D] border-[#7CE0A3] text-[#FFFFFF]'
                        : 'bg-[#23170F] border-[#C8B69E]/30 text-[#D8CCB8]'
                    }`}
                  >
                    {mode === PaceMode.SONIC
                      ? '⚡ Sonic'
                      : PACE_MODE_LABELS[mode].short}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onGlideTo(0, '0m Root Sanctuary')}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#23170F] border border-[#C8B69E]/35 text-xs font-mono font-semibold cursor-pointer"
              >
                0m Roots
              </button>
              <button
                type="button"
                onClick={() => onGlideTo(18, '18m Agarwood Bough')}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#23170F] border border-[#C8B69E]/35 text-xs font-mono font-semibold cursor-pointer"
              >
                18m Bough
              </button>
              <button
                type="button"
                onClick={() => onGlideTo(33, '33m Treetop Canopy')}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#23170F] border border-[#C8B69E]/35 text-xs font-mono font-semibold cursor-pointer"
              >
                33m Canopy
              </button>
              <button
                type="button"
                onClick={onOpenJobBoard}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#0E4429] border border-[#FFD166] text-[#FFFDF7] text-xs font-bold cursor-pointer"
              >
                Job Centre
              </button>
              <button
                type="button"
                onClick={onOpenCanopyCustomizer}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#23170F] border border-[#E5A93C]/45 text-[#F5DEB3] text-xs font-semibold cursor-pointer"
              >
                Canopy Studio
              </button>
              <button
                type="button"
                onClick={onOpenCanopyPaypalStore}
                className="touch-manipulation min-h-[44px] rounded-xl bg-[#E5A93C] border border-[#FFD166] text-[#171008] text-xs font-bold cursor-pointer"
              >
                PayPal Store
              </button>
              <button
                type="button"
                onClick={onOpenBankOfTreetop}
                className="touch-manipulation col-span-3 min-h-[44px] rounded-xl bg-[#1E2E1C] border border-[#FFD166]/65 text-[#FFE082] text-xs font-bold cursor-pointer"
              >
                Bank of Treetop · Stock Guide (Not a Real Bank)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Tablet & Desktop Console (sm+) */}
      <div className="hidden sm:block rounded-2xl bg-[#1B120B]/96 border border-[#E5A93C]/55 shadow-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-[#F7F4EB]">
        {/* Carved Agarwood Motivational Plaque Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2 border-b border-[#E5A93C]/25">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-[#E5A93C]">
              Agarwood Heartwood Plaque · {motivationalTitle}
            </p>
            <p className="mt-0.5 text-sm sm:text-base font-medium text-[#F7F4EB] leading-snug">
              “{motivationalMessage}”
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs sm:text-sm shrink-0">
            <span className="font-mono tabular-nums font-semibold text-[#FFD166]">
              {elevation.toFixed(1)}m / 33m
            </span>
            <span className="text-[#C8B69E]/60">·</span>
            <span className="text-[#9DC0A6] font-medium">{motionLabel}</span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="ml-1 px-2.5 py-1 rounded-lg border border-[#C8B69E]/30 text-[#D8CCB8] hover:text-[#F7F4EB] hover:border-[#E5A93C] transition-colors text-xs whitespace-nowrap cursor-pointer"
              title="Minimize bottom bar (you can still press the 3D stations and trunk buttons)"
            >
              ▾ Hide Bar
            </button>
          </div>
        </div>

        {/* Effortless Lift Controls + Visible Job Centre, Mezzanine Chill Pods & Canopy Triggers */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => handleDirectionalPointerDown('ascend')}
              onPointerUp={() => handleDirectionalPointerUp('ascend')}
              onPointerLeave={() => handleDirectionalPointerLeave('ascend')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleContinuous('ascend');
                }
              }}
              aria-pressed={motionState === 'ascending'}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                motionState === 'ascending'
                  ? 'bg-[#2C4A34] border-[#7CE0A3] text-[#F7F4EB]'
                  : 'bg-[#281B11] border-[#E5A93C]/55 text-[#FFD166] hover:bg-[#352417] hover:border-[#FFD166]'
              }`}
            >
              ▲ Haul Up
            </button>

            <button
              type="button"
              onClick={onStopLift}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                motionState === 'idle'
                  ? 'bg-[#332215] border-[#E5A93C]/70 text-[#F7F4EB]'
                  : 'bg-[#3D2614] border-[#FFD166] text-[#FFD166] hover:bg-[#4B2F19]'
              }`}
            >
              ■ Rest
            </button>

            <button
              type="button"
              onPointerDown={() => handleDirectionalPointerDown('descend')}
              onPointerUp={() => handleDirectionalPointerUp('descend')}
              onPointerLeave={() => handleDirectionalPointerLeave('descend')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleContinuous('descend');
                }
              }}
              aria-pressed={motionState === 'descending'}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                motionState === 'descending'
                  ? 'bg-[#2C4A34] border-[#7CE0A3] text-[#F7F4EB]'
                  : 'bg-[#281B11] border-[#E5A93C]/55 text-[#F4C97A] hover:bg-[#352417] hover:border-[#FFD166]'
              }`}
            >
              ▼ Lower
            </button>

            <button
              type="button"
              onClick={() => onGlideTo(0, '0m Root Sanctuary')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#23170F] border border-[#C8B69E]/35 hover:border-[#E5A93C] text-[#F7F4EB] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer font-mono tabular-nums"
            >
              0m
            </button>
            <button
              type="button"
              onClick={() => onGlideTo(18, '18m Agarwood Bough')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#23170F] border border-[#C8B69E]/35 hover:border-[#E5A93C] text-[#F7F4EB] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer font-mono tabular-nums"
            >
              18m
            </button>
            <button
              type="button"
              onClick={() => onGlideTo(33, '33m Treetop Canopy')}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#23170F] border border-[#C8B69E]/35 hover:border-[#E5A93C] text-[#F7F4EB] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer font-mono tabular-nums"
            >
              33m
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* 0m Old-Style Job Centre Board */}
            <button
              type="button"
              onClick={onOpenJobBoard}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                hoveredJobBoard || elevation < 3.0
                  ? 'bg-[#0E4429] border-[#FFD166] text-[#FFFDF7] hover:bg-[#145C38]'
                  : 'bg-[#153524] border-[#7CE0A3]/60 text-[#F7F4EB] hover:border-[#FFD166]'
              }`}
              title="Open the visible 0m Old-Style Job Centre Board to choose a job slip or collaborate"
            >
              Job Centre Board
            </button>

            {/* 33m Treetop Mezzanine (Library, Refreshments & Private Chill Pods) */}
            <button
              type="button"
              onClick={onOpenMezzanine}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                hoveredMezzanine || hoveredChillPodId || elevation >= 28.5
                  ? 'bg-[#1D4030] border-[#7CE0A3] text-[#FFFFFF] hover:bg-[#26543F]'
                  : 'bg-[#1A2E23] border-[#7CE0A3]/50 text-[#E2F5EA] hover:border-[#7CE0A3]'
              }`}
              title="Explore the 33m Mezzanine Library, Refreshments Bar & 1-Per-Person Private Chill Pods"
            >
              Mezzanine &amp; Chill Pods
            </button>

            {/* Welcome Area Shoe Character Selector */}
            <button
              type="button"
              onClick={onOpenShoeSelector}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                hoveredWelcomeShoes
                  ? 'bg-[#1F3527] border-[#7CE0A3] text-[#FFFFFF]'
                  : 'bg-[#1A2920] border-[#8FB996]/45 text-[#D8E8DD] hover:border-[#7CE0A3]'
              }`}
              title="Choose Wellington Boots, Work Boots, or Maker Shoes"
            >
              Shoes: {activeShoeLabel}
            </button>

            {/* Upstairs 33m Canopy Customiser */}
            <button
              type="button"
              onClick={onOpenCanopyCustomizer}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                hoveredCanopyStudio
                  ? 'bg-[#2E2012] border-[#FFD166] text-[#FFD166]'
                  : 'bg-[#23170F] border-[#E5A93C]/45 text-[#F5DEB3] hover:border-[#FFD166]'
              }`}
            >
              Customise Canopy
            </button>

            {/* Bank of Treetop Symbolic Stock Pot & Unpaid Exchequer */}
            <button
              type="button"
              onClick={onOpenBankOfTreetop}
              className="touch-manipulation min-h-[44px] px-3 py-2 rounded-xl bg-[#1E2E1C] border border-[#FFD166]/65 hover:border-[#FFD166] text-[#FFE082] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
              title="Bank of Treetop (Not a Real Bank): Save symbolic club tokens for Special-Interest Stock or volunteer as Unpaid Exchequer"
            >
              Bank of Treetop
            </button>

            {/* 33m Canopy PayPal Maker Store */}
            <button
              type="button"
              onClick={onOpenCanopyPaypalStore}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                hoveredCanopyStore
                  ? 'bg-[#E5A93C] border-[#FFD166] text-[#171008]'
                  : 'bg-[#E5A93C] hover:bg-[#FFD166] border-[#FFD166]/80 text-[#171008]'
              }`}
            >
              PayPal Store
            </button>

            {/* Carer Going-Out Checklist */}
            <button
              type="button"
              onClick={onOpenCarerReminders}
              className="touch-manipulation min-h-[44px] px-3 py-2 rounded-xl bg-[#1A3326] border border-[#7CE0A3]/60 hover:border-[#FFD166] text-[#D8F8E3] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
              title="Open Carer Going-Out Checklist (Everyone's Coat, Snacks, Meds, Bags & Changes of Clothes)"
            >
              Carer Check
            </button>

            {/* 4-Speed Lift Pace Selector: Super Slow / Gentle / Steady / Sonic Busy-Day */}
            <div
              role="group"
              aria-label="Agarwood Lift Pace Selector"
              className="inline-flex items-center gap-1 rounded-xl bg-[#141E18] border border-[#8FB996]/35 p-1"
            >
              {PACE_MODE_ORDER.map((mode) => {
                const active = paceMode === mode;
                const isSonic = mode === PaceMode.SONIC;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPace(mode)}
                    title={PACE_MODE_LABELS[mode].description}
                    className={`touch-manipulation min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? isSonic
                          ? 'bg-[#E5A93C] text-[#171008] font-bold'
                          : 'bg-[#284735] text-[#FFFFFF] border border-[#7CE0A3]/60'
                        : 'text-[#C4D8CA] hover:text-[#FFD166]'
                    }`}
                  >
                    {isSonic ? '⚡ Sonic' : PACE_MODE_LABELS[mode].short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Plain-English Guidance + Live 3D Hover Readout */}
        <p className="mt-2 text-xs text-[#D5C7B2]/95 flex flex-wrap items-center justify-between gap-2">
          <span>
            0m Courtyard: choose jobs &amp; collaborate at the{' '}
            <button
              type="button"
              onClick={onOpenJobBoard}
              className="text-[#FFD166] underline font-semibold cursor-pointer"
            >
              Job Centre
            </button>{' '}
            or map interests at the{' '}
            <button
              type="button"
              onClick={onOpenEntryKiosk}
              className="text-[#FFD166] underline font-semibold cursor-pointer"
            >
              Entry Kiosk
            </button>
            . 33m Upstairs: visit the{' '}
            <button
              type="button"
              onClick={onOpenMezzanine}
              className="text-[#7CE0A3] underline font-semibold cursor-pointer"
            >
              Mezzanine Library, Refreshments &amp; Private Chill Pods
            </button>
            .
          </span>
          {hoveredJobBoard ? (
            <span className="text-[#FFD166] font-semibold">
              3D Old-Style Job Centre Ready · Click to Choose a Job Slip or Team Up
            </span>
          ) : hoveredChillPodId ? (
            <span className="text-[#7CE0A3] font-semibold">
              3D Private Chill Pod Ready (1/Person) · Click for Fan, Heater, Calm, Water or Quilt
            </span>
          ) : hoveredMezzanine ? (
            <span className="text-[#7CE0A3] font-semibold">
              3D Mezzanine Gallery Ready · Click for Library &amp; Refreshments
            </span>
          ) : hoveredWelcomeShoes ? (
            <span className="text-[#7CE0A3] font-semibold">
              3D Boot &amp; Shoe Bench Ready · Click to Choose Wellies or Work Shoes
            </span>
          ) : hoveredCanopyStore ? (
            <span className="text-[#FFD166] font-semibold">
              3D Canopy PayPal Store Ready · Click to Sell or Buy Maker Work
            </span>
          ) : hoveredCanopyStudio ? (
            <span className="text-[#FFD166] font-semibold">
              3D Upstairs Studio Booth Ready · Click to Customise Canopy
            </span>
          ) : hoveredEntryKiosk ? (
            <span className="text-[#7CE0A3] font-semibold">
              3D Ground Entry Kiosk Ready · Click to Open Personal Dashboard
            </span>
          ) : hoveredTreeControl ? (
            <span className="text-[#FFD166] font-medium">
              3D Trunk Control Ready: {CONTROL_LABELS[hoveredTreeControl]}
            </span>
          ) : null}
        </p>
      </div>
    </aside>
  );
};
