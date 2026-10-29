export type ShoeCharacterKind =
  | 'wellington_boots'
  | 'safety_wellington_boots'
  | 'steel_toe_work_boots'
  | 'artisan_work_shoes'
  | 'timber_rigger_boots'
  | 'canvas_maker_shoes';

export type ShoeColorway =
  | 'forest_welly_green'
  | 'sunflower_welly_yellow'
  | 'heritage_oak_tan'
  | 'oxblood_leather'
  | 'harbour_navy'
  | 'charcoal_slate';

export interface ShoeCharacterSelection {
  shoeKind: ShoeCharacterKind;
  colorway: ShoeColorway;
  characterNickname: string;
}

export interface ShoeCharacterSpec {
  kind: ShoeCharacterKind;
  title: string;
  shortLabel: string;
  footwearFamily: 'Wellington Boots' | 'Work Boots' | 'Work Shoes';
  defaultColorway: ShoeColorway;
  soleHex: string;
  trimHex: string;
  upperRoughness: number;
  upperMetalness: number;
  shaftHeightRatio: number;
  hasSteelCap: boolean;
  hasBuckleStrap: boolean;
  hasPullLoops: boolean;
  hasRubberToeCap: boolean;
  tradeMatchNote: string;
  sensoryComfortNote: string;
}

export interface ShoeColorwaySpec {
  id: ShoeColorway;
  label: string;
  primaryHex: string;
  secondaryHex: string;
  laceOrStrapHex: string;
}

export const SHOE_CHARACTER_KINDS: ShoeCharacterKind[] = [
  'wellington_boots',
  'safety_wellington_boots',
  'steel_toe_work_boots',
  'artisan_work_shoes',
  'timber_rigger_boots',
  'canvas_maker_shoes',
];

export const SHOE_COLORWAYS: ShoeColorway[] = [
  'forest_welly_green',
  'sunflower_welly_yellow',
  'heritage_oak_tan',
  'oxblood_leather',
  'harbour_navy',
  'charcoal_slate',
];

export const SHOE_COLORWAY_CATALOG: Record<ShoeColorway, ShoeColorwaySpec> = {
  forest_welly_green: {
    id: 'forest_welly_green',
    label: 'Woodland Welly Green',
    primaryHex: '#255C3B',
    secondaryHex: '#183E27',
    laceOrStrapHex: '#E5A93C',
  },
  sunflower_welly_yellow: {
    id: 'sunflower_welly_yellow',
    label: 'Beacon Safety Yellow',
    primaryHex: '#E0A82E',
    secondaryHex: '#9E6F14',
    laceOrStrapHex: '#242C29',
  },
  heritage_oak_tan: {
    id: 'heritage_oak_tan',
    label: 'Heritage Oak Leather',
    primaryHex: '#9E5E34',
    secondaryHex: '#6E3E1F',
    laceOrStrapHex: '#F3D088',
  },
  oxblood_leather: {
    id: 'oxblood_leather',
    label: 'Workshop Oxblood',
    primaryHex: '#6E2622',
    secondaryHex: '#471614',
    laceOrStrapHex: '#E5A93C',
  },
  harbour_navy: {
    id: 'harbour_navy',
    label: 'Harbour Storm Navy',
    primaryHex: '#233D5B',
    secondaryHex: '#16273B',
    laceOrStrapHex: '#F7F4EB',
  },
  charcoal_slate: {
    id: 'charcoal_slate',
    label: 'Forged Slate Charcoal',
    primaryHex: '#353F3D',
    secondaryHex: '#202725',
    laceOrStrapHex: '#7CE0A3',
  },
};

export const SHOE_CHARACTER_CATALOG: Record<
  ShoeCharacterKind,
  ShoeCharacterSpec
> = {
  wellington_boots: {
    kind: 'wellington_boots',
    title: 'Classic Woodland Wellington Boots',
    shortLabel: 'Wellington Boots',
    footwearFamily: 'Wellington Boots',
    defaultColorway: 'forest_welly_green',
    soleHex: '#1E2421',
    trimHex: '#E5A93C',
    upperRoughness: 0.18,
    upperMetalness: 0.06,
    shaftHeightRatio: 1.0,
    hasSteelCap: false,
    hasBuckleStrap: true,
    hasPullLoops: false,
    hasRubberToeCap: false,
    tradeMatchNote:
      'Root Sanctuary & Botanical Bark Gathering — waterproof vulcanised knee-high wellies with mud-grip lugs and brass gusset buckle.',
    sensoryComfortNote:
      'Roomy calf fit with soft cotton lining and steady, splash-proof grounding on mossy woodland decks.',
  },
  safety_wellington_boots: {
    kind: 'safety_wellington_boots',
    title: 'Distillery & Canopy Safety Wellingtons',
    shortLabel: 'Safety Wellies',
    footwearFamily: 'Wellington Boots',
    defaultColorway: 'sunflower_welly_yellow',
    soleHex: '#2B2118',
    trimHex: '#FFD166',
    upperRoughness: 0.22,
    upperMetalness: 0.08,
    shaftHeightRatio: 0.94,
    hasSteelCap: true,
    hasBuckleStrap: true,
    hasPullLoops: false,
    hasRubberToeCap: false,
    tradeMatchNote:
      'Agarwood Essential Oil Hydro-Still & Wet Bench Work — high-visibility reinforced wellingtons with protective cap and slip-resistant tread.',
    sensoryComfortNote:
      'High-contrast cuff band makes foot placement easy to see in low-glare lantern light.',
  },
  steel_toe_work_boots: {
    kind: 'steel_toe_work_boots',
    title: 'Heavy-Duty Steel-Toe Work Boots',
    shortLabel: 'Steel-Toe Boots',
    footwearFamily: 'Work Boots',
    defaultColorway: 'heritage_oak_tan',
    soleHex: '#1F1A17',
    trimHex: '#CBD5E1',
    upperRoughness: 0.66,
    upperMetalness: 0.1,
    shaftHeightRatio: 0.62,
    hasSteelCap: true,
    hasBuckleStrap: false,
    hasPullLoops: false,
    hasRubberToeCap: false,
    tradeMatchNote:
      'Woodcraft, Joinery & Metalwork — oil-tanned leather ankle boots with brushed-steel toe shield and deep commando sole.',
    sensoryComfortNote:
      'Padded suede ankle collar and reassuringly weighted sole for calm proprioceptive feedback on the Lift.',
  },
  artisan_work_shoes: {
    kind: 'artisan_work_shoes',
    title: 'Heritage Leather Work Shoes',
    shortLabel: 'Leather Work Shoes',
    footwearFamily: 'Work Shoes',
    defaultColorway: 'oxblood_leather',
    soleHex: '#5C3A21',
    trimHex: '#E5A93C',
    upperRoughness: 0.42,
    upperMetalness: 0.08,
    shaftHeightRatio: 0.34,
    hasSteelCap: false,
    hasBuckleStrap: false,
    hasPullLoops: false,
    hasRubberToeCap: false,
    tradeMatchNote:
      'Precision Horology, Bookbinding & Label Press — sturdy Goodyear-welted workshop brogue shoes with oak-bark heel block.',
    sensoryComfortNote:
      'Low-cut ankle freedom with balanced arch support for long unhurried bench sessions.',
  },
  timber_rigger_boots: {
    kind: 'timber_rigger_boots',
    title: 'Fleece-Lined Timber Rigger Boots',
    shortLabel: 'Rigger Boots',
    footwearFamily: 'Work Boots',
    defaultColorway: 'heritage_oak_tan',
    soleHex: '#33261D',
    trimHex: '#E5A93C',
    upperRoughness: 0.74,
    upperMetalness: 0.06,
    shaftHeightRatio: 0.78,
    hasSteelCap: true,
    hasBuckleStrap: false,
    hasPullLoops: true,
    hasRubberToeCap: false,
    tradeMatchNote:
      'Pulley Rigging & Canopy Carpentry — easy pull-on mid-calf rigger boots with twin leather side loops and scuff-guard nose.',
    sensoryComfortNote:
      'Zero laces to tie—warm shearling-style lining and quick slip-on convenience.',
  },
  canvas_maker_shoes: {
    kind: 'canvas_maker_shoes',
    title: 'Quiet-Sole Canvas Maker Shoes',
    shortLabel: 'Quiet Maker Shoes',
    footwearFamily: 'Work Shoes',
    defaultColorway: 'harbour_navy',
    soleHex: '#E8DFCE',
    trimHex: '#F7F4EB',
    upperRoughness: 0.88,
    upperMetalness: 0.02,
    shaftHeightRatio: 0.38,
    hasSteelCap: false,
    hasBuckleStrap: false,
    hasPullLoops: false,
    hasRubberToeCap: true,
    tradeMatchNote:
      'Textiles, Weaving & Quiet Studio — breathable heavy-duck canvas workshop trainers with soft vulcanised gum-rubber toe cap.',
    sensoryComfortNote:
      'Ultra-quiet footsteps and lightweight flexible sole for sound-sensitive makers.',
  },
};

export const DEFAULT_SHOE_SELECTION: ShoeCharacterSelection = {
  shoeKind: 'wellington_boots',
  colorway: 'forest_welly_green',
  characterNickname: 'Woodland Wellies',
};

const SHOE_STORAGE_KEY = 'jays_job_club_shoe_character_v1';

export function loadLocalShoeSelection(): ShoeCharacterSelection {
  if (typeof window === 'undefined') return { ...DEFAULT_SHOE_SELECTION };
  try {
    const raw = window.localStorage.getItem(SHOE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHOE_SELECTION };
    const parsed = JSON.parse(raw) as Partial<ShoeCharacterSelection>;
    const shoeKind = SHOE_CHARACTER_KINDS.includes(
      parsed.shoeKind as ShoeCharacterKind
    )
      ? (parsed.shoeKind as ShoeCharacterKind)
      : DEFAULT_SHOE_SELECTION.shoeKind;
    const colorway = SHOE_COLORWAYS.includes(parsed.colorway as ShoeColorway)
      ? (parsed.colorway as ShoeColorway)
      : SHOE_CHARACTER_CATALOG[shoeKind].defaultColorway;
    const characterNickname =
      typeof parsed.characterNickname === 'string' &&
      parsed.characterNickname.trim().length >= 2
        ? parsed.characterNickname.trim().slice(0, 36)
        : SHOE_CHARACTER_CATALOG[shoeKind].shortLabel;
    return { shoeKind, colorway, characterNickname };
  } catch {
    return { ...DEFAULT_SHOE_SELECTION };
  }
}

export function saveLocalShoeSelection(next: ShoeCharacterSelection): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHOE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore private-browsing storage quota issues
  }
}
