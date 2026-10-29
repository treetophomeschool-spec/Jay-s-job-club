import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { type RealtimeCollabController } from '../collab/useRealtimeCollab';
import {
  type CollabPacingTag,
  type CollabStepStatus,
} from '../shared/workshopCatalog';
import { formatDualTimestamp } from '../utils/dualCalendar';
import {
  screenBootsOnGroundCensor,
  screenForHarmToHumansOrAnimals,
} from '../utils/ethicalGuard';

interface LiveCollabModalProps {
  isOpen: boolean;
  collab: RealtimeCollabController;
  onGlideToElevation: (meters: number, label: string) => void;
  onStepReward: (kind: 'added' | 'completed') => void;
  onClose: () => void;
}

const PACING_TAGS: CollabPacingTag[] = [
  'Quiet Async',
  'Paired Co-Work',
  'Trainer Guided',
  'Low-Demand Rest OK',
];

const NEXT_STATUS: Record<CollabStepStatus, CollabStepStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export const LiveCollabModal: React.FC<LiveCollabModalProps> = ({
  isOpen,
  collab,
  onGlideToElevation,
  onStepReward,
  onClose,
}) => {
  const [nameDraft, setNameDraft] = useState(collab.displayName);
  const [localPad, setLocalPad] = useState(collab.roomState.sharedCharterPad);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [customRoomDraft, setCustomRoomDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Guard to avoid overwriting local typing cursor while still applying remote peer pad updates
  const isEditingPadRef = useRef(false);
  const padDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    setNameDraft(collab.displayName);
  }, [collab.displayName]);

  useEffect(() => {
    if (!isEditingPadRef.current) {
      setLocalPad(collab.roomState.sharedCharterPad);
    }
  }, [collab.roomState.sharedCharterPad, collab.activeRoomId]);

  if (!isOpen) return null;

  const handlePadChange = (nextVal: string) => {
    setLocalPad(nextVal);
    setLocalError(null);
    if (padDebounceRef.current !== null) {
      window.clearTimeout(padDebounceRef.current);
    }
    padDebounceRef.current = window.setTimeout(() => {
      const censor = screenBootsOnGroundCensor(nextVal, 'Collab Charter Pad');
      if (!censor.allowed) {
        setLocalError(
          censor.reason ||
            'Tree "Boots on Ground" Censor: Shared pad update blocked due to rude or unsuitable wording.'
        );
        return;
      }
      const check = screenForHarmToHumansOrAnimals(nextVal);
      if (!check.safe) {
        setLocalError(
          check.reason ||
            'Shared pad update blocked by humane & ethical safety guard.'
        );
        return;
      }
      collab.updateCharterPad(nextVal);
    }, 260);
  };

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newStepTitle.trim();
    if (clean.length < 2) return;
    const censor = screenBootsOnGroundCensor(clean, 'Collab Step');
    if (!censor.allowed) {
      setLocalError(
        censor.reason ||
          'Tree "Boots on Ground" Censor: Blueprint step blocked due to rude or unsuitable language.'
      );
      return;
    }
    const check = screenForHarmToHumansOrAnimals(clean);
    if (!check.safe) {
      setLocalError(
        check.reason || 'Blueprint step blocked by humane & ethical safety guard.'
      );
      return;
    }
    setLocalError(null);
    collab.addStep(clean, collab.displayName);
    setNewStepTitle('');
    onStepReward('added');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatDraft.trim();
    if (!clean) return;
    const censor = screenBootsOnGroundCensor(clean, 'Collab Chat');
    if (!censor.allowed) {
      setLocalError(
        censor.reason ||
          'Tree "Boots on Ground" Censor: Message blocked due to rude or unsuitable language.'
      );
      return;
    }
    const check = screenForHarmToHumansOrAnimals(clean);
    if (!check.safe) {
      setLocalError(
        check.reason || 'Message blocked by humane & ethical safety guard.'
      );
      return;
    }
    setLocalError(null);
    collab.sendChatMessage(clean);
    setChatDraft('');
  };

  const handleJoinCustomRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = customRoomDraft.trim();
    if (cleanTitle.length < 2) return;
    const censor = screenBootsOnGroundCensor(cleanTitle, 'Collab Room Title');
    if (!censor.allowed) {
      setLocalError(
        censor.reason ||
          'Tree "Boots on Ground" Censor: Room title blocked due to rude or unsuitable wording.'
      );
      return;
    }
    const check = screenForHarmToHumansOrAnimals(cleanTitle);
    if (!check.safe) {
      setLocalError(check.reason || 'Room title blocked by safety guard.');
      return;
    }
    const slug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36);
    collab.joinRoom(slug || 'collab-bench', cleanTitle);
    setCustomRoomDraft('');
  };

  const presetRooms =
    collab.roomsSummary.length > 0
      ? collab.roomsSummary
      : [
          {
            roomId: 'root-sanctuary',
            title: 'Ground Floor · Co-Op Collab Bench (0m)',
            subtitle:
              'Turn special interests into shared community projects with zero forced speed.',
            activeCount: collab.peers.length,
            stepCount: collab.roomState.steps.length,
          },
          {
            roomId: 'canopy-trade',
            title: 'Canopy Summit · Shared Trade & Lantern Studio (33m)',
            subtitle:
              'Coordinate multi-craft builds, ethical trade deliveries, and artisan finishes.',
            activeCount: 0,
            stepCount: 1,
          },
          {
            roomId: 'open-skills-lounge',
            title: 'Open Skills, Mini-Lectures & Outreach Lounge',
            subtitle:
              'Open space for Show & Tell mini-lectures, community outreach planning, and peer skill swaps.',
            activeCount: 0,
            stepCount: 2,
          },
        ];

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-collab-heading"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#7CE0A3]" />
              <h2
                id="live-collab-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Real-Time Workshop Collaboration
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#C6D2C9]">
              Live shared Trade Blueprint steps, Pacing Charter pad &amp; 3D
              Cable Altitude Relay · Zero forced speed
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-mono tabular-nums text-[#7CE0A3]">
              {collab.connected
                ? `Live · ${collab.peers.length} in room`
                : 'Reconnecting room relay...'}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Real-Time Collaboration"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {(localError || collab.collabNotice) && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#2A1D17] border border-[#F4A261]/45 text-xs text-[#F4A261]">
              <span>{localError || collab.collabNotice}</span>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  collab.clearCollabNotice();
                }}
                className="text-[#F7F4EB] font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Top Bar: Room Selector + Personal Handle & Pacing Preference */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Room Switcher */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#E5A93C]">
                  Active Collaboration Room
                </span>
                <span className="text-[11px] font-mono text-[#9FB0A4]">
                  #{collab.activeRoomId}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {presetRooms.slice(0, 6).map((rm) => {
                  const active = rm.roomId === collab.activeRoomId;
                  return (
                    <button
                      key={rm.roomId}
                      type="button"
                      onClick={() => collab.joinRoom(rm.roomId, rm.title)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1F3327] border-[#7CE0A3] text-[#F7F4EB]'
                          : 'bg-[#111B15] border-[#F7F4EB]/12 text-[#C8D4CB] hover:border-[#E5A93C]/55'
                      }`}
                    >
                      <div className="text-xs font-bold leading-snug line-clamp-1">
                        {rm.title}
                      </div>
                      <div className="mt-1 text-[11px] font-mono tabular-nums text-[#9FB0A4]">
                        {rm.activeCount} active · {rm.stepCount} steps
                      </div>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleJoinCustomRoom} className="flex gap-2">
                <input
                  type="text"
                  maxLength={48}
                  value={customRoomDraft}
                  onChange={(e) => setCustomRoomDraft(e.target.value)}
                  placeholder="Or open a custom project / coaching room..."
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] placeholder-[#7F9185] focus:outline-none focus:border-[#E5A93C]"
                />
                <button
                  type="submit"
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1E2E24] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Room
                </button>
              </form>
            </div>

            {/* Your Workshop Presence & Nervous-System Pacing Mode */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#7CE0A3]">
                  Your Workshop Presence &amp; Pacing Boundary
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={32}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => collab.setDisplayName(nameDraft)}
                  aria-label="Your collaborator display name"
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] focus:outline-none focus:border-[#7CE0A3]"
                />
                <button
                  type="button"
                  onClick={() => collab.setDisplayName(nameDraft)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1E2E24] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#7CE0A3] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Save Name
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {PACING_TAGS.map((tag) => {
                  const selected = collab.pacingTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => collab.setPacingTag(tag)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selected
                          ? 'bg-[#7CE0A3] text-[#101813] border-[#7CE0A3]'
                          : 'bg-[#111B15] text-[#C8D4CB] border-[#F7F4EB]/12 hover:border-[#7CE0A3]/55'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Connected Collaborators Strip with 1-Click Altitude Glide */}
          <div className="p-4 rounded-xl bg-[#15211A] border border-[#F7F4EB]/12 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#F7F4EB]">
                Connected Collaborators in {collab.roomState.title}
              </span>
              <span className="text-[#9FB0A4]">
                Peers appear on flanking 3D guide cables at their live elevation
              </span>
            </div>

            {collab.peers.length === 0 ? (
              <p className="text-xs text-[#9FB0A4]">
                Connecting your carriage to the room relay...
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {collab.peers.map((peer) => {
                  const isSelf = peer.clientId === collab.clientId;
                  return (
                    <div
                      key={peer.clientId}
                      className="px-3 py-2 rounded-lg bg-[#101914] border border-[#F7F4EB]/14 flex items-center gap-2.5 text-xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: peer.color }}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="font-semibold text-[#F7F4EB]">
                          {peer.displayName}
                          {isSelf ? ' (You)' : ''}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-[#9FB0A4]">
                          {peer.elevationMeters.toFixed(1)}m · {peer.pacingMode}
                        </div>
                      </div>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            onGlideToElevation(
                              peer.elevationMeters,
                              `${peer.displayName} (${Math.round(peer.elevationMeters)}m)`
                            );
                            onClose();
                          }}
                          className="ml-1 min-h-[30px] px-2.5 py-1 rounded-md bg-[#1B2B22] border border-[#E5A93C]/45 text-[11px] font-semibold text-[#E5A93C] hover:text-[#F7F4EB] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Meet at {Math.round(peer.elevationMeters)}m
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main Split Workbench: Left = Shared Blueprint Steps & Charter Pad | Right = Ethical Live Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Shared Steps + Charter Pad */}
            <div className="lg:col-span-7 space-y-4">
              {/* Collaborative Trade & Outreach Steps */}
              <section className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E5A93C]" />
                    <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                      Shared Trade &amp; Outreach Blueprint Steps
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#9FB0A4]">
                    Click status to advance
                  </span>
                </div>

                <form onSubmit={handleAddStep} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={140}
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="Add a concrete, calm trade or outreach step (+1 Trying Token)..."
                    className="flex-1 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] placeholder-[#7F9185] focus:outline-none focus:border-[#E5A93C]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Step</span>
                  </button>
                </form>

                {collab.roomState.steps.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[#9FB0A4]">
                    No shared steps yet. Add the first step for this room above.
                  </p>
                ) : (
                  <div className="divide-y divide-[#F7F4EB]/10 border-t border-b border-[#F7F4EB]/10">
                    {collab.roomState.steps.map((step) => {
                      const nextSt = NEXT_STATUS[step.status];
                      return (
                        <div
                          key={step.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              collab.cycleStepStatus(step.id, nextSt);
                              if (nextSt === 'done') {
                                onStepReward('completed');
                              }
                            }}
                            className="flex items-start gap-2.5 text-left flex-1 cursor-pointer group"
                          >
                            {step.status === 'done' ? (
                              <CheckCircle2 className="w-4 h-4 text-[#7CE0A3] shrink-0 mt-0.5" />
                            ) : step.status === 'in_progress' ? (
                              <Clock className="w-4 h-4 text-[#E5A93C] shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-4 h-4 text-[#8FA395] group-hover:text-[#E5A93C] shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div
                                className={`font-medium leading-snug ${
                                  step.status === 'done'
                                    ? 'line-through text-[#8FA395]'
                                    : 'text-[#F7F4EB]'
                                }`}
                              >
                                {step.title}
                              </div>
                              <div className="mt-0.5 text-[11px] font-mono text-[#9FB0A4]">
                                Steward: {step.ownerName} ·{' '}
                                {step.status === 'done'
                                  ? 'Completed'
                                  : step.status === 'in_progress'
                                    ? 'In Progress'
                                    : 'Queued'}
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => collab.removeStep(step.id)}
                            aria-label={`Remove step ${step.title}`}
                            className="p-1.5 rounded-md text-[#8FA395] hover:text-[#F4A261] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Shared Pacing Charter & Co-Design Pad */}
              <section className="p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label
                    htmlFor="shared-charter-pad"
                    className="font-display text-sm font-bold text-[#F7F4EB]"
                  >
                    Shared Pacing Charter &amp; Co-Design Pad
                  </label>
                  <span className="font-mono text-[11px] text-[#9FB0A4]">
                    Last updated by {collab.roomState.padUpdatedBy}
                  </span>
                </div>
                <textarea
                  id="shared-charter-pad"
                  rows={4}
                  maxLength={2400}
                  value={localPad}
                  onFocus={() => {
                    isEditingPadRef.current = true;
                  }}
                  onBlur={() => {
                    isEditingPadRef.current = false;
                  }}
                  onChange={(e) => handlePadChange(e.target.value)}
                  placeholder="Write shared measurements, sensory accommodations, or partner notes..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] leading-relaxed focus:outline-none focus:border-[#7CE0A3]"
                />
              </section>
            </div>

            {/* Right Column: Live Workshop Notes & UK + Islamic Timestamps */}
            <section className="lg:col-span-5 p-4 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 flex flex-col justify-between min-h-[340px]">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 border-b border-[#F7F4EB]/12 pb-2.5">
                  <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                    Live Room Notes
                  </h3>
                  <span className="text-[11px] text-[#9FB0A4]">
                    Humane &amp; ethical guard active
                  </span>
                </div>

                <div className="max-h-[260px] overflow-y-auto space-y-3 pr-1">
                  {collab.roomState.messages.length === 0 ? (
                    <p className="py-8 text-center text-xs text-[#9FB0A4]">
                      Share a calm written check-in, dimensions note, or handoff
                      update with the room.
                    </p>
                  ) : (
                    collab.roomState.messages.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-lg bg-[#101914] border border-[#F7F4EB]/10 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#9FB0A4]">
                          <span
                            className="font-semibold"
                            style={{ color: m.senderColor || '#7CE0A3' }}
                          >
                            {m.senderName}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatDualTimestamp(m.createdAtMs)}
                          </span>
                        </div>
                        <p className="text-xs text-[#ECEFE9] leading-relaxed break-words">
                          {m.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleSendChat} className="mt-3 pt-3 border-t border-[#F7F4EB]/12 flex gap-2">
                <input
                  type="text"
                  maxLength={500}
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Write a calm note to room collaborators..."
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] placeholder-[#7F9185] focus:outline-none focus:border-[#7CE0A3]"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#93E8B4] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
