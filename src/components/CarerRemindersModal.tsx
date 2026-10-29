import React, { useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { PACE_MODE_LABELS, PACE_MODE_ORDER, PaceMode } from '../types/game';
import {
  CarerReminderItem,
  CarerRemindersState,
  validateCustomCarerItem,
} from '../utils/carerRemindersStore';

interface CarerRemindersModalProps {
  isOpen: boolean;
  remindersState: CarerRemindersState;
  paceMode: PaceMode;
  onChangeReminders: (next: CarerRemindersState) => void;
  onSelectPaceMode: (mode: PaceMode) => void;
  onGlideTo: (meters: number, label: string) => void;
  onClose: () => void;
}

export const CarerRemindersModal: React.FC<CarerRemindersModalProps> = ({
  isOpen,
  remindersState,
  paceMode,
  onChangeReminders,
  onSelectPaceMode,
  onGlideTo,
  onClose,
}) => {
  const [newItemText, setNewItemText] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const { items, pinnedStripVisible, outingNote } = remindersState;
  const totalCount = items.length;
  const checkedCount = items.filter((it) => it.checked).length;
  const remainingItems = items.filter((it) => !it.checked);
  const allReady = totalCount > 0 && checkedCount === totalCount;

  const handleToggleItem = (id: string) => {
    soundEngine.unlock();
    const nextItems = items.map((it) =>
      it.id === id ? { ...it, checked: !it.checked } : it
    );
    const nextCheckedCount = nextItems.filter((it) => it.checked).length;
    if (nextCheckedCount === nextItems.length && nextItems.length > 0) {
      soundEngine.playCanopyDelivery(false);
      setFeedback(
        'All going-out essentials checked — coats, snacks, meds, bags & spare clothes are ready!'
      );
    } else {
      soundEngine.playTokenCollect();
      setFeedback(null);
    }
    onChangeReminders({
      ...remindersState,
      items: nextItems,
    });
  };

  const handleCheckAll = () => {
    soundEngine.unlock();
    soundEngine.playCanopyDelivery(false);
    onChangeReminders({
      ...remindersState,
      items: items.map((it) => ({ ...it, checked: true })),
    });
    setFeedback('All going-out reminders marked ready.');
  };

  const handleResetAll = () => {
    soundEngine.unlock();
    soundEngine.playSanctuaryRest();
    onChangeReminders({
      ...remindersState,
      items: items.map((it) => ({ ...it, checked: false })),
    });
    setFeedback('Checklist reset cleanly for your next outing.');
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateCustomCarerItem(newItemText);
    if (!check.valid) {
      setFeedback(check.error || 'Please enter a valid item.');
      return;
    }
    if (items.length >= 17) {
      setFeedback('Checklist has reached the maximum of 17 items.');
      return;
    }
    const created: CarerReminderItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: 'custom',
      label: check.cleanLabel,
      detail: 'Personal carer going-out reminder',
      shortTag: check.cleanLabel.slice(0, 22),
      checked: false,
      isBuiltIn: false,
    };
    soundEngine.unlock();
    soundEngine.playCraftLoad();
    onChangeReminders({
      ...remindersState,
      items: [...items, created],
    });
    setNewItemText('');
    setFeedback(`Added "${created.label}" to your Going-Out Checklist.`);
  };

  const handleDeleteCustomItem = (id: string) => {
    onChangeReminders({
      ...remindersState,
      items: items.filter((it) => it.id !== id || it.isBuiltIn),
    });
  };

  const handleNoteChange = (val: string) => {
    onChangeReminders({
      ...remindersState,
      outingNote: val.slice(0, 120),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carer Going-Out Checklist and Lift Pace Controls"
      className="fixed inset-x-2 bottom-2 max-h-[88dvh] sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[min(540px,95vw)] sm:max-h-[calc(100dvh-1.5rem)] z-30 flex flex-col rounded-3xl sm:rounded-2xl bg-[#132019]/98 border border-[#E5A93C]/65 text-[#F7F4EB] shadow-2xl pointer-events-auto overflow-hidden"
    >
      {/* Accessible Header */}
      <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#192A20] border-b border-white/12 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#7CE0A3] truncate">
            Carer Support · Doorway Check &amp; Busy-Day Pace
          </p>
          <h2 className="text-base sm:text-xl font-bold text-[#FFD166] truncate">
            Going-Out Reminders &amp; Lift Speed
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#241810] border border-[#E5A93C]/55 hover:border-[#FFD166] text-[#FFD166] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          Close ✕
        </button>
      </div>

      {/* Scrollable Body with touch-action: pan-y and overscroll-behavior: contain */}
      <div className="flex-1 min-h-0 touch-pan-y-contain mobile-touch-scroll px-4 sm:px-5 py-3.5 sm:py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl bg-[#1D3326] border border-[#7CE0A3]/60 px-3.5 py-2.5 text-xs sm:text-sm text-[#E9F7EE]"
          >
            {feedback}
          </div>
        )}

        {/* Section 1: Lift Pace Selector (Super Slow to Sonic Speed for Busy Days) */}
        <section className="rounded-2xl bg-[#18281F] border border-[#E5A93C]/40 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-[#FFD166]">
              Agarwood Lift Speed · Calm Days or Busy Days
            </h3>
            <span className="font-mono text-xs text-[#7CE0A3]">
              Active: {PACE_MODE_LABELS[paceMode].buttonLabel}
            </span>
          </div>
          <p className="text-xs text-[#CFE3D4]">
            Choose <strong className="text-[#F7F4EB]">Super Slow</strong> for
            gentle sensory comfort (zero wind sway) or{' '}
            <strong className="text-[#FFD166]">Sonic</strong> on busy days to
            zip between 0m and 33m in 2 seconds:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PACE_MODE_ORDER.map((mode) => {
              const active = paceMode === mode;
              const meta = PACE_MODE_LABELS[mode];
              const isSonic = mode === PaceMode.SONIC;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onSelectPaceMode(mode);
                    setFeedback(
                      `Lift switched to ${meta.buttonLabel} — ${meta.description}.`
                    );
                  }}
                  className={`touch-manipulation touch-manipulation-btn min-h-[48px] px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? isSonic
                        ? 'bg-[#3B2810] border-[#FFD166] text-[#FFFBEB]'
                        : 'bg-[#243D2E] border-[#7CE0A3] text-[#FFFFFF]'
                      : 'bg-[#142219] border-white/15 text-[#DCEADF] hover:border-[#FFD166]'
                  }`}
                >
                  <div className="text-xs font-bold whitespace-nowrap truncate">
                    {isSonic ? '⚡ Sonic' : meta.short}
                  </div>
                  <div className="text-[11px] font-mono text-[#B7CDBD] truncate">
                    {mode === PaceMode.SUPER_SLOW
                      ? '0.55 m/s'
                      : mode === PaceMode.FINE
                        ? '1.35 m/s'
                        : mode === PaceMode.STEADY
                          ? '2.6 m/s'
                          : '16.5 m/s'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSelectPaceMode(PaceMode.SONIC);
                onGlideTo(33, '33m Canopy (Sonic Busy-Day)');
                onClose();
              }}
              className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              ⚡ Sonic Zip to 33m Canopy
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectPaceMode(PaceMode.SUPER_SLOW);
                setFeedback(
                  'Super Slow Lift Pace active (0.55 m/s) — ultra-steady, sway-free travel.'
                );
              }}
              className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#1F3528] border border-[#7CE0A3]/55 hover:border-[#7CE0A3] text-[#E6F6EC] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Set Super Slow Calm Pace
            </button>
          </div>
        </section>

        {/* Section 2: Carer Going-Out Checklist */}
        <section className="rounded-2xl bg-[#1A2B21] border border-[#7CE0A3]/45 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#FFD166]">
                Going Out Doorway Checklist
              </h3>
              <p className="text-xs text-[#CFE3D4] mt-0.5">
                {allReady
                  ? 'All essentials packed & checked — ready to head out calmly!'
                  : `${checkedCount} of ${totalCount} checked · Still to check: ${remainingItems
                      .map((r) => r.shortTag)
                      .join(' · ')}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {!allReady && (
                <button
                  type="button"
                  onClick={handleCheckAll}
                  className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#223B2C] border border-[#7CE0A3]/55 hover:border-[#7CE0A3] text-xs font-semibold text-[#7CE0A3] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Check All
                </button>
              )}
              <button
                type="button"
                onClick={handleResetAll}
                className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl bg-[#241A12] border border-[#E5A93C]/45 hover:border-[#FFD166] text-xs font-semibold text-[#FFD166] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset Next Trip
              </button>
            </div>
          </div>

          {/* Checklist Items (>= 56px touch hitboxes) */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border transition-colors flex items-stretch gap-2 ${
                  item.checked
                    ? 'bg-[#1F3729] border-[#7CE0A3]/65'
                    : 'bg-[#142219] border-white/14 hover:border-[#FFD166]/60'
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  onClick={() => handleToggleItem(item.id)}
                  className="touch-manipulation touch-manipulation-btn flex-1 min-h-[58px] p-3 text-left flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold ${
                        item.checked
                          ? 'text-[#A7F3D0] line-through decoration-[#7CE0A3]/70'
                          : 'text-[#F7F4EB]'
                      }`}
                    >
                      {item.label}
                    </div>
                    <p className="mt-0.5 text-xs text-[#C6DACB] leading-snug">
                      {item.detail}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold whitespace-nowrap shrink-0 mt-0.5 ${
                      item.checked ? 'text-[#7CE0A3]' : 'text-[#FFD166]'
                    }`}
                  >
                    {item.checked ? '✓ Packed' : 'To Check'}
                  </span>
                </button>

                {!item.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomItem(item.id)}
                    aria-label={`Remove ${item.label}`}
                    className="touch-manipulation touch-manipulation-btn min-h-[44px] min-w-[44px] px-2.5 self-center mr-1.5 rounded-lg bg-[#2A1B18] border border-white/12 hover:border-[#FDA4AF] text-xs font-semibold text-[#FDA4AF] cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Carer Reminder */}
          <form onSubmit={handleAddCustomItem} className="pt-2 flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add extra item (e.g., Blue badge, ear defenders, packed lunch)..."
              maxLength={64}
              aria-label="Add custom carer going-out reminder"
              className="flex-1 min-w-0 min-h-[44px] rounded-xl bg-[#111D16] border border-white/18 focus:border-[#FFD166] focus:outline-none px-3 py-2 text-xs sm:text-sm text-[#F7F4EB] placeholder:text-[#8DA694]"
            />
            <button
              type="submit"
              className="touch-manipulation touch-manipulation-btn min-h-[44px] px-3.5 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-[#181009] font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Add Item
            </button>
          </form>

          {/* Optional Quick Outing Note (Time / Appointment / Destination) */}
          <div className="pt-1 space-y-1">
            <label
              htmlFor="carer-outing-note"
              className="block text-xs font-semibold text-[#CFE3D4]"
            >
              Optional Today&apos;s Outing / Return Note (saved privately on this
              device):
            </label>
            <input
              id="carer-outing-note"
              type="text"
              value={outingNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="e.g., Leaving 10:15am · Library & Park · Bring spare wellies"
              maxLength={120}
              className="w-full min-h-[44px] rounded-xl bg-[#111D16] border border-white/15 focus:border-[#7CE0A3] focus:outline-none px-3 py-2 text-xs sm:text-sm text-[#F7F4EB] placeholder:text-[#8DA694]"
            />
          </div>
        </section>

        {/* Top Bar Reminder Strip Toggle */}
        <div className="rounded-xl bg-[#15241B] border border-white/12 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#CFE3D4]">
          <span>
            Show gentle Going-Out reminder strip beneath the top bar
          </span>
          <button
            type="button"
            aria-pressed={pinnedStripVisible}
            onClick={() =>
              onChangeReminders({
                ...remindersState,
                pinnedStripVisible: !pinnedStripVisible,
              })
            }
            className={`touch-manipulation touch-manipulation-btn min-h-[44px] px-3 py-1.5 rounded-xl border font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              pinnedStripVisible
                ? 'bg-[#21382B] border-[#7CE0A3] text-[#7CE0A3]'
                : 'bg-[#1B2A20] border-white/15 text-[#CFE3D4]'
            }`}
          >
            {pinnedStripVisible ? 'Top Reminder: ON' : 'Top Reminder: Hidden'}
          </button>
        </div>
      </div>
    </div>
  );
};
