/**
 * Shared catalog & real-time collaboration types imported by both `server.ts`
 * and client React components.
 * Zero binary/image imports so Node.js executes natively without bundlers.
 */

export type WelcomeShopCategory =
  | 'Books & Stories'
  | 'Woodcraft & Joinery'
  | 'Metalwork & Lanterns'
  | 'Textiles & Weaving'
  | 'Sensory & Calm Tools';

export interface HandcraftedCatalogItem {
  id: string;
  title: string;
  makerName: string;
  category: WelcomeShopCategory;
  materialsAndDimensions: string;
  story: string;
  /** Price in GBP pence (minor units, e.g. 999 = £9.99) */
  priceCents: number;
  initialStock: number;
  imageKey: 'drazella_sprinkles_book';
}

export const HANDCRAFTED_WELCOME_CATALOG: HandcraftedCatalogItem[] = [
  {
    id: 'drazella_sprinkles_book',
    title: 'Drazella Sprinkles — Clothbound Storybook Edition',
    makerName: "Jay's Job Club Press",
    category: 'Books & Stories',
    materialsAndDimensions:
      'Forest-green clothbound hardcover, gold-foil embossed cover, stitched ribbon marker · 21cm × 15cm',
    story:
      'Featured Welcome Stall book! Follow Drazella Sprinkles through an uplifting woodland tale of curiosity, kindness, and hands-on craft. Available via PayPal checkout or Ground Desk pickup.',
    priceCents: 999,
    initialStock: 25,
    imageKey: 'drazella_sprinkles_book',
  },
];

export interface CartLineInput {
  itemId: string;
  quantity: number;
  /** Optional custom member item metadata if sourced from Firestore /artisanItems */
  title?: string;
  unitPriceCents?: number;
}

export interface VerifiedOrderReceipt {
  receiptId: string;
  paypalOrderId: string;
  captureId: string;
  paymentMethod: 'paypal' | 'workshop_pickup_hold';
  buyerNote: string;
  totalCents: number;
  currency: 'GBP';
  items: Array<{
    itemId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  createdAtMs: number;
}

export type CollabPacingTag =
  | 'Quiet Async'
  | 'Paired Co-Work'
  | 'Trainer Guided'
  | 'Low-Demand Rest OK';

export type CollabStepStatus = 'todo' | 'in_progress' | 'done';

export interface CollabStep {
  id: string;
  title: string;
  ownerName: string;
  pacingTag: CollabPacingTag;
  status: CollabStepStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CollabMessage {
  id: string;
  senderName: string;
  senderColor: string;
  text: string;
  createdAtMs: number;
}

export interface CollabPeer {
  clientId: string;
  displayName: string;
  color: string;
  roomId: string;
  elevationMeters: number;
  zone: string;
  pacingMode: CollabPacingTag;
  joinedAtMs: number;
}

export interface CollabRoomState {
  roomId: string;
  title: string;
  subtitle: string;
  sharedCharterPad: string;
  padUpdatedBy: string;
  steps: CollabStep[];
  messages: CollabMessage[];
}

export interface CollabRoomSummary {
  roomId: string;
  title: string;
  subtitle: string;
  activeCount: number;
  stepCount: number;
}
