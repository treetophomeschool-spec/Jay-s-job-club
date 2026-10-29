export enum GameScreen {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  MASTERY_COMPLETE = 'MASTERY_COMPLETE',
}

export enum ZoneType {
  ROOT_SANCTUARY = 'ROOT_SANCTUARY',
  TRUNK_CABLE = 'TRUNK_CABLE',
  CANOPY_SUMMIT = 'CANOPY_SUMMIT',
}

export enum CameraPreset {
  LIFT_FOLLOW = 'LIFT_FOLLOW',
  DIAGRAM_WIDE = 'DIAGRAM_WIDE',
  CANOPY_SUMMIT = 'CANOPY_SUMMIT',
  ROOT_SANCTUARY = 'ROOT_SANCTUARY',
}

export type CanopyInspectAngle =
  | 'overview'
  | 'interior'
  | 'tools_rack'
  | 'lanterns_floor'
  | 'mezzanine_overview'
  | 'mezzanine_relaxation'
  | 'mezzanine_library'
  | 'mezzanine_refreshments'
  | 'chill_pod';

export type ChillPodId = 'pod_1' | 'pod_2' | 'pod_3' | 'pod_4';

export type ChillQuiltType = 'none' | 'vegan' | 'natural_duck_feather';

export type WellyPlushieId =
  | 'mossy_green'
  | 'sunny_yellow'
  | 'bramble_berry'
  | 'oatie_cream';

export interface ChillPodVisualConfig {
  podId: ChillPodId;
  occupied: boolean;
  isCurrentUser: boolean;
  fanEnabled: boolean;
  heaterEnabled: boolean;
  lightsOffCalm: boolean;
  flotationEnabled: boolean;
  quiltType: ChillQuiltType;
  wellyPlushieId?: WellyPlushieId | null;
}

export enum PaceMode {
  SUPER_SLOW = 'SUPER_SLOW',
  FINE = 'FINE',
  STEADY = 'STEADY',
  SONIC = 'SONIC',
}

export const PACE_MODE_ORDER: PaceMode[] = [
  PaceMode.SUPER_SLOW,
  PaceMode.FINE,
  PaceMode.STEADY,
  PaceMode.SONIC,
];

export const PACE_MODE_LABELS: Record<
  PaceMode,
  { short: string; buttonLabel: string; description: string }
> = {
  [PaceMode.SUPER_SLOW]: {
    short: 'Super Slow',
    buttonLabel: 'Super Slow',
    description: 'Ultra-gentle 0.55 m/s sensory & height-safe crawl (no wind sway)',
  },
  [PaceMode.FINE]: {
    short: 'Gentle',
    buttonLabel: 'Gentle Pace',
    description: 'Unhurried 1.35 m/s calm pulley pace',
  },
  [PaceMode.STEADY]: {
    short: 'Steady',
    buttonLabel: 'Steady Pace',
    description: 'Balanced 2.6 m/s everyday counterbalance haul',
  },
  [PaceMode.SONIC]: {
    short: 'Sonic',
    buttonLabel: 'Sonic (Busy Day)',
    description: 'Express 16.5 m/s busy-day zip from 0m to 33m in ~2 seconds',
  },
};

export enum CraftKind {
  CEDAR_JOINERY = 'CEDAR_JOINERY',
  COPPER_LANTERN = 'COPPER_LANTERN',
  LOOMED_TAPESTRY = 'LOOMED_TAPESTRY',
}

export type SharePathwayKind =
  | 'collab_ready'
  | 'trade_building'
  | 'job_steps'
  | 'trade_sharing';

export interface CraftDefinition {
  kind: CraftKind;
  label: string;
  materialNote: string;
  baseValue: number;
}

export const CRAFT_CATALOG: Record<CraftKind, CraftDefinition> = {
  [CraftKind.CEDAR_JOINERY]: {
    kind: CraftKind.CEDAR_JOINERY,
    label: 'Dovetail Cedar Chest',
    materialNote: 'Hand-planed aromatic timber',
    baseValue: 15,
  },
  [CraftKind.COPPER_LANTERN]: {
    kind: CraftKind.COPPER_LANTERN,
    label: 'Spun Brass Beacon Lamp',
    materialNote: 'Hammered sheet & warm lens',
    baseValue: 20,
  },
  [CraftKind.LOOMED_TAPESTRY]: {
    kind: CraftKind.LOOMED_TAPESTRY,
    label: 'Woven Canopy Banner',
    materialNote: 'Natural dyed highland wool',
    baseValue: 25,
  },
};

export interface HudSnapshot {
  screen: GameScreen;
  elevationMeters: number;
  maxElevationMeters: number;
  zone: ZoneType;
  poisePercent: number;
  isBraced: boolean;
  carriedCraft: CraftKind | null;
  selectedRootCraft: CraftKind;
  boughTokensCarried: number;
  tryingTokens: number;
  gatheringTokens: number;
  treehouseTokens: number;
  sharesCompleted: number;
  welcomeCheckedIn: boolean;
  dailyStreak: number;
  bestStreak: number;
  autoGatherEnabled: boolean;
  autoGlideTargetMeters: number | null;
  onlineCollaborators: number;
  communityTokens: number;
  beaconsLit: number; // 0 to 3 (▲ ▲ ▲)
  tradesCompleted: number;
  stowedToolsCount: number;
  placedFurnishingsCount: number;
  cameraPreset: CameraPreset;
  canopyInspectAngle: CanopyInspectAngle;
  canopyZoom: number;
  roofCutaway: boolean;
  paceMode: PaceMode;
  gustWarningActive: boolean;
  gustBandMeters: number | null;
  nearbyStationLabel: string | null;
  nearbyTokenAvailable: boolean;
  statusBanner: string;
  counterweightUpgraded: boolean;
  windShieldUpgraded: boolean;
  safetyHatchLatched: boolean;
  studioName: string;
  webglFallback: boolean;
  liftMotionState: 'idle' | 'ascending' | 'descending' | 'gliding';
  hoveredTreeControl: TreeLiftControlAction | null;
  hoveredEntryKiosk: boolean;
  hoveredWelcomeShoes: boolean;
  hoveredJobBoard: boolean;
  hoveredCanopyStore: boolean;
  hoveredCanopyStudio: boolean;
  hoveredMezzanine: boolean;
  hoveredChillPodId: ChillPodId | null;
  activeChillPodId: ChillPodId | null;
  hoveredSignId: SanctuarySignId | null;
  activeShoeLabel: string;
  motivationalTitle: string;
  motivationalMessage: string;
}

export type SanctuarySignId =
  | 'gateway_banner'
  | 'entry_kiosk'
  | 'welcome_shoe_bench'
  | 'job_board'
  | 'artisan_shop'
  | 'trunk_console'
  | 'canopy_studio'
  | 'canopy_paypal_store'
  | 'mezzanine_library'
  | 'mezzanine_refreshments'
  | 'mezzanine_chill_pods'
  | 'plaque_roots'
  | 'plaque_lower_heartwood'
  | 'plaque_golden_resin'
  | 'plaque_mid_bough'
  | 'plaque_upper_bough'
  | 'plaque_canopy_crown';

export type TreeLiftControlAction =
  | 'ascend'
  | 'stop'
  | 'descend'
  | 'glide_0'
  | 'glide_18'
  | 'glide_33';



