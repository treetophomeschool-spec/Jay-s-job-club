import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HANDCRAFTED_WELCOME_CATALOG,
  type CollabMessage,
  type CollabPacingTag,
  type CollabPeer,
  type CollabRoomState,
  type CollabRoomSummary,
  type CollabStep,
  type CollabStepStatus,
} from '../shared/workshopCatalog';

const DISPLAY_NAME_STORAGE_KEY = 'jays_job_club_collab_name_v1';

function loadSavedDisplayName(): string {
  try {
    const raw = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (raw && raw.trim().length >= 2) {
      return raw.trim().slice(0, 32);
    }
  } catch {
    // Ignore storage restrictions
  }
  return 'Apprentice Maker';
}

const DEFAULT_FALLBACK_ROOM: CollabRoomState = {
  roomId: 'root-sanctuary',
  title: 'Ground Floor · Co-Op Collab Bench (0m)',
  subtitle:
    'Turn special interests into shared community projects with zero forced speed.',
  sharedCharterPad:
    'Workshop Pacing Charter: Every collaborator works at their own nervous-system pace. Written check-ins, quiet parallel focus, and Root Rest breaks are always welcome.',
  padUpdatedBy: 'Workshop Steward',
  steps: [],
  messages: [],
};

export interface RealtimeCollabController {
  clientId: string;
  connected: boolean;
  displayName: string;
  pacingTag: CollabPacingTag;
  activeRoomId: string;
  roomState: CollabRoomState;
  peers: CollabPeer[];
  roomsSummary: CollabRoomSummary[];
  stockById: Record<string, number>;
  collabNotice: string | null;
  clearCollabNotice: () => void;
  setDisplayName: (name: string) => void;
  setPacingTag: (tag: CollabPacingTag) => void;
  joinRoom: (roomId: string, customTitle?: string, seedNote?: string) => void;
  updateCharterPad: (padText: string) => void;
  addStep: (title: string, ownerName?: string) => void;
  cycleStepStatus: (stepId: string, nextStatus: CollabStepStatus) => void;
  removeStep: (stepId: string) => void;
  sendChatMessage: (text: string) => void;
  reportLocalAltitude: (elevationMeters: number, zone: string) => void;
  refreshStockSnapshot: () => Promise<void>;
}

export function useRealtimeCollab(
  authenticatedDisplayName?: string | null
): RealtimeCollabController {
  const [clientId, setClientId] = useState<string>('local_peer');
  const [connected, setConnected] = useState<boolean>(false);
  const [displayName, setDisplayNameState] = useState<string>(() =>
    loadSavedDisplayName()
  );
  const [pacingTag, setPacingTagState] =
    useState<CollabPacingTag>('Quiet Async');
  const [activeRoomId, setActiveRoomId] = useState<string>('root-sanctuary');
  const [roomState, setRoomState] =
    useState<CollabRoomState>(DEFAULT_FALLBACK_ROOM);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [roomsSummary, setRoomsSummary] = useState<CollabRoomSummary[]>([]);
  const [collabNotice, setCollabNotice] = useState<string | null>(null);

  const [stockById, setStockById] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const item of HANDCRAFTED_WELCOME_CATALOG) {
      initial[item.id] = item.initialStock;
    }
    return initial;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<string[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);

  const activeRoomRef = useRef<string>(activeRoomId);
  activeRoomRef.current = activeRoomId;
  const displayNameRef = useRef<string>(displayName);
  displayNameRef.current = displayName;
  const pacingTagRef = useRef<CollabPacingTag>(pacingTag);
  pacingTagRef.current = pacingTag;

  const latestAltitudeRef = useRef<{ elevationMeters: number; zone: string }>({
    elevationMeters: 0,
    zone: 'ROOT_SANCTUARY',
  });
  const lastSentAltitudeAtRef = useRef<number>(0);
  const lastSentElevationRef = useRef<number>(0);

  // Sync authenticated display name gently if user still has default handle
  useEffect(() => {
    if (
      authenticatedDisplayName &&
      authenticatedDisplayName.trim().length >= 2 &&
      displayName === 'Apprentice Maker'
    ) {
      const clean = authenticatedDisplayName.trim().slice(0, 32);
      setDisplayNameState(clean);
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, clean);
      } catch {
        // Ignore storage restrictions
      }
    }
  }, [authenticatedDisplayName, displayName]);

  const sendPayload = useCallback((payload: Record<string, unknown>) => {
    const serialized = JSON.stringify(payload);
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(serialized);
    } else if (payload.type !== 'presence:move') {
      // Queue non-ephemeral collaborative actions while reconnecting
      pendingQueueRef.current.push(serialized);
      if (pendingQueueRef.current.length > 24) {
        pendingQueueRef.current.shift();
      }
    }
  }, []);

  const refreshStockSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/artisan/stock');
      if (!res.ok) return;
      const data = (await res.json()) as { stock?: Record<string, number> };
      if (data.stock && typeof data.stock === 'object') {
        setStockById((prev) => ({ ...prev, ...data.stock }));
      }
    } catch {
      // Offline or reconnecting; keep current stock map
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/collab`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        const delay = Math.min(8000, 1000 * 2 ** reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnected(true);

        // Request full authoritative room state and register displayName & pacingMode
        ws.send(
          JSON.stringify({
            type: 'presence:join',
            roomId: activeRoomRef.current,
            displayName: displayNameRef.current,
            pacingMode: pacingTagRef.current,
          })
        );
        ws.send(
          JSON.stringify({
            type: 'presence:move',
            elevationMeters: latestAltitudeRef.current.elevationMeters,
            zone: latestAltitudeRef.current.zone,
          })
        );

        // Flush queued collaborative edits in order
        while (pendingQueueRef.current.length > 0) {
          const item = pendingQueueRef.current.shift();
          if (item && ws.readyState === WebSocket.OPEN) {
            ws.send(item);
          }
        }
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
          const type = String(msg.type || '');

          if (type === 'init') {
            if (typeof msg.selfClientId === 'string') {
              setClientId(msg.selfClientId);
            }
            if (msg.roomState && typeof msg.roomState === 'object') {
              const incomingRoom = msg.roomState as CollabRoomState;
              if (incomingRoom.roomId === activeRoomRef.current) {
                setRoomState(incomingRoom);
              }
            }
            if (Array.isArray(msg.peers)) {
              setPeers(msg.peers as CollabPeer[]);
            }
            if (Array.isArray(msg.rooms)) {
              setRoomsSummary(msg.rooms as CollabRoomSummary[]);
            }
            if (msg.stock && typeof msg.stock === 'object') {
              setStockById((prev) => ({
                ...prev,
                ...(msg.stock as Record<string, number>),
              }));
            }
          } else if (type === 'room:state') {
            if (msg.roomState && typeof msg.roomState === 'object') {
              const incomingRoom = msg.roomState as CollabRoomState;
              setRoomState(incomingRoom);
              setActiveRoomId(incomingRoom.roomId);
            }
            if (Array.isArray(msg.rooms)) {
              setRoomsSummary(msg.rooms as CollabRoomSummary[]);
            }
          } else if (type === 'presence:sync') {
            if (Array.isArray(msg.peers)) {
              setPeers(msg.peers as CollabPeer[]);
            }
            if (Array.isArray(msg.rooms)) {
              setRoomsSummary(msg.rooms as CollabRoomSummary[]);
            }
          } else if (type === 'presence:moved') {
            const movedId = String(msg.clientId || '');
            const nextElev = Number(msg.elevationMeters ?? 0);
            const nextZone = String(msg.zone || 'ROOT_SANCTUARY');
            setPeers((prev) =>
              prev.map((p) =>
                p.clientId === movedId
                  ? { ...p, elevationMeters: nextElev, zone: nextZone }
                  : p
              )
            );
          } else if (type === 'rooms:updated') {
            if (Array.isArray(msg.rooms)) {
              setRoomsSummary(msg.rooms as CollabRoomSummary[]);
            }
          } else if (type === 'pad:updated') {
            setRoomState((prev) => ({
              ...prev,
              sharedCharterPad: String(msg.sharedCharterPad ?? ''),
              padUpdatedBy: String(msg.padUpdatedBy ?? 'Collaborator'),
            }));
          } else if (type === 'step:created') {
            if (msg.step && typeof msg.step === 'object') {
              const incomingStep = msg.step as CollabStep;
              setRoomState((prev) => {
                if (prev.steps.some((s) => s.id === incomingStep.id)) {
                  return prev;
                }
                return {
                  ...prev,
                  steps: [...prev.steps, incomingStep],
                };
              });
            }
          } else if (type === 'step:updated') {
            if (msg.step && typeof msg.step === 'object') {
              const incomingStep = msg.step as CollabStep;
              setRoomState((prev) => ({
                ...prev,
                steps: prev.steps.map((s) =>
                  s.id === incomingStep.id ? incomingStep : s
                ),
              }));
            }
          } else if (type === 'step:deleted') {
            const deletedId = String(msg.stepId || '');
            setRoomState((prev) => ({
              ...prev,
              steps: prev.steps.filter((s) => s.id !== deletedId),
            }));
          } else if (type === 'message:created') {
            if (msg.message && typeof msg.message === 'object') {
              const incomingMsg = msg.message as CollabMessage;
              setRoomState((prev) => {
                if (prev.messages.some((m) => m.id === incomingMsg.id)) {
                  return {
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === incomingMsg.id ? incomingMsg : m
                    ),
                  };
                }
                return {
                  ...prev,
                  messages: [...prev.messages.slice(-79), incomingMsg],
                };
              });
            }
          } else if (type === 'shop:stock_updated') {
            if (msg.stock && typeof msg.stock === 'object') {
              setStockById((prev) => ({
                ...prev,
                ...(msg.stock as Record<string, number>),
              }));
            }
          } else if (type === 'error:ethical') {
            setCollabNotice(
              String(msg.reason || 'Action blocked by workshop safety guard.')
            );
            // Re-sync authoritative room state to roll back any rejected optimistic edit
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'presence:join',
                  roomId: activeRoomRef.current,
                  displayName: displayNameRef.current,
                  pacingMode: pacingTagRef.current,
                })
              );
            }
          }
        } catch {
          // Ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        const delay = Math.min(7000, 900 * 2 ** reconnectAttemptRef.current);
        reconnectAttemptRef.current = Math.min(
          6,
          reconnectAttemptRef.current + 1
        );
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    void refreshStockSnapshot();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [refreshStockSnapshot]);

  const setDisplayName = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 32) || 'Apprentice Maker';
      setDisplayNameState(clean);
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, clean);
      } catch {
        // Ignore storage restrictions
      }
      sendPayload({
        type: 'presence:join',
        roomId: activeRoomRef.current,
        displayName: clean,
        pacingMode: pacingTagRef.current,
      });
    },
    [sendPayload]
  );

  const setPacingTag = useCallback(
    (tag: CollabPacingTag) => {
      setPacingTagState(tag);
      sendPayload({
        type: 'presence:join',
        roomId: activeRoomRef.current,
        displayName: displayNameRef.current,
        pacingMode: tag,
      });
    },
    [sendPayload]
  );

  const joinRoom = useCallback(
    (roomId: string, customTitle?: string, seedNote?: string) => {
      const cleanId =
        roomId
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .slice(0, 48) || 'root-sanctuary';
      setActiveRoomId(cleanId);
      setRoomState((prev) => {
        if (prev.roomId === cleanId) {
          return customTitle ? { ...prev, title: customTitle } : prev;
        }
        return {
          roomId: cleanId,
          title: customTitle || prev.title,
          subtitle: prev.subtitle,
          sharedCharterPad:
            seedNote && seedNote.trim().length >= 2
              ? seedNote.trim().slice(0, 1200)
              : prev.sharedCharterPad,
          padUpdatedBy: displayNameRef.current,
          steps: [],
          messages: [],
        };
      });
      sendPayload({
        type: 'presence:join',
        roomId: cleanId,
        roomTitle: customTitle,
        seedCharter: seedNote,
        displayName: displayNameRef.current,
        pacingMode: pacingTagRef.current,
      });
    },
    [sendPayload]
  );

  const updateCharterPad = useCallback(
    (padText: string) => {
      const cleanPad = padText.slice(0, 1200);
      setRoomState((prev) => ({
        ...prev,
        sharedCharterPad: cleanPad,
        padUpdatedBy: displayNameRef.current,
      }));
      sendPayload({
        type: 'pad:update',
        sharedCharterPad: cleanPad,
      });
    },
    [sendPayload]
  );

  const addStep = useCallback(
    (title: string, ownerName?: string) => {
      const clean = title.trim().slice(0, 140);
      if (clean.length < 3) return;
      const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const resolvedOwner = (ownerName || displayNameRef.current)
        .trim()
        .slice(0, 32) || 'Apprentice Maker';
      const nowMs = Date.now();
      const optimisticStep: CollabStep = {
        id: stepId,
        title: clean,
        ownerName: resolvedOwner,
        pacingTag: pacingTagRef.current,
        status: 'todo',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
      setRoomState((prev) => {
        if (prev.steps.some((s) => s.id === stepId)) return prev;
        return { ...prev, steps: [...prev.steps, optimisticStep] };
      });
      sendPayload({
        type: 'step:create',
        id: stepId,
        title: clean,
        ownerName: resolvedOwner,
        pacingTag: pacingTagRef.current,
      });
    },
    [sendPayload]
  );

  const cycleStepStatus = useCallback(
    (stepId: string, nextStatus: CollabStepStatus) => {
      const nowMs = Date.now();
      setRoomState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) =>
          s.id === stepId
            ? {
                ...s,
                status: nextStatus,
                ownerName: displayNameRef.current,
                updatedAtMs: nowMs,
              }
            : s
        ),
      }));
      sendPayload({
        type: 'step:update',
        id: stepId,
        status: nextStatus,
        ownerName: displayNameRef.current,
      });
    },
    [sendPayload]
  );

  const removeStep = useCallback(
    (stepId: string) => {
      setRoomState((prev) => ({
        ...prev,
        steps: prev.steps.filter((s) => s.id !== stepId),
      }));
      sendPayload({
        type: 'step:delete',
        id: stepId,
      });
    },
    [sendPayload]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      const clean = text.trim().slice(0, 500);
      if (!clean) return;
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const optimisticMsg: CollabMessage = {
        id: msgId,
        senderName: displayNameRef.current,
        senderColor: '#FFD166',
        text: clean,
        createdAtMs: Date.now(),
      };
      setRoomState((prev) => {
        if (prev.messages.some((m) => m.id === msgId)) return prev;
        return {
          ...prev,
          messages: [...prev.messages.slice(-79), optimisticMsg],
        };
      });
      sendPayload({
        type: 'message:create',
        id: msgId,
        text: clean,
      });
    },
    [sendPayload]
  );

  const reportLocalAltitude = useCallback(
    (elevationMeters: number, zone: string) => {
      latestAltitudeRef.current = { elevationMeters, zone };
      const now = performance.now();
      if (
        Math.abs(elevationMeters - lastSentElevationRef.current) < 0.25 &&
        now - lastSentAltitudeAtRef.current < 1500
      ) {
        return;
      }
      if (now - lastSentAltitudeAtRef.current < 160) {
        return;
      }
      lastSentAltitudeAtRef.current = now;
      lastSentElevationRef.current = elevationMeters;

      const socket = wsRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'presence:move',
            elevationMeters,
            zone,
          })
        );
      }
    },
    []
  );

  const clearCollabNotice = useCallback(() => {
    setCollabNotice(null);
  }, []);

  return useMemo(
    () => ({
      clientId,
      connected,
      displayName,
      pacingTag,
      activeRoomId,
      roomState,
      peers,
      roomsSummary,
      stockById,
      collabNotice,
      clearCollabNotice,
      setDisplayName,
      setPacingTag,
      joinRoom,
      updateCharterPad,
      addStep,
      cycleStepStatus,
      removeStep,
      sendChatMessage,
      reportLocalAltitude,
      refreshStockSnapshot,
    }),
    [
      clientId,
      connected,
      displayName,
      pacingTag,
      activeRoomId,
      roomState,
      peers,
      roomsSummary,
      stockById,
      collabNotice,
      clearCollabNotice,
      setDisplayName,
      setPacingTag,
      joinRoom,
      updateCharterPad,
      addStep,
      cycleStepStatus,
      removeStep,
      sendChatMessage,
      reportLocalAltitude,
      refreshStockSnapshot,
    ]
  );
}
