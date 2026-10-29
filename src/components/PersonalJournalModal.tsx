import React, { useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowDownUp,
  BookOpen,
  CloudUpload,
  Edit3,
  LogIn,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  JOURNAL_CONTENT_MAX_LENGTH,
  JOURNAL_CONTENT_MIN_LENGTH,
  JOURNAL_ENTRY_TYPES,
  JOURNAL_TITLE_MAX_LENGTH,
  JOURNAL_TITLE_MIN_LENGTH,
  JournalEntryType,
  OperationType,
  VALID_DOC_ID_REGEX,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import { formatDualTimestamp } from '../utils/dualCalendar';
import { screenForHarmToHumansOrAnimals } from '../utils/ethicalGuard';

export interface JournalEntryRecord {
  id: string;
  title: string;
  content: string;
  entryType: JournalEntryType;
  createdAtMs: number;
  updatedAtMs: number;
  source: 'cloud' | 'local';
}

interface PersonalJournalModalProps {
  isOpen: boolean;
  user: User | null;
  authReady: boolean;
  onEntryCreated: (entryType: JournalEntryType) => void;
  onJournalActivity?: () => void;
  onSendToCollab?: (title: string, content: string) => void;
  onClose: () => void;
}

const LOCAL_JOURNAL_STORAGE_KEY = 'jays_job_club_personal_journal_v1';

function loadLocalJournalEntries(): JournalEntryRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_JOURNAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object'
      )
      .map((item, index) => {
        const rawType = String(item.entryType || '');
        const entryType: JournalEntryType = JOURNAL_ENTRY_TYPES.includes(
          rawType as JournalEntryType
        )
          ? (rawType as JournalEntryType)
          : 'Special Interest Idea';
        const createdAtMs =
          typeof item.createdAtMs === 'number' && Number.isFinite(item.createdAtMs)
            ? item.createdAtMs
            : Date.now() - index * 1000;
        const updatedAtMs =
          typeof item.updatedAtMs === 'number' && Number.isFinite(item.updatedAtMs)
            ? item.updatedAtMs
            : createdAtMs;
        return {
          id:
            typeof item.id === 'string' && VALID_DOC_ID_REGEX.test(item.id)
              ? item.id
              : `local_${createdAtMs}_${index}`,
          title: String(item.title || 'Untitled Note').slice(
            0,
            JOURNAL_TITLE_MAX_LENGTH
          ),
          content: String(item.content || '').slice(
            0,
            JOURNAL_CONTENT_MAX_LENGTH
          ),
          entryType,
          createdAtMs,
          updatedAtMs,
          source: 'local' as const,
        };
      });
  } catch {
    return [];
  }
}

function saveLocalJournalEntries(entries: JournalEntryRecord[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_JOURNAL_STORAGE_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // Ignore storage quota errors in restricted browsing contexts
  }
}

function formatJournalTimestamp(ms: number): string {
  if (!ms) return 'Just now';
  return formatDualTimestamp(ms);
}

export const PersonalJournalModal: React.FC<PersonalJournalModalProps> = ({
  isOpen,
  user,
  authReady,
  onEntryCreated,
  onJournalActivity,
  onSendToCollab,
  onClose,
}) => {
  const [localEntries, setLocalEntries] = useState<JournalEntryRecord[]>(() =>
    loadLocalJournalEntries()
  );
  const [cloudEntries, setCloudEntries] = useState<JournalEntryRecord[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Chronological order & filter controls
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [filterType, setFilterType] = useState<'ALL' | JournalEntryType>('ALL');

  // Composer / Edit state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntryRecord | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [entryType, setEntryType] = useState<JournalEntryType>(
    'Special Interest Idea'
  );
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rewardBanner, setRewardBanner] = useState<string | null>(null);

  // Auth & local-to-cloud sync state
  const [authBusy, setAuthBusy] = useState(false);
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Real-time Firestore listener for signed-in member's private journal entries
  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setLoadingCloud(false);
      return;
    }

    setLoadingCloud(true);
    setFeedError(null);

    const journalQuery = query(
      collection(db, 'journalEntries'),
      where('uid', '==', user.uid),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      journalQuery,
      (snapshot) => {
        const loaded: JournalEntryRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const createdTs = d.createdAt as Timestamp | null;
          const updatedTs = d.updatedAt as Timestamp | null;
          const rawType = String(d.entryType || '');
          loaded.push({
            id: docSnap.id,
            title: String(d.title || ''),
            content: String(d.content || ''),
            entryType: JOURNAL_ENTRY_TYPES.includes(rawType as JournalEntryType)
              ? (rawType as JournalEntryType)
              : 'Special Interest Idea',
            createdAtMs: createdTs?.toMillis ? createdTs.toMillis() : Date.now(),
            updatedAtMs: updatedTs?.toMillis ? updatedTs.toMillis() : Date.now(),
            source: 'cloud',
          });
        });
        setCloudEntries(loaded);
        setLoadingCloud(false);
      },
      (error) => {
        setLoadingCloud(false);
        if (isQuotaExceededError(error)) {
          setFeedError(
            'Daily Firestore free-tier quota reached. Your local journal notes remain available.'
          );
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'journalEntries');
      }
    );

    return () => unsubscribe();
  }, [isOpen, authReady, user]);

  const activeEntries = user ? cloudEntries : localEntries;

  const sortedFilteredEntries = useMemo(() => {
    const base =
      filterType === 'ALL'
        ? activeEntries
        : activeEntries.filter((e) => e.entryType === filterType);

    return [...base].sort((a, b) =>
      sortOrder === 'DESC'
        ? b.createdAtMs - a.createdAtMs
        : a.createdAtMs - b.createdAtMs
    );
  }, [activeEntries, filterType, sortOrder]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setFeedError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setFeedError('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!user || localEntries.length === 0) return;
    setSyncingLocal(true);
    setFeedError(null);
    try {
      const batch = writeBatch(db);
      const toUpload = localEntries.slice(0, 25);
      toUpload.forEach((item) => {
        const newRef = doc(collection(db, 'journalEntries'));
        batch.set(newRef, {
          uid: user.uid,
          title: item.title.trim().slice(0, JOURNAL_TITLE_MAX_LENGTH) || 'Note',
          content:
            item.content.trim().slice(0, JOURNAL_CONTENT_MAX_LENGTH) || 'Saved note.',
          entryType: item.entryType,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      const remaining = localEntries.slice(25);
      setLocalEntries(remaining);
      saveLocalJournalEntries(remaining);
      setRewardBanner(
        `Synced ${toUpload.length} local journal ${toUpload.length === 1 ? 'entry' : 'entries'} to your private account.`
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setFeedError('Daily Firestore quota reached. Please try syncing tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'journalEntries');
      }
    } finally {
      setSyncingLocal(false);
    }
  };

  const openNewComposer = () => {
    setEditingEntry(null);
    setTitle('');
    setEntryType(
      filterType === 'ALL' ? 'Special Interest Idea' : filterType
    );
    setContent('');
    setFormError(null);
    setComposerOpen(true);
  };

  const openEditComposer = (entry: JournalEntryRecord) => {
    setEditingEntry(entry);
    setTitle(entry.title);
    setEntryType(entry.entryType);
    setContent(entry.content);
    setFormError(null);
    setComposerOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim().slice(0, JOURNAL_TITLE_MAX_LENGTH);
    const cleanContent = content.trim().slice(0, JOURNAL_CONTENT_MAX_LENGTH);

    if (cleanTitle.length < JOURNAL_TITLE_MIN_LENGTH) {
      setFormError('Please enter a short title for your journal entry.');
      return;
    }
    if (cleanContent.length < JOURNAL_CONTENT_MIN_LENGTH) {
      setFormError('Please write a note, idea, or reflection before saving.');
      return;
    }
    if (!JOURNAL_ENTRY_TYPES.includes(entryType)) {
      setFormError('Please choose a valid entry focus.');
      return;
    }

    const safety = screenForHarmToHumansOrAnimals(
      `${cleanTitle} ${cleanContent}`
    );
    if (!safety.safe) {
      setFormError(
        safety.reason ||
          'Blocked: Ideas representing harm to humans or animals are not permitted.'
      );
      return;
    }

    setSaving(true);
    setFormError(null);

    // Editing an existing entry
    if (editingEntry) {
      if (user && editingEntry.source === 'cloud') {
        const targetPath = `journalEntries/${editingEntry.id}`;
        try {
          await updateDoc(doc(db, 'journalEntries', editingEntry.id), {
            title: cleanTitle,
            content: cleanContent,
            entryType,
            updatedAt: serverTimestamp(),
          });
          setComposerOpen(false);
          setEditingEntry(null);
          onJournalActivity?.();
          setRewardBanner(
            'Journal entry updated while preserving its original UK + Hijri timestamp · Daily Streak updated!'
          );
        } catch (err) {
          if (isQuotaExceededError(err)) {
            setFormError('Daily Firestore quota reached. Please try again tomorrow.');
          } else {
            handleFirestoreError(err, OperationType.UPDATE, targetPath);
          }
        } finally {
          setSaving(false);
        }
        return;
      }

      // Local edit
      const now = Date.now();
      const updated = localEntries.map((item) =>
        item.id === editingEntry.id
          ? {
              ...item,
              title: cleanTitle,
              content: cleanContent,
              entryType,
              updatedAtMs: now,
            }
          : item
      );
      setLocalEntries(updated);
      saveLocalJournalEntries(updated);
      setComposerOpen(false);
      setEditingEntry(null);
      setSaving(false);
      onJournalActivity?.();
      setRewardBanner('Journal entry updated · Daily Mastery Streak recorded!');
      return;
    }

    // Creating a brand-new entry
    if (user) {
      if (!VALID_DOC_ID_REGEX.test(user.uid)) {
        setFormError('Invalid account identifier.');
        setSaving(false);
        return;
      }
      const newRef = doc(collection(db, 'journalEntries'));
      const targetPath = `journalEntries/${newRef.id}`;
      try {
        await setDoc(newRef, {
          uid: user.uid,
          title: cleanTitle,
          content: cleanContent,
          entryType,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setComposerOpen(false);
        setTitle('');
        setContent('');
        onEntryCreated(entryType);
        setRewardBanner(
          'Saved to your Personal Journal · Earned +1 Trying Token & +1 Gathering Token (Ideas & Papers)!'
        );
      } catch (err) {
        if (isQuotaExceededError(err)) {
          setFormError('Daily Firestore quota reached. Please try again tomorrow.');
        } else {
          handleFirestoreError(err, OperationType.CREATE, targetPath);
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    // Local creation when not signed in
    const now = Date.now();
    const newRecord: JournalEntryRecord = {
      id: `local_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle,
      content: cleanContent,
      entryType,
      createdAtMs: now,
      updatedAtMs: now,
      source: 'local',
    };
    const nextLocal = [newRecord, ...localEntries];
    setLocalEntries(nextLocal);
    saveLocalJournalEntries(nextLocal);
    setComposerOpen(false);
    setTitle('');
    setContent('');
    setSaving(false);
    onEntryCreated(entryType);
    setRewardBanner(
      'Saved to your Personal Journal · Earned +1 Trying Token & +1 Gathering Token (Ideas & Papers)!'
    );
  };

  const handleDeleteEntry = async (entry: JournalEntryRecord) => {
    if (user && entry.source === 'cloud') {
      const targetPath = `journalEntries/${entry.id}`;
      try {
        await deleteDoc(doc(db, 'journalEntries', entry.id));
        setConfirmDeleteId(null);
      } catch (err) {
        if (isQuotaExceededError(err)) {
          setFeedError('Daily Firestore quota reached. Please try again tomorrow.');
        } else {
          handleFirestoreError(err, OperationType.DELETE, targetPath);
        }
      }
      return;
    }

    const nextLocal = localEntries.filter((item) => item.id !== entry.id);
    setLocalEntries(nextLocal);
    saveLocalJournalEntries(nextLocal);
    setConfirmDeleteId(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="personal-journal-heading"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/20 rounded-xl text-[#F7F4EB] overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#E5A93C]" />
              <h2
                id="personal-journal-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Personal Journal · Ideas, Papers &amp; Job Steps
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#C6D2C9]">
              Record special interest ideas, working papers, and reflections in chronological order · New entries earn Trying &amp; Gathering Tokens
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!user && authReady && (
              <button
                type="button"
                disabled={authBusy}
                onClick={handleGoogleSignIn}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#E5A93C]/45 text-xs font-semibold text-[#E5A93C] hover:border-[#E5A93C] hover:text-[#F7F4EB] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authBusy ? 'Signing In...' : 'Sign In for Cloud Sync'}</span>
              </button>
            )}

            {user && localEntries.length > 0 && (
              <button
                type="button"
                disabled={syncingLocal}
                onClick={handleSyncLocalToCloud}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#7CE0A3]/50 text-xs font-semibold text-[#7CE0A3] hover:border-[#7CE0A3] disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>
                  {syncingLocal
                    ? 'Syncing...'
                    : `Sync ${localEntries.length} Local Note${localEntries.length > 1 ? 's' : ''}`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Personal Journal"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {rewardBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#18291F] border border-[#7CE0A3]/35 text-xs text-[#E4F2E9]">
              <span>{rewardBanner}</span>
              <button
                type="button"
                onClick={() => setRewardBanner(null)}
                className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {feedError && (
            <div className="px-4 py-3 rounded-lg bg-[#2A1D17] border border-[#F4A261]/40 text-xs text-[#F4A261]">
              {feedError}
            </div>
          )}

          {/* Top Controls: Filter Tabs, Chronological Sort Toggle & New Entry CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap items-center gap-1 p-1 bg-[#18261E] rounded-lg border border-[#F7F4EB]/10"
              role="group"
              aria-label="Filter journal entries by focus"
            >
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-[#E5A93C] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                All ({activeEntries.length})
              </button>
              {JOURNAL_ENTRY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterType === t
                      ? 'bg-[#E5A93C] text-[#101813]'
                      : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'))
                }
                aria-label="Toggle chronological sort order"
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#18261E] border border-[#F7F4EB]/14 text-xs font-semibold text-[#D6E0D9] hover:text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>
                  {sortOrder === 'DESC'
                    ? 'Chronological: Newest First'
                    : 'Chronological: Oldest First'}
                </span>
              </button>

              {!composerOpen && (
                <button
                  type="button"
                  onClick={openNewComposer}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Entry</span>
                </button>
              )}
            </div>
          </div>

          {/* Entry Composer / Editor Form */}
          {composerOpen && (
            <form
              onSubmit={handleSaveEntry}
              className="p-5 rounded-xl bg-[#16231C] border border-[#E5A93C]/45 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                  {editingEntry ? 'Edit Journal Entry' : 'New Personal Journal Entry'}
                </h3>
                <span className="text-xs text-[#B8C6BC]">
                  {user ? 'Private to your account' : 'Saved on this device'}
                </span>
              </div>

              {/* Focus Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#D0DBD3]">
                  Entry Focus
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {JOURNAL_ENTRY_TYPES.map((typeOption) => {
                    const selected = entryType === typeOption;
                    return (
                      <button
                        key={typeOption}
                        type="button"
                        onClick={() => setEntryType(typeOption)}
                        className={`min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-left cursor-pointer ${
                          selected
                            ? 'bg-[#E5A93C] text-[#101813] border-[#E5A93C]'
                            : 'bg-[#111B15] text-[#D0DBD3] border-[#F7F4EB]/14 hover:border-[#E5A93C]/60'
                        }`}
                      >
                        {typeOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="journal-entry-title"
                    className="font-semibold text-[#D0DBD3]"
                  >
                    Entry Title
                  </label>
                  <span className="font-mono tabular-nums text-[#9FB0A4]">
                    {title.length}/{JOURNAL_TITLE_MAX_LENGTH}
                  </span>
                </div>
                <input
                  id="journal-entry-title"
                  type="text"
                  maxLength={JOURNAL_TITLE_MAX_LENGTH}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Sketching solar lantern joinery or first outreach steps"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-sm text-[#F7F4EB] placeholder-[#7F9185] focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              {/* Content Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="journal-entry-content"
                    className="font-semibold text-[#D0DBD3]"
                  >
                    Notes, Working Papers &amp; Reflections
                  </label>
                  <span className="font-mono tabular-nums text-[#9FB0A4]">
                    {content.length}/{JOURNAL_CONTENT_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="journal-entry-content"
                  rows={5}
                  maxLength={JOURNAL_CONTENT_MAX_LENGTH}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write down special interest ideas, material lists, working paper drafts, or practical job steps you want ready to share..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-sm text-[#F7F4EB] placeholder-[#7F9185] leading-relaxed focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              {formError && (
                <p className="text-xs text-[#F4A261] font-medium">{formError}</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setEditingEntry(null);
                    setFormError(null);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/16 text-xs font-semibold text-[#D6E0D9] hover:text-[#F7F4EB] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[40px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {saving
                    ? 'Saving...'
                    : editingEntry
                      ? 'Save Changes'
                      : 'Save Entry (+Tokens)'}
                </button>
              </div>
            </form>
          )}

          {/* Chronological Entries Timeline */}
          {loadingCloud ? (
            <div className="py-12 text-center text-sm text-[#C6D2C9]">
              Loading your chronological journal entries...
            </div>
          ) : sortedFilteredEntries.length === 0 ? (
            <div className="py-12 px-6 rounded-xl bg-[#15211A] border border-[#F7F4EB]/12 text-center space-y-3">
              <p className="font-display text-lg font-bold text-[#F7F4EB]">
                Your Personal Journal Is Open
              </p>
              <p className="text-sm text-[#C6D2C9] max-w-md mx-auto leading-relaxed">
                Start collecting special interest ideas, working papers, job steps,
                or trade plans at your own pace. Every entry is saved with a
                timestamp in chronological order.
              </p>
              {!composerOpen && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={openNewComposer}
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Write First Entry</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
              {sortedFilteredEntries.map((entry) => {
                const wasEdited =
                  Math.abs(entry.updatedAtMs - entry.createdAtMs) > 2500;
                const isConfirmingDelete = confirmDeleteId === entry.id;

                return (
                  <article
                    key={entry.id}
                    className="py-5 first:pt-4 last:pb-4 space-y-2.5"
                  >
                    {/* Unboxed Metadata Kicker with Chronological Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8C6BC]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#E5A93C]">
                          {entry.entryType}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time
                          dateTime={new Date(entry.createdAtMs).toISOString()}
                          className="font-mono tabular-nums text-[#DCE5DE]"
                        >
                          {formatJournalTimestamp(entry.createdAtMs)}
                        </time>
                        {wasEdited && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-[#9FB0A4]">
                              Edited {formatJournalTimestamp(entry.updatedAtMs)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Collab Handoff, Edit & Delete Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {onSendToCollab && (
                          <button
                            type="button"
                            onClick={() =>
                              onSendToCollab(entry.title, entry.content)
                            }
                            className="min-h-[34px] px-3 py-1 rounded-md bg-[#18261E] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Share to Live Collab</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditComposer(entry)}
                          className="min-h-[34px] px-3 py-1 rounded-md bg-[#18261E] border border-[#F7F4EB]/14 text-xs font-semibold text-[#DCE5DE] hover:border-[#E5A93C] hover:text-[#F7F4EB] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#E5A93C]" />
                          <span>Edit</span>
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry)}
                              className="min-h-[34px] px-2.5 py-1 rounded-md bg-[#9E3B2B] text-xs font-semibold text-[#F7F4EB] hover:bg-[#B54634] transition-colors cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[34px] px-2.5 py-1 rounded-md bg-[#18261E] text-xs font-medium text-[#C8D4CB] hover:text-[#F7F4EB] transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            aria-label={`Delete entry ${entry.title}`}
                            className="min-h-[34px] px-2.5 py-1 rounded-md bg-[#18261E] border border-[#F7F4EB]/12 text-xs text-[#B8C6BC] hover:border-[#E07A5F] hover:text-[#F4A261] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-display text-lg font-bold text-[#F7F4EB] leading-snug">
                      {entry.title}
                    </h3>

                    <p className="text-sm text-[#DCE5DE] leading-relaxed whitespace-pre-wrap max-w-[72ch]">
                      {entry.content}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
