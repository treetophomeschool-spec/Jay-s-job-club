import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  HANDCRAFTED_WELCOME_CATALOG,
  type CartLineInput,
  type CollabMessage,
  type CollabPacingTag,
  type CollabPeer,
  type CollabRoomState,
  type CollabRoomSummary,
  type CollabStep,
  type CollabStepStatus,
  type VerifiedOrderReceipt,
} from './src/shared/workshopCatalog.ts';
import {
  screenBootsOnGroundCensor,
  screenForHarmToHumansOrAnimals,
} from './src/utils/ethicalGuard.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Authoritative server-side stock for Welcome Area handcrafted items
const itemStockMap = new Map<string, number>();
for (const item of HANDCRAFTED_WELCOME_CATALOG) {
  itemStockMap.set(item.id, item.initialStock);
}

const verifiedReceipts: VerifiedOrderReceipt[] = [];

// Authoritative Real-Time Multi-User Collaboration State
const rooms = new Map<string, CollabRoomState>();
const peers = new Map<string, { ws: WebSocket; peer: CollabPeer }>();

const PEER_PALETTE = [
  '#E5A93C',
  '#7CE0A3',
  '#6EC6E6',
  '#F4A261',
  '#C59BFA',
  '#95D5B2',
];

function seedInitialRooms(): void {
  const now = Date.now();
  rooms.set('root-sanctuary', {
    roomId: 'root-sanctuary',
    title: 'Ground Floor · Co-Op Collab Bench (0m)',
    subtitle:
      'Turn special interests into shared community projects with zero forced speed.',
    sharedCharterPad:
      'Workshop Pacing Charter: Every collaborator works at their own nervous-system pace. Written check-ins, quiet parallel focus, and Root Rest breaks are always welcome.',
    padUpdatedBy: 'Workshop Steward',
    steps: [
      {
        id: 'seed_step_root_1',
        title: 'Sketch modular cedar planter dimensions for neighborhood library',
        ownerName: 'Open Step',
        pacingTag: 'Quiet Async',
        status: 'todo',
        createdAtMs: now - 3600000,
        updatedAtMs: now - 3600000,
      },
      {
        id: 'seed_step_root_2',
        title: 'Prepare sensory-friendly welcome signage & clear tool labels',
        ownerName: 'Open Step',
        pacingTag: 'Paired Co-Work',
        status: 'in_progress',
        createdAtMs: now - 2400000,
        updatedAtMs: now - 2400000,
      },
    ],
    messages: [
      {
        id: 'seed_msg_root_1',
        senderName: 'Workshop Steward',
        senderColor: '#E5A93C',
        text: 'Welcome to the live Ground Collab Bench. Claim or add any step, or spin up a room from the Job Board or your Journal.',
        createdAtMs: now - 1800000,
      },
    ],
  });

  rooms.set('canopy-trade', {
    roomId: 'canopy-trade',
    title: 'Canopy Summit · Shared Trade & Lantern Studio (33m)',
    subtitle:
      'Coordinate multi-craft builds, ethical trade deliveries, and artisan finishes.',
    sharedCharterPad:
      'Canopy Safety & Trade Note: Floor hatch latched secure. Pair joinery frames with spun-brass low-glare lenses.',
    padUpdatedBy: 'Canopy Guild',
    steps: [
      {
        id: 'seed_step_canopy_1',
        title: 'Test frosted amber diffuser glass for zero-flicker desk lanterns',
        ownerName: 'Open Step',
        pacingTag: 'Trainer Guided',
        status: 'todo',
        createdAtMs: now - 3000000,
        updatedAtMs: now - 3000000,
      },
    ],
    messages: [],
  });

  rooms.set('open-skills-lounge', {
    roomId: 'open-skills-lounge',
    title: 'Open Skills, Mini-Lectures & Outreach Lounge',
    subtitle:
      'Open workshop room for peer skill sharing, Show & Tell prep, and community outreach planning.',
    sharedCharterPad:
      'Open Workshop Charter: Plain, respectful language. Share practical steps, mini-lecture notes, and outreach ideas at your own pace.',
    padUpdatedBy: 'Workshop Desk',
    steps: [
      {
        id: 'seed_step_open_1',
        title: 'Prepare Ground-Floor lanterns, herbal drinks & welcome packs for Show & Tell',
        ownerName: 'Open Step',
        pacingTag: 'Paired Co-Work',
        status: 'in_progress',
        createdAtMs: now - 2100000,
        updatedAtMs: now - 2100000,
      },
      {
        id: 'seed_step_open_2',
        title: 'Outline a 3-point mini-lecture or neighbourhood outreach project',
        ownerName: 'Open Step',
        pacingTag: 'Quiet Async',
        status: 'todo',
        createdAtMs: now - 1500000,
        updatedAtMs: now - 1500000,
      },
    ],
    messages: [],
  });
}

seedInitialRooms();

function sanitizeRoomId(raw: unknown): string {
  const cleaned = String(raw || 'root-sanctuary')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 64);
  return cleaned.length >= 2 ? cleaned : 'root-sanctuary';
}

function sanitizeShortText(raw: unknown, maxLen: number, fallback = ''): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed || fallback;
}

function getRoomSummaries(): CollabRoomSummary[] {
  const counts = new Map<string, number>();
  for (const { peer } of peers.values()) {
    counts.set(peer.roomId, (counts.get(peer.roomId) || 0) + 1);
  }
  const list: CollabRoomSummary[] = [];
  for (const rm of rooms.values()) {
    list.push({
      roomId: rm.roomId,
      title: rm.title,
      subtitle: rm.subtitle,
      activeCount: counts.get(rm.roomId) || 0,
      stepCount: rm.steps.length,
    });
  }
  return list;
}

function getAllActivePeers(): CollabPeer[] {
  return Array.from(peers.values()).map((entry) => entry.peer);
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastGlobal(payload: unknown): void {
  const encoded = JSON.stringify(payload);
  for (const { ws } of peers.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoded);
    }
  }
}

function broadcastToRoom(roomId: string, payload: unknown): void {
  const encoded = JSON.stringify(payload);
  for (const { ws, peer } of peers.values()) {
    if (peer.roomId === roomId && ws.readyState === WebSocket.OPEN) {
      ws.send(encoded);
    }
  }
}

// PayPal Server-Side Helpers
function getPayPalConfig() {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  const rawMode = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
  const mode: 'live' | 'sandbox' = rawMode === 'live' ? 'live' : 'sandbox';
  const baseUrl =
    mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  const merchantEmail = (process.env.PAYPAL_MERCHANT_EMAIL || '').trim();

  return {
    configured: Boolean(clientId && clientSecret),
    clientId: clientId || null,
    clientSecret,
    mode,
    baseUrl,
    merchantEmail,
  };
}

async function fetchPayPalAccessToken(): Promise<{
  token: string;
  baseUrl: string;
  merchantEmail: string;
}> {
  const cfg = getPayPalConfig();
  if (!cfg.configured || !cfg.clientId || !cfg.clientSecret) {
    throw new Error(
      'PayPal REST credentials (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET) are not configured on the server yet.'
    );
  }

  const credentials = Buffer.from(
    `${cfg.clientId}:${cfg.clientSecret}`
  ).toString('base64');

  const response = await fetch(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `PayPal OAuth token request failed (${response.status}): ${errText.slice(0, 180)}`
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('PayPal OAuth response did not include an access_token.');
  }

  return {
    token: data.access_token,
    baseUrl: cfg.baseUrl,
    merchantEmail: cfg.merchantEmail,
  };
}

function validateAndPriceCart(rawItems: unknown): {
  lines: Array<{
    itemId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  totalCents: number;
} {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Your handcrafted basket is empty.');
  }

  const catalogById = new Map(
    HANDCRAFTED_WELCOME_CATALOG.map((c) => [c.id, c])
  );
  const lines: Array<{
    itemId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }> = [];
  let totalCents = 0;

  for (const raw of rawItems.slice(0, 12) as CartLineInput[]) {
    const itemId = sanitizeShortText(raw?.itemId, 128);
    const quantity = Math.min(
      10,
      Math.max(1, Math.floor(Number(raw?.quantity) || 1))
    );
    const baseItem = catalogById.get(itemId);

    if (baseItem) {
      const available = itemStockMap.get(baseItem.id) ?? baseItem.initialStock;
      if (available < quantity) {
        throw new Error(
          `Only ${available} remaining in stock for "${baseItem.title}".`
        );
      }
      lines.push({
        itemId: baseItem.id,
        title: baseItem.title,
        quantity,
        unitPriceCents: baseItem.priceCents,
      });
      totalCents += baseItem.priceCents * quantity;
    } else {
      // Community member handcrafted item from Firestore (/artisanItems)
      const title = sanitizeShortText(raw?.title, 80, 'Handcrafted Workshop Item');
      const safety = screenForHarmToHumansOrAnimals(title);
      if (!safety.safe) {
        throw new Error(safety.reason || 'Blocked item in cart.');
      }
      const unitPriceCents = Math.min(
        250000,
        Math.max(300, Math.floor(Number(raw?.unitPriceCents) || 2000))
      );
      lines.push({
        itemId: itemId || 'member_artisan_item',
        title,
        quantity,
        unitPriceCents,
      });
      totalCents += unitPriceCents * quantity;
    }
  }

  if (totalCents < 300 || totalCents > 500000) {
    throw new Error('Order total must be between £3.00 and £5,000.00 GBP.');
  }

  return { lines, totalCents };
}

function getStockSnapshot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of itemStockMap.entries()) {
    out[k] = v;
  }
  return out;
}

// Pending server-validated PayPal order map (orderID -> validated lines & note; auto-evicted after 2h per GDPR Art. 5(1)(e))
const pendingPayPalOrders = new Map<
  string,
  {
    lines: Array<{
      itemId: string;
      title: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    totalCents: number;
    buyerNote: string;
    createdAtMs: number;
  }
>();

function pruneExpiredEphemeralServerRecords(): void {
  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  for (const [id, order] of pendingPayPalOrders.entries()) {
    if (now - order.createdAtMs > twoHoursMs) {
      pendingPayPalOrders.delete(id);
    }
  }
  while (
    verifiedReceipts.length > 0 &&
    now - verifiedReceipts[verifiedReceipts.length - 1].createdAtMs >
      twentyFourHoursMs
  ) {
    verifiedReceipts.pop();
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Health & Real-Time Collaboration summary endpoint
  app.get('/api/collab/rooms', (_req, res) => {
    res.json({
      rooms: getRoomSummaries(),
      onlineCount: peers.size,
    });
  });

  // Easy-to-remember Jay's Job Club shortcut URLs -> clean redirect to workshop root
  app.get(['/jaysjobclub', '/jays-job-club', '/jobclub', '/club'], (_req, res) => {
    res.redirect(302, '/?club=jaysjobclub');
  });

  // Live Server Debug & Diagnostics Endpoint
  app.get('/api/debug/status', (_req, res) => {
    pruneExpiredEphemeralServerRecords();
    const pp = getPayPalConfig();
    res.json({
      ok: true,
      serverTimeIso: new Date().toISOString(),
      easyUrls: ['/jaysjobclub', '/jobclub', '/club'],
      onlinePeers: peers.size,
      collabRooms: getRoomSummaries(),
      shopCatalogIds: HANDCRAFTED_WELCOME_CATALOG.map((c) => c.id),
      stock: getStockSnapshot(),
      recentVerifiedReceipts: verifiedReceipts.length,
      paypalConfigured: pp.configured,
      paypalMode: pp.mode,
    });
  });

  // Handcrafted Welcome Area Shop Stock (GDPR Art. 5(1)(c) Data Minimisation: never exposes buyerNote or PayPal IDs to other visitors)
  app.get('/api/artisan/stock', (_req, res) => {
    pruneExpiredEphemeralServerRecords();
    res.json({
      stock: getStockSnapshot(),
      recentOrderCount: verifiedReceipts.length,
    });
  });

  // GDPR Art. 17 Self-Service Ephemeral Collaboration & Presence Purge Endpoint
  app.post('/api/privacy/purge-ephemeral', (req, res) => {
    pruneExpiredEphemeralServerRecords();
    const targetClientId = sanitizeShortText(req.body?.clientId, 64, '');
    const targetDisplayName = sanitizeShortText(req.body?.displayName, 40, '');

    let removedMessages = 0;
    let anonymizedSteps = 0;

    if (targetClientId && peers.has(targetClientId)) {
      const active = peers.get(targetClientId);
      peers.delete(targetClientId);
      try {
        active?.ws.close();
      } catch {
        // Ignore already-closed socket
      }
    }

    if (targetDisplayName.length >= 2) {
      for (const room of rooms.values()) {
        const beforeLen = room.messages.length;
        room.messages = room.messages.filter(
          (m) => m.senderName !== targetDisplayName
        );
        removedMessages += beforeLen - room.messages.length;

        for (const step of room.steps) {
          if (step.ownerName === targetDisplayName) {
            step.ownerName = 'Open Step';
            anonymizedSteps += 1;
          }
        }
        if (room.padUpdatedBy === targetDisplayName) {
          room.padUpdatedBy = 'Collaborator';
        }
      }
    }

    broadcastGlobal({
      type: 'presence:sync',
      peers: getAllActivePeers(),
      rooms: getRoomSummaries(),
    });

    res.json({
      purged: true,
      removedMessages,
      anonymizedSteps,
    });
  });

  // PayPal Configuration Endpoint (Never exposes PAYPAL_CLIENT_SECRET)
  app.get('/api/paypal/config', (_req, res) => {
    const cfg = getPayPalConfig();
    res.json({
      configured: cfg.configured,
      clientId: cfg.configured ? cfg.clientId : null,
      mode: cfg.mode,
      currency: 'GBP',
      merchantEmail: cfg.merchantEmail || null,
      merchantEmailConfigured: Boolean(cfg.merchantEmail),
    });
  });

  // PayPal Orders v2 — Create Order (Server-Authoritative Pricing)
  app.post('/api/paypal/create-order', async (req, res) => {
    try {
      pruneExpiredEphemeralServerRecords();
      const buyerNote = sanitizeShortText(req.body?.buyerNote, 240, '');
      const noteSafety = screenForHarmToHumansOrAnimals(buyerNote);
      if (!noteSafety.safe) {
        res.status(400).json({ error: noteSafety.reason });
        return;
      }

      const venue =
        req.body?.venue === 'canopy' ? 'canopy' : 'welcome';
      const rawCart = req.body?.items ?? req.body?.cart;
      const { lines, totalCents } = validateAndPriceCart(rawCart);
      const { token, baseUrl, merchantEmail } = await fetchPayPalAccessToken();

      const totalValue = (totalCents / 100).toFixed(2);
      const purchaseUnit: Record<string, unknown> = {
        description:
          venue === 'canopy'
            ? "Jay's Job Club — 33m Treetop Canopy PayPal Maker Store"
            : "Jay's Job Club — Welcome Area Handcrafted Artisan Goods",
        amount: {
          currency_code: 'GBP',
          value: totalValue,
          breakdown: {
            item_total: {
              currency_code: 'GBP',
              value: totalValue,
            },
          },
        },
        items: lines.map((line) => ({
          name: line.title.slice(0, 120),
          quantity: String(line.quantity),
          category: 'PHYSICAL_GOODS',
          unit_amount: {
            currency_code: 'GBP',
            value: (line.unitPriceCents / 100).toFixed(2),
          },
        })),
      };

      if (merchantEmail) {
        purchaseUnit.payee = { email_address: merchantEmail };
      }

      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [purchaseUnit],
        }),
      });

      const orderData = (await orderRes.json()) as {
        id?: string;
        status?: string;
        message?: string;
      };

      if (!orderRes.ok || !orderData.id) {
        res.status(502).json({
          error:
            orderData.message ||
            `PayPal order creation failed (${orderRes.status}).`,
        });
        return;
      }

      pendingPayPalOrders.set(orderData.id, {
        lines,
        totalCents,
        buyerNote,
        createdAtMs: Date.now(),
      });

      res.json({
        orderID: orderData.id,
        orderId: orderData.id,
        status: orderData.status || 'CREATED',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // PayPal Orders v2 — Capture Order & Decrement Handcrafted Stock
  app.post('/api/paypal/capture-order', async (req, res) => {
    try {
      pruneExpiredEphemeralServerRecords();
      const orderID = sanitizeShortText(
        req.body?.orderID ?? req.body?.orderId,
        64
      );
      if (!orderID) {
        res.status(400).json({ error: 'Missing PayPal orderID.' });
        return;
      }

      const { token, baseUrl } = await fetchPayPalAccessToken();
      const capRes = await fetch(
        `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const capData = (await capRes.json()) as {
        id?: string;
        status?: string;
        message?: string;
        purchase_units?: Array<{
          payments?: { captures?: Array<{ id?: string }> };
        }>;
      };

      if (!capRes.ok || capData.status !== 'COMPLETED') {
        res.status(502).json({
          error:
            capData.message ||
            `PayPal capture did not complete (${capData.status || capRes.status}).`,
        });
        return;
      }

      const pending = pendingPayPalOrders.get(orderID);
      const lines = pending ? pending.lines : [];
      const totalCents = pending ? pending.totalCents : 0;
      const buyerNote = pending ? pending.buyerNote : '';
      pendingPayPalOrders.delete(orderID);

      for (const line of lines) {
        if (itemStockMap.has(line.itemId)) {
          const prev = itemStockMap.get(line.itemId) || 0;
          itemStockMap.set(line.itemId, Math.max(0, prev - line.quantity));
        }
      }

      const captureId =
        capData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;

      const receipt: VerifiedOrderReceipt = {
        receiptId: `JJC-PP-${Date.now().toString(36).toUpperCase()}`,
        paypalOrderId: orderID,
        captureId,
        paymentMethod: 'paypal',
        buyerNote,
        totalCents,
        currency: 'GBP',
        items: lines,
        createdAtMs: Date.now(),
      };
      verifiedReceipts.unshift(receipt);
      if (verifiedReceipts.length > 50) verifiedReceipts.pop();

      broadcastGlobal({
        type: 'shop:stock_updated',
        stock: getStockSnapshot(),
      });

      res.json({ receipt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // Welcome Area Workshop Pickup Hold Reservation (Always available for local desk pickup)
  app.post('/api/paypal/reserve-pickup', (req, res) => {
    try {
      pruneExpiredEphemeralServerRecords();
      const venue =
        req.body?.venue === 'canopy' ? 'canopy' : 'welcome';
      const buyerNote = sanitizeShortText(
        req.body?.buyerNote,
        240,
        venue === 'canopy'
          ? '33m Canopy Counter Pickup'
          : 'Welcome Desk Pickup'
      );
      const noteSafety = screenForHarmToHumansOrAnimals(buyerNote);
      if (!noteSafety.safe) {
        res.status(400).json({ error: noteSafety.reason });
        return;
      }

      const rawCart = req.body?.items ?? req.body?.cart;
      const { lines, totalCents } = validateAndPriceCart(rawCart);
      for (const line of lines) {
        if (itemStockMap.has(line.itemId)) {
          const prev = itemStockMap.get(line.itemId) || 0;
          itemStockMap.set(line.itemId, Math.max(0, prev - line.quantity));
        }
      }

      const receipt: VerifiedOrderReceipt = {
        receiptId: `JJC-HOLD-${Date.now().toString(36).toUpperCase()}`,
        paypalOrderId:
          venue === 'canopy'
            ? 'CANOPY-33M-STORE-COUNTER'
            : 'WORKSHOP-WELCOME-DESK',
        captureId: `HOLD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        paymentMethod: 'workshop_pickup_hold',
        buyerNote,
        totalCents,
        currency: 'GBP',
        items: lines,
        createdAtMs: Date.now(),
      };
      verifiedReceipts.unshift(receipt);
      if (verifiedReceipts.length > 50) verifiedReceipts.pop();

      broadcastGlobal({
        type: 'shop:stock_updated',
        stock: getStockSnapshot(),
      });

      res.json({ receipt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  const httpServer = createServer(app);

  // Attach Real-Time WebSocket Collaboration Server on /ws/collab via noServer upgrade routing
  // so non-collab upgrade requests (e.g. Vite dev middleware) are never aborted
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/ws/collab') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  let nextColorIdx = 0;

  wss.on('connection', (ws) => {
    const clientId = `peer_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const assignedColor = PEER_PALETTE[nextColorIdx % PEER_PALETTE.length];
    nextColorIdx += 1;

    const peer: CollabPeer = {
      clientId,
      displayName: 'Apprentice',
      color: assignedColor,
      roomId: 'root-sanctuary',
      elevationMeters: 0,
      zone: 'ROOT_SANCTUARY',
      pacingMode: 'Quiet Async',
      joinedAtMs: Date.now(),
    };
    peers.set(clientId, { ws, peer });

    // Send initial authoritative state immediately upon connect
    const currentRoom = rooms.get(peer.roomId)!;
    sendJson(ws, {
      type: 'init',
      selfClientId: clientId,
      roomState: currentRoom,
      rooms: getRoomSummaries(),
      peers: getAllActivePeers(),
      stock: getStockSnapshot(),
    });

    broadcastGlobal({
      type: 'presence:sync',
      peers: getAllActivePeers(),
      rooms: getRoomSummaries(),
    });

    ws.on('message', (rawBuf) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(rawBuf)) as Record<string, unknown>;
      } catch {
        return;
      }

      const eventType = String(msg.type || '');

      if (eventType === 'presence:join') {
        const cleanName = sanitizeShortText(
          msg.displayName,
          36,
          peer.displayName
        );
        const safety = screenForHarmToHumansOrAnimals(cleanName);
        if (safety.safe) {
          peer.displayName = cleanName;
        }

        const requestedRoom = sanitizeRoomId(msg.roomId);
        if (!rooms.has(requestedRoom)) {
          const customTitle = sanitizeShortText(
            msg.roomTitle,
            80,
            `Collab Room · ${requestedRoom}`
          );
          const customSub = sanitizeShortText(
            msg.roomSubtitle,
            140,
            'Live peer-to-peer collaborative trade & outreach workbench.'
          );
          const seedPad = sanitizeShortText(
            msg.seedCharter,
            800,
            'Low-demand collaborative workspace: take steps at your own pace.'
          );
          if (
            screenForHarmToHumansOrAnimals(
              `${customTitle} ${customSub} ${seedPad}`
            ).safe
          ) {
            rooms.set(requestedRoom, {
              roomId: requestedRoom,
              title: customTitle,
              subtitle: customSub,
              sharedCharterPad: seedPad,
              padUpdatedBy: peer.displayName,
              steps: [],
              messages: [],
            });
          }
        }

        const targetRoomId = rooms.has(requestedRoom)
          ? requestedRoom
          : 'root-sanctuary';
        peer.roomId = targetRoomId;

        const validPacing: CollabPacingTag[] = [
          'Quiet Async',
          'Paired Co-Work',
          'Trainer Guided',
          'Low-Demand Rest OK',
        ];
        if (
          typeof msg.pacingMode === 'string' &&
          validPacing.includes(msg.pacingMode as CollabPacingTag)
        ) {
          peer.pacingMode = msg.pacingMode as CollabPacingTag;
        }

        sendJson(ws, {
          type: 'room:state',
          roomState: rooms.get(targetRoomId)!,
          rooms: getRoomSummaries(),
        });

        broadcastGlobal({
          type: 'presence:sync',
          peers: getAllActivePeers(),
          rooms: getRoomSummaries(),
        });
        return;
      }

      if (eventType === 'presence:move') {
        const elev = Number(msg.elevationMeters);
        if (Number.isFinite(elev)) {
          peer.elevationMeters = Math.min(33, Math.max(0, Math.round(elev * 10) / 10));
        }
        if (typeof msg.zone === 'string') {
          peer.zone = msg.zone.slice(0, 32);
        }
        broadcastGlobal({
          type: 'presence:moved',
          clientId: peer.clientId,
          elevationMeters: peer.elevationMeters,
          zone: peer.zone,
        });
        return;
      }

      const activeRoom = rooms.get(peer.roomId);
      if (!activeRoom) return;

      if (eventType === 'step:create') {
        const stepId = sanitizeShortText(
          msg.id,
          64,
          `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        );
        // Idempotency guard: skip if step with this ID already exists
        if (activeRoom.steps.some((s) => s.id === stepId)) return;

        const title = sanitizeShortText(msg.title, 140);
        if (title.length < 3) return;
        const safety = screenForHarmToHumansOrAnimals(title);
        if (!safety.safe) {
          sendJson(ws, { type: 'error:ethical', reason: safety.reason });
          return;
        }

        const validPacing: CollabPacingTag[] = [
          'Quiet Async',
          'Paired Co-Work',
          'Trainer Guided',
          'Low-Demand Rest OK',
        ];
        const pacingTag: CollabPacingTag = validPacing.includes(
          msg.pacingTag as CollabPacingTag
        )
          ? (msg.pacingTag as CollabPacingTag)
          : 'Quiet Async';

        const created: CollabStep = {
          id: stepId,
          title,
          ownerName: peer.displayName,
          pacingTag,
          status: 'todo',
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        };
        activeRoom.steps.push(created);
        if (activeRoom.steps.length > 60) activeRoom.steps.shift();

        broadcastToRoom(activeRoom.roomId, {
          type: 'step:created',
          roomId: activeRoom.roomId,
          step: created,
        });
        broadcastGlobal({
          type: 'rooms:updated',
          rooms: getRoomSummaries(),
        });
        return;
      }

      if (eventType === 'step:update') {
        const stepId = sanitizeShortText(msg.id, 64);
        const existing = activeRoom.steps.find((s) => s.id === stepId);
        if (!existing) return;

        const prevStatus = existing.status;
        const validStatuses: CollabStepStatus[] = [
          'todo',
          'in_progress',
          'done',
        ];
        if (validStatuses.includes(msg.status as CollabStepStatus)) {
          existing.status = msg.status as CollabStepStatus;
        }
        if (typeof msg.ownerName === 'string') {
          const cleanOwner = sanitizeShortText(msg.ownerName, 36, existing.ownerName);
          if (screenForHarmToHumansOrAnimals(cleanOwner).safe) {
            existing.ownerName = cleanOwner;
          }
        }
        existing.updatedAtMs = Date.now();

        broadcastToRoom(activeRoom.roomId, {
          type: 'step:updated',
          roomId: activeRoom.roomId,
          step: existing,
          completedJustNow: prevStatus !== 'done' && existing.status === 'done',
          completedByClientId: peer.clientId,
        });
        return;
      }

      if (eventType === 'step:delete') {
        const stepId = sanitizeShortText(msg.id, 64);
        const idx = activeRoom.steps.findIndex((s) => s.id === stepId);
        if (idx === -1) return; // Idempotent no-op
        activeRoom.steps.splice(idx, 1);
        broadcastToRoom(activeRoom.roomId, {
          type: 'step:deleted',
          roomId: activeRoom.roomId,
          stepId,
        });
        broadcastGlobal({
          type: 'rooms:updated',
          rooms: getRoomSummaries(),
        });
        return;
      }

      if (eventType === 'pad:update') {
        const nextPad = sanitizeShortText(msg.sharedCharterPad, 1200, '');
        const safety = screenForHarmToHumansOrAnimals(nextPad);
        if (!safety.safe) {
          sendJson(ws, { type: 'error:ethical', reason: safety.reason });
          return;
        }
        activeRoom.sharedCharterPad = nextPad;
        activeRoom.padUpdatedBy = peer.displayName;
        broadcastToRoom(activeRoom.roomId, {
          type: 'pad:updated',
          roomId: activeRoom.roomId,
          sharedCharterPad: activeRoom.sharedCharterPad,
          padUpdatedBy: activeRoom.padUpdatedBy,
          sourceClientId: peer.clientId,
        });
        return;
      }

      if (eventType === 'message:create') {
        const msgId = sanitizeShortText(
          msg.id,
          64,
          `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        );
        if (activeRoom.messages.some((m) => m.id === msgId)) return;

        const text = sanitizeShortText(msg.text, 500);
        if (!text) return;
        const safety = screenBootsOnGroundCensor(text, 'collab-chat');
        if (!safety.allowed) {
          sendJson(ws, { type: 'error:ethical', reason: safety.reason });
          return;
        }

        const record: CollabMessage = {
          id: msgId,
          senderName: peer.displayName,
          senderColor: peer.color,
          text,
          createdAtMs: Date.now(),
        };
        activeRoom.messages.push(record);
        if (activeRoom.messages.length > 80) activeRoom.messages.shift();

        broadcastToRoom(activeRoom.roomId, {
          type: 'message:created',
          roomId: activeRoom.roomId,
          message: record,
        });
      }
    });

    ws.on('close', () => {
      peers.delete(clientId);
      broadcastGlobal({
        type: 'presence:sync',
        peers: getAllActivePeers(),
        rooms: getRoomSummaries(),
      });
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Jay's Job Club Full-Stack Server (HTTP + WebSocket + PayPal API) listening on http://0.0.0.0:${PORT}`
    );
  });
}

void startServer();
