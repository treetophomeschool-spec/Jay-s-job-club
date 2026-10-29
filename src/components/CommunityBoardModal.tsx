import React, { useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Edit3,
  LogIn,
  LogOut,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  OperationType,
  POST_CATEGORIES,
  PostCategory,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  VALID_DOC_ID_REGEX,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import { formatDualTimestamp } from '../utils/dualCalendar';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

export interface CommunityPostRecord {
  id: string;
  authorId: string;
  username: string;
  category: PostCategory;
  title: string;
  message: string;
  visibility: 'published' | 'archived';
  createdAtMs: number;
  updatedAtMs: number;
}

const STEWARD_SEED_POSTS: CommunityPostRecord[] = [
  {
    id: 'steward_post_1',
    authorId: 'workshop_steward',
    username: 'Jay · Workshop Steward',
    category: 'Collaboration Request',
    title: 'Community Library Cedar Book-Return Box & Reading Bench',
    message:
      'Looking for 1–2 makers interested in dovetail joinery or natural beeswax finishing. Zero deadline pressure—written check-ins and quiet bench sessions welcome.',
    visibility: 'published',
    createdAtMs: Date.now() - 3600 * 1000 * 5,
    updatedAtMs: Date.now() - 3600 * 1000 * 5,
  },
  {
    id: 'steward_post_2',
    authorId: 'workshop_steward',
    username: 'Samira · Lantern & Metalcraft Bench',
    category: 'Job Opportunity',
    title: 'Paid Micro-Batch Brass Lantern Shade Assembly (Flexible Ground Bench)',
    message:
      'Step-by-step visual jig provided for frosted amber glass & spun brass collars. Work strictly at your own pace with friendly written handoffs.',
    visibility: 'published',
    createdAtMs: Date.now() - 3600 * 1000 * 14,
    updatedAtMs: Date.now() - 3600 * 1000 * 14,
  },
  {
    id: 'steward_post_3',
    authorId: 'workshop_steward',
    username: 'Ground Kiosk Desk',
    category: 'Resource Share',
    title: 'Show & Tell Welcome Packs, Lanterns & Mini-Lecture Prep Open at 0m',
    message:
      'Preparing a Show & Tell session? Pick up lanterns, herbal drinks, and guest welcome packs from the Ground-Floor Prep desk before ascending to 33m.',
    visibility: 'published',
    createdAtMs: Date.now() - 3600 * 1000 * 26,
    updatedAtMs: Date.now() - 3600 * 1000 * 26,
  },
];

interface CommunityBoardModalProps {
  isOpen: boolean;
  isAtGround?: boolean;
  onReturnToGround?: () => void;
  onPostCreated?: (category: PostCategory) => void;
  onLaunchCollabFromPost?: (postTitle: string, postSummary: string) => void;
  onClose: () => void;
}

function sanitizeUsername(raw: string): string {
  const trimmed = raw.trim().slice(0, USERNAME_MAX_LENGTH);
  if (trimmed.length >= USERNAME_MIN_LENGTH) return trimmed;
  return 'Club Member';
}

function formatPostTimestamp(ms: number): string {
  if (!ms) return 'Just now';
  return formatDualTimestamp(ms);
}

export const CommunityBoardModal: React.FC<CommunityBoardModalProps> = ({
  isOpen,
  isAtGround = true,
  onReturnToGround,
  onPostCreated,
  onLaunchCollabFromPost,
  onClose,
}) => {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Saved public profile tracking
  const [profileExists, setProfileExists] = useState(false);
  const [savedProfileUsername, setSavedProfileUsername] = useState('');

  // Posts feed state
  const [posts, setPosts] = useState<CommunityPostRecord[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | PostCategory>('ALL');

  // Composer / Edit state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [category, setCategory] = useState<PostCategory>('Job Opportunity');
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline delete confirmation, Boots-on-Ground censor view toggle & Trying Token banner
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);
  const [showMaskedFlagged, setShowMaskedFlagged] = useState<boolean>(false);

  // 1. Track Firebase Authentication state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setAuthError(null);
    });
    return () => unsub();
  }, []);

  // 2. Load member's PublicProfile display handle when signed in
  useEffect(() => {
    if (!authReady || !user) {
      setProfileExists(false);
      setSavedProfileUsername('');
      return;
    }

    let cancelled = false;
    const profilePath = `publicProfiles/${user.uid}`;
    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'publicProfiles', user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const handle =
            typeof data.username === 'string'
              ? sanitizeUsername(data.username)
              : sanitizeUsername(user.displayName || 'Club Member');
          setProfileExists(true);
          setSavedProfileUsername(handle);
          setUsername((prev) => (prev.trim() ? prev : handle));
        } else {
          const fallback = sanitizeUsername(user.displayName || 'Club Member');
          setProfileExists(false);
          setSavedProfileUsername('');
          setUsername((prev) => (prev.trim() ? prev : fallback));
        }
      } catch (err) {
        if (cancelled) return;
        if (isQuotaExceededError(err)) {
          setFeedError(
            'Daily Firestore free-tier quota reached. Quota resets automatically tomorrow.'
          );
          return;
        }
        handleFirestoreError(err, OperationType.GET, profilePath);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // 3. Attach real-time Community Board listener ONLY when authReady && user && modal open
  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);
    setFeedError(null);

    const postsQuery = query(
      collection(db, 'communityPosts'),
      where('visibility', '==', 'published'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const loaded: CommunityPostRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const createdTs = d.createdAt as Timestamp | null;
          const updatedTs = d.updatedAt as Timestamp | null;
          loaded.push({
            id: docSnap.id,
            authorId: String(d.authorId || ''),
            username: String(d.username || 'Club Member'),
            category: (POST_CATEGORIES.includes(d.category)
              ? d.category
              : 'General Advice') as PostCategory,
            title: String(d.title || ''),
            message: String(d.message || ''),
            visibility: d.visibility === 'archived' ? 'archived' : 'published',
            createdAtMs: createdTs?.toMillis ? createdTs.toMillis() : Date.now(),
            updatedAtMs: updatedTs?.toMillis ? updatedTs.toMillis() : Date.now(),
          });
        });

        loaded.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setPosts(loaded);
        setLoadingPosts(false);
      },
      (error) => {
        setLoadingPosts(false);
        if (isQuotaExceededError(error)) {
          setFeedError(
            'Daily Firestore free-tier quota exceeded. Quota resets automatically the next day.'
          );
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'communityPosts');
      }
    );

    return () => unsubscribe();
  }, [isOpen, authReady, user]);

  const combinedPosts = useMemo(() => {
    return user && posts.length > 0
      ? [...posts, ...STEWARD_SEED_POSTS]
      : STEWARD_SEED_POSTS;
  }, [posts, user]);

  const censoredFeedAnalysis = useMemo(() => {
    const base =
      selectedFilter === 'ALL'
        ? combinedPosts
        : combinedPosts.filter((p) => p.category === selectedFilter);

    const visible: Array<{
      post: CommunityPostRecord;
      wasCensored: boolean;
      censorReason?: string;
    }> = [];
    let heldBackCount = 0;

    for (const post of base) {
      const check = screenBootsOnGroundCensor(
        `${post.username} ${post.title} ${post.message}`,
        'job-board-feed'
      );
      if (check.allowed) {
        visible.push({ post, wasCensored: false });
      } else {
        heldBackCount += 1;
        if (showMaskedFlagged) {
          const maskedTitle = screenBootsOnGroundCensor(
            post.title,
            'job-board-feed'
          ).maskedPreview;
          const maskedBody = screenBootsOnGroundCensor(
            post.message,
            'job-board-feed'
          ).maskedPreview;
          visible.push({
            post: {
              ...post,
              title: maskedTitle,
              message: maskedBody,
            },
            wasCensored: true,
            censorReason: check.reason,
          });
        }
      }
    }

    return { visible, heldBackCount };
  }, [combinedPosts, selectedFilter, showMaskedFlagged]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setAuthError('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setComposerOpen(false);
    setEditingPostId(null);
    await signOut(auth);
  };

  const openNewPostComposer = () => {
    setEditingPostId(null);
    setCategory(
      selectedFilter === 'ALL' ? 'Job Opportunity' : selectedFilter
    );
    if (!username.trim() && user) {
      setUsername(
        savedProfileUsername || sanitizeUsername(user.displayName || 'Club Member')
      );
    }
    setTitle('');
    setMessage('');
    setFormError(null);
    setComposerOpen(true);
  };

  const openEditComposer = (post: CommunityPostRecord) => {
    setEditingPostId(post.id);
    setCategory(post.category);
    setUsername(post.username);
    setTitle(post.title);
    setMessage(post.message);
    setFormError(null);
    setComposerOpen(true);
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanUsername = username.trim().slice(0, USERNAME_MAX_LENGTH);
    const cleanTitle = title.trim().slice(0, TITLE_MAX_LENGTH);
    const cleanMessage = message.trim().slice(0, MESSAGE_MAX_LENGTH);

    if (cleanUsername.length < USERNAME_MIN_LENGTH) {
      setFormError(
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`
      );
      return;
    }
    if (cleanTitle.length < TITLE_MIN_LENGTH) {
      setFormError(
        `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`
      );
      return;
    }
    if (cleanMessage.length < MESSAGE_MIN_LENGTH) {
      setFormError(
        `Message must be between ${MESSAGE_MIN_LENGTH} and ${MESSAGE_MAX_LENGTH} characters.`
      );
      return;
    }
    if (!POST_CATEGORIES.includes(category)) {
      setFormError('Please choose one of the four board categories.');
      return;
    }
    if (!VALID_DOC_ID_REGEX.test(user.uid)) {
      setFormError('Invalid user account identifier.');
      return;
    }

    const bootsCheck = screenBootsOnGroundCensor(
      `${cleanUsername} ${cleanTitle} ${cleanMessage}`,
      'job-board-submit',
      true
    );
    if (!bootsCheck.allowed) {
      setFormError(
        bootsCheck.reason ||
          "Tree 'Boots on Ground' Censor: Rude words, insults, or unsuitable content cannot be posted to the Job Board."
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);

    if (editingPostId) {
      const targetPath = `communityPosts/${editingPostId}`;
      try {
        await updateDoc(doc(db, 'communityPosts', editingPostId), {
          username: cleanUsername,
          category,
          title: cleanTitle,
          message: cleanMessage,
          updatedAt: serverTimestamp(),
        });

        if (profileExists && cleanUsername !== savedProfileUsername) {
          await updateDoc(doc(db, 'publicProfiles', user.uid), {
            username: cleanUsername,
            updatedAt: serverTimestamp(),
          });
          setSavedProfileUsername(cleanUsername);
        }

        setComposerOpen(false);
        setEditingPostId(null);
        setTitle('');
        setMessage('');
      } catch (err) {
        if (isQuotaExceededError(err)) {
          setFormError('Daily Firestore quota exceeded. Please try again tomorrow.');
        } else {
          handleFirestoreError(err, OperationType.UPDATE, targetPath);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Create new post atomically alongside PublicProfile if needed
    const newPostRef = doc(collection(db, 'communityPosts'));
    const postPath = `communityPosts/${newPostRef.id}`;

    try {
      const batch = writeBatch(db);
      const profileRef = doc(db, 'publicProfiles', user.uid);

      if (!profileExists) {
        batch.set(profileRef, {
          uid: user.uid,
          username: cleanUsername,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (cleanUsername !== savedProfileUsername) {
        batch.update(profileRef, {
          username: cleanUsername,
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(newPostRef, {
        authorId: user.uid,
        username: cleanUsername,
        category,
        title: cleanTitle,
        message: cleanMessage,
        visibility: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setProfileExists(true);
      setSavedProfileUsername(cleanUsername);
      setComposerOpen(false);
      setTitle('');
      setMessage('');
      onPostCreated?.(category);
      setTokenNotice(
        'Published to the Ground Floor Board · Earned +1 Level 1 Trying Token for trying & sharing!'
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setFormError('Daily Firestore quota exceeded. Please try again tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.CREATE, postPath);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const targetPath = `communityPosts/${postId}`;
    try {
      await deleteDoc(doc(db, 'communityPosts', postId));
      setConfirmDeleteId(null);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setFeedError('Daily Firestore quota exceeded. Please try again tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, targetPath);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-board-heading"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/20 rounded-xl text-[#F7F4EB] overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <h2
              id="community-board-heading"
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
            >
              Ground Floor · Job Board &amp; Collabs
            </h2>
            <p className="mt-0.5 text-xs text-[#C6D2C9]">
              Root Sanctuary (0m) · Job Opportunities, Collaborations, Shared Resources &amp; Advice
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isAtGround && onReturnToGround && (
              <button
                type="button"
                onClick={() => {
                  onReturnToGround();
                  onClose();
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#E5A93C]/45 text-xs font-semibold text-[#E5A93C] hover:border-[#E5A93C] hover:text-[#F7F4EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Glide Lift to Ground (0m)
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/16 text-xs font-semibold text-[#D6E0D9] hover:text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>Sign Out</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Ground Floor Job and Collab Board"
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/16 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body Content (Immediate Browsing Without Blocking Auth Gate) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!authReady ? (
            <div className="py-16 text-center text-sm text-[#C6D2C9]">
              Opening Ground Sanctuary Board...
            </div>
          ) : (
            <>
              {!user && (
                <div className="p-4 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[#F7F4EB]">
                      Browse Workshop Notices Immediately · Sign In to Post (+1 Trying Token)
                    </div>
                    <p className="text-[#C8D4CB]">
                      You can launch a Live Collab room from any notice below right away, or sign in with Google to view live member cloud notices and publish your own.
                    </p>
                    {authError && (
                      <p className="text-[#F4A261] font-medium">{authError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={handleGoogleSignIn}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>
                      {authBusy ? 'Signing In...' : 'Sign In to Post'}
                    </span>
                  </button>
                </div>
              )}

              {/* Tree 'Boots on Ground' Censor Charter Banner */}
              <div className="px-4 py-3 rounded-xl bg-[#16231C] border border-[#7CE0A3]/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#DCE5DE]">
                  <ShieldCheck className="w-4 h-4 text-[#7CE0A3] shrink-0" />
                  <span>
                    <strong className="text-[#F7F4EB]">
                      Tree &apos;Boots on Ground&apos; Censor Active:
                    </strong>{' '}
                    Rude words, swearing, personal insults, and exploitative or unsuitable listings are automatically held back so the Job Board stays welcoming for all ages.
                  </span>
                </div>
                {censoredFeedAnalysis.heldBackCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMaskedFlagged((v) => !v)}
                    className="font-mono text-[#E5A93C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {showMaskedFlagged
                      ? 'Hide Censored Posts'
                      : `${censoredFeedAnalysis.heldBackCount} Unsuitable Held (Preview Masked)`}
                  </button>
                )}
              </div>

              {tokenNotice && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[#18291F] border border-[#E5A93C]/45 text-xs text-[#F7F4EB]">
                  <span>{tokenNotice}</span>
                  <button
                    type="button"
                    onClick={() => setTokenNotice(null)}
                    className="text-[#B8C6BC] hover:text-[#F7F4EB] font-semibold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Filter Bar & New Post Trigger */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex flex-wrap items-center gap-1 p-1 bg-[#18261E] rounded-lg border border-[#F7F4EB]/10"
                  role="group"
                  aria-label="Filter community posts by type"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('ALL')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedFilter === 'ALL'
                        ? 'bg-[#E5A93C] text-[#101813]'
                        : 'text-[#C6D2C9] hover:text-[#F7F4EB]'
                    }`}
                  >
                    All ({combinedPosts.length})
                  </button>
                  {POST_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedFilter(cat)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedFilter === cat
                          ? 'bg-[#E5A93C] text-[#101813]'
                          : 'text-[#C6D2C9] hover:text-[#F7F4EB]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {user && !composerOpen && (
                  <button
                    type="button"
                    onClick={openNewPostComposer}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Post</span>
                  </button>
                )}
              </div>

              {/* Post Composer / Editor Form */}
              {composerOpen && (
                <form
                  onSubmit={handleSubmitPost}
                  className="bg-[#17241D] border border-[#F7F4EB]/16 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-[#F7F4EB]">
                      {editingPostId ? 'Edit Community Post' : 'Create Community Post'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerOpen(false);
                        setEditingPostId(null);
                        setFormError(null);
                      }}
                      className="text-xs font-medium text-[#B8C6BC] hover:text-[#F7F4EB] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Category & Username Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#D6E0D9] mb-1.5">
                        Message Type
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {POST_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap truncate cursor-pointer ${
                              category === cat
                                ? 'bg-[#E5A93C] text-[#101813] border-[#E5A93C]'
                                : 'bg-[#111B15] text-[#C8D4CB] border-[#F7F4EB]/14 hover:border-[#F7F4EB]/35'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="post-username"
                          className="text-xs font-semibold text-[#D6E0D9]"
                        >
                          Poster Username
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-[#9FB0A4]">
                          {username.trim().length}/{USERNAME_MAX_LENGTH}
                        </span>
                      </div>
                      <input
                        id="post-username"
                        type="text"
                        required
                        minLength={USERNAME_MIN_LENGTH}
                        maxLength={USERNAME_MAX_LENGTH}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your workshop name"
                        className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#101914] border border-[#F7F4EB]/18 text-sm text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                      />
                    </div>
                  </div>

                  {/* Title Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="post-title"
                        className="text-xs font-semibold text-[#D6E0D9]"
                      >
                        Post Title
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-[#9FB0A4]">
                        {title.trim().length}/{TITLE_MAX_LENGTH}
                      </span>
                    </div>
                    <input
                      id="post-title"
                      type="text"
                      required
                      minLength={TITLE_MIN_LENGTH}
                      maxLength={TITLE_MAX_LENGTH}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Clear, welcoming headline for fellow members"
                      className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#101914] border border-[#F7F4EB]/18 text-sm text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C]"
                    />
                  </div>

                  {/* Detailed Message Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="post-message"
                        className="text-xs font-semibold text-[#D6E0D9]"
                      >
                        Detailed Message
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-[#9FB0A4]">
                        {message.trim().length}/{MESSAGE_MAX_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="post-message"
                      rows={4}
                      required
                      minLength={MESSAGE_MIN_LENGTH}
                      maxLength={MESSAGE_MAX_LENGTH}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share details, flexible pacing expectations, tools available, or practical guidance..."
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#101914] border border-[#F7F4EB]/18 text-sm text-[#F7F4EB] placeholder:text-[#7E9184] focus:outline-none focus:border-[#E5A93C] resize-y"
                    />
                  </div>

                  {formError && (
                    <div className="p-3 rounded-lg bg-[#281A15] border border-[#F4A261]/55 flex items-start gap-2 text-xs text-[#F4A261] font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {submitting
                        ? 'Saving...'
                        : editingPostId
                          ? 'Save Changes'
                          : 'Publish to Board'}
                    </button>
                  </div>
                </form>
              )}

              {/* Feed Error / Quota Notice */}
              {feedError && (
                <div className="p-4 rounded-lg bg-[#231C16] border border-[#E5A93C]/40 text-xs text-[#F7F4EB]">
                  {feedError}
                </div>
              )}

              {/* Posts Feed (Zero Static Pills, Clean Hairline Dividers) */}
              {loadingPosts ? (
                <div className="py-12 text-center text-sm text-[#B8C6BC]">
                  Loading community notices...
                </div>
              ) : censoredFeedAnalysis.visible.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-[#F7F4EB]/10 rounded-xl bg-[#15211A]">
                  <p className="font-display text-base font-semibold text-[#F7F4EB]">
                    No posts in {selectedFilter === 'ALL' ? 'the board' : selectedFilter} yet
                  </p>
                  <p className="text-xs text-[#B8C6BC]">
                    Be the first club member to share a post at your own pace.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F7F4EB]/12 border-t border-b border-[#F7F4EB]/12">
                  {censoredFeedAnalysis.visible.map(({ post, wasCensored }) => {
                    const isOwner = Boolean(user && user.uid === post.authorId);
                    return (
                      <article key={post.id} className="py-5 space-y-2">
                        {/* Unboxed Metadata Kicker with Subtle Separators */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8C6BC]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#E5A93C]">
                              {post.category}
                            </span>
                            {wasCensored && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-[#F4A261]">
                                  Boots-on-Ground Masked
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>
                              Posted by{' '}
                              <strong className="font-semibold text-[#F7F4EB]">
                                {post.username}
                              </strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatPostTimestamp(post.createdAtMs)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {onLaunchCollabFromPost && (
                              <button
                                type="button"
                                onClick={() =>
                                  onLaunchCollabFromPost(post.title, post.message)
                                }
                                className="min-h-[32px] px-3 py-1 rounded-md bg-[#18261E] border border-[#7CE0A3]/45 text-xs font-semibold text-[#7CE0A3] hover:text-[#F7F4EB] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>Open Collab Room</span>
                              </button>
                            )}

                            {isOwner && (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => openEditComposer(post)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#C8D4CB] hover:text-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>

                                {confirmDeleteId === post.id ? (
                                  <span className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePost(post.id)}
                                      className="text-xs font-bold text-[#F4A261] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      Confirm Remove
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-[#9FB0A4] hover:text-[#F7F4EB] whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(post.id)}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#C8D4CB] hover:text-[#F4A261] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <h3 className="font-display text-lg font-bold text-[#F7F4EB] leading-snug">
                          {post.title}
                        </h3>

                        <p className="text-sm text-[#DCE3DD] leading-relaxed whitespace-pre-wrap break-words max-w-[75ch]">
                          {post.message}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
