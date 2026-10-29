/**
 * Ethical & Humane Idea Guard + Tree 'Boots on Ground' Censor for Jay's Job Club.
 *
 * 1. Blocks ideas, tools, or listings representing harm, cruelty, violence,
 *    or exploitation toward humans or animals.
 * 2. Enforces the Tree 'Boots on Ground' Censor across the Job Board and shared spaces:
 *    blocks rude words, profanity, slurs, personal insults, and unsuitable listings.
 * 3. Evaluates sound, constructive, and ethical ideas to award Treehouse Tokens
 *    reliably—even for concise, practical everyday ideas.
 */

export interface SafetyScreenResult {
  safe: boolean;
  reason?: string;
}

export type BootsCensorCategory =
  | 'clean'
  | 'rude_language'
  | 'unsuitable_listing'
  | 'harm_safety';

export interface BootsOnGroundVerdict {
  allowed: boolean;
  category: BootsCensorCategory;
  reason?: string;
  flaggedTerms: string[];
  maskedPreview: string;
}

export interface EthicalIdeaVerdict {
  isHarmful: boolean;
  isSoundAndEthical: boolean;
  tokensAwarded: number;
  feedback: string;
  pillars: string[];
}

export interface WorkshopDebugEvent {
  id: string;
  timestampMs: number;
  kind: 'boots_censor' | 'ethical_tokens' | 'safety_guard' | 'system';
  source: string;
  allowed: boolean;
  summary: string;
  detail?: string;
}

const MAX_DEBUG_EVENTS = 60;
const debugEvents: WorkshopDebugEvent[] = [];
const debugListeners = new Set<() => void>();

export function recordDebugEvent(
  event: Omit<WorkshopDebugEvent, 'id' | 'timestampMs'>
): void {
  const entry: WorkshopDebugEvent = {
    ...event,
    id: `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestampMs: Date.now(),
  };
  debugEvents.unshift(entry);
  if (debugEvents.length > MAX_DEBUG_EVENTS) {
    debugEvents.pop();
  }
  for (const listener of debugListeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function getDebugEvents(): WorkshopDebugEvent[] {
  return [...debugEvents];
}

export function clearDebugEvents(): void {
  debugEvents.length = 0;
  for (const listener of debugListeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function subscribeDebugEvents(listener: () => void): () => void {
  debugListeners.add(listener);
  return () => {
    debugListeners.delete(listener);
  };
}

// Whole-word / phrase patterns indicating harm to humans or animals
const HARM_PATTERNS: { pattern: RegExp; category: string }[] = [
  {
    pattern:
      /\b(kill|killing|murder|assault|torture|maim|stab|shoot|strangle|poison|poisoning|slaughter|massacre|bomb|explosive|weapon|weapons|firearm|gunpowder|landmine|biohazard|toxin)\b/i,
    category: 'violence, weapons, or physical harm',
  },
  {
    pattern:
      /\b(animal\s+cruelty|hurt\s+animals?|harm\s+animals?|abuse\s+animals?|poach|poaching|glue\s+trap|leg\s+trap|snare\s+trap|bear\s+trap|trophy\s+hunt|dogfight|cockfight|exterminate\s+wildlife|pest\s+poison|rodenticide)\b/i,
    category: 'harm or cruelty toward animals',
  },
  {
    pattern:
      /\b(hurt\s+people|harm\s+humans?|exploit\s+workers|sweatshop|forced\s+labor|child\s+labor|scam|defraud|extort|harass|bully|stalk|doxx|hate\s+speech|self[-\s]?harm|suicide)\b/i,
    category: 'harm, exploitation, or abuse toward people',
  },
];

// Tree 'Boots on Ground' rude language, profanity, insults & unsuitable Job Board patterns
const RUDE_WORD_PATTERNS: { regex: RegExp; label: string }[] = [
  {
    regex:
      /\b(fuck|fucking|fucked|fucker|motherfucker|shit|shitty|bullshit|bitch|bitches|bastard|asshole|arsehole|dickhead|prick|cunt|twat|wanker|bollocks|bugger|slut|whore|piss\s*off|damn\s+you|screw\s+you|stfu|gtfo)\b/gi,
    label: 'profanity / rude language',
  },
  {
    regex:
      /\b(idiot|idiots|moron|morons|stupid\s+people|dumbass|jackass|loser|losers|scumbag|trash\s+human|worthless|shut\s+up|pathetic\s+fool|creep|weirdo)\b/gi,
    label: 'personal insult / disrespectful tone',
  },
];

const UNSUITABLE_BOARD_PATTERNS: { regex: RegExp; label: string }[] = [
  {
    regex:
      /\b(adult\s+only|nsfw|xxx|porn|pornography|escort\s+service|strip\s+club|gambling\s+ring|casino\s+betting|illegal\s+drugs|buy\s+weed|cocaine|meth|stolen\s+goods)\b/gi,
    label: 'unsuitable / age-inappropriate content',
  },
  {
    regex:
      /\b(pyramid\s+scheme|ponzi|get\s+rich\s+quick|wire\s+transfer\s+upfront|crypto\s+pump|unpaid\s+trial\s+shift|cash\s+in\s+hand\s+no\s+questions|mlm\s+recruit)\b/gi,
    label: 'exploitative or scam job listing',
  },
];

function normalizeObfuscatedText(input: string): string {
  return input
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/([a-zA-Z])\*(?=[a-zA-Z])/g, '$1u');
}

const CONSTRUCTIVE_PILLARS: { pattern: RegExp; label: string }[] = [
  {
    pattern:
      /\b(community|neighbor|neighbour|accessible|inclusive|welcome|welcoming|share|sharing|teach|teaching|mentor|mentoring|outreach|library|school|elder|elders|shelter|accessibility|mutual|kind|kindness|calm|safe|support|help|helping|club|pack| tea |drink|gather)\b/i,
    label: 'Community & Shared Skill',
  },
  {
    pattern:
      /\b(repair|mend|mending|reclaim|reclaimed|recycle|recycled|upcycle|sustainable|solar|timber|cedar|cork|wool|beeswax|durable|non-toxic|low-waste|refill|reuse|compost|garden|planter|herb|book|story|read)\b/i,
    label: 'Sustainable Craft & Stewardship',
  },
  {
    pattern:
      /\b(humane|bird|birds|pollinator|bee|bees|wildlife|sanctuary|habitat|gentle|ethical|fair|respectful|tree|nature|woodland|park|hedge)\b/i,
    label: 'Humane & Nature-Safe Care',
  },
  {
    pattern:
      /\b(build|craft|carve|weave|sew|knit|lantern|joinery|bench|tool|workshop|fix|paint|design|bake|cook|grow|music|coding|organise|organize)\b/i,
    label: 'Practical Workshop Trade',
  },
];

function hasMeaningfulProse(text: string, minWords: number): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 4) return false;
  const words = cleaned
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]{2,}/.test(w));
  return words.length >= minWords;
}

/**
 * Screens any workshop text for harm to humans or animals.
 */
export function screenForHarmToHumansOrAnimals(
  rawText: string,
  source = 'workshop'
): SafetyScreenResult {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  const deobfuscated = normalizeObfuscatedText(normalized);

  for (const rule of HARM_PATTERNS) {
    if (rule.pattern.test(normalized) || rule.pattern.test(deobfuscated)) {
      const reason = `Treehouse Charter Guard: Content involving ${rule.category} is not permitted. Jay's Job Club only supports humane, safe, and constructive work for people and animals.`;
      recordDebugEvent({
        kind: 'safety_guard',
        source,
        allowed: false,
        summary: `Blocked (${rule.category})`,
        detail: normalized.slice(0, 120),
      });
      return {
        safe: false,
        reason,
      };
    }
  }
  return { safe: true };
}

/**
 * Tree 'Boots on Ground' Censor:
 * Screens Job Board posts, usernames, mini-lectures, and community outreach notes
 * for rude language, insults, unsuitable themes, or harm.
 */
export function screenBootsOnGroundCensor(
  rawText: string,
  source = 'job-board',
  logCleanEvents = false
): BootsOnGroundVerdict {
  const trimmed = rawText.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return {
      allowed: true,
      category: 'clean',
      flaggedTerms: [],
      maskedPreview: '',
    };
  }

  // 1. Check harm to humans or animals first
  const harmCheck = screenForHarmToHumansOrAnimals(trimmed, source);
  if (!harmCheck.safe) {
    return {
      allowed: false,
      category: 'harm_safety',
      reason:
        harmCheck.reason ||
        "Tree 'Boots on Ground' Censor: Content involving harm to people or animals is blocked.",
      flaggedTerms: ['harm/safety policy'],
      maskedPreview: '[Held by Tree Boots on Ground Charter]',
    };
  }

  const deobfuscated = normalizeObfuscatedText(trimmed);
  const flaggedSet = new Set<string>();
  let masked = trimmed;
  let primaryCategory: BootsCensorCategory = 'clean';

  // 2. Check rude words & personal insults
  for (const rule of RUDE_WORD_PATTERNS) {
    rule.regex.lastIndex = 0;
    const directMatches = trimmed.match(rule.regex) || [];
    rule.regex.lastIndex = 0;
    const deobMatches = deobfuscated.match(rule.regex) || [];
    const allMatches = [...directMatches, ...deobMatches];
    if (allMatches.length > 0) {
      primaryCategory = 'rude_language';
      for (const m of allMatches) {
        flaggedSet.add(m.toLowerCase());
      }
      rule.regex.lastIndex = 0;
      masked = masked.replace(rule.regex, (match) =>
        match.length <= 2 ? '**' : `${match[0]}${'*'.repeat(match.length - 1)}`
      );
    }
  }

  // 3. Check unsuitable / exploitative Job Board content
  for (const rule of UNSUITABLE_BOARD_PATTERNS) {
    rule.regex.lastIndex = 0;
    const directMatches = trimmed.match(rule.regex) || [];
    rule.regex.lastIndex = 0;
    const deobMatches = deobfuscated.match(rule.regex) || [];
    const allMatches = [...directMatches, ...deobMatches];
    if (allMatches.length > 0) {
      if (primaryCategory === 'clean') {
        primaryCategory = 'unsuitable_listing';
      }
      for (const m of allMatches) {
        flaggedSet.add(m.toLowerCase());
      }
      rule.regex.lastIndex = 0;
      masked = masked.replace(rule.regex, '[unsuitable term]');
    }
  }

  if (primaryCategory !== 'clean') {
    const flaggedTerms = Array.from(flaggedSet).slice(0, 6);
    const reason =
      primaryCategory === 'rude_language'
        ? "Tree 'Boots on Ground' Censor: Rude words, swearing, or personal insults aren't allowed on the board. Please keep workshop notices welcoming and practical."
        : "Tree 'Boots on Ground' Censor: Unsuitable, adult, or exploitative job-board terms were detected. Please share genuine, fair community opportunities.";

    recordDebugEvent({
      kind: 'boots_censor',
      source,
      allowed: false,
      summary: `Held (${primaryCategory}): ${flaggedTerms.join(', ')}`,
      detail: masked.slice(0, 140),
    });

    return {
      allowed: false,
      category: primaryCategory,
      reason,
      flaggedTerms,
      maskedPreview: masked,
    };
  }

  if (logCleanEvents) {
    recordDebugEvent({
      kind: 'boots_censor',
      source,
      allowed: true,
      summary: 'Passed Boots on Ground check',
      detail: trimmed.slice(0, 120),
    });
  }

  return {
    allowed: true,
    category: 'clean',
    flaggedTerms: [],
    maskedPreview: trimmed,
  };
}

/**
 * Evaluates a player's trade or outreach idea for Treehouse Tokens.
 * Accepts concise, practical everyday ideas while blocking rude or harmful content.
 */
export function evaluateEthicalIdeaForTokens(
  title: string,
  description: string
): EthicalIdeaVerdict {
  const combined = `${title} ${description}`.trim();

  // Check both Harm Guard and Boots on Ground Censor
  const censor = screenBootsOnGroundCensor(combined, 'ethical-idea-bench');
  if (!censor.allowed) {
    return {
      isHarmful: true,
      isSoundAndEthical: false,
      tokensAwarded: 0,
      feedback:
        censor.reason ||
        'Blocked by the Treehouse Charter: Only respectful, humane, non-harmful ideas earn Treehouse Tokens.',
      pillars: [],
    };
  }

  const cleanTitle = title.trim();
  const cleanDesc = description.trim();

  if (cleanTitle.length < 2) {
    recordDebugEvent({
      kind: 'ethical_tokens',
      source: 'ethical-idea-bench',
      allowed: false,
      summary: 'Needs short title (2+ chars)',
      detail: combined.slice(0, 100),
    });
    return {
      isHarmful: false,
      isSoundAndEthical: false,
      tokensAwarded: 0,
      feedback:
        'Give your ethical idea a short title (at least 2 characters) so we can log it on the bench.',
      pillars: [],
    };
  }

  if (!hasMeaningfulProse(cleanDesc, 2) && !hasMeaningfulProse(combined, 3)) {
    recordDebugEvent({
      kind: 'ethical_tokens',
      source: 'ethical-idea-bench',
      allowed: false,
      summary: 'Needs a few descriptive words',
      detail: combined.slice(0, 100),
    });
    return {
      isHarmful: false,
      isSoundAndEthical: false,
      tokensAwarded: 0,
      feedback:
        'Add a few practical words explaining how your idea helps people, craft, or nature (e.g., "Repair bikes for local neighbours").',
      pillars: [],
    };
  }

  const pillars: string[] = [];
  for (const p of CONSTRUCTIVE_PILLARS) {
    if (p.pattern.test(combined)) {
      pillars.push(p.label);
    }
  }

  if (pillars.length === 0) {
    pillars.push('Practical Workshop Initiative');
  }

  const wordCount = combined.split(/\s+/).filter(Boolean).length;
  // Base +2 Treehouse Tokens for any sound, respectful idea; up to +4 for rich multi-pillar plans
  const bonus =
    pillars.length >= 3 || (pillars.length >= 2 && wordCount >= 18)
      ? 2
      : pillars.length >= 2 || wordCount >= 12
        ? 1
        : 0;
  const tokensAwarded = Math.min(4, 2 + bonus);

  const feedback = `Verified sound & ethical (${pillars.join(' · ')}) — awarded +${tokensAwarded} Treehouse Tokens!`;

  recordDebugEvent({
    kind: 'ethical_tokens',
    source: 'ethical-idea-bench',
    allowed: true,
    summary: `Verified +${tokensAwarded} Treehouse Tokens (${pillars.join(', ')})`,
    detail: `${cleanTitle}: ${cleanDesc.slice(0, 100)}`,
  });

  return {
    isHarmful: false,
    isSoundAndEthical: true,
    tokensAwarded,
    feedback,
    pillars,
  };
}
