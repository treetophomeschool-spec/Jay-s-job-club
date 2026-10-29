import * as THREE from 'three';
import { CanopyFloorStyle, DEFAULT_CANOPY_STUDIO } from '../firebase';
import { AGARWOOD_MOTIVATIONAL_PLAQUES } from '../shared/agarwoodMotivation';
import { TreeLiftControlAction } from '../types/game';

export interface ProceduralTextureSet {
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  timberAlbedo: THREE.CanvasTexture;
  cableAlbedo: THREE.CanvasTexture;
  shingleAlbedo: THREE.CanvasTexture;
  bannerSign: THREE.CanvasTexture;
  groundBoardSign: THREE.CanvasTexture;
  jobCardRackFace: THREE.CanvasTexture;
  welcomeKioskSign: THREE.CanvasTexture;
  welcomeShoeSign: THREE.CanvasTexture;
  artisanShopSign: THREE.CanvasTexture;
  canopyStudioSign: THREE.CanvasTexture;
  canopyPaypalSign: THREE.CanvasTexture;
  mezzanineLibrarySign: THREE.CanvasTexture;
  mezzanineRefreshmentsSign: THREE.CanvasTexture;
  mezzanineChillPodsSign: THREE.CanvasTexture;
  mezzaninePlushieTubSign: THREE.CanvasTexture;
  chillSanctuaryFloor: THREE.CanvasTexture;
  canopyFloorMaps: Record<CanopyFloorStyle, THREE.CanvasTexture>;
  elevationMarkers: Map<number, THREE.CanvasTexture>;
  agarwoodPlaques: Map<string, THREE.CanvasTexture>;
  agarwoodConsoleSign: THREE.CanvasTexture;
  liftControlFaces: Record<TreeLiftControlAction, THREE.CanvasTexture>;
  contactShadow: THREE.CanvasTexture;
  updateCanopyStudioSign: (studioName: string, tradeFocus: string) => void;
  updateAgarwoodConsoleSign: (
    elevationMeters: number,
    motivationalTitle: string,
    motivationalMessage: string,
    motionLabel: string
  ) => void;
  dispose: () => void;
}

function makeFloorTexture(
  draw: (ctx: CanvasRenderingContext2D) => void,
  maxAnisotropy: number,
  disposable: THREE.Texture[]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  disposable.push(tex);
  return tex;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function createProceduralTextures(
  maxAnisotropy: number
): ProceduralTextureSet {
  const disposable: THREE.Texture[] = [];

  // 1. Resinous Agarwood (Aquilaria / Oud Heartwood) Bark Albedo (sRGB) & Bump (Linear)
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 512;
  barkCanvas.height = 512;
  const bCtx = barkCanvas.getContext('2d')!;
  bCtx.fillStyle = '#3B2618';
  bCtx.fillRect(0, 0, 512, 512);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 190; i++) {
    const x = (i / 190) * 512 + Math.sin(i * 13.7) * 4;
    const w = 3 + (i % 5) * 2;
    const shade =
      i % 4 === 0
        ? '#26170E'
        : i % 4 === 1
          ? '#4D3220'
          : i % 4 === 2
            ? '#5C3D28'
            : '#332014';
    bCtx.fillStyle = shade;
    bCtx.fillRect(x, 0, w, 512);

    bumpCtx.fillStyle = i % 2 === 0 ? '#464646' : '#C2C2C2';
    bumpCtx.fillRect(x, 0, w, 512);
  }
  // Golden-amber aromatic Agarwood oud resin streaks coursing through the heartwood fissures
  for (let r = 0; r < 46; r++) {
    const rx = ((r * 79) % 496) + 8;
    const ry = ((r * 113) % 420) + 12;
    const rh = 36 + (r % 4) * 22;
    bCtx.fillStyle =
      r % 3 === 0 ? 'rgba(229, 169, 60, 0.34)' : 'rgba(196, 134, 45, 0.25)';
    bCtx.fillRect(rx, ry, 2.5, rh);
    bumpCtx.fillStyle = 'rgba(215, 215, 215, 0.55)';
    bumpCtx.fillRect(rx, ry, 2.5, rh);
  }
  for (let k = 0; k < 200; k++) {
    const rx = (Math.sin(k * 91.3) * 0.5 + 0.5) * 512;
    const ry = (Math.cos(k * 47.9) * 0.5 + 0.5) * 512;
    bCtx.fillStyle = 'rgba(20, 12, 7, 0.34)';
    bCtx.fillRect(rx, ry, 3, 42);
    bumpCtx.fillStyle = 'rgba(28, 28, 28, 0.45)';
    bumpCtx.fillRect(rx, ry, 3, 42);
  }

  const barkAlbedo = new THREE.CanvasTexture(barkCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;
  barkAlbedo.repeat.set(3, 9);
  barkAlbedo.anisotropy = maxAnisotropy;
  disposable.push(barkAlbedo);

  const barkBump = new THREE.CanvasTexture(bumpCanvas);
  barkBump.wrapS = THREE.RepeatWrapping;
  barkBump.wrapT = THREE.RepeatWrapping;
  barkBump.repeat.set(3, 9);
  barkBump.anisotropy = maxAnisotropy;
  disposable.push(barkBump);

  // 2. Planed Cedar / Agarwood Timber Plank Texture (sRGB)
  const timberCanvas = document.createElement('canvas');
  timberCanvas.width = 512;
  timberCanvas.height = 512;
  const tCtx = timberCanvas.getContext('2d')!;
  tCtx.fillStyle = '#9C6B3E';
  tCtx.fillRect(0, 0, 512, 512);

  const plankCount = 8;
  const plankH = 512 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const y = p * plankH;
    const tones = ['#A57446', '#946338', '#AD7C4D', '#8C5C32'];
    tCtx.fillStyle = tones[p % tones.length];
    tCtx.fillRect(0, y + 2, 512, plankH - 3);
    tCtx.fillStyle = '#4B2F18';
    tCtx.fillRect(0, y, 512, 2);

    tCtx.strokeStyle = 'rgba(65, 38, 16, 0.18)';
    tCtx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      tCtx.beginPath();
      const gy = y + 8 + g * 9;
      tCtx.moveTo(0, gy);
      tCtx.bezierCurveTo(
        170,
        gy + ((p + g) % 2 === 0 ? 4 : -4),
        340,
        gy - 3,
        512,
        gy + 1
      );
      tCtx.stroke();
    }
  }

  const timberAlbedo = new THREE.CanvasTexture(timberCanvas);
  timberAlbedo.colorSpace = THREE.SRGBColorSpace;
  timberAlbedo.wrapS = THREE.RepeatWrapping;
  timberAlbedo.wrapT = THREE.RepeatWrapping;
  timberAlbedo.repeat.set(2, 2);
  timberAlbedo.anisotropy = maxAnisotropy;
  disposable.push(timberAlbedo);

  // 3. Braided Vertical Cable Texture (sRGB)
  const cableCanvas = document.createElement('canvas');
  cableCanvas.width = 128;
  cableCanvas.height = 256;
  const cCtx = cableCanvas.getContext('2d')!;
  cCtx.fillStyle = '#C9B38C';
  cCtx.fillRect(0, 0, 128, 256);
  cCtx.strokeStyle = '#6E5839';
  cCtx.lineWidth = 10;
  for (let y = -64; y < 320; y += 24) {
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(128, y + 48);
    cCtx.stroke();
  }
  cCtx.strokeStyle = '#E6D6B8';
  cCtx.lineWidth = 4;
  for (let y = -52; y < 320; y += 24) {
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(128, y + 48);
    cCtx.stroke();
  }

  const cableAlbedo = new THREE.CanvasTexture(cableCanvas);
  cableAlbedo.colorSpace = THREE.SRGBColorSpace;
  cableAlbedo.wrapS = THREE.RepeatWrapping;
  cableAlbedo.wrapT = THREE.RepeatWrapping;
  cableAlbedo.repeat.set(1, 56);
  cableAlbedo.anisotropy = maxAnisotropy;
  disposable.push(cableAlbedo);

  // 4. Roof Cedar Shingle Texture (sRGB)
  const shingleCanvas = document.createElement('canvas');
  shingleCanvas.width = 512;
  shingleCanvas.height = 512;
  const sCtx = shingleCanvas.getContext('2d')!;
  sCtx.fillStyle = '#334B39';
  sCtx.fillRect(0, 0, 512, 512);
  const rows = 10;
  const cols = 8;
  const rh = 512 / rows;
  const cw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const sx = c * cw + offset;
      const sy = r * rh;
      sCtx.fillStyle = (r + c) % 2 === 0 ? '#3A5641' : '#2E4534';
      sCtx.fillRect(sx + 2, sy + 2, cw - 4, rh - 4);
      sCtx.fillStyle = '#1E2E22';
      sCtx.fillRect(sx, sy + rh - 3, cw, 3);
    }
  }
  const shingleAlbedo = new THREE.CanvasTexture(shingleCanvas);
  shingleAlbedo.colorSpace = THREE.SRGBColorSpace;
  shingleAlbedo.wrapS = THREE.RepeatWrapping;
  shingleAlbedo.wrapT = THREE.RepeatWrapping;
  shingleAlbedo.repeat.set(3, 3);
  shingleAlbedo.anisotropy = maxAnisotropy;
  disposable.push(shingleAlbedo);

  // High-visibility low-vision helper: re-renders sign canvases once web fonts finish loading
  const fontRefreshCallbacks: Array<() => void> = [];
  let isDisposed = false;

  const setLetterSpacing = (ctx: CanvasRenderingContext2D, px: number) => {
    const anyCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ('letterSpacing' in anyCtx) {
      anyCtx.letterSpacing = `${px}px`;
    }
  };

  const drawAccessibleTwoLineSign = (
    canvas: HTMLCanvasElement,
    tex: THREE.CanvasTexture,
    opts: {
      bgHex: string;
      borderHex: string;
      headline: string;
      headlineSize: number;
      subline: string;
      sublineHex: string;
      sublineSize: number;
    }
  ) => {
    const render = () => {
      if (isDisposed) return;
      const ctx = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;

      // Solid ultra-high-contrast obsidian backing (>18.5:1 contrast with #FFFFFF)
      ctx.fillStyle = opts.bgHex;
      ctx.fillRect(0, 0, w, h);

      // Thick high-luminance outer & inner sighting frame for low-vision edge definition
      ctx.strokeStyle = opts.borderHex;
      ctx.lineWidth = 18;
      ctx.strokeRect(20, 20, w - 40, h - 40);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = 4;
      ctx.strokeRect(46, 46, w - 92, h - 92);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Line 1: Pure crisp white bold large-print headline
      setLetterSpacing(ctx, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${opts.headlineSize}px "Plus Jakarta Sans", Verdana, system-ui, sans-serif`;
      ctx.fillText(opts.headline, w / 2, Math.round(h * 0.39), w - 150);

      // Clean separator rule
      ctx.strokeStyle = 'rgba(255, 228, 132, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(140, Math.round(h * 0.58));
      ctx.lineTo(w - 140, Math.round(h * 0.58));
      ctx.stroke();

      // Line 2: High-luminance gold or mint large-print subtitle
      setLetterSpacing(ctx, 1.5);
      ctx.fillStyle = opts.sublineHex;
      ctx.font = `700 ${opts.sublineSize}px "Plus Jakarta Sans", Verdana, system-ui, sans-serif`;
      ctx.fillText(opts.subline, w / 2, Math.round(h * 0.74), w - 150);

      setLetterSpacing(ctx, 0);
      tex.needsUpdate = true;
    };

    render();
    fontRefreshCallbacks.push(render);
  };

  // 5. High-Contrast Ground Workshop Gateway Banner Sign (2048x512 sRGB)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 2048;
  signCanvas.height = 512;
  const bannerSign = new THREE.CanvasTexture(signCanvas);
  bannerSign.colorSpace = THREE.SRGBColorSpace;
  bannerSign.anisotropy = maxAnisotropy;
  disposable.push(bannerSign);
  drawAccessibleTwoLineSign(signCanvas, bannerSign, {
    bgHex: '#060B08',
    borderHex: '#FFE484',
    headline: "JAY'S JOB CLUB",
    headlineSize: 152,
    subline: 'Special Interests → Real Trades',
    sublineHex: '#FFE484',
    sublineSize: 74,
  });

  // 6. Heritage Old-Style Job Centre Vacancy Cards Header Plaque (2048x512 sRGB)
  const gbCanvas = document.createElement('canvas');
  gbCanvas.width = 2048;
  gbCanvas.height = 512;
  const groundBoardSign = new THREE.CanvasTexture(gbCanvas);
  groundBoardSign.colorSpace = THREE.SRGBColorSpace;
  groundBoardSign.anisotropy = maxAnisotropy;
  disposable.push(groundBoardSign);
  drawAccessibleTwoLineSign(gbCanvas, groundBoardSign, {
    bgHex: '#062617',
    borderHex: '#FFE484',
    headline: "JAY'S JOB CENTRE",
    headlineSize: 132,
    subline: 'Beta Research · Drazella · Bank Exchequer',
    sublineHex: '#FFE484',
    sublineSize: 62,
  });

  // 6a. Procedural Old-Style Job Centre Slotted Index-Card Display Backing (1536x1024 sRGB)
  const rackCanvas = document.createElement('canvas');
  rackCanvas.width = 1536;
  rackCanvas.height = 1024;
  const jobCardRackFace = new THREE.CanvasTexture(rackCanvas);
  jobCardRackFace.colorSpace = THREE.SRGBColorSpace;
  jobCardRackFace.anisotropy = maxAnisotropy;
  disposable.push(jobCardRackFace);
  const renderJobRack = () => {
    if (isDisposed) return;
    const rCtx = rackCanvas.getContext('2d')!;
    rCtx.fillStyle = '#0B2E1D';
    rCtx.fillRect(0, 0, 1536, 1024);
    rCtx.strokeStyle = '#D4AF37';
    rCtx.lineWidth = 14;
    rCtx.strokeRect(14, 14, 1508, 996);

    const sampleCards = [
      {
        ref: 'JC-001',
        title: 'BETA USER RESEARCH',
        note: "JAY'S JOB CENTRE · LIVE",
        tint: '#FFFDF3',
      },
      {
        ref: 'JC-002',
        title: 'DRAZELLA SPRINKES',
        note: 'EASY READ + DIGITAL ART',
        tint: '#F2FBF5',
      },
      {
        ref: 'JC-003',
        title: 'BANK OF TREETOP',
        note: 'EXCHEQUER · UNPAID ROLE',
        tint: '#FFF9E8',
      },
      {
        ref: 'JC-103',
        title: 'BRASS LANTERNS',
        note: 'COURTYARD · TEAM UP',
        tint: '#FFFDF5',
      },
      {
        ref: 'JC-105',
        title: 'TEA & LIBRARY HOST',
        note: 'MEZZANINE · OUTREACH',
        tint: '#F2FBF5',
      },
      {
        ref: 'JC-106',
        title: 'TOOL BENCH CARE',
        note: 'REPAIR · SKILL SWAP',
        tint: '#FFFDF5',
      },
    ];
    const cols = 3;
    const cardW = 452;
    const cardH = 416;
    sampleCards.forEach((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = 56 + col * 484;
      const cy = 58 + row * 462;

      // Brass slot pocket shadow
      rCtx.fillStyle = '#05170E';
      rCtx.fillRect(cx + 8, cy + 10, cardW, cardH);

      // Cream/mint physical index card
      rCtx.fillStyle = card.tint;
      rCtx.fillRect(cx, cy, cardW, cardH);
      rCtx.strokeStyle = '#14452B';
      rCtx.lineWidth = 5;
      rCtx.strokeRect(cx, cy, cardW, cardH);

      // Top bottle-green header strip on each vacancy card
      rCtx.fillStyle = '#0C3B24';
      rCtx.fillRect(cx, cy, cardW, 88);

      // Brass peg pin
      rCtx.fillStyle = '#F2C94C';
      rCtx.beginPath();
      rCtx.arc(cx + cardW / 2, cy + 24, 11, 0, Math.PI * 2);
      rCtx.fill();

      rCtx.textAlign = 'left';
      rCtx.textBaseline = 'middle';
      rCtx.fillStyle = '#FFE484';
      rCtx.font = '800 32px "JetBrains Mono", monospace';
      rCtx.fillText(card.ref, cx + 22, cy + 56);

      rCtx.textAlign = 'right';
      rCtx.fillStyle = '#A8F5C4';
      rCtx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      rCtx.fillText('OPEN', cx + cardW - 22, cy + 56);

      rCtx.textAlign = 'left';
      rCtx.fillStyle = '#0B1F14';
      rCtx.font = '800 40px "Plus Jakarta Sans", Verdana, sans-serif';
      rCtx.fillText(card.title, cx + 22, cy + 162, cardW - 44);

      rCtx.strokeStyle = '#9BC2AC';
      rCtx.lineWidth = 3;
      rCtx.beginPath();
      rCtx.moveTo(cx + 22, cy + 218);
      rCtx.lineTo(cx + cardW - 22, cy + 218);
      rCtx.stroke();

      rCtx.fillStyle = '#1E4631';
      rCtx.font = '700 28px "Plus Jakarta Sans", Verdana, sans-serif';
      rCtx.fillText(card.note, cx + 22, cy + 272, cardW - 44);

      rCtx.fillStyle = '#0C3B24';
      rCtx.fillRect(cx + 22, cy + 326, cardW - 44, 58);
      rCtx.textAlign = 'center';
      rCtx.fillStyle = '#FFFFFF';
      rCtx.font = '800 26px "Plus Jakarta Sans", Verdana, sans-serif';
      rCtx.fillText('CLICK TO CHOOSE / COLLAB', cx + cardW / 2, cy + 356, cardW - 60);
    });
    jobCardRackFace.needsUpdate = true;
  };
  renderJobRack();
  fontRefreshCallbacks.push(renderJobRack);

  // 6b. Ground Floor Sign-In Kiosk & Personal Special-Interest Dashboard Sign (2048x640 sRGB)
  const welcomeCanvas = document.createElement('canvas');
  welcomeCanvas.width = 2048;
  welcomeCanvas.height = 640;
  const welcomeKioskSign = new THREE.CanvasTexture(welcomeCanvas);
  welcomeKioskSign.colorSpace = THREE.SRGBColorSpace;
  welcomeKioskSign.anisotropy = maxAnisotropy;
  disposable.push(welcomeKioskSign);
  drawAccessibleTwoLineSign(welcomeCanvas, welcomeKioskSign, {
    bgHex: '#080503',
    borderHex: '#FFE484',
    headline: 'ENTRY KIOSK · SIGN UP',
    headlineSize: 132,
    subline: 'Special Interest → Job Dashboard',
    sublineHex: '#FFE484',
    sublineSize: 78,
  });

  // 6c. Ground Floor Handcrafted Book & Show-and-Tell Shop Sign (2048x512 sRGB)
  const artisanCanvas = document.createElement('canvas');
  artisanCanvas.width = 2048;
  artisanCanvas.height = 512;
  const artisanShopSign = new THREE.CanvasTexture(artisanCanvas);
  artisanShopSign.colorSpace = THREE.SRGBColorSpace;
  artisanShopSign.anisotropy = maxAnisotropy;
  disposable.push(artisanShopSign);
  drawAccessibleTwoLineSign(artisanCanvas, artisanShopSign, {
    bgHex: '#060B08',
    borderHex: '#FFE484',
    headline: 'DRAZELLA SPRINKES',
    headlineSize: 122,
    subline: 'Easy Read Neurobiology · Digital Art',
    sublineHex: '#FFE484',
    sublineSize: 66,
  });

  // 6d. Welcome Area Boot & Shoe Character Fitting Bench Sign (2048x512 sRGB)
  const shoeSignCanvas = document.createElement('canvas');
  shoeSignCanvas.width = 2048;
  shoeSignCanvas.height = 512;
  const welcomeShoeSign = new THREE.CanvasTexture(shoeSignCanvas);
  welcomeShoeSign.colorSpace = THREE.SRGBColorSpace;
  welcomeShoeSign.anisotropy = maxAnisotropy;
  disposable.push(welcomeShoeSign);
  drawAccessibleTwoLineSign(shoeSignCanvas, welcomeShoeSign, {
    bgHex: '#070D09',
    borderHex: '#A8F5C4',
    headline: 'BOOT & SHOE BENCH',
    headlineSize: 132,
    subline: 'Wellies · Work Boots · Maker Shoes',
    sublineHex: '#FFE484',
    sublineSize: 72,
  });

  // 6e. 33m Canopy PayPal Maker Storefront Sign (2048x512 sRGB)
  const canopyPaypalCanvas = document.createElement('canvas');
  canopyPaypalCanvas.width = 2048;
  canopyPaypalCanvas.height = 512;
  const canopyPaypalSign = new THREE.CanvasTexture(canopyPaypalCanvas);
  canopyPaypalSign.colorSpace = THREE.SRGBColorSpace;
  canopyPaypalSign.anisotropy = maxAnisotropy;
  disposable.push(canopyPaypalSign);
  drawAccessibleTwoLineSign(canopyPaypalCanvas, canopyPaypalSign, {
    bgHex: '#060B08',
    borderHex: '#FFE484',
    headline: 'CANOPY PAYPAL STORE',
    headlineSize: 128,
    subline: 'Sell & Buy Maker Work · 33m',
    sublineHex: '#A8F5C4',
    sublineSize: 74,
  });

  // 6f. 33m Mezzanine Quiet Library Sign (2048x512 sRGB)
  const mezLibCanvas = document.createElement('canvas');
  mezLibCanvas.width = 2048;
  mezLibCanvas.height = 512;
  const mezzanineLibrarySign = new THREE.CanvasTexture(mezLibCanvas);
  mezzanineLibrarySign.colorSpace = THREE.SRGBColorSpace;
  mezzanineLibrarySign.anisotropy = maxAnisotropy;
  disposable.push(mezzanineLibrarySign);
  drawAccessibleTwoLineSign(mezLibCanvas, mezzanineLibrarySign, {
    bgHex: '#080C0A',
    borderHex: '#FFE484',
    headline: 'MEZZANINE LIBRARY',
    headlineSize: 132,
    subline: 'Trade Guides · Sensory Reading Nook',
    sublineHex: '#FFE484',
    sublineSize: 68,
  });

  // 6g. 33m Mezzanine Refreshments Counter Sign (2048x512 sRGB)
  const mezRefCanvas = document.createElement('canvas');
  mezRefCanvas.width = 2048;
  mezRefCanvas.height = 512;
  const mezzanineRefreshmentsSign = new THREE.CanvasTexture(mezRefCanvas);
  mezzanineRefreshmentsSign.colorSpace = THREE.SRGBColorSpace;
  mezzanineRefreshmentsSign.anisotropy = maxAnisotropy;
  disposable.push(mezzanineRefreshmentsSign);
  drawAccessibleTwoLineSign(mezRefCanvas, mezzanineRefreshmentsSign, {
    bgHex: '#070D09',
    borderHex: '#A8F5C4',
    headline: 'REFRESHMENTS BAR',
    headlineSize: 132,
    subline: 'Herbal Tea · Spring Water · Oat Tray',
    sublineHex: '#A8F5C4',
    sublineSize: 68,
  });

  // 6h. 33m Mezzanine Private Sensory Chill Pods Sign (2048x512 sRGB)
  const mezPodsCanvas = document.createElement('canvas');
  mezPodsCanvas.width = 2048;
  mezPodsCanvas.height = 512;
  const mezzanineChillPodsSign = new THREE.CanvasTexture(mezPodsCanvas);
  mezzanineChillPodsSign.colorSpace = THREE.SRGBColorSpace;
  mezzanineChillPodsSign.anisotropy = maxAnisotropy;
  disposable.push(mezzanineChillPodsSign);
  drawAccessibleTwoLineSign(mezPodsCanvas, mezzanineChillPodsSign, {
    bgHex: '#060A0E',
    borderHex: '#A8F5C4',
    headline: 'SAFE CHILL PODS (1PP)',
    headlineSize: 118,
    subline: 'Step-Free Floor · Enclosed · Private',
    sublineHex: '#FFE484',
    sublineSize: 64,
  });

  // 6i. Welly Plushie Laundry Tub Relaxation Sign (2048x512 sRGB)
  const plushieTubCanvas = document.createElement('canvas');
  plushieTubCanvas.width = 2048;
  plushieTubCanvas.height = 512;
  const mezzaninePlushieTubSign = new THREE.CanvasTexture(plushieTubCanvas);
  mezzaninePlushieTubSign.colorSpace = THREE.SRGBColorSpace;
  mezzaninePlushieTubSign.anisotropy = maxAnisotropy;
  disposable.push(mezzaninePlushieTubSign);
  drawAccessibleTwoLineSign(plushieTubCanvas, mezzaninePlushieTubSign, {
    bgHex: '#0A1610',
    borderHex: '#FFE484',
    headline: 'WELLY PLUSHIE TUB',
    headlineSize: 132,
    subline: 'Relaxation Lounge · Pick a Soft Welly',
    sublineHex: '#A8F5C4',
    sublineSize: 68,
  });

  // 6j. Safe Accessible Chill Pods Sanctuary Flooring (Matte Cushion-Cork & Sage Grip, Zero Gaps / Zero Glare)
  const chillSanctuaryFloor = makeFloorTexture(
    (ctx) => {
      // Grounded warm sage-eucalyptus & honey-cork cushioned safety base (solid, zero dark cracks that trigger fear of heights)
      ctx.fillStyle = '#4B6653';
      ctx.fillRect(0, 0, 512, 512);

      const grid = 4;
      const tile = 512 / grid;
      const calmTones = ['#587660', '#516E59', '#5E7C66', '#54715C'];

      for (let ty = 0; ty < grid; ty++) {
        for (let tx = 0; tx < grid; tx++) {
          const ox = tx * tile;
          const oy = ty * tile;
          ctx.fillStyle = calmTones[(tx + ty) % calmTones.length];
          ctx.fillRect(ox + 3, oy + 3, tile - 6, tile - 6);

          // Flush bevelled warm honey-cork weld seam (solid sealed joint — never looks like an open gap!)
          ctx.strokeStyle = '#C9A26B';
          ctx.lineWidth = 3;
          ctx.strokeRect(ox + 3, oy + 3, tile - 6, tile - 6);

          // Subtle anti-slip elastomeric micro-grip stippling & soft cork flecks
          for (let s = 0; s < 42; s++) {
            const px = ox + 12 + ((s * 31 + tx * 17) % (tile - 24));
            const py = oy + 12 + ((s * 47 + ty * 23) % (tile - 24));
            ctx.fillStyle =
              s % 3 === 0
                ? 'rgba(245, 224, 178, 0.24)'
                : 'rgba(42, 62, 48, 0.22)';
            ctx.beginPath();
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }

          // Gentle low-vision tactile directional micro-ribs for cane & foot grip
          ctx.strokeStyle = 'rgba(255, 232, 163, 0.16)';
          ctx.lineWidth = 1.6;
          for (let ry = 22; ry < tile - 18; ry += 26) {
            ctx.beginPath();
            ctx.moveTo(ox + 14, oy + ry);
            ctx.lineTo(ox + tile - 14, oy + ry);
            ctx.stroke();
          }
        }
      }
    },
    maxAnisotropy,
    disposable
  );
  chillSanctuaryFloor.repeat.set(4, 2.5);

  // 7. Dynamic Canopy Personal Trade Area Studio Nameplate (2048x512 sRGB)
  const studioCanvas = document.createElement('canvas');
  studioCanvas.width = 2048;
  studioCanvas.height = 512;
  const stCtx = studioCanvas.getContext('2d')!;
  const canopyStudioSign = new THREE.CanvasTexture(studioCanvas);
  canopyStudioSign.colorSpace = THREE.SRGBColorSpace;
  canopyStudioSign.anisotropy = maxAnisotropy;
  disposable.push(canopyStudioSign);

  let latestStudioName = DEFAULT_CANOPY_STUDIO.studioName;
  let latestTradeFocus: string = DEFAULT_CANOPY_STUDIO.tradeFocus;

  const updateCanopyStudioSign = (studioName: string, tradeFocus: string) => {
    latestStudioName = studioName;
    latestTradeFocus = tradeFocus;
    if (isDisposed) return;

    stCtx.fillStyle = '#060B08';
    stCtx.fillRect(0, 0, 2048, 512);
    stCtx.strokeStyle = '#FFE484';
    stCtx.lineWidth = 18;
    stCtx.strokeRect(20, 20, 2008, 472);
    stCtx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    stCtx.lineWidth = 4;
    stCtx.strokeRect(46, 46, 1956, 420);

    stCtx.textAlign = 'center';
    stCtx.textBaseline = 'middle';
    const safeName = studioName.trim().slice(0, 40) || 'Canopy Workshop Rota';
    const fontSize = safeName.length > 22 ? 104 : 128;

    setLetterSpacing(stCtx, 2.5);
    stCtx.fillStyle = '#FFFFFF';
    stCtx.font = `800 ${fontSize}px "Plus Jakarta Sans", Verdana, system-ui, sans-serif`;
    stCtx.fillText(safeName, 1024, 198, 1880);

    stCtx.strokeStyle = 'rgba(255, 228, 132, 0.55)';
    stCtx.lineWidth = 4;
    stCtx.beginPath();
    stCtx.moveTo(140, 296);
    stCtx.lineTo(1908, 296);
    stCtx.stroke();

    setLetterSpacing(stCtx, 1.5);
    stCtx.fillStyle = '#FFE484';
    stCtx.font =
      '700 72px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
    stCtx.fillText(`${tradeFocus} · Trade Rota`, 1024, 378, 1880);

    setLetterSpacing(stCtx, 0);
    canopyStudioSign.needsUpdate = true;
  };
  updateCanopyStudioSign(latestStudioName, latestTradeFocus);
  fontRefreshCallbacks.push(() =>
    updateCanopyStudioSign(latestStudioName, latestTradeFocus)
  );

  // 8. Four Customizable Non-Slip Secure Canopy Flooring Textures (sRGB)
  const canopyFloorMaps: Record<CanopyFloorStyle, THREE.CanvasTexture> = {
    interlocking_oak: makeFloorTexture(
      (ctx) => {
        ctx.fillStyle = '#A87B4F';
        ctx.fillRect(0, 0, 512, 512);
        const rowsCount = 8;
        const rowH = 512 / rowsCount;
        const oakShades = ['#B6885A', '#9E7145', '#BE9163', '#A6794C'];
        for (let r = 0; r < rowsCount; r++) {
          const y = r * rowH;
          ctx.fillStyle = oakShades[r % oakShades.length];
          ctx.fillRect(0, y + 3, 512, rowH - 5);
          ctx.fillStyle = '#472E18';
          ctx.fillRect(0, y, 512, 3);
          ctx.fillStyle = '#D99E38';
          ctx.fillRect(0, y + rowH - 7, 512, 3);
          const jointX = ((r * 173) % 380) + 64;
          ctx.fillStyle = '#472E18';
          ctx.fillRect(jointX, y, 3, rowH);
          ctx.fillStyle = '#5E3D20';
          ctx.beginPath();
          ctx.arc(jointX - 14, y + rowH * 0.45, 4, 0, Math.PI * 2);
          ctx.arc(jointX + 17, y + rowH * 0.45, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      maxAnisotropy,
      disposable
    ),
    nonslip_slate: makeFloorTexture(
      (ctx) => {
        ctx.fillStyle = '#26302D';
        ctx.fillRect(0, 0, 512, 512);
        const grid = 4;
        const cell = 512 / grid;
        const slateTones = ['#36433F', '#2F3B37', '#3D4B46', '#323E3A'];
        for (let gy = 0; gy < grid; gy++) {
          for (let gx = 0; gx < grid; gx++) {
            const sx = gx * cell;
            const sy = gy * cell;
            ctx.fillStyle = slateTones[(gx + gy * 2) % slateTones.length];
            ctx.fillRect(sx + 4, sy + 4, cell - 8, cell - 8);
            ctx.strokeStyle = 'rgba(229, 169, 60, 0.28)';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 8, sy + 8, cell - 16, cell - 16);
            ctx.fillStyle = '#4C5C56';
            for (let dy = 24; dy < cell - 18; dy += 22) {
              for (let dx = 24; dx < cell - 18; dx += 22) {
                ctx.fillRect(sx + dx - 3, sy + dy - 3, 6, 6);
              }
            }
          }
        }
      },
      maxAnisotropy,
      disposable
    ),
    cork_sanctuary: makeFloorTexture(
      (ctx) => {
        ctx.fillStyle = '#734F32';
        ctx.fillRect(0, 0, 512, 512);
        const tile = 128;
        for (let ty = 0; ty < 4; ty++) {
          for (let tx = 0; tx < 4; tx++) {
            const ox = tx * tile;
            const oy = ty * tile;
            ctx.fillStyle = (tx + ty) % 2 === 0 ? '#B98759' : '#AD7B4E';
            ctx.fillRect(ox + 5, oy + 5, tile - 10, tile - 10);
            for (let s = 0; s < 55; s++) {
              const px = ox + 10 + ((s * 37 + tx * 19) % (tile - 20));
              const py = oy + 10 + ((s * 53 + ty * 29) % (tile - 20));
              ctx.fillStyle = s % 2 === 0 ? '#8C5E37' : '#D2A477';
              ctx.fillRect(px, py, 4, 3);
            }
          }
        }
      },
      maxAnisotropy,
      disposable
    ),
    herringbone_cedar: makeFloorTexture(
      (ctx) => {
        ctx.fillStyle = '#59331E';
        ctx.fillRect(0, 0, 512, 512);
        const step = 64;
        const cedarShades = ['#A85D3B', '#924D2E', '#BC6F4B', '#834226'];
        for (let row = -2; row < 10; row++) {
          for (let col = -2; col < 10; col++) {
            const cx = col * step;
            const cy = row * step;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((row + col) % 2 === 0 ? Math.PI / 4 : -Math.PI / 4);
            ctx.fillStyle =
              cedarShades[Math.abs(row * 3 + col) % cedarShades.length];
            ctx.fillRect(-42, -14, 84, 28);
            ctx.strokeStyle = '#3D2011';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-42, -14, 84, 28);
            ctx.restore();
          }
        }
      },
      maxAnisotropy,
      disposable
    ),
  };

  // 9. High-Contrast Large-Print Elevation Markers along the Agarwood Trunk (512x256 sRGB)
  const elevationMarkers = new Map<number, THREE.CanvasTexture>();
  [5, 10, 15, 20, 25, 30].forEach((meters) => {
    const mCanvas = document.createElement('canvas');
    mCanvas.width = 512;
    mCanvas.height = 256;
    const mCtx = mCanvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(mCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    elevationMarkers.set(meters, tex);
    disposable.push(tex);

    const drawMarker = () => {
      if (isDisposed) return;
      mCtx.fillStyle = '#080503';
      mCtx.fillRect(0, 0, 512, 256);
      mCtx.strokeStyle = '#FFE484';
      mCtx.lineWidth = 14;
      mCtx.strokeRect(12, 12, 488, 232);
      mCtx.fillStyle = '#FFFFFF';
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.font =
        '800 134px "Plus Jakarta Sans", "JetBrains Mono", system-ui, sans-serif';
      mCtx.fillText(`${meters}m`, 256, 132);
      tex.needsUpdate = true;
    };
    drawMarker();
    fontRefreshCallbacks.push(drawMarker);
  });

  // 10. Six High-Contrast Large-Print Agarwood Motivational Plaques up the Trunk (1536x640 sRGB)
  // Solid obsidian plate with ZERO background grain streaks behind text for maximum low-vision clarity
  const agarwoodPlaques = new Map<string, THREE.CanvasTexture>();
  AGARWOOD_MOTIVATIONAL_PLAQUES.forEach((plaque) => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 1536;
    pCanvas.height = 640;
    const pCtx = pCanvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(pCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    agarwoodPlaques.set(plaque.id, tex);
    disposable.push(tex);

    const drawPlaque = () => {
      if (isDisposed) return;
      pCtx.fillStyle = '#080503';
      pCtx.fillRect(0, 0, 1536, 640);

      pCtx.strokeStyle = '#FFE484';
      pCtx.lineWidth = 16;
      pCtx.strokeRect(18, 18, 1500, 604);
      pCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      pCtx.lineWidth = 4;
      pCtx.strokeRect(42, 42, 1452, 556);

      pCtx.textAlign = 'center';
      pCtx.textBaseline = 'middle';
      setLetterSpacing(pCtx, 2);
      pCtx.fillStyle = '#FFE484';
      pCtx.font =
        '800 54px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
      pCtx.fillText(
        `${plaque.zoneLabel.split('·')[0].trim()} · ${plaque.carvedTitle}`,
        768,
        122,
        1380
      );

      pCtx.strokeStyle = 'rgba(255, 228, 132, 0.5)';
      pCtx.lineWidth = 4;
      pCtx.beginPath();
      pCtx.moveTo(110, 186);
      pCtx.lineTo(1426, 186);
      pCtx.stroke();

      setLetterSpacing(pCtx, 1);
      pCtx.fillStyle = '#FFFFFF';
      pCtx.font =
        '700 72px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
      let lines = wrapCanvasText(pCtx, plaque.motivationalMessage, 1360);
      let lineStep = 96;
      if (lines.length > 3) {
        pCtx.font =
          '700 56px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
        lines = wrapCanvasText(pCtx, plaque.motivationalMessage, 1380);
        lineStep = 78;
      }
      const visibleLines = lines.slice(0, 4);
      const blockHeight = (visibleLines.length - 1) * lineStep;
      const startY = 394 - blockHeight / 2;

      visibleLines.forEach((line, idx) => {
        pCtx.fillText(line, 768, startY + idx * lineStep, 1390);
      });

      setLetterSpacing(pCtx, 0);
      tex.needsUpdate = true;
    };

    drawPlaque();
    fontRefreshCallbacks.push(drawPlaque);
  });

  // 11. Dynamic High-Contrast Agarwood Trunk Lift Control Console Plate (1536x768 sRGB)
  const consoleCanvas = document.createElement('canvas');
  consoleCanvas.width = 1536;
  consoleCanvas.height = 768;
  const csCtx = consoleCanvas.getContext('2d')!;
  const agarwoodConsoleSign = new THREE.CanvasTexture(consoleCanvas);
  agarwoodConsoleSign.colorSpace = THREE.SRGBColorSpace;
  agarwoodConsoleSign.anisotropy = maxAnisotropy;
  disposable.push(agarwoodConsoleSign);

  const initialPlaque = AGARWOOD_MOTIVATIONAL_PLAQUES[0];
  let latestConsoleState = {
    elevationMeters: 0,
    motivationalTitle: initialPlaque.carvedTitle,
    motivationalMessage: initialPlaque.motivationalMessage,
    motionLabel: 'RESTING STEADY',
  };

  const updateAgarwoodConsoleSign = (
    elevationMeters: number,
    motivationalTitle: string,
    motivationalMessage: string,
    motionLabel: string
  ) => {
    latestConsoleState = {
      elevationMeters,
      motivationalTitle,
      motivationalMessage,
      motionLabel,
    };
    if (isDisposed) return;

    // Solid deep obsidian background (zero distracting wood streaks behind text)
    csCtx.fillStyle = '#070503';
    csCtx.fillRect(0, 0, 1536, 768);

    csCtx.strokeStyle = '#FFE484';
    csCtx.lineWidth = 18;
    csCtx.strokeRect(20, 20, 1496, 728);
    csCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    csCtx.lineWidth = 4;
    csCtx.strokeRect(44, 44, 1448, 680);

    csCtx.textAlign = 'center';
    csCtx.textBaseline = 'middle';

    setLetterSpacing(csCtx, 2.5);
    csCtx.fillStyle = '#FFE484';
    csCtx.font = '800 58px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
    csCtx.fillText('AGARWOOD TREE LIFT', 768, 114, 1380);

    setLetterSpacing(csCtx, 1.5);
    csCtx.fillStyle = '#A8F5C4';
    csCtx.font =
      '800 68px "Plus Jakarta Sans", "JetBrains Mono", system-ui, sans-serif';
    csCtx.fillText(
      `${elevationMeters.toFixed(1)}m / 33m · ${motionLabel}`,
      768,
      214,
      1380
    );

    // High-contrast divider
    csCtx.strokeStyle = 'rgba(255, 228, 132, 0.65)';
    csCtx.lineWidth = 5;
    csCtx.beginPath();
    csCtx.moveTo(92, 286);
    csCtx.lineTo(1444, 286);
    csCtx.stroke();

    setLetterSpacing(csCtx, 2);
    csCtx.fillStyle = '#FFE484';
    csCtx.font = '800 50px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
    csCtx.fillText(motivationalTitle, 768, 354, 1380);

    setLetterSpacing(csCtx, 1);
    csCtx.fillStyle = '#FFFFFF';
    csCtx.font = '700 64px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
    let rawMsgLines = wrapCanvasText(csCtx, motivationalMessage, 1360);
    let stepY = 84;
    if (rawMsgLines.length > 3) {
      csCtx.font =
        '700 50px "Plus Jakarta Sans", Verdana, system-ui, sans-serif';
      rawMsgLines = wrapCanvasText(csCtx, motivationalMessage, 1380);
      stepY = 66;
    }
    const msgLines = rawMsgLines.slice(0, 4);
    const blockH = (msgLines.length - 1) * stepY;
    const baseLineY = 550 - blockH / 2;
    msgLines.forEach((ln, idx) => {
      csCtx.fillText(ln, 768, baseLineY + idx * stepY, 1390);
    });

    setLetterSpacing(csCtx, 0);
    agarwoodConsoleSign.needsUpdate = true;
  };

  updateAgarwoodConsoleSign(
    latestConsoleState.elevationMeters,
    latestConsoleState.motivationalTitle,
    latestConsoleState.motivationalMessage,
    latestConsoleState.motionLabel
  );
  fontRefreshCallbacks.push(() =>
    updateAgarwoodConsoleSign(
      latestConsoleState.elevationMeters,
      latestConsoleState.motivationalTitle,
      latestConsoleState.motivationalMessage,
      latestConsoleState.motionLabel
    )
  );

  // 12. High-Contrast Large-Print Faceplates for Embedded 3D Lift Buttons (1024x384 sRGB)
  const makeControlFace = (
    symbol: string,
    label: string,
    bgHex: string,
    borderHex: string,
    textHex: string,
    fontPx: number
  ): THREE.CanvasTexture => {
    const btnCanvas = document.createElement('canvas');
    btnCanvas.width = 1024;
    btnCanvas.height = 384;
    const ctx = btnCanvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(btnCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    disposable.push(tex);

    const drawBtn = () => {
      if (isDisposed) return;
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, 1024, 384);

      ctx.strokeStyle = borderHex;
      ctx.lineWidth = 18;
      ctx.strokeRect(18, 18, 988, 348);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setLetterSpacing(ctx, 2.5);
      ctx.fillStyle = textHex;
      ctx.font = `800 ${fontPx}px "Plus Jakarta Sans", Verdana, system-ui, sans-serif`;
      ctx.fillText(
        symbol ? `${symbol} ${label}` : label,
        512,
        196,
        920
      );
      setLetterSpacing(ctx, 0);
      tex.needsUpdate = true;
    };

    drawBtn();
    fontRefreshCallbacks.push(drawBtn);
    return tex;
  };

  const liftControlFaces: Record<TreeLiftControlAction, THREE.CanvasTexture> = {
    ascend: makeControlFace('▲', 'HAUL UP', '#07140C', '#FFE484', '#FFFFFF', 112),
    stop: makeControlFace('■', 'HOLD / REST', '#0C0805', '#FFFFFF', '#FFE484', 102),
    descend: makeControlFace('▼', 'LOWER', '#071114', '#A8F5C4', '#FFFFFF', 112),
    glide_0: makeControlFace('', '0m ROOTS', '#090604', '#FFE484', '#FFFFFF', 118),
    glide_18: makeControlFace('', '18m BOUGH', '#090604', '#A8F5C4', '#FFFFFF', 112),
    glide_33: makeControlFace('', '33m TOP', '#090604', '#FFE484', '#FFFFFF', 118),
  };

  // Re-render all procedural sign textures cleanly once Google Web Fonts finish loading
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready
      .then(() => {
        if (!isDisposed) {
          fontRefreshCallbacks.forEach((cb) => cb());
        }
      })
      .catch(() => {
        // Ignore font load errors in headless environments
      });
  }

  // 13. Soft Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shCtx = shadowCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(128, 128, 16, 128, 128, 124);
  grad.addColorStop(0, 'rgba(8, 14, 10, 0.72)');
  grad.addColorStop(0.55, 'rgba(8, 14, 10, 0.32)');
  grad.addColorStop(1, 'rgba(8, 14, 10, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 256, 256);

  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  disposable.push(contactShadow);

  return {
    barkAlbedo,
    barkBump,
    timberAlbedo,
    cableAlbedo,
    shingleAlbedo,
    bannerSign,
    groundBoardSign,
    jobCardRackFace,
    welcomeKioskSign,
    welcomeShoeSign,
    artisanShopSign,
    canopyStudioSign,
    canopyPaypalSign,
    mezzanineLibrarySign,
    mezzanineRefreshmentsSign,
    mezzanineChillPodsSign,
    mezzaninePlushieTubSign,
    chillSanctuaryFloor,
    canopyFloorMaps,
    elevationMarkers,
    agarwoodPlaques,
    agarwoodConsoleSign,
    liftControlFaces,
    contactShadow,
    updateCanopyStudioSign,
    updateAgarwoodConsoleSign,
    dispose: () => {
      isDisposed = true;
      disposable.forEach((t) => t.dispose());
    },
  };
}

