import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

export interface AgarwoodPlaqueSpec {
  id: string;
  elevationMeters: number;
  zoneLabel: string;
  carvedTitle: string;
  motivationalMessage: string;
}

const RAW_AGARWOOD_PLAQUES: AgarwoodPlaqueSpec[] = [
  {
    id: 'plaque_roots',
    elevationMeters: 2.2,
    zoneLabel: '0m · Root Sanctuary',
    carvedTitle: 'ROOTS & SPECIAL INTERESTS',
    motivationalMessage:
      'Different, not less — be prepared to put your goals to fruition by catapulting special interests into a job, trade, or community outreach.',
  },
  {
    id: 'plaque_lower_heartwood',
    elevationMeters: 8.2,
    zoneLabel: '8m · Lower Agarwood Trunk',
    carvedTitle: 'YOUR OWN RHYTHM',
    motivationalMessage:
      'Move at your own rhythm — steady craft outlasts rushed noise.',
  },
  {
    id: 'plaque_golden_resin',
    elevationMeters: 14.2,
    zoneLabel: '14m · Golden Resin Heartwood',
    carvedTitle: 'AGARWOOD PATIENCE',
    motivationalMessage:
      'Like agarwood forming warm resin over time, patience turns care into lasting value.',
  },
  {
    id: 'plaque_mid_bough',
    elevationMeters: 20.2,
    zoneLabel: '20m · Mid-Trunk Bough',
    carvedTitle: 'FOCUSED CURIOSITY',
    motivationalMessage:
      'Your focused curiosity is a real trade skill waiting for a welcoming bench.',
  },
  {
    id: 'plaque_upper_bough',
    elevationMeters: 26.2,
    zoneLabel: '26m · Upper Bough Rest',
    carvedTitle: 'REST IS PART OF THE CLIMB',
    motivationalMessage:
      'Pause whenever you wish. Resting on the branch is part of the climb.',
  },
  {
    id: 'plaque_canopy_crown',
    elevationMeters: 32.2,
    zoneLabel: '33m · Treetop Canopy',
    carvedTitle: 'CANOPY WORKSHOP WELCOME',
    motivationalMessage:
      'Welcome to the Canopy — share your craft kindly and shine at your own pace.',
  },
];

// Deterministic Boots-on-Ground & Humane Alignment verification on boot
export const AGARWOOD_MOTIVATIONAL_PLAQUES: AgarwoodPlaqueSpec[] =
  RAW_AGARWOOD_PLAQUES.filter((plaque) => {
    const verdict = screenBootsOnGroundCensor(
      `${plaque.carvedTitle} ${plaque.motivationalMessage}`,
      'agarwood-tree-plaque'
    );
    return verdict.allowed;
  });

export function getAgarwoodMotivationForElevation(
  elevationMeters: number
): AgarwoodPlaqueSpec {
  let closest = AGARWOOD_MOTIVATIONAL_PLAQUES[0];
  let bestDist = Infinity;
  for (const plaque of AGARWOOD_MOTIVATIONAL_PLAQUES) {
    const dist = Math.abs(elevationMeters - plaque.elevationMeters);
    if (dist < bestDist) {
      bestDist = dist;
      closest = plaque;
    }
  }
  return closest;
}

export interface MeltingUpdateSlide {
  id: string;
  kicker: string;
  headline: string;
  highlight: string;
  detail: string;
}

const RAW_MELTING_SLIDES: MeltingUpdateSlide[] = [
  {
    id: 'kiosk_welcome',
    kicker: 'Ground Sign-In Kiosk · Treetop Token Gate',
    headline: 'JAY’S JOB CLUB',
    highlight: '“We like to hear about your special interest journeys.”',
    detail:
      'Canopy entry requires an Admin-approved Treetop Token after application · Operate the Agarwood Tree Lift below at your own pace.',
  },
  {
    id: 'pg_cert_notes',
    kicker: 'PG Cert Autism & Mental Health · Student-in-Training Notes',
    headline: 'Monotropism & Sensory Pacing',
    highlight:
      'Deep special-interest focus thrives in predictable, low-arousal spaces.',
    detail:
      'Educational reflections from a student in training (Double Empathy & Burnout Prevention) · Zero forced speed on the Agarwood Lift.',
  },
  {
    id: 'canopy_rota',
    kicker: '33m Treetop Canopy · Learn-a-Trade Workshop Rota',
    headline: 'Special Interest Trade Workshops',
    highlight:
      'Cedar Joinery · Brass Lanterns · Loom Weaving · Botanical Outreach',
    detail:
      'Optional meet-up overflow on Zoom, Facebook, or moderated social media strictly where appropriate and with Parent, Carer, or Competent Adult approval.',
  },
  {
    id: 'carer_going_out',
    kicker: 'Carer Support & Lift Pace · Super Slow to Busy-Day Sonic',
    headline: 'Going Out? Gentle Carer Checklist',
    highlight:
      'Everyone’s Coat · Snacks · Meds · Bags · Changes of Clothes',
    detail:
      'Choose Super Slow lift pace for calm days or Sonic Speed for busy days · Open Carer Check in the top bar anytime.',
  },
];

export const ALIGNED_MELTING_SLIDES: MeltingUpdateSlide[] =
  RAW_MELTING_SLIDES.filter((slide) => {
    const verdict = screenBootsOnGroundCensor(
      `${slide.kicker} ${slide.headline} ${slide.highlight} ${slide.detail}`,
      'melting-overlay'
    );
    return verdict.allowed;
  });
