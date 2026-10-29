import {
  NEXT_STEP_MAX_LENGTH,
  PATHWAY_READINESS_STAGES,
  PathwayReadinessStage,
  POTENTIAL_JOB_MAX_LENGTH,
  SPECIAL_INTEREST_MAX_LENGTH,
  SpecialInterestPathwayRecord,
  TREETOP_TRADE_TRACKS,
  TreetopTradeTrack,
  USERNAME_MAX_LENGTH,
} from '../firebase';

export const LOCAL_PATHWAYS_STORAGE_KEY = 'jays_job_club_kiosk_pathways_v1';
export const PATHWAYS_CHANGED_EVENT = 'jays-job-club-pathways-changed';

export interface DeterministicJobSuggestion {
  role: string;
  suggestedTrack: TreetopTradeTrack;
  gentleFirstStep: string;
}

interface KeywordBridgeRule {
  keywords: string[];
  suggestions: DeterministicJobSuggestion[];
}

const KEYWORD_BRIDGE_RULES: KeywordBridgeRule[] = [
  {
    keywords: [
      'wood',
      'timber',
      'carv',
      'joiner',
      'cabinet',
      'cedar',
      'agarwood',
      'furniture',
      'whittl',
      'lathe',
    ],
    suggestions: [
      {
        role: 'Bespoke Cabinetmaker & Joinery Bench Craftsperson',
        suggestedTrack: 'Woodcraft & Joinery',
        gentleFirstStep:
          'Practice marking and cutting a single calm dovetail joint on aromatic cedar.',
      },
      {
        role: 'Heritage Timber & Furniture Restoration Specialist',
        suggestedTrack: 'Woodcraft & Joinery',
        gentleFirstStep:
          'Inspect wood grain direction and smooth one test board with a hand plane.',
      },
      {
        role: 'Architectural Model & Acoustic Woodwork Maker',
        suggestedTrack: 'Woodcraft & Joinery',
        gentleFirstStep:
          'Measure and dry-fit small interlocking oak or cork sanctuary panels.',
      },
    ],
  },
  {
    keywords: [
      'clock',
      'watch',
      'gear',
      'brass',
      'metal',
      'lantern',
      'lamp',
      'light',
      'forge',
      'copper',
      'jewelry',
      'jewellery',
    ],
    suggestions: [
      {
        role: 'Architectural Lantern & Bespoke Lighting Craftsperson',
        suggestedTrack: 'Metalwork & Lanterns',
        gentleFirstStep:
          'Assemble a low-voltage warm amber glass lantern frame at a quiet bench.',
      },
      {
        role: 'Heritage Horology & Precision Instrument Technician',
        suggestedTrack: 'Metalwork & Lanterns',
        gentleFirstStep:
          'Sort, measure, and clean brass gears and fasteners with vernier calipers.',
      },
      {
        role: 'Small-Batch Metalwork & Engraving Maker',
        suggestedTrack: 'Metalwork & Lanterns',
        gentleFirstStep:
          'Practice scribing clean geometric layout lines on a brass nameplate.',
      },
    ],
  },
  {
    keywords: [
      'fabric',
      'wool',
      'weav',
      'loom',
      'knit',
      'sew',
      'stitch',
      'quilt',
      'yarn',
      'dye',
      'pattern',
      'cloth',
    ],
    suggestions: [
      {
        role: 'Hand-Loom Textile Weaver & Acoustic Rug Maker',
        suggestedTrack: 'Textiles & Weaving',
        gentleFirstStep:
          'Wind a hardwood boat shuttle with plant-dyed wool and weave a sample swatch.',
      },
      {
        role: 'Bespoke Garment Alteration & Visible-Mending Maker',
        suggestedTrack: 'Textiles & Weaving',
        gentleFirstStep:
          'Practice reinforced seam stitching on heavyweight canvas at your own pace.',
      },
      {
        role: 'Sensory-Friendly Soft Furnishings Designer',
        suggestedTrack: 'Textiles & Weaving',
        gentleFirstStep:
          'Compare tactile natural fibres and bind a non-curling sample edge.',
      },
    ],
  },
  {
    keywords: [
      'repair',
      'fix',
      'solder',
      'circuit',
      'electronic',
      'radio',
      'audio',
      'bike',
      'bicycle',
      'tool',
      'appliance',
      'mechanical',
    ],
    suggestions: [
      {
        role: 'Bench Electronics & Small-Appliance Repair Technician',
        suggestedTrack: 'Repair & Maker Tools',
        gentleFirstStep:
          'Test continuity on a low-voltage lamp circuit using a bench multimeter.',
      },
      {
        role: 'Community Tool Library & Precision Maintenance Steward',
        suggestedTrack: 'Repair & Maker Tools',
        gentleFirstStep:
          'Clean, oil, and catalogue three hand tools in the quiet workshop locker.',
      },
      {
        role: 'Cycle & Mobility Aid Mechanical Technician',
        suggestedTrack: 'Repair & Maker Tools',
        gentleFirstStep:
          'Check brake cable tension and bearing smoothness on a single wheel rig.',
      },
    ],
  },
  {
    keywords: [
      'train',
      'rail',
      'timetable',
      'map',
      'route',
      'code',
      'coding',
      'software',
      'computer',
      'data',
      'archive',
      'catalog',
      'library',
      'book',
      'math',
      'puzzle',
      'chess',
    ],
    suggestions: [
      {
        role: 'Structured Data, Archive & Cataloguing Specialist',
        suggestedTrack: 'Digital & Systems Craft',
        gentleFirstStep:
          'Organise a 15-item taxonomy of workshop tools or books with clear labels.',
      },
      {
        role: 'Quality Assurance (QA) & Accessibility Systems Tester',
        suggestedTrack: 'Digital & Systems Craft',
        gentleFirstStep:
          'Run a calm, step-by-step checklist verifying predictable interface flows.',
      },
      {
        role: 'Timetable, Logistics & Route Planning Analyst',
        suggestedTrack: 'Digital & Systems Craft',
        gentleFirstStep:
          'Draft a clear weekly workshop rota with unhurried transition buffers.',
      },
    ],
  },
  {
    keywords: [
      'plant',
      'tree',
      'botan',
      'garden',
      'seed',
      'fern',
      'herb',
      'forest',
      'nature',
      'bird',
      'bee',
      'pollinator',
      'animal',
      'ecology',
    ],
    suggestions: [
      {
        role: 'Botanical Nursery & Sensory Garden Propagator',
        suggestedTrack: 'Botanical & Community Outreach',
        gentleFirstStep:
          'Pot woodland ferns or press labelled herbarium leaves in a cedar press.',
      },
      {
        role: 'Arboretum, Conservation & Pollinator Habitat Steward',
        suggestedTrack: 'Botanical & Community Outreach',
        gentleFirstStep:
          'Log native pollinator sightings and check planter moisture levels.',
      },
      {
        role: 'Calm Welcome Desk & Community Leaflets Archivist',
        suggestedTrack: 'Botanical & Community Outreach',
        gentleFirstStep:
          'Curate clear written welcome leaflets for new sanctuary visitors.',
      },
    ],
  },
];

const TRACK_DEFAULT_SUGGESTIONS: Record<
  TreetopTradeTrack,
  DeterministicJobSuggestion[]
> = {
  'Woodcraft & Joinery': KEYWORD_BRIDGE_RULES[0].suggestions,
  'Metalwork & Lanterns': KEYWORD_BRIDGE_RULES[1].suggestions,
  'Textiles & Weaving': KEYWORD_BRIDGE_RULES[2].suggestions,
  'Repair & Maker Tools': KEYWORD_BRIDGE_RULES[3].suggestions,
  'Digital & Systems Craft': KEYWORD_BRIDGE_RULES[4].suggestions,
  'Botanical & Community Outreach': KEYWORD_BRIDGE_RULES[5].suggestions,
};

export function suggestDeterministicJobRoles(
  specialInterest: string,
  selectedTrack: TreetopTradeTrack
): DeterministicJobSuggestion[] {
  const normalized = specialInterest.trim().toLowerCase();
  if (normalized.length >= 2) {
    for (const rule of KEYWORD_BRIDGE_RULES) {
      if (rule.keywords.some((kw) => normalized.includes(kw))) {
        return rule.suggestions;
      }
    }
  }
  return (
    TRACK_DEFAULT_SUGGESTIONS[selectedTrack] ??
    TRACK_DEFAULT_SUGGESTIONS['Woodcraft & Joinery']
  );
}

export function nextReadinessStage(
  current: PathwayReadinessStage
): PathwayReadinessStage {
  const idx = PATHWAY_READINESS_STAGES.indexOf(current);
  if (idx < 0 || idx === PATHWAY_READINESS_STAGES.length - 1) {
    return PATHWAY_READINESS_STAGES[0] ?? 'Exploring Curiosity';
  }
  return PATHWAY_READINESS_STAGES[idx + 1];
}

export function loadLocalInterestPathways(): SpecialInterestPathwayRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_PATHWAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object')
      )
      .map((item) => {
        const track = TREETOP_TRADE_TRACKS.includes(
          item.tradeTrack as TreetopTradeTrack
        )
          ? (item.tradeTrack as TreetopTradeTrack)
          : (TREETOP_TRADE_TRACKS[0] ?? 'Woodcraft & Joinery');
        const stage = PATHWAY_READINESS_STAGES.includes(
          item.readinessStage as PathwayReadinessStage
        )
          ? (item.readinessStage as PathwayReadinessStage)
          : (PATHWAY_READINESS_STAGES[0] ?? 'Exploring Curiosity');
        return {
          id: String(item.id || `local_${Date.now()}`).replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          ),
          uid: 'local_visitor',
          entrantHandle: String(
            item.entrantHandle || 'Sanctuary Entrant'
          ).slice(0, USERNAME_MAX_LENGTH),
          specialInterest: String(item.specialInterest || '').slice(
            0,
            SPECIAL_INTEREST_MAX_LENGTH
          ),
          potentialJobRole: String(item.potentialJobRole || '').slice(
            0,
            POTENTIAL_JOB_MAX_LENGTH
          ),
          tradeTrack: track,
          comfortableNextStep: String(item.comfortableNextStep || '').slice(
            0,
            NEXT_STEP_MAX_LENGTH
          ),
          readinessStage: stage,
          createdAtMs:
            typeof item.createdAtMs === 'number'
              ? item.createdAtMs
              : Date.now(),
          source: 'local' as const,
        };
      })
      .filter(
        (row) =>
          row.specialInterest.trim().length >= 2 &&
          row.potentialJobRole.trim().length >= 2
      );
  } catch {
    return [];
  }
}

export function saveLocalInterestPathways(
  items: SpecialInterestPathwayRecord[]
): void {
  try {
    const trimmed = items.slice(0, 30);
    window.localStorage.setItem(
      LOCAL_PATHWAYS_STORAGE_KEY,
      JSON.stringify(trimmed)
    );
    window.dispatchEvent(new CustomEvent(PATHWAYS_CHANGED_EVENT));
  } catch {
    // Ignore local storage quota errors
  }
}
