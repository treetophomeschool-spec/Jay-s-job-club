import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  doc,
  DocumentReference,
  DocumentSnapshot,
  getDoc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import blueprint from '../firebase-blueprint.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export type PostCategory =
  | 'Job Opportunity'
  | 'Collaboration Request'
  | 'Resource Share'
  | 'General Advice';

export type CanopyTradeFocus =
  | 'Woodcraft & Joinery'
  | 'Metalwork & Lanterns'
  | 'Textiles & Weaving'
  | 'Repair & Maker Tools'
  | 'Community Outreach';

export type CanopyFloorStyle =
  | 'interlocking_oak'
  | 'nonslip_slate'
  | 'cork_sanctuary'
  | 'herringbone_cedar';

export type CanopyTrimAccent =
  | 'warm_brass'
  | 'forged_iron'
  | 'forest_sage'
  | 'terracotta_clay';

export type JournalEntryType =
  | 'Special Interest Idea'
  | 'Working Paper & Notes'
  | 'Job Step Reflection'
  | 'Collab & Trade Plan';

export type ToolTradeCategory =
  | CanopyTradeFocus
  | 'Botanical & Essential Oils';

export type ToolVisualKind =
  | 'joinery_plane'
  | 'precision_calipers'
  | 'loom_shuttle'
  | 'soldering_iron_kit'
  | 'botanical_press'
  | 'outreach_compass_kit'
  | 'agarwood_alembic_still'
  | 'amber_bottling_kit';

export type BottleSaleVenue = 'welcome_area' | 'canopy' | 'both';
export type BottleSizeMl = 5 | 10 | 15 | 30;
export type BottleListingStatus = 'on_sale' | 'sold_out' | 'archived';

export interface CraftedBottleRecord {
  id: string;
  makerId: string;
  makerName: string;
  productTitle: string;
  labelHeadline: string;
  labelBatchNote: string;
  barkOriginAndProcess: string;
  bottleSizeMl: BottleSizeMl;
  saleVenue: BottleSaleVenue;
  pricePence: number;
  priceTokens: number;
  stockCount: number;
  status: BottleListingStatus;
  createdAtMs: number;
  source: 'cloud' | 'local';
}

export interface StowedToolRecord {
  id: string;
  ownerId: string;
  username: string;
  toolName: string;
  tradeCategory: ToolTradeCategory;
  visualKind: ToolVisualKind;
  showAndTellStory: string;
  isSharedShowAndTell: boolean;
  createdAtMs: number;
  source: 'cloud' | 'local';
}

export type CanopyFurnishingKind =
  | 'brass_hanging_lantern'
  | 'amber_floor_lantern'
  | 'starlight_garland'
  | 'cedar_reading_lamp'
  | 'woven_sanctuary_rug'
  | 'fern_planter_box';

export type ServiceProviderRole =
  | 'Pre-Crisis Intervention Counsellor'
  | 'Crisis Coaching Specialist'
  | 'Neurobiologically-Aware Skills & Trade Trainer';

export type ServiceSessionMode =
  | 'Live Collab Workbench'
  | 'Async Written Coaching'
  | 'Paced 1-on-1 Trade Bench';

export type ArtisanItemCategory =
  | 'Woodcraft & Joinery'
  | 'Metalwork & Lanterns'
  | 'Textiles & Weaving'
  | 'Sensory & Calm Tools';

export interface CanopyStudioConfig {
  studioName: string;
  tradeFocus: CanopyTradeFocus;
  floorStyle: CanopyFloorStyle;
  trimAccent: CanopyTrimAccent;
  safetyGateClosed: boolean;
  furnishedItems: CanopyFurnishingKind[];
}

export interface TreeProgressState {
  tryingTokens: number;
  gatheringTokens: number;
  treehouseTokens: number;
  ownedFurnishings: CanopyFurnishingKind[];
  sharesCompleted: number;
  welcomeCheckedIn: boolean;
  dailyStreak: number;
  bestStreak: number;
  lastStreakDate: string;
}

// Parse validation constants directly from firebase-blueprint.json for 100% synchronicity
const postProps = blueprint.entities.CommunityPost.properties;
const profileProps = blueprint.entities.PublicProfile.properties;
const studioProps = blueprint.entities.CanopyStudio.properties;
const journalProps = blueprint.entities.JournalEntry.properties;
const toolProps = blueprint.entities.ToolOfTrade.properties;
const storeProps = blueprint.entities.StoreListing.properties;
const providerProps = blueprint.entities.ServiceProvider.properties;
const artisanProps = blueprint.entities.ArtisanItem.properties;
const consentProps = blueprint.entities.PrivacyConsent.properties;
const treetopAppProps = blueprint.entities.TreetopApplication.properties;
const pgCertProps = blueprint.entities.PgCertNote.properties;
const workshopProps = blueprint.entities.CanopyWorkshop.properties;
const registrationProps = blueprint.entities.WorkshopRegistration.properties;
const pathwayProps = blueprint.entities.SpecialInterestPathway.properties;
const bottleProps = blueprint.entities.CraftedBottleListing.properties;
const canopyPaypalProps = blueprint.entities.CanopyPaypalItem.properties;
const shoeProfileProps = blueprint.entities.ShoeCharacterProfile.properties;
const chillPodProps = blueprint.entities.ChillPodState.properties;
const jobVacancyProps = blueprint.entities.JobCentreVacancy.properties;
const jobCollabProps = blueprint.entities.JobCentreCollaborator.properties;
const uxFeedbackProps = blueprint.entities.UxBetaFeedback.properties;
const dailyHabitProps = blueprint.entities.DailyHabitTracker.properties;
const bankLedgerProps = blueprint.entities.BankOfTreetopLedger.properties;

export const PUBLIC_BETA_URL =
  'https://ais-pre-x2jjy2m2n6xjpnnulwo4mi-601426882728.europe-west2.run.app';
export const DEV_PREVIEW_URL =
  'https://ais-dev-x2jjy2m2n6xjpnnulwo4mi-601426882728.europe-west2.run.app';

export type ChillPodDocId = 'pod_1' | 'pod_2' | 'pod_3' | 'pod_4';
export type ChillQuiltChoice = 'none' | 'vegan' | 'natural_duck_feather';

export interface ChillPodStateRecord {
  podId: ChillPodDocId;
  podLabel: string;
  occupantId: string;
  occupantName: string;
  occupancyStatus: 'vacant' | 'occupied';
  fanEnabled: boolean;
  heaterEnabled: boolean;
  lightsOffCalm: boolean;
  flotationEnabled: boolean;
  quiltType: ChillQuiltChoice;
  updatedAtMs: number;
  source: 'cloud' | 'local';
}

export const CHILL_POD_IDS = chillPodProps.podId.enum as ChillPodDocId[];
export const CHILL_QUILT_TYPES =
  chillPodProps.quiltType.enum as ChillQuiltChoice[];

export type JobVacancyTradeCategory =
  | 'Woodcraft & Joinery'
  | 'Metalwork & Lanterns'
  | 'Textiles & Weaving'
  | 'Repair & Maker Tools'
  | 'Digital & Systems Craft'
  | 'Botanical & Community Outreach'
  | 'Botanical & Essential Oils';

export type JobVacancyLocationZone =
  | '0m Courtyard Workbench'
  | '12m Ascent Relay'
  | '33m Canopy Workshop'
  | '33m Mezzanine Library & Refreshments'
  | 'Community Outreach Rota';

export type JobVacancyPacingStyle =
  | 'Self-Paced Solo'
  | 'Paired Quiet Bench'
  | 'Small Collab Crew (2-4)'
  | 'Flexible Drop-In';

export type JobCollaborationMode =
  | 'Solo or Optional Buddy'
  | 'Open Team-Up & Skill Swap'
  | 'Mentor + Apprentice Pair'
  | 'Shared Outreach Crew';

export interface JobCentreVacancyRecord {
  id: string;
  referenceCode: string;
  jobTitle: string;
  tradeCategory: JobVacancyTradeCategory;
  locationZone: JobVacancyLocationZone;
  pacingStyle: JobVacancyPacingStyle;
  cardSummary: string;
  keySteps: string;
  collaborationMode: JobCollaborationMode;
  collaborationOpen: boolean;
  rewardTokens: number;
  creatorId: string;
  creatorName: string;
  status: 'open' | 'filled' | 'archived';
  createdAtMs: number;
  source: 'cloud' | 'local' | 'curated';
}

export type JobCollaboratorRole =
  | 'Lead Maker'
  | 'Co-Maker Buddy'
  | 'Quiet Prep & Sorting'
  | 'Finishing & Labelling'
  | 'Outreach Helper';

export type JobCollaboratorStation =
  | 'Ground Courtyard'
  | 'Canopy Workbench'
  | 'Mezzanine Library Desk'
  | 'Async Written Notes';

export interface JobCentreCollaboratorRecord {
  id: string;
  vacancyId: string;
  memberId: string;
  memberName: string;
  collabRole: JobCollaboratorRole;
  pledgeNote: string;
  preferredStation: JobCollaboratorStation;
  status: 'active' | 'completed' | 'stepped_back';
  updatedAtMs: number;
  source: 'cloud' | 'local';
}

export const JOB_VACANCY_TRADES =
  jobVacancyProps.tradeCategory.enum as JobVacancyTradeCategory[];
export const JOB_VACANCY_ZONES =
  jobVacancyProps.locationZone.enum as JobVacancyLocationZone[];
export const JOB_VACANCY_PACING =
  jobVacancyProps.pacingStyle.enum as JobVacancyPacingStyle[];
export const JOB_COLLAB_MODES =
  jobVacancyProps.collaborationMode.enum as JobCollaborationMode[];
export const JOB_TITLE_MIN = jobVacancyProps.jobTitle.minLength;
export const JOB_TITLE_MAX = jobVacancyProps.jobTitle.maxLength;
export const JOB_SUMMARY_MIN = jobVacancyProps.cardSummary.minLength;
export const JOB_SUMMARY_MAX = jobVacancyProps.cardSummary.maxLength;
export const JOB_STEPS_MIN = jobVacancyProps.keySteps.minLength;
export const JOB_STEPS_MAX = jobVacancyProps.keySteps.maxLength;

export const JOB_COLLAB_ROLES =
  jobCollabProps.collabRole.enum as JobCollaboratorRole[];
export const JOB_COLLAB_STATIONS =
  jobCollabProps.preferredStation.enum as JobCollaboratorStation[];
export const JOB_PLEDGE_MIN = jobCollabProps.pledgeNote.minLength;
export const JOB_PLEDGE_MAX = jobCollabProps.pledgeNote.maxLength;

export type UxFeedbackFocusArea =
  | 'Overall Navigation & Readability'
  | 'Old-Style Job Centre & Collaboration'
  | 'Mezzanine Library & Refreshments'
  | 'Private Sensory Chill Pods'
  | 'Entry Kiosk & Canopy Lift';

export interface UxBetaFeedbackRecord {
  id: string;
  authorId: string;
  testerHandle: string;
  focusArea: UxFeedbackFocusArea;
  easeScore: number;
  workedWell: string;
  improvementIdea: string;
  createdAtMs: number;
  source: 'cloud' | 'local';
}

export const UX_FEEDBACK_AREAS =
  uxFeedbackProps.focusArea.enum as UxFeedbackFocusArea[];
export const UX_WORKED_WELL_MIN = uxFeedbackProps.workedWell.minLength;
export const UX_WORKED_WELL_MAX = uxFeedbackProps.workedWell.maxLength;
export const UX_IMPROVEMENT_MAX = uxFeedbackProps.improvementIdea.maxLength;

export type BuiltInHabitId =
  | 'focus_15m'
  | 'community_outreach'
  | 'job_slip_step'
  | 'skill_practice'
  | 'sensory_pacing';

export type CustomHabitSlotId =
  | 'custom_1'
  | 'custom_2'
  | 'custom_3'
  | 'custom_4'
  | 'custom_5';

export type DailyHabitId = BuiltInHabitId | CustomHabitSlotId;

export const HABIT_ID_ALLOWLIST: DailyHabitId[] = [
  'focus_15m',
  'community_outreach',
  'job_slip_step',
  'skill_practice',
  'sensory_pacing',
  'custom_1',
  'custom_2',
  'custom_3',
  'custom_4',
  'custom_5',
];

export const CUSTOM_HABIT_SLOTS: CustomHabitSlotId[] = [
  'custom_1',
  'custom_2',
  'custom_3',
  'custom_4',
  'custom_5',
];

export const HABIT_ACTIVE_DATE_REGEX = new RegExp(
  dailyHabitProps.activeDate.pattern
);
export const HABIT_LAST_LABEL_MAX = dailyHabitProps.lastMilestoneLabel.maxLength;
export const HABIT_CUSTOM_LABEL_MIN = 2;
export const HABIT_CUSTOM_LABEL_MAX = 60;
export const MAX_HABIT_ENERGY = 99999;
export const MAX_LIFETIME_ENERGY = 999999;

export interface DailyHabitTrackerRecord {
  activeDate: string;
  energyPoints: number;
  lifetimeEnergyEarned: number;
  totalMilestonesLogged: number;
  dailyStreak: number;
  bestStreak: number;
  completedIdsToday: DailyHabitId[];
  customHabitLabels: string[];
  lastMilestoneLabel: string;
  lastLoggedDate: string;
  updatedAtMs: number;
  source: 'cloud' | 'local';
}

export type BankStockBundleId =
  | 'stock_cedar_joinery'
  | 'stock_agarwood_vials'
  | 'stock_drazella_publishing'
  | 'stock_brass_lanterns'
  | 'stock_plant_dyed_wool'
  | 'stock_custom_interest';

export const BANK_STOCK_BUNDLE_IDS =
  bankLedgerProps.selectedBundleId.enum as BankStockBundleId[];
export const BANK_CUSTOM_GOAL_MAX = bankLedgerProps.customInterestGoal.maxLength;
export const BANK_MAX_SAVED_UNITS = 9999;
export const BANK_MAX_LIFETIME_UNITS = 99999;

export interface BankOfTreetopLedgerRecord {
  selectedBundleId: BankStockBundleId;
  customInterestGoal: string;
  savedUnits: number;
  lifetimeUnitsSaved: number;
  bundlesRequisitioned: number;
  exchequerChecksLogged: number;
  disclaimerAccepted: boolean;
  updatedAtMs: number;
  source: 'cloud' | 'local';
}

export type CanopyPaypalItemStatus = 'active' | 'sold_out' | 'archived';

export interface CanopyPaypalItemRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  tradeCategory: ToolTradeCategory;
  materialsSpec: string;
  craftStory: string;
  sellerBenchTag: string;
  priceCents: number;
  stockCount: number;
  status: CanopyPaypalItemStatus;
  createdAtMs: number;
  source: 'cloud' | 'local' | 'curated';
}

export const CANOPY_PAYPAL_CATEGORIES =
  canopyPaypalProps.tradeCategory.enum as ToolTradeCategory[];
export const CANOPY_PAYPAL_TITLE_MIN = canopyPaypalProps.title.minLength;
export const CANOPY_PAYPAL_TITLE_MAX = canopyPaypalProps.title.maxLength;
export const CANOPY_PAYPAL_SPEC_MIN = canopyPaypalProps.materialsSpec.minLength;
export const CANOPY_PAYPAL_SPEC_MAX = canopyPaypalProps.materialsSpec.maxLength;
export const CANOPY_PAYPAL_STORY_MIN = canopyPaypalProps.craftStory.minLength;
export const CANOPY_PAYPAL_STORY_MAX = canopyPaypalProps.craftStory.maxLength;
export const CANOPY_PAYPAL_TAG_MAX = canopyPaypalProps.sellerBenchTag.maxLength;
export const CANOPY_PAYPAL_MIN_PRICE_CENTS = 300;
export const CANOPY_PAYPAL_MAX_PRICE_CENTS = 250000;
export const CANOPY_PAYPAL_MAX_STOCK = 100;

export const SHOE_NICKNAME_MIN_LENGTH =
  shoeProfileProps.characterNickname.minLength;
export const SHOE_NICKNAME_MAX_LENGTH =
  shoeProfileProps.characterNickname.maxLength;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'treetophomeschool@gmail.com';

export type TreetopTradeTrack =
  | 'Woodcraft & Joinery'
  | 'Metalwork & Lanterns'
  | 'Textiles & Weaving'
  | 'Repair & Maker Tools'
  | 'Digital & Systems Craft'
  | 'Botanical & Community Outreach';

export type SupervisionContextKind =
  | 'Competent Adult (18+)'
  | 'With Parent Approval'
  | 'With Carer Approval'
  | 'With Competent Adult Supporter';

export type TreetopApplicationStatus = 'pending' | 'approved' | 'declined';

export type PathwayReadinessStage =
  | 'Exploring Curiosity'
  | 'Practicing Craft'
  | 'Ready for Trade Rota'
  | 'Active Job Step';

export interface SpecialInterestPathwayRecord {
  id: string;
  uid: string;
  entrantHandle: string;
  specialInterest: string;
  potentialJobRole: string;
  tradeTrack: TreetopTradeTrack;
  comfortableNextStep: string;
  readinessStage: PathwayReadinessStage;
  createdAtMs: number;
  source: 'cloud' | 'local';
}

export interface TreetopApplicationState {
  applicantId: string;
  displayName: string;
  specialInterestJourney: string;
  preferredTradeTrack: TreetopTradeTrack;
  supervisionContext: SupervisionContextKind;
  status: TreetopApplicationStatus;
  treetopTokenGranted: boolean;
  tokenCode: string;
  adminNote: string;
}

export type PgCertModuleTheme =
  | 'Monotropism & Special Interest Flow'
  | 'Double Empathy & Peer Belonging'
  | 'Autistic Burnout & Sensory Pacing'
  | 'Predictable Environments & Co-Regulation'
  | 'Safeguarding & Supported Decision-Making';

export type OverflowPlatformKind =
  | 'Canopy Only (No External Overflow)'
  | 'Zoom Supervised Meet-Up'
  | 'Facebook Moderated Craft Group'
  | 'Other Moderated Social Media';

export type AdultApprovalKind =
  | 'Not Requesting External Overflow'
  | 'Self (Competent Adult 18+)'
  | 'Parent Approval Confirmed'
  | 'Carer Approval Confirmed'
  | 'Competent Adult Supporter Confirmed';

export const TREETOP_TRADE_TRACKS =
  treetopAppProps.preferredTradeTrack.enum as TreetopTradeTrack[];
export const SUPERVISION_CONTEXTS =
  treetopAppProps.supervisionContext.enum as SupervisionContextKind[];
export const JOURNEY_MIN_LENGTH =
  treetopAppProps.specialInterestJourney.minLength;
export const JOURNEY_MAX_LENGTH =
  treetopAppProps.specialInterestJourney.maxLength;
export const TOKEN_CODE_REGEX = new RegExp(treetopAppProps.tokenCode.pattern);

export const PATHWAY_READINESS_STAGES =
  pathwayProps.readinessStage.enum as PathwayReadinessStage[];
export const SPECIAL_INTEREST_MIN_LENGTH =
  pathwayProps.specialInterest.minLength;
export const SPECIAL_INTEREST_MAX_LENGTH =
  pathwayProps.specialInterest.maxLength;
export const POTENTIAL_JOB_MIN_LENGTH =
  pathwayProps.potentialJobRole.minLength;
export const POTENTIAL_JOB_MAX_LENGTH =
  pathwayProps.potentialJobRole.maxLength;
export const NEXT_STEP_MAX_LENGTH =
  pathwayProps.comfortableNextStep.maxLength;

export const PG_CERT_MODULE_THEMES =
  pgCertProps.moduleTheme.enum as PgCertModuleTheme[];
export const OVERFLOW_PLATFORMS =
  workshopProps.overflowPlatform.enum as OverflowPlatformKind[];
export const ADULT_APPROVAL_TYPES =
  registrationProps.adultApprovalType.enum as AdultApprovalKind[];

export const POLICY_VERSION_MIN_LENGTH = consentProps.policyVersion.minLength;
export const POLICY_VERSION_MAX_LENGTH = consentProps.policyVersion.maxLength;

export const POST_CATEGORIES = postProps.category.enum as PostCategory[];
export const USERNAME_MIN_LENGTH = profileProps.username.minLength;
export const USERNAME_MAX_LENGTH = profileProps.username.maxLength;
export const TITLE_MIN_LENGTH = postProps.title.minLength;
export const TITLE_MAX_LENGTH = postProps.title.maxLength;
export const MESSAGE_MIN_LENGTH = postProps.message.minLength;
export const MESSAGE_MAX_LENGTH = postProps.message.maxLength;
export const VALID_DOC_ID_REGEX = new RegExp(postProps.authorId.pattern);

export const STUDIO_NAME_MIN_LENGTH = studioProps.studioName.minLength;
export const STUDIO_NAME_MAX_LENGTH = studioProps.studioName.maxLength;
export const CANOPY_TRADE_FOCUSES =
  studioProps.tradeFocus.enum as CanopyTradeFocus[];
export const CANOPY_FLOOR_STYLES =
  studioProps.floorStyle.enum as CanopyFloorStyle[];
export const CANOPY_TRIM_ACCENTS =
  studioProps.trimAccent.enum as CanopyTrimAccent[];

export const JOURNAL_ENTRY_TYPES =
  journalProps.entryType.enum as JournalEntryType[];
export const JOURNAL_TITLE_MIN_LENGTH = journalProps.title.minLength;
export const JOURNAL_TITLE_MAX_LENGTH = journalProps.title.maxLength;
export const JOURNAL_CONTENT_MIN_LENGTH = journalProps.content.minLength;
export const JOURNAL_CONTENT_MAX_LENGTH = journalProps.content.maxLength;

export const TOOL_NAME_MIN_LENGTH = toolProps.toolName.minLength;
export const TOOL_NAME_MAX_LENGTH = toolProps.toolName.maxLength;
export const TOOL_STORY_MIN_LENGTH = toolProps.showAndTellStory.minLength;
export const TOOL_STORY_MAX_LENGTH = toolProps.showAndTellStory.maxLength;
export const TOOL_TRADE_CATEGORIES =
  toolProps.tradeCategory.enum as ToolTradeCategory[];
export const TOOL_VISUAL_KINDS = toolProps.visualKind.enum as ToolVisualKind[];

export const BOTTLE_TITLE_MIN_LENGTH = bottleProps.productTitle.minLength;
export const BOTTLE_TITLE_MAX_LENGTH = bottleProps.productTitle.maxLength;
export const BOTTLE_HEADLINE_MIN_LENGTH = bottleProps.labelHeadline.minLength;
export const BOTTLE_HEADLINE_MAX_LENGTH = bottleProps.labelHeadline.maxLength;
export const BOTTLE_BATCH_MIN_LENGTH = bottleProps.labelBatchNote.minLength;
export const BOTTLE_BATCH_MAX_LENGTH = bottleProps.labelBatchNote.maxLength;
export const BOTTLE_PROCESS_MIN_LENGTH =
  bottleProps.barkOriginAndProcess.minLength;
export const BOTTLE_PROCESS_MAX_LENGTH =
  bottleProps.barkOriginAndProcess.maxLength;
export const BOTTLE_SALE_VENUES =
  bottleProps.saleVenue.enum as BottleSaleVenue[];
export const BOTTLE_SIZES_ML: BottleSizeMl[] = [5, 10, 15, 30];
export const BOTTLE_PRICE_MIN_PENCE = 300;
export const BOTTLE_PRICE_MAX_PENCE = 50000;
export const BOTTLE_PRICE_MIN_TOKENS = 1;
export const BOTTLE_PRICE_MAX_TOKENS = 50;
export const BOTTLE_MAX_STOCK = 50;

export const CANOPY_FURNISHING_KINDS =
  storeProps.itemKind.enum as CanopyFurnishingKind[];
export const STORE_TITLE_MIN_LENGTH = storeProps.title.minLength;
export const STORE_TITLE_MAX_LENGTH = storeProps.title.maxLength;
export const STORE_NOTE_MIN_LENGTH = storeProps.craftNote.minLength;
export const STORE_NOTE_MAX_LENGTH = storeProps.craftNote.maxLength;
export const STORE_PRICE_MIN = 1;
export const STORE_PRICE_MAX = 50;

export const SERVICE_PROVIDER_ROLES =
  providerProps.providerRole.enum as ServiceProviderRole[];
export const SERVICE_SESSION_MODES =
  providerProps.sessionMode.enum as ServiceSessionMode[];
export const PROVIDER_NAME_MIN_LENGTH = providerProps.displayName.minLength;
export const PROVIDER_NAME_MAX_LENGTH = providerProps.displayName.maxLength;
export const PROVIDER_SUMMARY_MIN_LENGTH =
  providerProps.specialtySummary.minLength;
export const PROVIDER_SUMMARY_MAX_LENGTH =
  providerProps.specialtySummary.maxLength;
export const PROVIDER_ACCOM_MIN_LENGTH =
  providerProps.neuroAccommodations.minLength;
export const PROVIDER_ACCOM_MAX_LENGTH =
  providerProps.neuroAccommodations.maxLength;
export const PROVIDER_ACCOMMODATIONS_MIN_LENGTH = PROVIDER_ACCOM_MIN_LENGTH;
export const PROVIDER_ACCOMMODATIONS_MAX_LENGTH = PROVIDER_ACCOM_MAX_LENGTH;

export const ARTISAN_ITEM_CATEGORIES =
  artisanProps.category.enum as ArtisanItemCategory[];
export const ARTISAN_TITLE_MIN_LENGTH = artisanProps.title.minLength;
export const ARTISAN_TITLE_MAX_LENGTH = artisanProps.title.maxLength;
export const ARTISAN_SPECS_MIN_LENGTH =
  artisanProps.materialsAndDimensions.minLength;
export const ARTISAN_SPECS_MAX_LENGTH =
  artisanProps.materialsAndDimensions.maxLength;
export const ARTISAN_MATERIALS_MIN_LENGTH = ARTISAN_SPECS_MIN_LENGTH;
export const ARTISAN_MATERIALS_MAX_LENGTH = ARTISAN_SPECS_MAX_LENGTH;
export const ARTISAN_STORY_MIN_LENGTH = artisanProps.story.minLength;
export const ARTISAN_STORY_MAX_LENGTH = artisanProps.story.maxLength;
export const ARTISAN_PRICE_MIN_CENTS = 300;
export const ARTISAN_PRICE_MAX_CENTS = 250000;
export const MIN_ARTISAN_PRICE_CENTS = ARTISAN_PRICE_MIN_CENTS;
export const MAX_ARTISAN_PRICE_CENTS = ARTISAN_PRICE_MAX_CENTS;
export const MAX_ARTISAN_STOCK = 100;

export const MAX_TOKEN_COUNT = 99999;

export interface ToolVisualSpec {
  kind: ToolVisualKind;
  label: string;
  slotNote: string;
  defaultCategory: ToolTradeCategory;
}

export const TOOL_VISUAL_CATALOG: Record<ToolVisualKind, ToolVisualSpec> = {
  agarwood_alembic_still: {
    kind: 'agarwood_alembic_still',
    label: 'Copper Agarwood Bark Hydro-Still',
    slotNote:
      'Canopy Bench Slot · Hammered copper alembic still & bark rasp for distilling Agarwood essential oil',
    defaultCategory: 'Botanical & Essential Oils',
  },
  amber_bottling_kit: {
    kind: 'amber_bottling_kit',
    label: 'Amber Dropper Bottling & Label Kit',
    slotNote:
      'Canopy Bench Slot · UV-protective amber glass dropper vials, brass funnel & high-contrast label press',
    defaultCategory: 'Botanical & Essential Oils',
  },
  joinery_plane: {
    kind: 'joinery_plane',
    label: 'Cedar Smoothing Plane',
    slotNote: 'Top-left peg · Handled timber plane with brass frog',
    defaultCategory: 'Woodcraft & Joinery',
  },
  precision_calipers: {
    kind: 'precision_calipers',
    label: 'Brass Vernier Calipers',
    slotNote: 'Top-center peg · Precision layout & measurement calipers',
    defaultCategory: 'Metalwork & Lanterns',
  },
  loom_shuttle: {
    kind: 'loom_shuttle',
    label: 'Hardwood Weaving Shuttle',
    slotNote: 'Top-right peg · Carved boat shuttle wound with dyed wool',
    defaultCategory: 'Textiles & Weaving',
  },
  soldering_iron_kit: {
    kind: 'soldering_iron_kit',
    label: 'Low-Volt Bench Repair Iron',
    slotNote: 'Lower-left shelf · Insulated electronics & lantern repair kit',
    defaultCategory: 'Repair & Maker Tools',
  },
  botanical_press: {
    kind: 'botanical_press',
    label: 'Seed & Herbarium Press',
    slotNote: 'Lower-center shelf · Strapped cedar botanical & paper press',
    defaultCategory: 'Community Outreach',
  },
  outreach_compass_kit: {
    kind: 'outreach_compass_kit',
    label: 'Wayfinding Compass & Field Kit',
    slotNote: 'Lower-right shelf · Brass trail compass & outreach notebook',
    defaultCategory: 'Community Outreach',
  },
};

export interface CanopyFurnishingSpec {
  kind: CanopyFurnishingKind;
  label: string;
  placementNote: string;
  coopSupplyPrice: number;
  craftSummary: string;
}

export const CANOPY_FURNISHING_CATALOG: Record<
  CanopyFurnishingKind,
  CanopyFurnishingSpec
> = {
  brass_hanging_lantern: {
    kind: 'brass_hanging_lantern',
    label: 'Spun Brass Rafter Lantern',
    placementNote: 'Hangs from main Canopy beam · Casts warm golden light',
    coopSupplyPrice: 3,
    craftSummary: 'Hand-spun brass dome with frosted amber glass cylinder.',
  },
  amber_floor_lantern: {
    kind: 'amber_floor_lantern',
    label: 'Amber Timber Floor Lantern',
    placementNote: 'Stands beside front balustrade · Grounded warm beacon',
    coopSupplyPrice: 3,
    craftSummary: 'Mortised cedar post lantern with warm storm-proof lens.',
  },
  starlight_garland: {
    kind: 'starlight_garland',
    label: 'Eave String Lantern Garland',
    placementNote: 'Drapes across interior rafters · Soft overhead festoon',
    coopSupplyPrice: 4,
    craftSummary: 'Low-voltage warm glass bulbs strung along braided hemp.',
  },
  cedar_reading_lamp: {
    kind: 'cedar_reading_lamp',
    label: 'Articulated Cedar Bench Lamp',
    placementNote: 'Illuminates the Show & Tell rack and Personal Trade bench',
    coopSupplyPrice: 2,
    craftSummary: 'Pivoting cedar arm with brass shade for close craft work.',
  },
  woven_sanctuary_rug: {
    kind: 'woven_sanctuary_rug',
    label: 'Hand-Loomed Sanctuary Rug',
    placementNote: 'Laid flat over non-slip Canopy deck · Acoustic warmth',
    coopSupplyPrice: 3,
    craftSummary: 'Plant-dyed wool runner with non-curling bound edges.',
  },
  fern_planter_box: {
    kind: 'fern_planter_box',
    label: 'Woodland Fern & Pollinator Box',
    placementNote: 'Rests along right balustrade · Humane native greenery',
    coopSupplyPrice: 2,
    craftSummary: 'Untreated aromatic cedar trough with living woodland ferns.',
  },
};

export const DEFAULT_CANOPY_STUDIO: CanopyStudioConfig = {
  studioName: 'Canopy Trade Bench',
  tradeFocus: 'Woodcraft & Joinery',
  floorStyle: 'interlocking_oak',
  trimAccent: 'warm_brass',
  safetyGateClosed: true,
  furnishedItems: [],
};

export const DEFAULT_TREE_PROGRESS: TreeProgressState = {
  tryingTokens: 0,
  gatheringTokens: 0,
  treehouseTokens: 2,
  ownedFurnishings: [],
  sharesCompleted: 0,
  welcomeCheckedIn: false,
  dailyStreak: 0,
  bestStreak: 0,
  lastStreakDate: '',
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isQuotaExceededError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('Quota exceeded');
}

export function isAuthTokenServiceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return (
    msg.includes('token-service-api-has-not-been-used') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('auth/user-token-expired') ||
    msg.includes('auth/invalid-user-token') ||
    code === 'auth/user-token-expired' ||
    code === 'auth/invalid-user-token'
  );
}

export function isTransientOfflineOrTokenError(error: unknown): boolean {
  if (isAuthTokenServiceError(error)) return true;
  const msg = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return (
    msg.includes('the client is offline') ||
    msg.includes('client is offline') ||
    msg.includes('Failed to get document') ||
    msg.includes('network-request-failed') ||
    code === 'unavailable' ||
    code === 'auth/network-request-failed'
  );
}

/**
 * Awaits a Firestore write up to `timeoutMs`. If the client is offline or
 * reconnecting, Firestore queues the write locally while this resolves with
 * `{ settled: false }` so UI forms never hang indefinitely. Permission or
 * validation errors still reject immediately and propagate to `handleFirestoreError`.
 */
export async function withCloudWriteTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 2400
): Promise<{ settled: boolean }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const writePromise = promise.then(
    () => ({ settled: true }),
    (err) => {
      if (isTransientOfflineOrTokenError(err) || isQuotaExceededError(err)) {
        return { settled: false };
      }
      throw err;
    }
  );
  // Prevent unhandled rejection if timeout wins the race on a slow mobile connection
  void writePromise.catch(() => {});

  try {
    const result = await Promise.race([
      writePromise,
      new Promise<{ settled: boolean }>((resolve) => {
        timer = setTimeout(() => resolve({ settled: false }), timeoutMs);
      }),
    ]);
    return result;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

/**
 * Reads a Firestore document up to `timeoutMs`. If the client is offline or
 * reconnecting, resolves `{ snap: null, timedOut: true }` instead of stalling
 * UI buttons for 10+ seconds. Real permission errors still propagate.
 */
export async function getDocWithTimeout<T>(
  ref: DocumentReference<T>,
  timeoutMs = 1800
): Promise<{ snap: DocumentSnapshot<T> | null; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const readPromise = getDoc(ref).then(
    (snap) => ({ snap, timedOut: false as const }),
    (err) => {
      if (isTransientOfflineOrTokenError(err) || isQuotaExceededError(err)) {
        return { snap: null, timedOut: true as const };
      }
      throw err;
    }
  );
  // Prevent unhandled rejection if timeout wins the race
  void readPromise.catch(() => {});

  try {
    return await Promise.race([
      readPromise,
      new Promise<{ snap: null; timedOut: true }>((resolve) => {
        timer = setTimeout(
          () => resolve({ snap: null, timedOut: true }),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

let safeCurrentUser: User | null = null;
let authSessionNotice: string | null = null;
let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let authValidationSeq = 0;
const safeAuthListeners = new Set<(user: User | null) => void>();

let resolveInitialAuthGate: (() => void) | null = null;
const initialAuthGatePromise = new Promise<void>((resolve) => {
  resolveInitialAuthGate = resolve;
});

function notifySafeAuthListeners(nextUser: User | null): void {
  safeCurrentUser = nextUser;
  if (resolveInitialAuthGate) {
    const done = resolveInitialAuthGate;
    resolveInitialAuthGate = null;
    done();
  }
  for (const listener of safeAuthListeners) {
    listener(nextUser);
  }
}

function clearTokenRefreshTimer(): void {
  if (tokenRefreshTimer !== null) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
}

function scheduleProactiveTokenCheck(user: User, seq: number): void {
  clearTokenRefreshTimer();
  void user
    .getIdTokenResult()
    .then((tokenResult) => {
      if (seq !== authValidationSeq) return;
      const expiryMs = Date.parse(tokenResult.expirationTime);
      if (!Number.isFinite(expiryMs)) return;
      const delayMs = Math.max(10_000, expiryMs - Date.now() - 90_000);
      tokenRefreshTimer = setTimeout(() => {
        void user.getIdToken(true).then(
          () => {
            if (seq === authValidationSeq && auth.currentUser?.uid === user.uid) {
              scheduleProactiveTokenCheck(user, seq);
            }
          },
          async (refreshErr) => {
            if (isAuthTokenServiceError(refreshErr)) {
              authSessionNotice =
                'Your 1-hour Google cloud session expired while Token Service API (securetoken.googleapis.com) is disabled on this project. Sign in again anytime to sync to the cloud — local saving stays active.';
              notifySafeAuthListeners(null);
              try {
                await signOut(auth);
              } catch {
                // Ignore sign-out cleanup errors
              }
            }
          }
        );
      }, delayMs);
    })
    .catch(() => {
      // Ignore metadata inspection errors
    });
}

onAuthStateChanged(auth, (rawUser) => {
  const seq = ++authValidationSeq;
  clearTokenRefreshTimer();

  if (!rawUser) {
    notifySafeAuthListeners(null);
    return;
  }

  void rawUser
    .getIdToken()
    .then(() => {
      if (seq !== authValidationSeq) return;
      authSessionNotice = null;
      scheduleProactiveTokenCheck(rawUser, seq);
      notifySafeAuthListeners(rawUser);
    })
    .catch(async (err) => {
      if (seq !== authValidationSeq) return;
      if (isAuthTokenServiceError(err)) {
        authSessionNotice =
          'Your previous Google session expired while Token Service API (securetoken.googleapis.com) is disabled on this project. Click Sign In with Google for a fresh session, or continue saving locally.';
        notifySafeAuthListeners(null);
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out cleanup errors
        }
        return;
      }
      notifySafeAuthListeners(null);
    });
});

export function getSafeCurrentUser(): User | null {
  return safeCurrentUser;
}

export function getAuthSessionNotice(): string | null {
  return authSessionNotice;
}

export function subscribeSafeAuth(
  listener: (user: User | null) => void
): () => void {
  safeAuthListeners.add(listener);
  listener(safeCurrentUser);
  return () => {
    safeAuthListeners.delete(listener);
  };
}

// Validate connection to Firestore on application boot after auth token gate resolves
async function testConnection(): Promise<void> {
  try {
    await initialAuthGatePromise;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline') &&
      !isAuthTokenServiceError(error) &&
      (typeof navigator === 'undefined' || navigator.onLine !== false)
    ) {
      console.warn('Firestore operating in local offline sanctuary cache mode.');
    }
  }
}

void testConnection();
