import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadScript, type PayPalNamespace } from '@paypal/paypal-js';
import { User, signInWithPopup } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Eye,
  LogIn,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import drazellaBookImg from '../assets/images/drazella_sprinkles_book_1793008697361.jpg';
import {
  ARTISAN_ITEM_CATEGORIES,
  ARTISAN_MATERIALS_MAX_LENGTH,
  ARTISAN_MATERIALS_MIN_LENGTH,
  ARTISAN_STORY_MAX_LENGTH,
  ARTISAN_STORY_MIN_LENGTH,
  ARTISAN_TITLE_MAX_LENGTH,
  ARTISAN_TITLE_MIN_LENGTH,
  ArtisanItemCategory,
  MAX_ARTISAN_PRICE_CENTS,
  MAX_ARTISAN_STOCK,
  MIN_ARTISAN_PRICE_CENTS,
  OperationType,
  VALID_DOC_ID_REGEX,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
} from '../firebase';
import {
  HANDCRAFTED_WELCOME_CATALOG,
  type CartLineInput,
  type VerifiedOrderReceipt,
  type WelcomeShopCategory,
} from '../shared/workshopCatalog';
import { formatDualTimestamp } from '../utils/dualCalendar';
import {
  screenBootsOnGroundCensor,
  screenForHarmToHumansOrAnimals,
} from '../utils/ethicalGuard';

const CATALOG_IMAGE_MAP: Record<string, string> = {
  drazella_sprinkles_book: drazellaBookImg,
};

interface ShopProductCardItem {
  id: string;
  title: string;
  makerName: string;
  category: WelcomeShopCategory;
  materialsAndDimensions: string;
  story: string;
  priceCents: number;
  stockCount: number;
  imageUrl?: string;
  isCatalogOfficial: boolean;
}

interface PayPalClientConfig {
  configured: boolean;
  clientId: string | null;
  currency: string;
  mode: string;
  merchantEmail: string | null;
}

interface WelcomeArtisanShopModalProps {
  isOpen: boolean;
  user: User | null;
  authReady: boolean;
  stockById: Record<string, number>;
  onFocusWelcomeMarket: () => void;
  onOrderCompleted: (receipt: VerifiedOrderReceipt) => void;
  onRefreshStock: () => Promise<void>;
  onClose: () => void;
}

function formatGbpFromCents(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

export const WelcomeArtisanShopModal: React.FC<WelcomeArtisanShopModalProps> = ({
  isOpen,
  user,
  authReady,
  stockById,
  onFocusWelcomeMarket,
  onOrderCompleted,
  onRefreshStock,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<'market' | 'sell'>('market');
  const [cartQty, setCartQty] = useState<Record<string, number>>({});
  const [buyerNote, setBuyerNote] = useState<string>('');
  const [paypalConfig, setPaypalConfig] = useState<PayPalClientConfig | null>(
    null
  );
  const [paypalSdkReady, setPaypalSdkReady] = useState<boolean>(false);
  const [checkoutBusy, setCheckoutBusy] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] =
    useState<VerifiedOrderReceipt | null>(null);

  // Member handcrafted listings from Firestore /artisanItems
  const [memberItems, setMemberItems] = useState<ShopProductCardItem[]>([]);
  const [makerName, setMakerName] = useState<string>('');
  const [itemTitle, setItemTitle] = useState<string>('');
  const [itemCategory, setItemCategory] =
    useState<ArtisanItemCategory>('Woodcraft & Joinery');
  const [materialsSpec, setMaterialsSpec] = useState<string>('');
  const [craftStory, setCraftStory] = useState<string>('');
  const [pricePounds, setPricePounds] = useState<string>('28.00');
  const [stockCount, setStockCount] = useState<number>(3);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);

  const paypalButtonsContainerRef = useRef<HTMLDivElement | null>(null);
  const paypalNamespaceRef = useRef<PayPalNamespace | null>(null);

  // Fetch PayPal server configuration on modal open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/paypal/config');
        if (!res.ok) return;
        const data = (await res.json()) as PayPalClientConfig;
        if (!cancelled) {
          setPaypalConfig(data);
        }
      } catch {
        if (!cancelled) {
          setPaypalConfig({
            configured: false,
            clientId: null,
            currency: 'GBP',
            mode: 'sandbox',
            merchantEmail: null,
          });
        }
      }
    };

    void fetchConfig();
    void onRefreshStock();

    return () => {
      cancelled = true;
    };
  }, [isOpen, onRefreshStock]);

  // Subscribe to verified community handcrafted items in Firestore when signed in
  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setMemberItems([]);
      return;
    }

    const q = query(collection(db, 'artisanItems'), limit(40));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded: ShopProductCardItem[] = [];
        snap.forEach((dSnap) => {
          const d = dSnap.data();
          if (d.status !== 'active' && d.makerId !== user.uid) return;
          const cat = ARTISAN_ITEM_CATEGORIES.includes(d.category)
            ? (d.category as ArtisanItemCategory)
            : 'Woodcraft & Joinery';
          loaded.push({
            id: dSnap.id,
            title: String(d.title || 'Handcrafted Piece'),
            makerName: String(d.makerName || 'Club Maker'),
            category: cat,
            materialsAndDimensions: String(d.materialsAndDimensions || ''),
            story: String(d.story || ''),
            priceCents: Number(d.priceCents || 2500),
            stockCount: Number(d.stockCount ?? 1),
            isCatalogOfficial: false,
          });
        });
        setMemberItems(loaded);
      },
      (err) => {
        if (!isQuotaExceededError(err)) {
          handleFirestoreError(err, OperationType.LIST, 'artisanItems');
        }
      }
    );

    return () => unsub();
  }, [isOpen, authReady, user]);

  const allShopItems: ShopProductCardItem[] = useMemo(() => {
    const official: ShopProductCardItem[] = HANDCRAFTED_WELCOME_CATALOG.map(
      (item) => ({
        id: item.id,
        title: item.title,
        makerName: item.makerName,
        category: item.category,
        materialsAndDimensions: item.materialsAndDimensions,
        story: item.story,
        priceCents: item.priceCents,
        stockCount: stockById[item.id] ?? item.initialStock,
        imageUrl: CATALOG_IMAGE_MAP[item.imageKey],
        isCatalogOfficial: true,
      })
    );
    return [...official, ...memberItems];
  }, [memberItems, stockById]);

  const cartLines = useMemo(() => {
    const lines: Array<{ item: ShopProductCardItem; quantity: number }> = [];
    for (const item of allShopItems) {
      const qty = cartQty[item.id] || 0;
      if (qty > 0 && item.stockCount > 0) {
        lines.push({ item, quantity: Math.min(qty, item.stockCount, 5) });
      }
    }
    return lines;
  }, [allShopItems, cartQty]);

  const cartTotalCents = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) => sum + line.item.priceCents * line.quantity,
        0
      ),
    [cartLines]
  );

  const serializedCartPayload: CartLineInput[] = useMemo(
    () =>
      cartLines.map((l) => ({
        itemId: l.item.id,
        title: l.item.title,
        quantity: l.quantity,
        unitPriceCents: l.item.priceCents,
      })),
    [cartLines]
  );

  // Load real @paypal/paypal-js SDK when server provides a configured PAYPAL_CLIENT_ID
  useEffect(() => {
    if (
      !isOpen ||
      !paypalConfig?.configured ||
      !paypalConfig.clientId ||
      activeView !== 'market'
    ) {
      setPaypalSdkReady(false);
      return;
    }

    let cancelled = false;
    loadScript({
      clientId: paypalConfig.clientId,
      currency: paypalConfig.currency || 'GBP',
      intent: 'capture',
    })
      .then((paypalNs) => {
        if (cancelled) return;
        paypalNamespaceRef.current = paypalNs;
        setPaypalSdkReady(Boolean(paypalNs?.Buttons));
      })
      .catch(() => {
        if (!cancelled) {
          setPaypalSdkReady(false);
          setCheckoutError(
            'Could not initialize PayPal JS SDK. Check your PAYPAL_CLIENT_ID configuration.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, paypalConfig, activeView]);

  // Render live PayPal Buttons into container whenever SDK & cart are ready
  useEffect(() => {
    const container = paypalButtonsContainerRef.current;
    const paypalNs = paypalNamespaceRef.current;
    if (
      !isOpen ||
      !paypalSdkReady ||
      !container ||
      !paypalNs?.Buttons ||
      serializedCartPayload.length === 0
    ) {
      if (container) container.innerHTML = '';
      return;
    }

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
        const safety = screenForHarmToHumansOrAnimals(buyerNote);
        if (!safety.safe) {
          const msg =
            safety.reason || 'Delivery note blocked by ethical safety guard.';
          setCheckoutError(msg);
          throw new Error(msg);
        }

        const res = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: serializedCartPayload,
            buyerNote,
          }),
        });
        const data = (await res.json()) as { orderId?: string; error?: string };
        if (!res.ok || !data.orderId) {
          const errMsg = data.error || 'Failed to create PayPal order.';
          setCheckoutError(errMsg);
          throw new Error(errMsg);
        }
        return data.orderId;
      },
      onApprove: async (data) => {
        setCheckoutBusy(true);
        setCheckoutError(null);
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderID,
              cart: serializedCartPayload,
              buyerNote,
            }),
          });
          const result = (await res.json()) as {
            receipt?: VerifiedOrderReceipt;
            error?: string;
          };
          if (!res.ok || !result.receipt) {
            setCheckoutError(
              result.error || 'Could not capture PayPal payment.'
            );
            return;
          }
          setLatestReceipt(result.receipt);
          setCartQty({});
          setBuyerNote('');
          onOrderCompleted(result.receipt);
        } finally {
          setCheckoutBusy(false);
        }
      },
      onError: () => {
        setCheckoutError(
          'PayPal checkout window closed or encountered a network error.'
        );
      },
    });

    if (buttons.isEligible()) {
      void buttons.render(container);
    }

    return () => {
      container.innerHTML = '';
    };
  }, [
    isOpen,
    paypalSdkReady,
    serializedCartPayload,
    buyerNote,
    onOrderCompleted,
  ]);

  if (!isOpen) return null;

  const adjustQty = (item: ShopProductCardItem, delta: number) => {
    setLatestReceipt(null);
    setCheckoutError(null);
    setCartQty((prev) => {
      const curr = prev[item.id] || 0;
      const next = Math.max(0, Math.min(item.stockCount, 5, curr + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
  };

  const handleReserveWelcomePickup = async () => {
    if (serializedCartPayload.length === 0) return;
    const safety = screenForHarmToHumansOrAnimals(buyerNote);
    if (!safety.safe) {
      setCheckoutError(
        safety.reason || 'Pickup note blocked by ethical safety guard.'
      );
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/paypal/reserve-pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: serializedCartPayload,
          buyerNote,
        }),
      });
      const data = (await res.json()) as {
        receipt?: VerifiedOrderReceipt;
        error?: string;
      };
      if (!res.ok || !data.receipt) {
        setCheckoutError(data.error || 'Could not reserve handcrafted items.');
        return;
      }
      setLatestReceipt(data.receipt);
      setCartQty({});
      setBuyerNote('');
      onOrderCompleted(data.receipt);
    } catch {
      setCheckoutError('Network error while reserving Welcome Area items.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setSellError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('auth/popup-closed-by-user')) {
        setSellError('Could not complete Google Sign-In.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handlePublishHandcraftedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !VALID_DOC_ID_REGEX.test(user.uid)) return;

    const cleanMaker =
      makerName.trim().slice(0, 40) ||
      (user.displayName ? user.displayName.trim().slice(0, 40) : 'Club Maker');
    const cleanTitle = itemTitle.trim().slice(0, ARTISAN_TITLE_MAX_LENGTH);
    const cleanMaterials = materialsSpec
      .trim()
      .slice(0, ARTISAN_MATERIALS_MAX_LENGTH);
    const cleanStory = craftStory.trim().slice(0, ARTISAN_STORY_MAX_LENGTH);
    const parsedCents = Math.round(Number(pricePounds) * 100);

    if (cleanTitle.length < ARTISAN_TITLE_MIN_LENGTH) {
      setSellError('Please give your handcrafted item a clear title.');
      return;
    }
    if (cleanMaterials.length < ARTISAN_MATERIALS_MIN_LENGTH) {
      setSellError(
        'Please specify natural materials and dimensions (8+ chars).'
      );
      return;
    }
    if (cleanStory.length < ARTISAN_STORY_MIN_LENGTH) {
      setSellError('Please share how the piece is crafted (12+ chars).');
      return;
    }
    if (
      !Number.isFinite(parsedCents) ||
      parsedCents < MIN_ARTISAN_PRICE_CENTS ||
      parsedCents > MAX_ARTISAN_PRICE_CENTS
    ) {
      setSellError('Price must be between £3.00 and £2,500.00.');
      return;
    }

    const censor = screenBootsOnGroundCensor(
      `${cleanMaker} ${cleanTitle} ${cleanMaterials} ${cleanStory}`,
      'welcome-shop-listing'
    );
    if (!censor.allowed) {
      setSellError(
        censor.reason ||
          'Blocked: Stall listings must be respectful, humane, and suitable for all ages.'
      );
      return;
    }

    setPublishing(true);
    setSellError(null);

    const newRef = doc(collection(db, 'artisanItems'));
    const profileRef = doc(db, 'publicProfiles', user.uid);
    try {
      const profileSnap = await getDoc(profileRef);
      const batch = writeBatch(db);
      if (!profileSnap.exists()) {
        batch.set(profileRef, {
          uid: user.uid,
          username: cleanMaker,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(newRef, {
        makerId: user.uid,
        makerName: cleanMaker,
        title: cleanTitle,
        category: itemCategory,
        materialsAndDimensions: cleanMaterials,
        story: cleanStory,
        priceCents: parsedCents,
        stockCount: Math.max(1, Math.min(MAX_ARTISAN_STOCK, Math.floor(stockCount))),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setItemTitle('');
      setMaterialsSpec('');
      setCraftStory('');
      setActiveView('market');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        setSellError('Daily Firestore quota reached. Please try tomorrow.');
      } else {
        handleFirestoreError(err, OperationType.CREATE, `artisanItems/${newRef.id}`);
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto bg-[#0B120E]/86 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-artisan-heading"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#121C16] border border-[#F7F4EB]/22 rounded-xl text-[#F7F4EB] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#F7F4EB]/14 bg-[#15211A]">
          <div>
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#E5A93C]" />
              <h2
                id="welcome-artisan-heading"
                className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EB]"
              >
                Welcome Area · Bookstall &amp; PayPal Checkout
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#C6D2C9]">
              Ground Sanctuary (0m) · Featuring the Drazella Sprinkles clothbound storybook (£9.99 GBP) &amp; community maker listings via PayPal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onFocusWelcomeMarket();
                onClose();
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1A2820] border border-[#E5A93C]/45 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>View 3D Stall (0m)</span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-[#101914] rounded-lg border border-[#F7F4EB]/12">
              <button
                type="button"
                onClick={() => setActiveView('market')}
                className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'market'
                    ? 'bg-[#E5A93C] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                Shop Crafts ({allShopItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveView('sell')}
                className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  activeView === 'sell'
                    ? 'bg-[#7CE0A3] text-[#101813]'
                    : 'text-[#C8D4CB] hover:text-[#F7F4EB]'
                }`}
              >
                List Handcrafted Piece
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Handcrafted Artisan Market"
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#1A2820] border border-[#F7F4EB]/18 text-xs font-semibold text-[#F7F4EB] hover:border-[#E5A93C] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#E5A93C]" />
              <span>Close (Esc)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeView === 'market' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 cols: Product Grid */}
              <div className="lg:col-span-8 space-y-4">
                {latestReceipt && (
                  <div className="p-4 rounded-xl bg-[#16291E] border border-[#7CE0A3]/55 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#7CE0A3]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {latestReceipt.paymentMethod === 'paypal'
                            ? 'PayPal Order Captured & Verified!'
                            : 'Reserved at the 0m Welcome Area Stall!'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#F7F4EB]">
                        Ref: {latestReceipt.receiptId}
                      </span>
                    </div>
                    <p className="text-xs text-[#DCE5DE]">
                      Total:{' '}
                      <strong className="font-mono">
                        {formatGbpFromCents(latestReceipt.totalCents)}
                      </strong>{' '}
                      · Date: {formatDualTimestamp(latestReceipt.createdAtMs)} ·
                      Bonus: +2 Canopy Treehouse Tokens awarded!
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {allShopItems.map((item) => {
                    const inBasket = cartQty[item.id] || 0;
                    const soldOut = item.stockCount <= 0;
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          {/* 4:3 Studio Product Frame */}
                          <div className="relative aspect-[4/3] w-full bg-[#0F1813] overflow-hidden border-b border-[#F7F4EB]/10">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#1A2B21] to-[#101914]">
                                <Package className="w-9 h-9 text-[#E5A93C] mb-2" />
                                <span className="font-display text-sm font-bold text-[#F7F4EB]">
                                  {item.category}
                                </span>
                                <span className="text-[11px] text-[#9FB0A4] mt-0.5">
                                  Member Handcrafted Edition
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-2">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="font-semibold text-[#E5A93C]">
                                {item.category}
                              </span>
                              <span className="font-mono tabular-nums text-base font-bold text-[#F7F4EB]">
                                {formatGbpFromCents(item.priceCents)}
                              </span>
                            </div>

                            <h3 className="font-display text-base font-bold text-[#F7F4EB] leading-snug">
                              {item.title}
                            </h3>

                            <p className="text-[11px] font-mono text-[#9FB0A4]">
                              Maker: {item.makerName} · {item.materialsAndDimensions}
                            </p>

                            <p className="text-xs text-[#D2DDD5] leading-relaxed">
                              {item.story}
                            </p>
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2 border-t border-[#F7F4EB]/10">
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              soldOut ? 'text-[#F4A261]' : 'text-[#9FB0A4]'
                            }`}
                          >
                            {soldOut
                              ? 'Batch Sold Out'
                              : `${item.stockCount} handcrafted in stock`}
                          </span>

                          {inBasket > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => adjustQty(item, -1)}
                                aria-label={`Decrease quantity of ${item.title}`}
                                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E2E24] border border-[#F7F4EB]/18 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5 text-[#E5A93C]" />
                              </button>
                              <span className="w-6 text-center font-mono text-xs font-bold">
                                {inBasket}
                              </span>
                              <button
                                type="button"
                                disabled={inBasket >= item.stockCount}
                                onClick={() => adjustQty(item, 1)}
                                aria-label={`Increase quantity of ${item.title}`}
                                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E2E24] border border-[#F7F4EB]/18 disabled:opacity-40 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-[#E5A93C]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={soldOut}
                              onClick={() => adjustQty(item, 1)}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Add to Basket
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Right 4 cols: Basket & Real PayPal Orders v2 Checkout */}
              <aside className="lg:col-span-4 space-y-4">
                <div className="p-5 rounded-xl bg-[#16231C] border border-[#E5A93C]/35 space-y-4 sticky top-0">
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#F7F4EB]/12 pb-3">
                    <h3 className="font-display text-lg font-bold text-[#F7F4EB]">
                      Welcome Stall Basket
                    </h3>
                    <span className="font-mono text-xs text-[#9FB0A4]">
                      GBP (£)
                    </span>
                  </div>

                  {cartLines.length === 0 ? (
                    <p className="py-6 text-xs text-[#9FB0A4] leading-relaxed">
                      Add the featured <strong className="text-[#F7F4EB]">Drazella Sprinkles</strong> storybook (or a member listing) to your basket to check out via PayPal or reserve for Ground Desk pickup.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2.5 divide-y divide-[#F7F4EB]/10">
                        {cartLines.map(({ item, quantity }) => (
                          <div
                            key={item.id}
                            className="pt-2.5 first:pt-0 flex items-start justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-[#F7F4EB]">
                                {item.title}
                              </div>
                              <div className="font-mono text-[11px] text-[#9FB0A4]">
                                Qty {quantity} × {formatGbpFromCents(item.priceCents)}
                              </div>
                            </div>
                            <span className="font-mono font-bold tabular-nums text-[#E5A93C]">
                              {formatGbpFromCents(item.priceCents * quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-[#F7F4EB]/14 flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-[#D0DBD3]">
                          Order Total
                        </span>
                        <span className="font-mono text-xl font-bold tabular-nums text-[#F7F4EB]">
                          {formatGbpFromCents(cartTotalCents)}
                        </span>
                      </div>

                      <div>
                        <label
                          htmlFor="paypal-buyer-note"
                          className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                        >
                          Packaging / Sensory-Safe Delivery Note (Optional)
                        </label>
                        <input
                          id="paypal-buyer-note"
                          type="text"
                          maxLength={220}
                          value={buyerNote}
                          onChange={(e) => setBuyerNote(e.target.value)}
                          placeholder="e.g., Unscented paper wrap, quiet doorstep drop-off"
                          className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/16 text-xs text-[#F7F4EB] placeholder-[#7F9185] focus:outline-none focus:border-[#E5A93C]"
                        />
                      </div>

                      {checkoutError && (
                        <p className="text-xs text-[#F4A261] font-medium">
                          {checkoutError}
                        </p>
                      )}

                      {/* Real PayPal Buttons Mount */}
                      {paypalConfig?.configured ? (
                        <div className="space-y-2">
                          <div
                            ref={paypalButtonsContainerRef}
                            className="min-h-[46px]"
                          />
                          <p className="text-[11px] font-mono text-[#9FB0A4]">
                            PayPal ({paypalConfig.mode}) · Server-verified Orders
                            v2 capture
                            {paypalConfig.merchantEmail
                              ? ` · Merchant: ${paypalConfig.merchantEmail}`
                              : ''}
                          </p>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-lg bg-[#101914] border border-[#E5A93C]/35 space-y-2 text-xs">
                          <div className="font-semibold text-[#E5A93C]">
                            PayPal Server Credentials Ready to Connect
                          </div>
                          <p className="text-[#C8D4CB] leading-relaxed">
                            Live PayPal Orders v2 routes (
                            <code className="font-mono text-[11px]">
                              /api/paypal/create-order
                            </code>{' '}
                            &amp;{' '}
                            <code className="font-mono text-[11px]">
                              /api/paypal/capture-order
                            </code>
                            ) are active on the server. Set{' '}
                            <code className="font-mono text-[11px] text-[#F7F4EB]">
                              PAYPAL_CLIENT_ID
                            </code>{' '}
                            and{' '}
                            <code className="font-mono text-[11px] text-[#F7F4EB]">
                              PAYPAL_CLIENT_SECRET
                            </code>{' '}
                            in your environment settings to render the live PayPal
                            button.
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={checkoutBusy}
                        onClick={handleReserveWelcomePickup}
                        className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#1E2E24] border border-[#7CE0A3]/50 text-xs font-bold text-[#7CE0A3] hover:border-[#7CE0A3] hover:text-[#F7F4EB] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {checkoutBusy
                            ? 'Processing...'
                            : 'Reserve for Welcome Desk Pickup (+2 Treehouse Tokens)'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            /* Maker Listing Form (/artisanItems) */
            <div className="max-w-2xl mx-auto">
              {!user ? (
                <div className="p-8 rounded-xl bg-[#16231C] border border-[#F7F4EB]/14 text-center space-y-4">
                  <h3 className="font-display text-lg font-bold text-[#F7F4EB]">
                    List Your Handcrafted Work in the Welcome Area
                  </h3>
                  <p className="text-xs text-[#C6D2C9] leading-relaxed">
                    Sign in with a verified Google account to list physical
                    woodcraft, brasswork, woven textiles, or sensory tools for
                    fellow visitors to buy via PayPal.
                  </p>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={handleGoogleSignIn}
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E5A93C] text-[#101813] text-xs font-bold hover:bg-[#F0B84D] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{authBusy ? 'Signing In...' : 'Sign In with Google'}</span>
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handlePublishHandcraftedItem}
                  className="p-6 rounded-xl bg-[#16231C] border border-[#7CE0A3]/40 space-y-4"
                >
                  <h3 className="font-display text-lg font-bold text-[#F7F4EB]">
                    Add Handcrafted Item to the Welcome Area Stall
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="maker-name"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                      >
                        Maker / Bench Name
                      </label>
                      <input
                        id="maker-name"
                        type="text"
                        maxLength={40}
                        value={makerName}
                        onChange={(e) => setMakerName(e.target.value)}
                        placeholder={user.displayName || 'Your craft bench name'}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="item-cat"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                      >
                        Craft Discipline
                      </label>
                      <select
                        id="item-cat"
                        value={itemCategory}
                        onChange={(e) =>
                          setItemCategory(e.target.value as ArtisanItemCategory)
                        }
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                      >
                        {ARTISAN_ITEM_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="item-title"
                      className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                    >
                      Handcrafted Item Title
                    </label>
                    <input
                      id="item-title"
                      type="text"
                      required
                      minLength={ARTISAN_TITLE_MIN_LENGTH}
                      maxLength={ARTISAN_TITLE_MAX_LENGTH}
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder="e.g., Hand-Carved Sycamore Spoon & Beeswax Roll"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="item-materials"
                      className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                    >
                      Natural Materials &amp; Dimensions
                    </label>
                    <input
                      id="item-materials"
                      type="text"
                      required
                      minLength={ARTISAN_MATERIALS_MIN_LENGTH}
                      maxLength={ARTISAN_MATERIALS_MAX_LENGTH}
                      value={materialsSpec}
                      onChange={(e) => setMaterialsSpec(e.target.value)}
                      placeholder="e.g., Sustainably felled sycamore, organic beeswax · 24cm × 5cm"
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="item-story"
                      className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                    >
                      Maker Story &amp; Ethical Craft Notes
                    </label>
                    <textarea
                      id="item-story"
                      rows={3}
                      required
                      minLength={ARTISAN_STORY_MIN_LENGTH}
                      maxLength={ARTISAN_STORY_MAX_LENGTH}
                      value={craftStory}
                      onChange={(e) => setCraftStory(e.target.value)}
                      placeholder="Describe how you crafted this piece at your own pace..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs text-[#F7F4EB]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="item-price"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                      >
                        Price (£ GBP)
                      </label>
                      <input
                        id="item-price"
                        type="number"
                        step="0.50"
                        min="3"
                        max="2500"
                        value={pricePounds}
                        onChange={(e) => setPricePounds(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs font-mono text-[#F7F4EB]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="item-stock"
                        className="block text-xs font-semibold text-[#D0DBD3] mb-1"
                      >
                        Batch Quantity Available
                      </label>
                      <input
                        id="item-stock"
                        type="number"
                        min={1}
                        max={MAX_ARTISAN_STOCK}
                        value={stockCount}
                        onChange={(e) => setStockCount(Number(e.target.value))}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#0F1813] border border-[#F7F4EB]/18 text-xs font-mono text-[#F7F4EB]"
                      />
                    </div>
                  </div>

                  {sellError && (
                    <p className="text-xs text-[#F4A261] font-medium">
                      {sellError}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveView('market')}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1A2820] text-xs font-semibold text-[#C8D4CB] cursor-pointer"
                    >
                      Back to Stall
                    </button>
                    <button
                      type="submit"
                      disabled={publishing}
                      className="min-h-[40px] px-5 py-2 rounded-lg bg-[#7CE0A3] text-[#101813] text-xs font-bold hover:bg-[#93E8B4] disabled:opacity-60 cursor-pointer"
                    >
                      {publishing ? 'Listing...' : 'Publish Handcrafted Item'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
