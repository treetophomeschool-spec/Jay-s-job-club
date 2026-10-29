import { AGARWOOD_MOTIVATIONAL_PLAQUES } from './agarwoodMotivation';
import { SanctuarySignId } from '../types/game';

export type SignZoneGroup =
  | '0m Ground Sanctuary'
  | 'Agarwood Trunk (2m–32m)'
  | '33m Treetop Canopy';

export interface SanctuarySignEntry {
  id: SanctuarySignId;
  zoneGroup: SignZoneGroup;
  locationLabel: string;
  elevationMeters: number;
  boardHeadline: string;
  boardSubline: string;
  fullPlainText: string;
  opensEntryKiosk?: boolean;
}

const STATIC_GROUND_SIGNS: SanctuarySignEntry[] = [
  {
    id: 'gateway_banner',
    zoneGroup: '0m Ground Sanctuary',
    locationLabel: '0m Front Archway',
    elevationMeters: 0,
    boardHeadline: "JAY'S JOB CLUB",
    boardSubline: 'Special Interests → Real Trades',
    fullPlainText:
      "Welcome to Jay's Job Club in the Agarwood Sanctuary (Ages 18+). Explore how your focused special interest can grow into a welcoming craft, workshop skill, or real-world job role at your own pace.",
  },
  {
    id: 'entry_kiosk',
    zoneGroup: '0m Ground Sanctuary',
    locationLabel: '0m Front-Left Plaza',
    elevationMeters: 0,
    boardHeadline: 'ENTRY KIOSK · SIGN UP',
    boardSubline: 'Special Interest → Job Dashboard',
    fullPlainText:
      '“We like to hear about your special interest journeys.” Open the Entry Kiosk to type in your special interest, see which job or trade role it could lead to, and apply for an Admin-approved Treetop Token.',
    opensEntryKiosk: true,
  },
  {
    id: 'welcome_shoe_bench',
    zoneGroup: '0m Ground Sanctuary',
    locationLabel: '0m Front-Right Fitting Bench',
    elevationMeters: 0,
    boardHeadline: 'BOOT & SHOE CHARACTERS',
    boardSubline: 'Wellies · Work Boots · Maker Shoes',
    fullPlainText:
      'Choose your playable 3D footwear character in the Welcome Area—including Classic Woodland Wellington Boots, Safety Wellies, Steel-Toe Work Boots, Heritage Leather Work Shoes, Timber Rigger Boots, and Quiet-Sole Canvas Maker Shoes.',
  },
  {
    id: 'job_board',
    zoneGroup: '0m Ground Sanctuary',
    locationLabel: '0m Rear-Right Pavilion',
    elevationMeters: 0,
    boardHeadline: 'JOB BOARD & COLLABS',
    boardSubline: 'Screened Safe Roles · 0m Deck',
    fullPlainText:
      'Boots-on-Ground Censor screened job opportunities and calm peer collaborations. Rude, exploitative, or unsuitable postings are automatically blocked before reaching the board.',
  },
  {
    id: 'artisan_shop',
    zoneGroup: '0m Ground Sanctuary',
    locationLabel: '0m Left Market Stall',
    elevationMeters: 0,
    boardHeadline: 'DRAZELLA BOOK & SHOP',
    boardSubline: 'Lanterns · Drinks · Welcome Packs',
    fullPlainText:
      'Handcrafted sanctuary showcase featuring the Drazella Sprinkles book, spun brass canopy lanterns, warm botanical drinks, woven runners, and calm welcome packs.',
  },
];

const TRUNK_PLAQUE_SIGNS: SanctuarySignEntry[] =
  AGARWOOD_MOTIVATIONAL_PLAQUES.map((plaque) => ({
    id: plaque.id as SanctuarySignId,
    zoneGroup: 'Agarwood Trunk (2m–32m)',
    locationLabel: plaque.zoneLabel,
    elevationMeters: plaque.elevationMeters,
    boardHeadline: plaque.carvedTitle,
    boardSubline: plaque.zoneLabel,
    fullPlainText: plaque.motivationalMessage,
  }));

export function buildSanctuarySignsCatalog(
  studioName = 'Canopy Workshop Rota',
  tradeFocus = 'Woodcraft & Joinery',
  currentElevation = 0
): SanctuarySignEntry[] {
  const activePlaque =
    AGARWOOD_MOTIVATIONAL_PLAQUES.reduce((best, item) =>
      Math.abs(item.elevationMeters - currentElevation) <
      Math.abs(best.elevationMeters - currentElevation)
        ? item
        : best
    ) ?? AGARWOOD_MOTIVATIONAL_PLAQUES[0];

  const trunkConsoleEntry: SanctuarySignEntry = {
    id: 'trunk_console',
    zoneGroup: 'Agarwood Trunk (2m–32m)',
    locationLabel: `${currentElevation.toFixed(1)}m · Lift Control Plate`,
    elevationMeters: currentElevation,
    boardHeadline: 'AGARWOOD LIFT CONSOLE',
    boardSubline: `${activePlaque.carvedTitle} · ${currentElevation.toFixed(1)}m / 33m`,
    fullPlainText: `Embedded trunk lift controls: ▲ HAUL UP, ■ HOLD, ▼ LOWER, plus 0m ROOTS, 18m BOUGH, and 33m TOP buttons. Current plaque: “${activePlaque.motivationalMessage}”`,
  };

  const canopyStudioEntry: SanctuarySignEntry = {
    id: 'canopy_studio',
    zoneGroup: '33m Treetop Canopy',
    locationLabel: '33m Canopy Studio Wall',
    elevationMeters: 33,
    boardHeadline: studioName.trim() || 'Canopy Workshop Rota',
    boardSubline: `${tradeFocus} · Customisable Upstairs`,
    fullPlainText: `${studioName.trim() || 'Canopy Workshop Rota'} (${tradeFocus}). Customise your upstairs flooring, safety hatch, nameplate, and placed 3D lanterns at 33m.`,
  };

  const canopyPaypalEntry: SanctuarySignEntry = {
    id: 'canopy_paypal_store',
    zoneGroup: '33m Treetop Canopy',
    locationLabel: '33m Canopy Maker Storefront',
    elevationMeters: 33,
    boardHeadline: 'CANOPY PAYPAL STORE',
    boardSubline: 'Sell & Buy Maker Work · 33m',
    fullPlainText:
      'Upstairs 33m Treetop Canopy PayPal Store where members can list and sell their handcrafted woodwork, lanterns, textiles, and distilled Agarwood essential oil bottles via PayPal checkout or Canopy Counter Hold.',
  };

  return [
    ...STATIC_GROUND_SIGNS,
    trunkConsoleEntry,
    ...TRUNK_PLAQUE_SIGNS,
    canopyStudioEntry,
    canopyPaypalEntry,
  ];
}

export function getSanctuarySignById(
  id: SanctuarySignId | null | undefined,
  studioName?: string,
  tradeFocus?: string,
  currentElevation?: number
): SanctuarySignEntry | null {
  if (!id) return null;
  const all = buildSanctuarySignsCatalog(
    studioName,
    tradeFocus,
    currentElevation
  );
  return all.find((item) => item.id === id) ?? null;
}
