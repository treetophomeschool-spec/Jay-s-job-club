import { loadScript, PayPalNamespace } from '@paypal/paypal-js';
import { signInWithPopup, User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  LogIn,
  PackagePlus,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  auth,
  CANOPY_PAYPAL_CATEGORIES,
  CANOPY_PAYPAL_MAX_PRICE_CENTS,
  CANOPY_PAYPAL_MAX_STOCK,
  CANOPY_PAYPAL_MIN_PRICE_CENTS,
  CANOPY_PAYPAL_SPEC_MAX,
  CANOPY_PAYPAL_SPEC_MIN,
  CANOPY_PAYPAL_STORY_MAX,
  CANOPY_PAYPAL_STORY_MIN,
  CANOPY_PAYPAL_TAG_MAX,
  CANOPY_PAYPAL_TITLE_MAX,
  CANOPY_PAYPAL_TITLE_MIN,
  CanopyPaypalItemRecord,
  db,
  getDocWithTimeout,
  getSafeCurrentUser,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  isTransientOfflineOrTokenError,
  OperationType,
  subscribeSafeAuth,
  ToolTradeCategory,
  TreeProgressState,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  VALID_DOC_ID_REGEX,
  withCloudWriteTimeout,
} from '../firebase';
import { formatDualCalendarBanner } from '../utils/dualCalendar';
import { screenBootsOnGroundCensor } from '../utils/ethicalGuard';

interface CanopyPaypalStoreModalProps {
  isOpen: boolean;
  localProgress: TreeProgressState;
  onUpdateLocalProgress: (
    next: TreeProgressState,
    bannerMessage?: string
  ) => void;
  onOpenCanopyCustomizer: () => void;
  onOpenBankOfTreetop?: () => void;
  onClose: () => void;
}

interface PayPalClientConfig {
  configured: boolean;
  clientId: string | null;
  mode: 'sandbox' | 'live';
  currency: string;
  merchantEmail: string | null;
}

interface VerifiedReceipt {
  receiptId: string;
  paypalOrderId: string;
  captureId: string;
  paymentMethod: 'paypal' | 'workshop_pickup_hold';
  buyerNote: string;
  totalCents: number;
  currency: string;
  items: Array<{
    itemId: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  createdAtMs: number;
}

const LOCAL_CANOPY_ITEMS_KEY = 'jays_job_club_canopy_paypal_items_v1';

const CURATED_CANOPY_STARTERS: CanopyPaypalItemRecord[] = [
  {
    id: 'canopy-agarwood-oil-10ml',
    sellerId: 'canopy_bench',
    sellerName: 'Agarwood Hydro-Still Bench',
    title: 'Distilled Agarwood Bark Essential Oil (10ml)',
    tradeCategory: 'Botanical & Essential Oils',
    materialsSpec:
      '10ml UV-protective amber glass dropper bottle · High-contrast tactile batch label · Cultivated Aquilaria bark',
    craftStory:
      'Small-batch aromatic resinous heartwood hydro-distilled calmly upstairs at 33m, bottled with brass funnel, and finished with large-print high-contrast batch labels.',
    sellerBenchTag: 'Canopy Bench #01 · Hydro-Still',
    priceCents: 2400,
    stockCount: 9,
    status: 'active',
    createdAtMs: 1730000100000,
    source: 'curated',
  },
  {
    id: 'canopy-dovetail-cedar-caddy',
    sellerId: 'canopy_bench',
    sellerName: 'Timber Joinery Rota',
    title: 'Hand-Planed Dovetail Cedar Tool Caddy',
    tradeCategory: 'Woodcraft & Joinery',
    materialsSpec:
      '28cm × 16cm × 14cm · Western red cedar, brass corner pins & beeswax rub',
    craftStory:
      'Cut with Japanese pull-saw and smoothed with a low-angle plane on the 33m Canopy joinery bench—designed to hold callipers, chisels, or dropper vials.',
    sellerBenchTag: 'Canopy Bench #02 · Joinery',
    priceCents: 3200,
    stockCount: 6,
    status: 'active',
    createdAtMs: 1730000080000,
    source: 'curated',
  },
  {
    id: 'canopy-spun-brass-lantern',
    sellerId: 'canopy_bench',
    sellerName: 'Lantern & Metalwork Loft',
    title: 'Low-Glare Spun Brass Canopy Desk Lantern',
    tradeCategory: 'Metalwork & Lanterns',
    materialsSpec:
      '22cm tall · Brushed solid brass hood, frosted warm 2700K diffuser & braided cord',
    craftStory:
      'Crafted specifically for sensory-friendly workspaces—eliminates harsh overhead glare while casting warm amber pools across workbenches.',
    sellerBenchTag: 'Canopy Bench #03 · Lanterns',
    priceCents: 3800,
    stockCount: 5,
    status: 'active',
    createdAtMs: 1730000060000,
    source: 'curated',
  },
  {
    id: 'canopy-highland-wool-mat',
    sellerId: 'canopy_bench',
    sellerName: 'Weaving & Acoustic Loom',
    title: 'Hand-Loomed Acoustic Workbench Runner',
    tradeCategory: 'Textiles & Weaving',
    materialsSpec:
      '65cm × 32cm · Plant-dyed British wool warp with bound non-curling selvedge',
    craftStory:
      'Woven on a rigid-heddle loom at the Canopy summit so hand tools rest quietly on the bench without sharp clatter.',
    sellerBenchTag: 'Canopy Bench #04 · Loom',
    priceCents: 1950,
    stockCount: 8,
    status: 'active',
    createdAtMs: 1730000040000,
    source: 'curated',
  },
];

function loadLocalCanopyItems(): CanopyPaypalItemRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CANOPY_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CanopyPaypalItemRecord =>
        Boolean(x) &&
        typeof x.id === 'string' &&
        typeof x.title === 'string' &&
        typeof x.priceCents === 'number'
    );
  } catch {
    return [];
  }
}

function saveLocalCanopyItems(items: CanopyPaypalItemRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CANOPY_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota issues
  }
}

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

let cachedPaypalPromise: Promise<PayPalNamespace | null> | null = null;
let cachedPaypalClientKey = '';

export const CanopyPaypalStoreModal: React.FC<CanopyPaypalStoreModalProps> = ({
  isOpen,
  localProgress,
  onUpdateLocalProgress,
  onOpenCanopyCustomizer,
  onOpenBankOfTreetop,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'sell'>('browse');
  const [user, setUser] = useState<User | null>(() => getSafeCurrentUser());
  const [profileExists, setProfileExists] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [memberHandle, setMemberHandle] = useState('CanopyMaker');
  const [cloudItems, setCloudItems] = useState<CanopyPaypalItemRecord[]>([]);
  const [ownCloudItems, setOwnCloudItems] = useState<CanopyPaypalItemRecord[]>(
    []
  );
  const [localItems, setLocalItems] = useState<CanopyPaypalItemRecord[]>(() =>
    loadLocalCanopyItems()
  );
  const [curatedStockOverrides, setCuratedStockOverrides] = useState<
    Record<string, number>
  >({});

  const [categoryFilter, setCategoryFilter] = useState<
    'All' | ToolTradeCategory
  >('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Basket & PayPal Checkout state
  const [cart, setCart] = useState<Record<string, number>>({
    'canopy-agarwood-oil-10ml': 1,
  });
  const [buyerNote, setBuyerNote] = useState('');
  const [paypalConfig, setPaypalConfig] = useState<PayPalClientConfig | null>(
    null
  );
  const [paypalSdkReady, setPaypalSdkReady] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<VerifiedReceipt | null>(
    null
  );
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);

  // Sell Your Work form state
  const [sellerNameInput, setSellerNameInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [tradeCategoryInput, setTradeCategoryInput] =
    useState<ToolTradeCategory>('Botanical & Essential Oils');
  const [materialsInput, setMaterialsInput] = useState('');
  const [storyInput, setStoryInput] = useState('');
  const [benchTagInput, setBenchTagInput] = useState('');
  const [pricePoundsInput, setPricePoundsInput] = useState('18.50');
  const [stockInput, setStockInput] = useState('5');
  const [sellBusy, setSellBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [sellFeedback, setSellFeedback] = useState<string | null>(null);
  const [sellError, setSellError] = useState<string | null>(null);

  const dualCalendar = formatDualCalendarBanner();

  useEffect(() => {
    return subscribeSafeAuth((nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfileExists(false);
        setProfileLoaded(false);
      } else if (nextUser.displayName?.trim()) {
        const clean = nextUser.displayName
          .trim()
          .slice(0, USERNAME_MAX_LENGTH);
        setMemberHandle(clean);
        setSellerNameInput((prev) => prev || clean);
      }
    });
  }, []);

  // Load PayPal client config from Express backend
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/paypal/config')
      .then((r) => r.json())
      .then((cfg: PayPalClientConfig) => {
        if (!cancelled) {
          setPaypalConfig(cfg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaypalConfig({
            configured: false,
            clientId: null,
            mode: 'sandbox',
            currency: 'GBP',
            merchantEmail: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Load @paypal/paypal-js SDK when configured
  useEffect(() => {
    if (!isOpen || !paypalConfig?.configured || !paypalConfig.clientId) {
      setPaypalSdkReady(false);
      return;
    }
    let cancelled = false;
    const key = `${paypalConfig.clientId}:${paypalConfig.currency || 'GBP'}`;
    if (!cachedPaypalPromise || cachedPaypalClientKey !== key) {
      cachedPaypalClientKey = key;
      cachedPaypalPromise = loadScript({
        clientId: paypalConfig.clientId,
        currency: paypalConfig.currency || 'GBP',
        intent: 'capture',
      });
    }
    cachedPaypalPromise
      .then((ns) => {
        if (!cancelled) {
          setPaypalSdkReady(Boolean(ns?.Buttons));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaypalSdkReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, paypalConfig]);

  // Subscribe to public active Canopy PayPal listings when signed in
  useEffect(() => {
    if (!isOpen || !user) {
      setCloudItems([]);
      return;
    }
    const activeQ = query(
      collection(db, 'canopyPaypalItems'),
      where('status', '==', 'active'),
      limit(40)
    );
    const unsubActive = onSnapshot(
      activeQ,
      (snap) => {
        const list: CanopyPaypalItemRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          list.push({
            id: docSnap.id,
            sellerId: String(d.sellerId || ''),
            sellerName: String(d.sellerName || 'Canopy Maker'),
            title: String(d.title || 'Handcrafted Work'),
            tradeCategory: (CANOPY_PAYPAL_CATEGORIES.includes(
              d.tradeCategory as ToolTradeCategory
            )
              ? d.tradeCategory
              : 'Woodcraft & Joinery') as ToolTradeCategory,
            materialsSpec: String(d.materialsSpec || ''),
            craftStory: String(d.craftStory || ''),
            sellerBenchTag: String(d.sellerBenchTag || ''),
            priceCents: Number(d.priceCents) || 1500,
            stockCount: Number(d.stockCount) || 0,
            status: d.status === 'sold_out' ? 'sold_out' : 'active',
            createdAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setCloudItems(list);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'canopyPaypalItems');
      }
    );

    return () => unsubActive();
  }, [isOpen, user]);

  // Subscribe to signed-in user's own listings (including sold_out) & profile handle
  useEffect(() => {
    if (!isOpen || !user || !VALID_DOC_ID_REGEX.test(user.uid)) {
      setOwnCloudItems([]);
      return;
    }

    const profRef = doc(db, 'publicProfiles', user.uid);
    const unsubProf = onSnapshot(
      profRef,
      (snap) => {
        setProfileLoaded(true);
        setProfileExists(snap.exists());
        if (snap.exists()) {
          const uname = snap.data().username;
          if (typeof uname === 'string' && uname.trim()) {
            setMemberHandle(uname.trim());
            setSellerNameInput((prev) => prev || uname.trim());
          }
        }
      },
      () => {
        // Ignore profile read errors
      }
    );

    const ownQ = query(
      collection(db, 'canopyPaypalItems'),
      where('sellerId', '==', user.uid),
      limit(25)
    );
    const unsubOwn = onSnapshot(
      ownQ,
      (snap) => {
        const list: CanopyPaypalItemRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.status === 'archived') return;
          const ts = d.createdAt as Timestamp | undefined;
          list.push({
            id: docSnap.id,
            sellerId: String(d.sellerId || ''),
            sellerName: String(d.sellerName || 'Canopy Maker'),
            title: String(d.title || ''),
            tradeCategory: (d.tradeCategory ||
              'Woodcraft & Joinery') as ToolTradeCategory,
            materialsSpec: String(d.materialsSpec || ''),
            craftStory: String(d.craftStory || ''),
            sellerBenchTag: String(d.sellerBenchTag || ''),
            priceCents: Number(d.priceCents) || 1500,
            stockCount: Number(d.stockCount) || 0,
            status: d.status === 'sold_out' ? 'sold_out' : 'active',
            createdAtMs:
              ts && typeof ts.toMillis === 'function'
                ? ts.toMillis()
                : Date.now(),
            source: 'cloud',
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setOwnCloudItems(list);
      },
      (err) => {
        if (isQuotaExceededError(err) || isTransientOfflineOrTokenError(err)) {
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'canopyPaypalItems');
      }
    );

    return () => {
      unsubProf();
      unsubOwn();
    };
  }, [isOpen, user]);

  // Combine Cloud + Local + Curated Canopy Maker Works
  const allStoreItems = useMemo(() => {
    const byId = new Map<string, CanopyPaypalItemRecord>();
    for (const item of cloudItems) {
      byId.set(item.id, item);
    }
    for (const item of ownCloudItems) {
      if (!byId.has(item.id) && item.status !== 'archived') {
        byId.set(item.id, item);
      }
    }
    for (const item of localItems) {
      if (item.status !== 'archived' && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    for (const starter of CURATED_CANOPY_STARTERS) {
      const overrideStock = curatedStockOverrides[starter.id];
      const stockCount =
        typeof overrideStock === 'number' ? overrideStock : starter.stockCount;
      byId.set(starter.id, {
        ...starter,
        stockCount,
        status: stockCount > 0 ? 'active' : 'sold_out',
      });
    }
    return Array.from(byId.values());
  }, [cloudItems, ownCloudItems, localItems, curatedStockOverrides]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStoreItems.filter((item) => {
      if (
        categoryFilter !== 'All' &&
        item.tradeCategory !== categoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.sellerName.toLowerCase().includes(q) ||
        item.materialsSpec.toLowerCase().includes(q) ||
        item.craftStory.toLowerCase().includes(q)
      );
    });
  }, [allStoreItems, categoryFilter, searchQuery]);

  const cartLines = useMemo(() => {
    const lines: Array<{
      item: CanopyPaypalItemRecord;
      quantity: number;
      lineTotalCents: number;
    }> = [];
    for (const [id, qty] of Object.entries(cart)) {
      if (qty <= 0) continue;
      const found = allStoreItems.find((x) => x.id === id);
      if (found && found.stockCount > 0) {
        const clampedQty = Math.min(qty, found.stockCount);
        lines.push({
          item: found,
          quantity: clampedQty,
          lineTotalCents: clampedQty * found.priceCents,
        });
      }
    }
    return lines;
  }, [cart, allStoreItems]);

  const cartTotalCents = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.lineTotalCents, 0),
    [cartLines]
  );

  const decrementPurchasedStock = useCallback(
    async (
      purchasedLines: Array<{
        item: CanopyPaypalItemRecord;
        quantity: number;
      }>
    ) => {
      for (const { item, quantity } of purchasedLines) {
        const nextStock = Math.max(0, item.stockCount - quantity);
        if (item.source === 'curated') {
          setCuratedStockOverrides((prev) => ({
            ...prev,
            [item.id]: nextStock,
          }));
        } else if (item.source === 'local') {
          setLocalItems((prev) => {
            const updated = prev.map((loc) =>
              loc.id === item.id
                ? {
                    ...loc,
                    stockCount: nextStock,
                    status: (nextStock === 0
                      ? 'sold_out'
                      : 'active') as CanopyPaypalItemRecord['status'],
                  }
                : loc
            );
            saveLocalCanopyItems(updated);
            return updated;
          });
        } else if (
          item.source === 'cloud' &&
          user?.emailVerified &&
          user.uid !== item.sellerId
        ) {
          try {
            await updateDoc(doc(db, 'canopyPaypalItems', item.id), {
              stockCount: nextStock,
              status: nextStock === 0 ? 'sold_out' : 'active',
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Non-blocking if buyer is guest or already updated
          }
        }
      }
    },
    [user]
  );

  // Render live PayPal Buttons into container when on Browse tab with items in basket
  useEffect(() => {
    if (
      !isOpen ||
      activeTab !== 'browse' ||
      !paypalSdkReady ||
      cartLines.length === 0 ||
      !paypalContainerRef.current
    ) {
      return;
    }

    const paypalNs = (window as unknown as { paypal?: PayPalNamespace }).paypal;
    if (!paypalNs?.Buttons) return;

    const container = paypalContainerRef.current;
    container.innerHTML = '';

    const buttons = paypalNs.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
      },
      createOrder: async () => {
        setCheckoutError(null);
        const res = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venue: 'canopy',
            buyerNote: buyerNote.trim(),
            items: cartLines.map((l) => ({
              itemId: l.item.id,
              title: l.item.title,
              quantity: l.quantity,
              unitPriceCents: l.item.priceCents,
            })),
          }),
        });
        const data = (await res.json()) as {
          orderID?: string;
          error?: string;
        };
        if (!res.ok || !data.orderID) {
          const errText =
            data.error || 'Could not create Canopy PayPal order.';
          setCheckoutError(errText);
          throw new Error(errText);
        }
        return data.orderID;
      },
      onApprove: async (data) => {
        setCheckoutBusy(true);
        setCheckoutError(null);
        try {
          const snapshotLines = [...cartLines];
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          const cap = (await res.json()) as {
            receipt?: VerifiedReceipt;
            error?: string;
          };
          if (!res.ok || !cap.receipt) {
            throw new Error(
              cap.error || 'PayPal capture could not be verified.'
            );
          }
          await decrementPurchasedStock(snapshotLines);
          setLatestReceipt(cap.receipt);
          setCart({});
          setBuyerNote('');
          onUpdateLocalProgress(
            {
              ...localProgress,
              treehouseTokens: localProgress.treehouseTokens + 2,
              sharesCompleted: localProgress.sharesCompleted + 1,
            },
            'Canopy PayPal Store order complete (+2 Canopy Tokens)!'
          );
        } catch (err) {
          setCheckoutError(
            err instanceof Error ? err.message : 'PayPal capture error.'
          );
        } finally {
          setCheckoutBusy(false);
        }
      },
      onError: (err) => {
        setCheckoutError(
          err instanceof Error
            ? err.message
            : 'PayPal checkout encountered an issue.'
        );
      },
    });

    if (buttons.isEligible()) {
      void buttons.render(container);
    }

    return () => {
      try {
        void buttons.close();
      } catch {
        // Ignore teardown errors
      }
    };
  }, [
    isOpen,
    activeTab,
    paypalSdkReady,
    cartLines,
    buyerNote,
    decrementPurchasedStock,
    localProgress,
    onUpdateLocalProgress,
  ]);

  if (!isOpen) return null;

  const handleAddToCart = (item: CanopyPaypalItemRecord) => {
    setLatestReceipt(null);
    setCheckoutError(null);
    setCart((prev) => {
      const current = prev[item.id] || 0;
      if (current >= item.stockCount) return prev;
      return { ...prev, [item.id]: current + 1 };
    });
  };

  const handleSetQty = (itemId: string, nextQty: number, maxStock: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (nextQty <= 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = Math.min(maxStock, nextQty);
      }
      return copy;
    });
  };

  const handleReserveCanopyHold = async () => {
    if (cartLines.length === 0) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const snapshotLines = [...cartLines];
      const res = await fetch('/api/paypal/reserve-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue: 'canopy',
          buyerNote: buyerNote.trim() || '33m Canopy Counter Pickup',
          items: snapshotLines.map((l) => ({
            itemId: l.item.id,
            title: l.item.title,
            quantity: l.quantity,
            unitPriceCents: l.item.priceCents,
          })),
        }),
      });
      const data = (await res.json()) as {
        receipt?: VerifiedReceipt;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        throw new Error(
          data.error || 'Could not reserve Canopy Counter pickup.'
        );
      }
      await decrementPurchasedStock(snapshotLines);
      setLatestReceipt(data.receipt);
      setCart({});
      setBuyerNote('');
      onUpdateLocalProgress(
        {
          ...localProgress,
          tryingTokens: localProgress.tryingTokens + 1,
        },
        'Reserved maker work at the 33m Canopy Store Counter (+1 Trying Token)!'
      );
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Could not complete reservation.'
      );
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleFillAgarwoodExample = () => {
    setSellerNameInput(memberHandle || 'OudStillApprentice');
    setTitleInput('Small-Batch Agarwood Bark Essential Oil (15ml)');
    setTradeCategoryInput('Botanical & Essential Oils');
    setMaterialsInput(
      '15ml amber glass dropper vial · Cultivated Agarwood bark hydro-distillate · Large-print batch label'
    );
    setStoryInput(
      'Hydro-distilled from resinous Agarwood bark shavings at a calm unhurried pace, filtered into amber glass, and labelled with high-contrast tactile typography for sale in the 33m Canopy Store.'
    );
    setBenchTagInput('Canopy Still #05 · PayPal Verified');
    setPricePoundsInput('28.00');
    setStockInput('6');
    setSellError(null);
    setSellFeedback(
      'Loaded Agarwood Essential Oil maker example — edit any detail or publish directly below!'
    );
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setSellError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setSellError('Could not complete Google Sign-In. Please try again.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePublishWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);
    setSellFeedback(null);

    const cleanSeller = (sellerNameInput.trim() || memberHandle).slice(
      0,
      USERNAME_MAX_LENGTH
    );
    const cleanTitle = titleInput.trim().slice(0, CANOPY_PAYPAL_TITLE_MAX);
    const cleanSpec = materialsInput.trim().slice(0, CANOPY_PAYPAL_SPEC_MAX);
    const cleanStory = storyInput.trim().slice(0, CANOPY_PAYPAL_STORY_MAX);
    const cleanTag = benchTagInput.trim().slice(0, CANOPY_PAYPAL_TAG_MAX);
    const parsedPounds = Number(pricePoundsInput);
    const priceCents = Math.round(parsedPounds * 100);
    const stockCount = Math.floor(Number(stockInput) || 0);

    if (cleanSeller.length < USERNAME_MIN_LENGTH) {
      setSellError(
        `Maker handle must be at least ${USERNAME_MIN_LENGTH} characters.`
      );
      return;
    }
    if (cleanTitle.length < CANOPY_PAYPAL_TITLE_MIN) {
      setSellError(
        `Work title must be between ${CANOPY_PAYPAL_TITLE_MIN} and ${CANOPY_PAYPAL_TITLE_MAX} characters.`
      );
      return;
    }
    if (cleanSpec.length < CANOPY_PAYPAL_SPEC_MIN) {
      setSellError(
        `Materials & dimensions must be at least ${CANOPY_PAYPAL_SPEC_MIN} characters.`
      );
      return;
    }
    if (cleanStory.length < CANOPY_PAYPAL_STORY_MIN) {
      setSellError(
        `Maker craft story must be at least ${CANOPY_PAYPAL_STORY_MIN} characters.`
      );
      return;
    }
    if (
      !Number.isFinite(priceCents) ||
      priceCents < CANOPY_PAYPAL_MIN_PRICE_CENTS ||
      priceCents > CANOPY_PAYPAL_MAX_PRICE_CENTS
    ) {
      setSellError('Price must be between £3.00 and £2,500.00 GBP.');
      return;
    }
    if (stockCount < 1 || stockCount > CANOPY_PAYPAL_MAX_STOCK) {
      setSellError(`Stock quantity must be between 1 and ${CANOPY_PAYPAL_MAX_STOCK}.`);
      return;
    }

    // Boots-on-Ground Censor Screening
    const censor = screenBootsOnGroundCensor(
      `${cleanSeller} ${cleanTitle} ${cleanSpec} ${cleanStory} ${cleanTag}`
    );
    if (!censor.allowed) {
      setSellError(
        censor.reason || 'Listing held by Boots-on-Ground Censor.'
      );
      return;
    }

    // If not signed in or unverified email, save immediately to local Canopy Store so user can test right away
    if (!user || !user.emailVerified || !VALID_DOC_ID_REGEX.test(user.uid)) {
      const localRecord: CanopyPaypalItemRecord = {
        id: `local-canopy-${Date.now().toString(36)}`,
        sellerId: user?.uid || 'local_maker',
        sellerName: cleanSeller,
        title: cleanTitle,
        tradeCategory: tradeCategoryInput,
        materialsSpec: cleanSpec,
        craftStory: cleanStory,
        sellerBenchTag: cleanTag,
        priceCents,
        stockCount,
        status: 'active',
        createdAtMs: Date.now(),
        source: 'local',
      };
      const updated = [localRecord, ...localItems];
      setLocalItems(updated);
      saveLocalCanopyItems(updated);
      onUpdateLocalProgress(
        {
          ...localProgress,
          tryingTokens: localProgress.tryingTokens + 1,
          treehouseTokens: localProgress.treehouseTokens + 1,
        },
        `Listed "${cleanTitle}" on the 33m Canopy PayPal Store (+1 Trying & +1 Canopy Token)!`
      );
      setTitleInput('');
      setMaterialsInput('');
      setStoryInput('');
      setSellFeedback(
        `Listed "${cleanTitle}" on this Canopy counter! Sign in with Google anytime to publish across all club visitors.`
      );
      setActiveTab('browse');
      return;
    }

    setSellBusy(true);
    const newId = `cp_${user.uid.slice(0, 10)}_${Date.now().toString(36)}`;
    const itemPath = `canopyPaypalItems/${newId}`;

    const saveFallbackLocalListing = (noticeText: string) => {
      const localRecord: CanopyPaypalItemRecord = {
        id: `local-canopy-${Date.now().toString(36)}`,
        sellerId: user.uid,
        sellerName: cleanSeller,
        title: cleanTitle,
        tradeCategory: tradeCategoryInput,
        materialsSpec: cleanSpec,
        craftStory: cleanStory,
        sellerBenchTag: cleanTag,
        priceCents,
        stockCount,
        status: 'active',
        createdAtMs: Date.now(),
        source: 'local',
      };
      const updated = [localRecord, ...localItems];
      setLocalItems(updated);
      saveLocalCanopyItems(updated);
      onUpdateLocalProgress(
        {
          ...localProgress,
          tryingTokens: localProgress.tryingTokens + 1,
          treehouseTokens: localProgress.treehouseTokens + 1,
        },
        `Listed "${cleanTitle}" on the 33m Canopy PayPal Store (+1 Trying & +1 Canopy Token)!`
      );
      setTitleInput('');
      setMaterialsInput('');
      setStoryInput('');
      setSellFeedback(noticeText);
      setActiveTab('browse');
    };

    try {
      const profileRef = doc(db, 'publicProfiles', user.uid);
      let hasProfile = profileExists;
      if (!hasProfile && !profileLoaded) {
        const { snap: profSnap, timedOut } = await getDocWithTimeout(profileRef);
        if (timedOut) {
          saveFallbackLocalListing(
            `Listed "${cleanTitle}" on this Canopy counter — cloud sync queued while reconnecting!`
          );
          return;
        }
        hasProfile = Boolean(profSnap?.exists());
      }

      const itemRef = doc(db, 'canopyPaypalItems', newId);
      const itemPayload = {
        sellerId: user.uid,
        sellerName: cleanSeller,
        title: cleanTitle,
        tradeCategory: tradeCategoryInput,
        materialsSpec: cleanSpec,
        craftStory: cleanStory,
        sellerBenchTag: cleanTag,
        priceCents,
        stockCount,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const writeOp = hasProfile
        ? setDoc(itemRef, itemPayload)
        : (() => {
            const batch = writeBatch(db);
            batch.set(profileRef, {
              uid: user.uid,
              username: cleanSeller,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            batch.set(itemRef, itemPayload);
            return batch.commit();
          })();

      const { settled } = await withCloudWriteTimeout(writeOp, 2400);
      if (!settled) {
        saveFallbackLocalListing(
          `Listed "${cleanTitle}" on this Canopy counter — cloud sync queued while reconnecting!`
        );
        return;
      }

      setProfileExists(true);
      setProfileLoaded(true);

      onUpdateLocalProgress(
        {
          ...localProgress,
          tryingTokens: localProgress.tryingTokens + 1,
          treehouseTokens: localProgress.treehouseTokens + 2,
          sharesCompleted: localProgress.sharesCompleted + 1,
        },
        `Published "${cleanTitle}" to the 33m Canopy PayPal Store (+2 Canopy Tokens)!`
      );

      setTitleInput('');
      setMaterialsInput('');
      setStoryInput('');
      setSellFeedback(
        `Published "${cleanTitle}" live to the 33m Canopy PayPal Store!`
      );
      setActiveTab('browse');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        saveFallbackLocalListing(
          `Listed "${cleanTitle}" locally on this Canopy counter (daily cloud quota reached).`
        );
      } else if (isTransientOfflineOrTokenError(err)) {
        saveFallbackLocalListing(
          `Listed "${cleanTitle}" on this Canopy counter while cloud connection is offline.`
        );
      } else {
        handleFirestoreError(err, OperationType.CREATE, itemPath);
      }
    } finally {
      setSellBusy(false);
    }
  };

  const handleArchiveItem = async (item: CanopyPaypalItemRecord) => {
    if (item.source === 'local') {
      const next = localItems.filter((x) => x.id !== item.id);
      setLocalItems(next);
      saveLocalCanopyItems(next);
      return;
    }
    if (!user || item.sellerId !== user.uid) return;
    try {
      await withCloudWriteTimeout(
        updateDoc(doc(db, 'canopyPaypalItems', item.id), {
          status: 'archived',
          stockCount: 0,
          updatedAt: serverTimestamp(),
        }),
        2200
      );
    } catch (err) {
      if (
        !isQuotaExceededError(err) &&
        !isTransientOfflineOrTokenError(err)
      ) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `canopyPaypalItems/${item.id}`
        );
      }
    }
  };

  const myListings = [
    ...ownCloudItems,
    ...localItems.filter((x) => x.status !== 'archived'),
  ];

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="canopy-paypal-store-heading"
      className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-[#09110C]/80 p-3 sm:p-6"
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#111C15] border-2 border-[#FFD166]/65 text-[#F7F4EB] shadow-2xl overflow-hidden">
        {/* Top Storefront Header */}
        <div className="px-5 py-4 sm:px-6 bg-[#17261D] border-b border-[#8FB996]/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-[#7CE0A3] font-semibold">
              33m Treetop Canopy · {dualCalendar.combined}
            </p>
            <h2
              id="canopy-paypal-store-heading"
              className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-[#FFFFFF] flex items-center gap-2"
            >
              <Store className="w-6 h-6 text-[#FFD166] shrink-0" />
              <span>Canopy PayPal Maker Store</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCanopyCustomizer}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1D2F24] border border-[#8FB996]/45 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#F7F4EB] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#E5A93C]" />
              <span>Customise Upstairs</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#281B11] border border-[#FFD166]/70 hover:bg-[#362417] text-xs sm:text-sm font-bold text-[#FFD166] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close Store</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 py-3 sm:px-6 bg-[#132018] border-b border-[#8FB996]/25 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'browse'
                  ? 'bg-[#E5A93C] text-[#171008]'
                  : 'bg-[#1A2B20] border border-[#8FB996]/35 text-[#E5EFE8] hover:border-[#FFD166]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                01. Browse Canopy Works &amp; PayPal Checkout (
                {allStoreItems.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sell')}
              className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === 'sell'
                  ? 'bg-[#7CE0A3] text-[#0D1A12]'
                  : 'bg-[#1A2B20] border border-[#8FB996]/35 text-[#E5EFE8] hover:border-[#7CE0A3]'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>02. Sell Your Work ({myListings.length})</span>
            </button>
          </div>

          <span className="font-mono tabular-nums text-xs sm:text-sm text-[#FFD166] font-semibold">
            Basket: {formatGbp(cartTotalCents)} ({cartLines.length}{' '}
            {cartLines.length === 1 ? 'item' : 'items'})
          </span>
        </div>

        {/* Body */}
        <div className="mobile-touch-scroll flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {onOpenBankOfTreetop && (
            <div className="rounded-xl bg-[#16291F] border border-[#D4AF37]/55 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-bold text-[#FFE082]">
                  Saving Up for Special-Interest Starter Stock? Visit Bank of
                  Treetop (Not a Real Bank)
                </div>
                <p className="text-xs text-[#D2E6DA]">
                  Set aside symbolic Trying, Gathering &amp; Treehouse Tokens
                  toward craft starter stock. Disclaimer: Bank of Treetop is NOT
                  a real bank and holds zero real money.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenBankOfTreetop}
                className="touch-manipulation min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1D3E2C] hover:bg-[#26523B] border border-[#FFD166] text-xs font-bold text-[#FFE082] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Bank of Treetop Guide →
              </button>
            </div>
          )}

          {activeTab === 'browse' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Columns: Maker Works Catalog */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2.5">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Canopy handcrafted works, Agarwood oils, woodwork, or makers..."
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      ['All', ...CANOPY_PAYPAL_CATEGORIES] as Array<
                        'All' | ToolTradeCategory
                      >
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          categoryFilter === cat
                            ? 'bg-[#E5A93C] text-[#171008]'
                            : 'bg-[#17261D] border border-[#8FB996]/30 text-[#D6E6DC] hover:border-[#FFD166]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {sellFeedback && (
                  <div className="rounded-xl bg-[#162C20] border border-[#7CE0A3]/60 p-3.5 text-sm font-medium text-[#DCFCE7]">
                    {sellFeedback}
                  </div>
                )}

                <div className="space-y-3.5">
                  {filteredItems.map((item) => {
                    const inCartQty = cart[item.id] || 0;
                    const soldOut =
                      item.stockCount <= 0 || item.status === 'sold_out';
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl bg-[#0D1711] border border-[#8FB996]/35 p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-mono text-[#7CE0A3] font-semibold">
                            {item.tradeCategory} · Maker: {item.sellerName}
                          </span>
                          <span className="font-mono tabular-nums text-base sm:text-lg font-bold text-[#FFD166]">
                            {formatGbp(item.priceCents)}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-[#FFFFFF] leading-snug">
                          {item.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-[#BFD5C7] font-medium">
                          {item.materialsSpec}
                        </p>

                        <p className="text-sm text-[#E8F2EC] leading-relaxed">
                          {item.craftStory}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs font-mono tabular-nums text-[#9DC0A6]">
                            {soldOut
                              ? 'Sold Out on Counter'
                              : `${item.stockCount} available`}
                            {item.sellerBenchTag
                              ? ` · ${item.sellerBenchTag}`
                              : ''}
                          </div>

                          <div className="flex items-center gap-2">
                            {user && item.sellerId === user.uid && (
                              <button
                                type="button"
                                onClick={() => handleArchiveItem(item)}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#291715] border border-[#F87171]/45 hover:border-[#F87171] text-xs font-semibold text-[#FCA5A5] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Archive</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={soldOut || inCartQty >= item.stockCount}
                              onClick={() => handleAddToCart(item)}
                              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] disabled:opacity-45 text-[#171008] font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>
                                {soldOut
                                  ? 'Sold Out'
                                  : inCartQty > 0
                                    ? `In Basket (${inCartQty})`
                                    : 'Add to Basket'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Columns: PayPal Checkout & Canopy Counter Basket */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-xl bg-[#0D1711] border-2 border-[#E5A93C]/50 p-4 sm:p-5 space-y-4">
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#8FB996]/25 pb-3">
                    <h3 className="text-base sm:text-lg font-bold text-[#FFFFFF]">
                      Canopy Checkout Basket
                    </h3>
                    <span className="font-mono tabular-nums text-lg font-bold text-[#FFD166]">
                      {formatGbp(cartTotalCents)}
                    </span>
                  </div>

                  {cartLines.length === 0 ? (
                    <p className="text-sm text-[#C8DDD0] leading-relaxed">
                      Your Canopy basket is empty. Add any handcrafted item on
                      the left—or switch to{' '}
                      <button
                        type="button"
                        onClick={() => setActiveTab('sell')}
                        className="text-[#FFD166] font-semibold underline cursor-pointer"
                      >
                        02. Sell Your Work
                      </button>{' '}
                      to put your own craft on sale upstairs!
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-[#8FB996]/20">
                        {cartLines.map(({ item, quantity, lineTotalCents }) => (
                          <div
                            key={item.id}
                            className="py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#FFFFFF] truncate">
                                {item.title}
                              </p>
                              <p className="text-xs font-mono tabular-nums text-[#9DC0A6]">
                                {formatGbp(item.priceCents)} each ·{' '}
                                {item.sellerName}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetQty(
                                    item.id,
                                    quantity - 1,
                                    item.stockCount
                                  )
                                }
                                className="w-8 h-8 rounded-lg bg-[#1A2B20] border border-[#8FB996]/40 text-sm font-bold text-[#FFFFFF] cursor-pointer"
                                aria-label={`Decrease quantity of ${item.title}`}
                              >
                                −
                              </button>
                              <span className="w-7 text-center font-mono tabular-nums text-sm font-bold text-[#FFD166]">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetQty(
                                    item.id,
                                    quantity + 1,
                                    item.stockCount
                                  )
                                }
                                className="w-8 h-8 rounded-lg bg-[#1A2B20] border border-[#8FB996]/40 text-sm font-bold text-[#FFFFFF] cursor-pointer"
                                aria-label={`Increase quantity of ${item.title}`}
                              >
                                +
                              </button>
                              <span className="ml-1 font-mono tabular-nums text-sm font-semibold text-[#F7F4EB]">
                                {formatGbp(lineTotalCents)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label
                          htmlFor="canopy-buyer-note"
                          className="block text-xs sm:text-sm font-semibold text-[#E5EFE8] mb-1"
                        >
                          Optional Canopy Pickup or Gift Note (Non-PII)
                        </label>
                        <input
                          id="canopy-buyer-note"
                          type="text"
                          maxLength={180}
                          value={buyerNote}
                          onChange={(e) => setBuyerNote(e.target.value)}
                          placeholder="e.g. Collect after Thursday Woodcraft Rota"
                          className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#132018] border border-[#8FB996]/40 focus:border-[#FFD166] focus:outline-none text-sm text-[#FFFFFF]"
                        />
                      </div>

                      {/* Live PayPal Smart Buttons or Clear Sandbox Guidance */}
                      <div className="space-y-3 pt-1">
                        {paypalConfig?.configured && paypalSdkReady ? (
                          <div className="rounded-xl bg-[#F7F4EB] p-3">
                            <div ref={paypalContainerRef} />
                          </div>
                        ) : (
                          <div className="rounded-xl bg-[#16241B] border border-[#E5A93C]/45 p-3.5 text-xs sm:text-sm text-[#E5EFE8] leading-relaxed">
                            <p className="font-bold text-[#FFD166]">
                              PayPal Checkout ({paypalConfig?.mode || 'sandbox'})
                            </p>
                            <p className="mt-1 text-[#C8DDD0]">
                              {paypalConfig?.configured
                                ? 'Loading embedded PayPal Checkout buttons...'
                                : 'Live PayPal merchant keys are not set in this preview environment yet—use "Reserve at 33m Canopy Counter" below to test the full server-verified order & receipt flow immediately.'}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={checkoutBusy}
                          onClick={handleReserveCanopyHold}
                          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#274632] border border-[#7CE0A3] hover:bg-[#31583F] disabled:opacity-50 text-sm sm:text-base font-bold text-[#FFFFFF] cursor-pointer transition-colors"
                        >
                          {checkoutBusy
                            ? 'Processing Order...'
                            : `Reserve at 33m Canopy Counter (${formatGbp(cartTotalCents)})`}
                        </button>
                      </div>
                    </>
                  )}

                  {checkoutError && (
                    <div className="rounded-xl bg-[#2B1614] border border-[#F87171]/60 p-3 text-xs sm:text-sm font-medium text-[#FECACA]">
                      {checkoutError}
                    </div>
                  )}
                </div>

                {/* Verified Order Receipt Card */}
                {latestReceipt && (
                  <div className="rounded-xl bg-[#14291D] border-2 border-[#7CE0A3] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[#7CE0A3] font-bold text-sm sm:text-base">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>Canopy Store Receipt Confirmed</span>
                    </div>
                    <p className="font-mono tabular-nums text-xs text-[#E5EFE8]">
                      Ref: {latestReceipt.receiptId} · Total:{' '}
                      {formatGbp(latestReceipt.totalCents)} GBP
                    </p>
                    <ul className="text-xs sm:text-sm text-[#D6E8DC] space-y-1">
                      {latestReceipt.items.map((ln) => (
                        <li key={`${ln.itemId}-${ln.title}`}>
                          {ln.quantity}× {ln.title} (
                          {formatGbp(ln.unitPriceCents * ln.quantity)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 02: SELL YOUR WORK AT THE 33M CANOPY PAYPAL STORE */
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="rounded-xl bg-[#0D1711] border border-[#7CE0A3]/40 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#FFD166]">
                    List Your Handcrafted Work at the 33m Canopy Store
                  </h3>
                  <p className="text-xs sm:text-sm text-[#D4E6DA]">
                    Sell your woodwork, lanterns, woven textiles, or bottled
                    Agarwood bark essential oil. Screened automatically by the
                    Boots-on-Ground Censor for calm community safety.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillAgarwoodExample}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1C2F23] border border-[#E5A93C]/60 hover:border-[#FFD166] text-xs sm:text-sm font-semibold text-[#FFD166] whitespace-nowrap cursor-pointer"
                  >
                    Fill Agarwood Oil Example
                  </button>
                  {!user && (
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={handleGoogleSignIn}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E5A93C] hover:bg-[#FFD166] text-xs sm:text-sm font-bold text-[#171008] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {authBusy ? 'Signing In...' : 'Sign In for Cloud Sync'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handlePublishWork} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="canopy-sell-maker"
                      className="block text-xs sm:text-sm font-semibold text-[#FFFFFF] mb-1"
                    >
                      Your Maker Handle (Non-PII)
                    </label>
                    <input
                      id="canopy-sell-maker"
                      type="text"
                      required
                      minLength={USERNAME_MIN_LENGTH}
                      maxLength={USERNAME_MAX_LENGTH}
                      value={sellerNameInput}
                      onChange={(e) => setSellerNameInput(e.target.value)}
                      placeholder="e.g. CedarApprentice"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="canopy-sell-category"
                      className="block text-xs sm:text-sm font-semibold text-[#FFFFFF] mb-1"
                    >
                      Canopy Trade Category
                    </label>
                    <select
                      id="canopy-sell-category"
                      value={tradeCategoryInput}
                      onChange={(e) =>
                        setTradeCategoryInput(
                          e.target.value as ToolTradeCategory
                        )
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
                    >
                      {CANOPY_PAYPAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <label
                      htmlFor="canopy-sell-title"
                      className="text-xs sm:text-sm font-semibold text-[#FFFFFF]"
                    >
                      Title of Your Work
                    </label>
                    <span className="font-mono tabular-nums text-xs text-[#9DC0A6]">
                      {titleInput.trim().length}/{CANOPY_PAYPAL_TITLE_MAX}
                    </span>
                  </div>
                  <input
                    id="canopy-sell-title"
                    type="text"
                    required
                    minLength={CANOPY_PAYPAL_TITLE_MIN}
                    maxLength={CANOPY_PAYPAL_TITLE_MAX}
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="e.g. Hand-Turned Agarwood Oil Scent Diffuser"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <label
                      htmlFor="canopy-sell-materials"
                      className="text-xs sm:text-sm font-semibold text-[#FFFFFF]"
                    >
                      Materials, Label &amp; Dimensions
                    </label>
                    <span className="font-mono tabular-nums text-xs text-[#9DC0A6]">
                      {materialsInput.trim().length}/{CANOPY_PAYPAL_SPEC_MAX}
                    </span>
                  </div>
                  <input
                    id="canopy-sell-materials"
                    type="text"
                    required
                    minLength={CANOPY_PAYPAL_SPEC_MIN}
                    maxLength={CANOPY_PAYPAL_SPEC_MAX}
                    value={materialsInput}
                    onChange={(e) => setMaterialsInput(e.target.value)}
                    placeholder="e.g. Reclaimed white oak, solid brass hardware, natural beeswax finish"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF]"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <label
                      htmlFor="canopy-sell-story"
                      className="text-xs sm:text-sm font-semibold text-[#FFFFFF]"
                    >
                      Maker Craft Story (How you made it)
                    </label>
                    <span className="font-mono tabular-nums text-xs text-[#9DC0A6]">
                      {storyInput.trim().length}/{CANOPY_PAYPAL_STORY_MAX}
                    </span>
                  </div>
                  <textarea
                    id="canopy-sell-story"
                    rows={3}
                    required
                    minLength={CANOPY_PAYPAL_STORY_MIN}
                    maxLength={CANOPY_PAYPAL_STORY_MAX}
                    value={storyInput}
                    onChange={(e) => setStoryInput(e.target.value)}
                    placeholder="Describe your process, tools of the trade, or special-interest inspiration..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base text-[#FFFFFF] leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="canopy-sell-price"
                      className="block text-xs sm:text-sm font-semibold text-[#FFFFFF] mb-1"
                    >
                      Price (£ GBP)
                    </label>
                    <input
                      id="canopy-sell-price"
                      type="number"
                      step="0.50"
                      min="3.00"
                      max="2500.00"
                      required
                      value={pricePoundsInput}
                      onChange={(e) => setPricePoundsInput(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base font-mono tabular-nums text-[#FFD166]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="canopy-sell-stock"
                      className="block text-xs sm:text-sm font-semibold text-[#FFFFFF] mb-1"
                    >
                      Stock Quantity (1–100)
                    </label>
                    <input
                      id="canopy-sell-stock"
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm sm:text-base font-mono tabular-nums text-[#FFFFFF]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="canopy-sell-tag"
                      className="block text-xs sm:text-sm font-semibold text-[#FFFFFF] mb-1"
                    >
                      Stall / PayPal Ref (Non-PII)
                    </label>
                    <input
                      id="canopy-sell-tag"
                      type="text"
                      maxLength={CANOPY_PAYPAL_TAG_MAX}
                      value={benchTagInput}
                      onChange={(e) => setBenchTagInput(e.target.value)}
                      placeholder="e.g. Canopy Stall #06"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0B140F] border border-[#8FB996]/45 focus:border-[#FFD166] focus:outline-none text-sm text-[#FFFFFF]"
                    />
                  </div>
                </div>

                {sellError && (
                  <div className="rounded-xl bg-[#2B1614] border border-[#F87171]/60 p-3.5 text-sm font-medium text-[#FECACA]">
                    {sellError}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#9DC0A6]">
                    Never include personal email addresses, phone numbers, or
                    home addresses.
                  </p>

                  <button
                    type="submit"
                    disabled={sellBusy}
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#7CE0A3] hover:bg-[#A8F5C4] disabled:opacity-50 text-[#0C1911] font-bold text-sm sm:text-base whitespace-nowrap cursor-pointer"
                  >
                    {sellBusy
                      ? 'Publishing to Canopy Store...'
                      : user?.emailVerified
                        ? 'Publish Work to Canopy PayPal Store'
                        : 'List Work on Canopy Counter'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
