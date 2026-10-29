import { screenForHarmToHumansOrAnimals } from './ethicalGuard';

export type CarerReminderCategory =
  | 'coats'
  | 'snacks'
  | 'meds'
  | 'bags'
  | 'clothes'
  | 'custom';

export interface CarerReminderItem {
  id: string;
  category: CarerReminderCategory;
  label: string;
  detail: string;
  shortTag: string;
  checked: boolean;
  isBuiltIn: boolean;
}

export interface CarerRemindersState {
  items: CarerReminderItem[];
  pinnedStripVisible: boolean;
  outingNote: string;
  updatedAtMs: number;
}

export const CARER_REMINDERS_STORAGE_KEY = 'jays_job_club_carer_reminders_v1';
export const CARER_REMINDERS_CHANGED_EVENT =
  'jaysjobclub:carer-reminders-changed';

export const DEFAULT_CARER_REMINDER_ITEMS: CarerReminderItem[] = [
  {
    id: 'carer_coats',
    category: 'coats',
    label: "Everyone's Coats & Weather Layers",
    detail:
      'Warm coats, waterproof jackets, hats, gloves, or sun layers checked for everyone going out.',
    shortTag: 'Coats',
    checked: false,
    isBuiltIn: true,
  },
  {
    id: 'carer_snacks',
    category: 'snacks',
    label: 'Snacks & Drinks',
    detail:
      'Safe preferred snacks, water bottles, and steady-energy comfort bites packed.',
    shortTag: 'Snacks',
    checked: false,
    isBuiltIn: true,
  },
  {
    id: 'carer_meds',
    category: 'meds',
    label: 'Meds & Health Essentials',
    detail:
      'Scheduled medications, inhalers, rescue meds, prescriptions, or medical alert cards.',
    shortTag: 'Meds',
    checked: false,
    isBuiltIn: true,
  },
  {
    id: 'carer_bags',
    category: 'bags',
    label: 'Bags, Keys & Sensory Kit',
    detail:
      'Day bags, ear defenders, comfort item, wipes, house keys, wallet, and charged phone.',
    shortTag: 'Bags',
    checked: false,
    isBuiltIn: true,
  },
  {
    id: 'carer_clothes',
    category: 'clothes',
    label: 'Changes of Clothes & Spare Footwear',
    detail:
      'Full spare outfit, socks, underwear, waterproof wet-bag, and comfortable spare shoes or wellies.',
    shortTag: 'Changes of Clothes',
    checked: false,
    isBuiltIn: true,
  },
];

export function buildDefaultCarerRemindersState(): CarerRemindersState {
  return {
    items: DEFAULT_CARER_REMINDER_ITEMS.map((item) => ({ ...item })),
    pinnedStripVisible: true,
    outingNote: '',
    updatedAtMs: Date.now(),
  };
}

export function loadCarerRemindersState(): CarerRemindersState {
  const fallback = buildDefaultCarerRemindersState();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(CARER_REMINDERS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CarerRemindersState>;
    const savedById = new Map<string, Partial<CarerReminderItem>>();
    if (Array.isArray(parsed.items)) {
      for (const it of parsed.items) {
        if (it && typeof it.id === 'string') {
          savedById.set(it.id, it);
        }
      }
    }

    // Ensure all 5 core carer reminders always exist in order
    const mergedItems: CarerReminderItem[] = DEFAULT_CARER_REMINDER_ITEMS.map(
      (def) => {
        const saved = savedById.get(def.id);
        return {
          ...def,
          checked: Boolean(saved?.checked),
        };
      }
    );

    // Append custom carer items (up to 12)
    if (Array.isArray(parsed.items)) {
      for (const it of parsed.items) {
        if (
          it &&
          !it.isBuiltIn &&
          typeof it.id === 'string' &&
          typeof it.label === 'string' &&
          it.label.trim().length >= 2 &&
          mergedItems.length < 17
        ) {
          const cleanLabel = it.label.trim().slice(0, 64);
          mergedItems.push({
            id: it.id,
            category: 'custom',
            label: cleanLabel,
            detail:
              typeof it.detail === 'string' && it.detail.trim()
                ? it.detail.trim().slice(0, 120)
                : 'Personal carer going-out reminder',
            shortTag: cleanLabel.slice(0, 22),
            checked: Boolean(it.checked),
            isBuiltIn: false,
          });
        }
      }
    }

    return {
      items: mergedItems,
      pinnedStripVisible:
        typeof parsed.pinnedStripVisible === 'boolean'
          ? parsed.pinnedStripVisible
          : true,
      outingNote:
        typeof parsed.outingNote === 'string'
          ? parsed.outingNote.slice(0, 120)
          : '',
      updatedAtMs:
        typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    };
  } catch {
    return fallback;
  }
}

export function saveCarerRemindersState(next: CarerRemindersState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CARER_REMINDERS_STORAGE_KEY,
      JSON.stringify({ ...next, updatedAtMs: Date.now() })
    );
    window.dispatchEvent(new CustomEvent(CARER_REMINDERS_CHANGED_EVENT));
  } catch {
    // Ignore local storage quota errors
  }
}

export function validateCustomCarerItem(rawLabel: string): {
  valid: boolean;
  cleanLabel: string;
  error?: string;
} {
  const cleanLabel = rawLabel.replace(/\s+/g, ' ').trim().slice(0, 64);
  if (cleanLabel.length < 2) {
    return {
      valid: false,
      cleanLabel,
      error: 'Please enter at least 2 characters for the reminder item.',
    };
  }
  const safety = screenForHarmToHumansOrAnimals(cleanLabel, 'carer-reminders');
  if (!safety.safe) {
    return {
      valid: false,
      cleanLabel,
      error: safety.reason || 'Please enter a safe household or outing item.',
    };
  }
  return { valid: true, cleanLabel };
}
