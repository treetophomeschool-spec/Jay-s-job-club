import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import {
  CANOPY_FURNISHING_KINDS,
  CANOPY_TRADE_FOCUSES,
  CanopyFloorStyle,
  CanopyFurnishingKind,
  CanopyStudioConfig,
  CanopyTrimAccent,
  DEFAULT_CANOPY_STUDIO,
  DEFAULT_TREE_PROGRESS,
  MAX_TOKEN_COUNT,
  TOOL_VISUAL_KINDS,
  ToolVisualKind,
  TreeProgressState,
} from '../firebase';
import { getAgarwoodMotivationForElevation } from '../shared/agarwoodMotivation';
import {
  DEFAULT_SHOE_SELECTION,
  SHOE_CHARACTER_CATALOG,
  ShoeCharacterKind,
  ShoeColorway,
} from '../shared/shoeCharacterCatalog';
import { type CollabPeer } from '../shared/workshopCatalog';
import {
  CRAFT_CATALOG,
  CameraPreset,
  CanopyInspectAngle,
  ChillPodId,
  ChillPodVisualConfig,
  CraftKind,
  GameScreen,
  HudSnapshot,
  PACE_MODE_LABELS,
  PACE_MODE_ORDER,
  PaceMode,
  SanctuarySignId,
  SharePathwayKind,
  TreeLiftControlAction,
  ZoneType,
} from '../types/game';
import {
  AgarwoodTrunkControlRig,
  BoughStationNode,
  CABLE_X,
  CABLE_Z,
  CanopySummitRig,
  CollaboratorRelaySlot,
  MAX_LIFT_Y,
  MIN_LIFT_Y,
  ManualLiftRig,
  createAgarwoodTrunkControlRig,
  createCableAndCounterweight,
  createCanopyTreehouseGroup,
  createCollaboratorRelayRig,
  createGreatTreeAndStations,
  createGroundWorkshopGroup,
  createManualLiftGroup,
  createTerrainAndPerimeter,
  updateShoeCharacterAppearance,
} from './models';
import { ProceduralTextureSet, createProceduralTextures } from './textures';

// Module-scope reusable scratch objects (Zero GC inside tick loop)
const _camTargetPos = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _lookCurrent = new THREE.Vector3(-0.35, 2.2, 1.4);
const _particleDummy = new THREE.Object3D();
const _particleColor = new THREE.Color();
const _raycaster = new THREE.Raycaster();
_raycaster.layers.set(1);
const _pointerNdc = new THREE.Vector2();

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

const PARTICLE_COUNT = 48;

export class TreehouseEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private isSoftwareGl = false;
  private webglFallback = false;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet | null = null;
  private disposables: Array<{ dispose: () => void }> = [];

  private liftRig!: ManualLiftRig;
  private canopyRig!: CanopySummitRig;
  private agarwoodControlRig!: AgarwoodTrunkControlRig;
  private entryKioskHitProxy: THREE.Mesh | null = null;
  private entryKioskBeaconMat: THREE.MeshStandardMaterial | null = null;
  private welcomeShoeHitProxy: THREE.Mesh | null = null;
  private welcomeShoeBeaconMat: THREE.MeshStandardMaterial | null = null;
  private jobBoardHitProxy: THREE.Mesh | null = null;
  private jobBoardBeaconMat: THREE.MeshStandardMaterial | null = null;
  private drazellaStallHitProxy: THREE.Mesh | null = null;
  private sceneInteractives: THREE.Object3D[] = [];
  private counterweight!: THREE.Group;
  private stations: BoughStationNode[] = [];
  private collabRelaySlots: CollaboratorRelaySlot[] = [];
  private onlineCollaborators = 1;

  // Wind gust visual rig
  private gustGroup: THREE.Group = new THREE.Group();
  private gustStreaks: THREE.Mesh[] = [];
  private gustMat!: THREE.MeshStandardMaterial;

  // Pooled 3D particle system
  private particleMesh!: THREE.InstancedMesh;
  private particles: PooledParticle[] = [];

  // Loop & timing
  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hudEmitAccumulator = 0;
  private shoeStridePhase = 0;
  private activeShoeLabel =
    SHOE_CHARACTER_CATALOG[DEFAULT_SHOE_SELECTION.shoeKind].shortLabel;

  // Input & Embedded Agarwood Tree Control states
  private heldKeys = new Set<string>();
  private uiHoldAscend = false;
  private uiHoldDescend = false;
  private continuousLiftDir: -1 | 0 | 1 = 0;
  private activeTreeButtonPress: TreeLiftControlAction | null = null;
  private activeTreeButtonDownAt = 0;
  private hoveredTreeControl: TreeLiftControlAction | null = null;
  private hoveredEntryKiosk = false;
  private hoveredWelcomeShoes = false;
  private hoveredJobBoard = false;
  private hoveredCanopyStore = false;
  private hoveredCanopyStudio = false;
  private hoveredMezzanine = false;
  private hoveredChillPodId: ChillPodId | null = null;
  private activeChillPodId: ChillPodId | null = null;
  private focusedPodId: ChillPodId = 'pod_1';
  private onOpenEntryKiosk?: () => void;
  private onOpenShoeSelector?: () => void;
  private onOpenJobBoard?: (cardId?: string) => void;
  private onOpenCanopyPaypalStore?: () => void;
  private onOpenCanopyCustomizer?: () => void;
  private onOpenMezzanine?: (
    tab: 'pods' | 'library' | 'refreshments',
    podId?: ChillPodId
  ) => void;
  private lastRaycastMs = 0;
  private lastConsoleSignKey = '';
  private actionBufferTimer = 0;
  private externalModalOpen = false;
  private studioDrawerOpen = false;
  private welcomeDrawerOpen = false;

  // Subtle manual drag camera offset, mobile touch tap/pinch & Canopy inspection zoom/cutaway
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private pointerDownOriginX = 0;
  private pointerDownOriginY = 0;
  private pointerTravelPx = 0;
  private pendingTouchStationEvent: PointerEvent | null = null;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance = 0;
  private orbitYawOffset = 0;
  private orbitPitchOffset = 0;
  private canopyInspectAngle: CanopyInspectAngle = 'overview';
  private canopyZoom = 1.0;
  private roofCutaway = false;
  private roofOpacityCurrent = 1.0;
  private stowedToolsCount = 0;

  // Game & Physics Simulation State (Start ready to operate immediately)
  private screen: GameScreen = GameScreen.PLAYING;
  private liftY = MIN_LIFT_Y;
  private liftVelocity = 0;
  private clickDistanceAccum = 0;
  private sonicTrailTimer = 0;
  private autoGlideTargetY: number | null = null;
  private autoGatherEnabled = true;
  private wasAtCanopySummit = false;
  private lastHudSignature = '';

  private poise = 100;
  private braceTimer = 0;
  private braceCooldown = 0;
  private hitstopTimer = 0;
  private flashTimer = 0;
  private shakeIntensity = 0;
  private squashY = 1;
  private swayAngle = 0;
  private swayVelocity = 0;

  private carriedCraft: CraftKind | null = null;
  private selectedRootCraft: CraftKind = CraftKind.CEDAR_JOINERY;
  private boughTokensCarried = 0;
  private communityTokens = 0;
  private beaconsLit = 0;
  private tradesCompleted = 0;
  private counterweightUpgraded = false;
  private windShieldUpgraded = false;

  private cameraPreset: CameraPreset = CameraPreset.LIFT_FOLLOW;
  private paceMode: PaceMode = PaceMode.STEADY;
  private studioConfig: CanopyStudioConfig = { ...DEFAULT_CANOPY_STUDIO };
  private treeProgress: TreeProgressState = { ...DEFAULT_TREE_PROGRESS };
  private onTreeProgressChange?: (next: TreeProgressState) => void;
  private onCanopySummitReached?: () => void;
  private statusBanner =
    'Agarwood Tree Lift ready · Press the carved controls on the Agarwood trunk (or below) to climb at your own pace.';

  // Telegraphed Crosswind Encounter State
  private gustPhase: 'IDLE' | 'TELEGRAPH' | 'SWEEP' = 'IDLE';
  private gustTimer = 6.5;
  private gustY = 15.0;
  private gustDir = 1;
  private gustResolvedThisSweep = false;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onTreeProgressChange?: (next: TreeProgressState) => void,
    onCanopySummitReached?: () => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onTreeProgressChange = onTreeProgressChange;
    this.onCanopySummitReached = onCanopySummitReached;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.2,
      220
    );
    this.camera.position.set(8.5, 6.5, 19.5);

    this.initRendererAndScene();
    this.bindEvents();
    this.emitHudSnapshot(true);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      );
      renderer.setSize(
        Math.max(1, this.container.clientWidth),
        Math.max(1, this.container.clientHeight)
      );
      renderer.shadowMap.enabled = !this.isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';
      this.container.appendChild(renderer.domElement);
      this.renderer = renderer;

      // Studio Environment Reflection (RoomEnvironment on every device)
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
      this.scene.environment = envRT.texture;
      this.disposables.push(envRT);
      pmremGenerator.dispose();
    } catch {
      this.webglFallback = true;
      return;
    }

    // Horizon-matched atmospheric sky & exponential fog
    const skyHex = 0x1e3126;
    this.scene.background = new THREE.Color(skyHex);
    this.scene.fog = new THREE.FogExp2(skyHex, 0.0115);

    // Balanced 3-Point Warm/Cool Studio Outdoor Rig
    const hemiLight = new THREE.HemisphereLight(0xaad6e8, 0x2d4029, 0.95);
    hemiLight.position.set(0, 45, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe5b8, 2.25);
    keyLight.position.set(18, 38, 24);
    keyLight.target.position.set(0, 16, 0);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 85;
    const d = 24;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d + 6;
    keyLight.shadow.camera.bottom = -d + 2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight, keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x98cbb4, 0.72);
    rimLight.position.set(-16, 26, -18);
    this.scene.add(rimLight);

    // Warm sanctuary & summit point lights
    const rootWarmLight = new THREE.PointLight(0xffb54c, 3.2, 14, 1.8);
    rootWarmLight.position.set(2.8, 2.4, 3.4);
    this.scene.add(rootWarmLight);

    const canopyWarmLight = new THREE.PointLight(0xffbe5c, 4.0, 15, 1.8);
    canopyWarmLight.position.set(0, 34.8, 1.2);
    this.scene.add(canopyWarmLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    // Assemble World Hierarchy
    const perimeter = createTerrainAndPerimeter(this.textures, this.disposables);
    this.scene.add(perimeter);

    const { treeGroup, stations } = createGreatTreeAndStations(
      this.textures,
      this.disposables
    );
    this.stations = stations;
    this.scene.add(treeGroup);

    const groundWorkshop = createGroundWorkshopGroup(
      this.textures,
      this.disposables
    );
    this.entryKioskHitProxy = groundWorkshop.entryKioskHitProxy;
    this.entryKioskBeaconMat = groundWorkshop.entryKioskBeaconMat;
    this.welcomeShoeHitProxy = groundWorkshop.welcomeShoeHitProxy;
    this.welcomeShoeBeaconMat = groundWorkshop.welcomeShoeBeaconMat;
    this.jobBoardHitProxy = groundWorkshop.jobBoardHitProxy;
    this.jobBoardBeaconMat = groundWorkshop.jobBoardBeaconMat;
    this.drazellaStallHitProxy = groundWorkshop.drazellaStallHitProxy;
    this.scene.add(groundWorkshop.group);

    this.canopyRig = createCanopyTreehouseGroup(
      this.textures,
      this.isSoftwareGl,
      this.disposables
    );
    this.scene.add(this.canopyRig.root);

    const { group: cableGroup, counterweight } = createCableAndCounterweight(
      this.textures,
      this.disposables
    );
    this.counterweight = counterweight;
    this.scene.add(cableGroup);

    this.liftRig = createManualLiftGroup(this.textures, this.disposables);
    this.scene.add(this.liftRig.root);
    this.scene.add(this.liftRig.groundContactShadow);

    const collabRelay = createCollaboratorRelayRig(
      this.textures,
      this.disposables
    );
    this.collabRelaySlots = collabRelay.slots;
    this.scene.add(collabRelay.group);

    this.agarwoodControlRig = createAgarwoodTrunkControlRig(
      this.textures,
      this.disposables
    );
    this.scene.add(this.agarwoodControlRig.root);

    this.sceneInteractives = [
      ...this.agarwoodControlRig.hitProxies,
      this.entryKioskHitProxy,
      this.welcomeShoeHitProxy,
      this.jobBoardHitProxy,
      this.drazellaStallHitProxy,
      this.canopyRig.canopyStoreHitProxy,
      this.canopyRig.canopyStudioHitProxy,
      this.canopyRig.mezzanineLibraryHitProxy,
      this.canopyRig.mezzanineRefreshmentsHitProxy,
      this.canopyRig.wellyTubHitProxy,
      ...this.canopyRig.chillPodHitProxies,
    ];

    this.initWindGustVisuals();
    this.initParticlePool();
    this.beaconsLit = 3;
    this.updateBeaconVisuals();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initWindGustVisuals(): void {
    this.gustMat = new THREE.MeshStandardMaterial({
      color: '#F5DFA3',
      emissive: '#E5A93C',
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0,
      roughness: 0.4,
      depthWrite: false,
    });
    const streakGeo = new THREE.CapsuleGeometry(0.055, 2.8, 4, 8);
    streakGeo.rotateZ(Math.PI / 2);
    this.disposables.push(this.gustMat, streakGeo);

    for (let i = 0; i < 5; i++) {
      const streak = new THREE.Mesh(streakGeo, this.gustMat);
      streak.position.set(
        (i - 2) * 1.15,
        (i % 3 - 1) * 0.65,
        CABLE_Z + (i % 2 === 0 ? 0.35 : -0.35)
      );
      this.gustStreaks.push(streak);
      this.gustGroup.add(streak);
    }
    this.gustGroup.visible = false;
    this.scene.add(this.gustGroup);
  }

  private initParticlePool(): void {
    const pGeo = new THREE.OctahedronGeometry(0.11, 0);
    const pMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
    });
    this.disposables.push(pGeo, pMat);

    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_COUNT);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 1,
      });
      _particleDummy.position.set(0, -50, 0);
      _particleDummy.scale.setScalar(0.001);
      _particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
      this.particleMesh.setColorAt(i, _particleColor.setHex(0xffd166));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.particleMesh);
  }

  private spawnParticles(
    wx: number,
    wy: number,
    wz: number,
    count: number,
    hexColor: number
  ): void {
    if (this.webglFallback) return;
    let spawned = 0;
    _particleColor.setHex(hexColor);

    for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = wx + (Math.random() - 0.5) * 0.7;
        p.y = wy + (Math.random() - 0.5) * 0.5;
        p.z = wz + (Math.random() - 0.5) * 0.7;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.4 + Math.random() * 2.8;
        p.vx = Math.cos(angle) * speed;
        p.vy = 1.2 + Math.random() * 2.6;
        p.vz = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = 0.55 + Math.random() * 0.35;
        p.scale = 0.75 + Math.random() * 0.65;
        this.particleMesh.setColorAt(i, _particleColor);
        spawned++;
      }
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.addEventListener('pointerdown', this.handlePointerDown);
      canvas.addEventListener('pointermove', this.handlePointerMove);
      canvas.addEventListener('pointerleave', this.handlePointerLeave);
      canvas.addEventListener('wheel', this.handleWheel, { passive: false });
      canvas.addEventListener('webglcontextlost', this.handleContextLost);
      canvas.addEventListener(
        'webglcontextrestored',
        this.handleContextRestored
      );
    }
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
  };

  private handleContextRestored = (): void => {
    this.lastTimestamp = performance.now();
    this.startLoop();
  };

  private handleResize = (): void => {
    if (!this.renderer) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private clearHeldInputs = (): void => {
    this.heldKeys.clear();
    this.uiHoldAscend = false;
    this.uiHoldDescend = false;
    this.activeTreeButtonPress = null;
    this.isDragging = false;
    this.pendingTouchStationEvent = null;
    this.activePointers.clear();
    this.lastPinchDistance = 0;
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearHeldInputs();
    }
  };

  private pickSceneInteractive(e: PointerEvent): {
    liftControl: TreeLiftControlAction | null;
    entryKiosk: boolean;
    welcomeShoes: boolean;
    jobBoard: boolean;
    jobBoardCardId: string | null;
    canopyStore: boolean;
    canopyStudio: boolean;
    mezzanineSection: 'library' | 'refreshments' | 'plushie_tub' | null;
    chillPodId: ChillPodId | null;
  } {
    const empty = {
      liftControl: null,
      entryKiosk: false,
      welcomeShoes: false,
      jobBoard: false,
      jobBoardCardId: null,
      canopyStore: false,
      canopyStudio: false,
      mezzanineSection: null,
      chillPodId: null,
    };
    const canvas = this.renderer?.domElement;
    if (
      !canvas ||
      this.sceneInteractives.length === 0 ||
      this.webglFallback
    ) {
      return empty;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return empty;
    }

    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointerNdc, this.camera);

    const hits = _raycaster.intersectObjects(this.sceneInteractives, false);
    if (hits.length > 0) {
      const topObj = hits[0].object;
      const sceneAction = topObj.userData.sceneAction as string | undefined;
      if (sceneAction === 'open_entry_kiosk') {
        return { ...empty, entryKiosk: true };
      }
      if (sceneAction === 'open_shoe_selector') {
        return { ...empty, welcomeShoes: true };
      }
      if (sceneAction === 'open_job_board') {
        return { ...empty, jobBoard: true, jobBoardCardId: null };
      }
      if (sceneAction === 'open_drazella_notice') {
        return {
          ...empty,
          jobBoard: true,
          jobBoardCardId: 'jc_real_drazella_sprinkes_publishing',
        };
      }
      if (sceneAction === 'open_canopy_paypal_store') {
        return { ...empty, canopyStore: true };
      }
      if (sceneAction === 'open_canopy_customizer') {
        return { ...empty, canopyStudio: true };
      }
      if (sceneAction === 'open_mezzanine_library') {
        return { ...empty, mezzanineSection: 'library' };
      }
      if (sceneAction === 'open_mezzanine_refreshments') {
        return { ...empty, mezzanineSection: 'refreshments' };
      }
      if (sceneAction === 'open_plushie_tub') {
        return { ...empty, mezzanineSection: 'plushie_tub' };
      }
      if (sceneAction === 'open_chill_pod') {
        const podId = (topObj.userData.podId as ChillPodId | undefined) ?? 'pod_1';
        return { ...empty, chillPodId: podId };
      }
      const action = topObj.userData.liftControl as
        | TreeLiftControlAction
        | undefined;
      return { ...empty, liftControl: action ?? null };
    }
    return empty;
  }

  private triggerTreeControlDown(action: TreeLiftControlAction): void {
    soundEngine.unlock();
    if (this.screen !== GameScreen.PLAYING) {
      this.screen = GameScreen.PLAYING;
    }
    this.activeTreeButtonPress = action;
    this.activeTreeButtonDownAt = performance.now();

    const consoleY = this.liftY + 1.25;
    this.spawnParticles(-1.45, consoleY, 1.75, 10, 0xffd166);

    if (action === 'ascend') {
      this.autoGlideTargetY = null;
      this.uiHoldAscend = true;
      this.uiHoldDescend = false;
      soundEngine.playCraftLoad();
      this.statusBanner =
        'Agarwood Trunk Lever · Hauling upward at a calm, steady pace.';
    } else if (action === 'descend') {
      this.autoGlideTargetY = null;
      this.uiHoldDescend = true;
      this.uiHoldAscend = false;
      soundEngine.playCraftLoad();
      this.statusBanner =
        'Agarwood Trunk Lever · Lowering gently toward the Root Sanctuary.';
    } else if (action === 'stop') {
      this.stopLift();
      return;
    } else if (action === 'glide_0') {
      this.continuousLiftDir = 0;
      this.glideToElevation(0, '0m Root Sanctuary');
      return;
    } else if (action === 'glide_18') {
      this.continuousLiftDir = 0;
      this.glideToElevation(18, '18m Agarwood Bough');
      return;
    } else if (action === 'glide_33') {
      this.continuousLiftDir = 0;
      this.glideToElevation(33, '33m Treetop Canopy');
      return;
    }
    this.emitHudSnapshot(true);
  }

  private activatePickedStation(picked: ReturnType<TreehouseEngine['pickSceneInteractive']>): boolean {
    if (picked.entryKiosk) {
      soundEngine.unlock();
      soundEngine.playTokenCollect();
      this.spawnParticles(-3.68, 2.25, 2.72, 16, 0xffd166);
      this.focusEntryKiosk();
      this.onOpenEntryKiosk?.();
      return true;
    }
    if (picked.welcomeShoes) {
      soundEngine.unlock();
      soundEngine.playTokenCollect();
      this.spawnParticles(1.92, 1.85, 4.18, 16, 0x7ce0a3);
      this.focusWelcomeShoeBench();
      this.onOpenShoeSelector?.();
      return true;
    }
    if (picked.jobBoard) {
      soundEngine.unlock();
      soundEngine.playTokenCollect();
      if (picked.jobBoardCardId === 'jc_real_drazella_sprinkes_publishing') {
        this.spawnParticles(-4.35, 1.95, -0.35, 18, 0xffd166);
      } else {
        this.spawnParticles(3.62, 2.15, 1.38, 18, 0x7ce0a3);
      }
      this.focusJobBoard();
      this.onOpenJobBoard?.(picked.jobBoardCardId ?? undefined);
      return true;
    }
    if (picked.canopyStore) {
      soundEngine.unlock();
      soundEngine.playTokenCollect();
      this.spawnParticles(2.45, 34.4, 1.85, 18, 0xffd166);
      this.focusCanopyPaypalStore();
      this.onOpenCanopyPaypalStore?.();
      return true;
    }
    if (picked.canopyStudio) {
      soundEngine.unlock();
      soundEngine.playCraftLoad();
      this.spawnParticles(0, 34.3, -2.1, 16, 0xe5a93c);
      this.focusCanopyStudio();
      this.onOpenCanopyCustomizer?.();
      return true;
    }
    if (picked.mezzanineSection === 'library') {
      soundEngine.unlock();
      soundEngine.playPodSensoryCue('book');
      this.spawnParticles(-3.55, 36.4, -0.25, 16, 0xffd166);
      this.focusMezzanine('mezzanine_library');
      this.onOpenMezzanine?.('library');
      return true;
    }
    if (picked.mezzanineSection === 'refreshments') {
      soundEngine.unlock();
      soundEngine.playPodSensoryCue('tea');
      this.spawnParticles(3.55, 36.4, -0.25, 16, 0x7ce0a3);
      this.focusMezzanine('mezzanine_refreshments');
      this.onOpenMezzanine?.('refreshments');
      return true;
    }
    if (picked.mezzanineSection === 'plushie_tub') {
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();
      this.spawnParticles(0, 35.9, -2.02, 18, 0xffd166);
      this.focusMezzanine('mezzanine_relaxation');
      this.onOpenMezzanine?.('pods');
      return true;
    }
    if (picked.chillPodId) {
      soundEngine.unlock();
      soundEngine.playSanctuaryRest();
      const podNode = this.canopyRig?.chillPods[picked.chillPodId];
      if (podNode) {
        this.spawnParticles(
          podNode.worldFocusPos.x,
          podNode.worldFocusPos.y + 0.6,
          podNode.worldFocusPos.z,
          16,
          0x7ce0a3
        );
      }
      this.focusMezzanine('chill_pod', picked.chillPodId);
      this.onOpenMezzanine?.('pods', picked.chillPodId);
      return true;
    }
    return false;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.isDragging = false;
      this.pendingTouchStationEvent = null;
      return;
    }

    this.pointerDownOriginX = e.clientX;
    this.pointerDownOriginY = e.clientY;
    this.pointerTravelPx = 0;

    const picked = this.pickSceneInteractive(e);
    if (picked.liftControl) {
      e.preventDefault();
      this.triggerTreeControlDown(picked.liftControl);
      return;
    }

    const hitStation =
      picked.entryKiosk ||
      picked.welcomeShoes ||
      picked.jobBoard ||
      picked.canopyStore ||
      picked.canopyStudio ||
      picked.mezzanineSection !== null ||
      picked.chillPodId !== null;

    if (hitStation) {
      if (e.pointerType === 'touch') {
        // Defer touch station activation to pointerup if finger didn't drag (> 14px),
        // allowing natural 1-finger camera orbit on small phone screens without misfires
        this.pendingTouchStationEvent = e;
      } else {
        e.preventDefault();
        this.activatePickedStation(picked);
        return;
      }
    } else {
      this.pendingTouchStationEvent = null;
    }

    if (
      this.screen !== GameScreen.PLAYING &&
      !this.studioDrawerOpen &&
      !this.welcomeDrawerOpen
    ) {
      return;
    }
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger mobile pinch-to-zoom for Canopy / Mezzanine / Chill Pods inspection
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (this.lastPinchDistance > 0 && this.cameraPreset === CameraPreset.CANOPY_SUMMIT) {
        const delta = (dist - this.lastPinchDistance) * 0.0045;
        if (Math.abs(delta) > 0.005) {
          this.setCanopyZoom(this.canopyZoom + delta);
          this.lastPinchDistance = dist;
        }
      } else {
        this.lastPinchDistance = dist;
      }
      return;
    }

    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.pointerTravelPx = Math.max(
        this.pointerTravelPx,
        Math.hypot(
          e.clientX - this.pointerDownOriginX,
          e.clientY - this.pointerDownOriginY
        )
      );
      if (this.pointerTravelPx > 14) {
        this.pendingTouchStationEvent = null;
      }

      const maxYaw =
        this.cameraPreset === CameraPreset.CANOPY_SUMMIT ? 2.45 : 0.65;
      this.orbitYawOffset = THREE.MathUtils.clamp(
        this.orbitYawOffset - dx * 0.0045,
        -maxYaw,
        maxYaw
      );
      this.orbitPitchOffset = THREE.MathUtils.clamp(
        this.orbitPitchOffset + dy * 0.0034,
        -0.38,
        0.45
      );
      return;
    }

    if (e.pointerType === 'touch') return;

    // Throttled 25fps hover raycast against Layer 1 interactive stations
    const now = performance.now();
    if (now - this.lastRaycastMs < 40) return;
    this.lastRaycastMs = now;

    const picked = this.pickSceneInteractive(e);
    const nextHoveredMez = picked.mezzanineSection !== null;
    if (
      picked.liftControl !== this.hoveredTreeControl ||
      picked.entryKiosk !== this.hoveredEntryKiosk ||
      picked.welcomeShoes !== this.hoveredWelcomeShoes ||
      picked.jobBoard !== this.hoveredJobBoard ||
      picked.canopyStore !== this.hoveredCanopyStore ||
      picked.canopyStudio !== this.hoveredCanopyStudio ||
      nextHoveredMez !== this.hoveredMezzanine ||
      picked.chillPodId !== this.hoveredChillPodId
    ) {
      this.hoveredTreeControl = picked.liftControl;
      this.hoveredEntryKiosk = picked.entryKiosk;
      this.hoveredWelcomeShoes = picked.welcomeShoes;
      this.hoveredJobBoard = picked.jobBoard;
      this.hoveredCanopyStore = picked.canopyStore;
      this.hoveredCanopyStudio = picked.canopyStudio;
      this.hoveredMezzanine = nextHoveredMez;
      this.hoveredChillPodId = picked.chillPodId;
      const canvas = this.renderer?.domElement;
      if (canvas) {
        canvas.style.cursor =
          picked.liftControl ||
          picked.entryKiosk ||
          picked.welcomeShoes ||
          picked.jobBoard ||
          picked.canopyStore ||
          picked.canopyStudio ||
          nextHoveredMez ||
          picked.chillPodId
            ? 'pointer'
            : 'grab';
      }
      this.emitHudSnapshot(false);
    }
  };

  private handlePointerLeave = (): void => {
    if (
      this.hoveredTreeControl !== null ||
      this.hoveredEntryKiosk ||
      this.hoveredWelcomeShoes ||
      this.hoveredJobBoard ||
      this.hoveredCanopyStore ||
      this.hoveredCanopyStudio ||
      this.hoveredMezzanine ||
      this.hoveredChillPodId !== null
    ) {
      this.hoveredTreeControl = null;
      this.hoveredEntryKiosk = false;
      this.hoveredWelcomeShoes = false;
      this.hoveredJobBoard = false;
      this.hoveredCanopyStore = false;
      this.hoveredCanopyStudio = false;
      this.hoveredMezzanine = false;
      this.hoveredChillPodId = null;
      const canvas = this.renderer?.domElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }
  };

  private handleWheel = (e: WheelEvent): void => {
    if (this.cameraPreset !== CameraPreset.CANOPY_SUMMIT) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    this.setCanopyZoom(this.canopyZoom + delta);
  };

  private handlePointerUp = (e?: PointerEvent): void => {
    if (e) {
      this.activePointers.delete(e.pointerId);
    } else {
      this.activePointers.clear();
    }
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = 0;
    }

    if (
      e &&
      e.type !== 'pointercancel' &&
      this.pendingTouchStationEvent &&
      this.pointerTravelPx <= 14
    ) {
      const picked = this.pickSceneInteractive(e);
      const fallbackPicked =
        picked.chillPodId ||
        picked.mezzanineSection ||
        picked.jobBoard ||
        picked.entryKiosk ||
        picked.welcomeShoes ||
        picked.canopyStore ||
        picked.canopyStudio
          ? picked
          : this.pickSceneInteractive(this.pendingTouchStationEvent);
      this.pendingTouchStationEvent = null;
      this.isDragging = false;
      this.activatePickedStation(fallbackPicked);
      return;
    }
    this.pendingTouchStationEvent = null;

    if (this.activeTreeButtonPress) {
      const heldMs = performance.now() - this.activeTreeButtonDownAt;
      const action = this.activeTreeButtonPress;
      this.activeTreeButtonPress = null;
      this.uiHoldAscend = false;
      this.uiHoldDescend = false;

      // Effortless accessibility: a quick tap (< 260ms) on Ascend/Descend toggles calm hands-free travel!
      if (heldMs < 260 && (action === 'ascend' || action === 'descend')) {
        const desiredDir: -1 | 1 = action === 'ascend' ? 1 : -1;
        this.continuousLiftDir =
          this.continuousLiftDir === desiredDir ? 0 : desiredDir;
        if (this.continuousLiftDir !== 0) {
          this.statusBanner =
            this.continuousLiftDir > 0
              ? 'Agarwood Lift climbing steadily · Tap Rest / Hold anytime to pause.'
              : 'Agarwood Lift lowering gently · Tap Rest / Hold anytime to pause.';
        } else {
          this.statusBanner = 'Agarwood Lift paused smoothly on the trunk.';
        }
      }
      this.emitHudSnapshot(true);
    }
    this.isDragging = false;
  };

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (this.externalModalOpen || this.isEditableTarget(e.target)) return;

    if (this.screen === GameScreen.TITLE) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startPlaying();
      }
      return;
    }

    if (this.screen !== GameScreen.PLAYING) return;

    this.heldKeys.add(e.code);

    if (
      e.code === 'KeyW' ||
      e.code === 'ArrowUp' ||
      e.code === 'KeyS' ||
      e.code === 'ArrowDown'
    ) {
      this.continuousLiftDir = 0;
      this.autoGlideTargetY = null;
    } else if (e.code === 'Space') {
      e.preventDefault();
      soundEngine.unlock();
      if (
        this.continuousLiftDir !== 0 ||
        this.autoGlideTargetY !== null ||
        Math.abs(this.liftVelocity) > 0.1
      ) {
        this.stopLift();
      } else {
        this.actionBufferTimer = 0.14;
      }
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      soundEngine.unlock();
      this.actionBufferTimer = 0.14;
    } else if (e.code === 'Digit1') {
      this.glideToElevation(0, '0m Root Sanctuary');
    } else if (e.code === 'Digit2') {
      this.glideToElevation(18, '18m Agarwood Bough');
    } else if (e.code === 'Digit3') {
      this.glideToElevation(33, '33m Treetop Canopy');
    } else if (e.code === 'KeyC') {
      this.cycleCameraPreset();
    } else if (e.code === 'KeyR') {
      this.triggerReturnToRoots();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  public setOnOpenEntryKiosk(cb: (() => void) | undefined): void {
    this.onOpenEntryKiosk = cb;
  }

  public setOnOpenShoeSelector(cb: (() => void) | undefined): void {
    this.onOpenShoeSelector = cb;
  }

  public setOnOpenCanopyPaypalStore(cb: (() => void) | undefined): void {
    this.onOpenCanopyPaypalStore = cb;
  }

  public setOnOpenCanopyCustomizer(cb: (() => void) | undefined): void {
    this.onOpenCanopyCustomizer = cb;
  }

  public setOnOpenJobBoard(
    cb: ((cardId?: string) => void) | undefined
  ): void {
    this.onOpenJobBoard = cb;
  }

  public setOnOpenMezzanine(
    cb:
      | ((
          tab: 'pods' | 'library' | 'refreshments',
          podId?: ChillPodId
        ) => void)
      | undefined
  ): void {
    this.onOpenMezzanine = cb;
  }

  public applyShoeCharacter(
    shoeKind: ShoeCharacterKind,
    colorway: ShoeColorway,
    characterNickname?: string,
    celebrate = false
  ): void {
    const spec =
      SHOE_CHARACTER_CATALOG[shoeKind] ||
      SHOE_CHARACTER_CATALOG.wellington_boots;
    this.activeShoeLabel =
      characterNickname && characterNickname.trim().length >= 2
        ? characterNickname.trim()
        : spec.shortLabel;

    if (!this.webglFallback && this.liftRig?.shoeCharacter) {
      updateShoeCharacterAppearance(
        this.liftRig.shoeCharacter,
        shoeKind,
        colorway
      );
      if (celebrate) {
        this.squashY = 1.07;
        this.spawnParticles(CABLE_X + 0.3, this.liftY + 0.55, CABLE_Z, 16, 0x7ce0a3);
        soundEngine.playCraftLoad();
        this.statusBanner = `Laced up ${this.activeShoeLabel} (${spec.shortLabel}) · Ready to stride onto the Agarwood Lift!`;
      }
    }
    this.emitHudSnapshot(true);
  }

  public focusEntryKiosk(): void {
    this.cameraPreset = CameraPreset.ROOT_SANCTUARY;
    this.orbitYawOffset = -0.14;
    this.orbitPitchOffset = 0;
    this.statusBanner =
      'Ground Entry Kiosk active · Share your special interest journey or check Treetop Token status.';
    this.emitHudSnapshot(true);
  }

  public focusWelcomeShoeBench(): void {
    this.cameraPreset = CameraPreset.ROOT_SANCTUARY;
    this.orbitYawOffset = 0.16;
    this.orbitPitchOffset = -0.04;
    this.statusBanner =
      'Welcome Area Boot & Shoe Fitting Bench · Choose Wellington Boots, Work Boots, or Maker Shoes.';
    this.emitHudSnapshot(true);
  }

  public focusJobBoard(): void {
    this.cameraPreset = CameraPreset.ROOT_SANCTUARY;
    this.orbitYawOffset = 0.28;
    this.orbitPitchOffset = -0.02;
    this.statusBanner =
      "Jay's Job Centre · Inspect JC-001 (Beta User Researcher), JC-002 (Drazella Sprinkes Easy Read + Digital Art), or collaborate live.";
    this.emitHudSnapshot(true);
  }

  public focusCanopyPaypalStore(): void {
    this.cameraPreset = CameraPreset.CANOPY_SUMMIT;
    this.canopyInspectAngle = 'interior';
    this.roofCutaway = true;
    this.orbitYawOffset = 0.28;
    this.orbitPitchOffset = -0.02;
    this.statusBanner =
      '33m Canopy PayPal Maker Store · Sell your handcrafted work or check out via PayPal.';
    this.emitHudSnapshot(true);
  }

  public focusCanopyStudio(): void {
    this.cameraPreset = CameraPreset.CANOPY_SUMMIT;
    this.canopyInspectAngle = 'interior';
    this.roofCutaway = true;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    this.statusBanner =
      '33m Upstairs Canopy Studio · Customise non-slip flooring, safety hatch, nameplate & 3D lanterns.';
    this.emitHudSnapshot(true);
  }

  public focusMezzanine(
    angle:
      | 'mezzanine_overview'
      | 'mezzanine_relaxation'
      | 'mezzanine_library'
      | 'mezzanine_refreshments'
      | 'chill_pod' = 'mezzanine_overview',
    podId?: ChillPodId
  ): void {
    this.cameraPreset = CameraPreset.CANOPY_SUMMIT;
    this.canopyInspectAngle = angle;
    this.roofCutaway = true;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    if (podId) {
      this.focusedPodId = podId;
    } else if (this.activeChillPodId) {
      this.focusedPodId = this.activeChillPodId;
    }
    this.statusBanner =
      angle === 'mezzanine_library'
        ? 'Treetop Mezzanine Library · Browse calm trade manuals, joinery guides & sensory pacing notes.'
        : angle === 'mezzanine_refreshments'
          ? 'Treetop Mezzanine Refreshments · Pour warm herbal tea, spring water, or oat flapjacks to restore Poise.'
          : angle === 'mezzanine_relaxation'
            ? 'Safe Chill Pods Lounge & Welly Plushie Laundry Tub · Step-free cushioned floor, enclosed height-safe walls & soft Welly plushies.'
            : angle === 'chill_pod'
              ? 'Private Sensory Chill Pod (1 Per Person) · Step-free threshold, dual grab bars, privacy door & sensory controls.'
              : 'Treetop Mezzanine Gallery · Explore the Library, Refreshments Bar, Welly Plushie Tub & 4 Safe Chill Pods.';
    this.emitHudSnapshot(true);
  }

  public setTactileFloorHighContrast(enabled: boolean): void {
    if (this.webglFallback || !this.canopyRig?.tactileWayfindingMat) return;
    const mat = this.canopyRig.tactileWayfindingMat;
    if (enabled) {
      mat.color.set('#FFF078');
      mat.emissive.set('#F59E0B');
      mat.emissiveIntensity = 0.88;
    } else {
      mat.color.set('#FFE066');
      mat.emissive.set('#D97706');
      mat.emissiveIntensity = 0.28;
    }
  }

  public restorePoiseFromRefreshment(drinkLabel: string): void {
    this.poise = 100;
    soundEngine.playPodSensoryCue('tea');
    this.spawnParticles(3.55, 36.4, -0.25, 16, 0x7ce0a3);
    this.statusBanner = `Enjoyed ${drinkLabel} at the Mezzanine Refreshments Bar · Poise restored to 100%.`;
    this.emitHudSnapshot(true);
  }

  public applyChillPodsVisualState(configs: ChillPodVisualConfig[]): void {
    let myPod: ChillPodId | null = null;
    let myPodLightsOff = false;

    for (const cfg of configs) {
      if (cfg.occupied && cfg.isCurrentUser) {
        myPod = cfg.podId;
        myPodLightsOff = cfg.lightsOffCalm;
      }
      if (!this.webglFallback && this.canopyRig?.chillPods[cfg.podId]) {
        const node = this.canopyRig.chillPods[cfg.podId];
        node.fanActive = cfg.occupied && cfg.fanEnabled;
        node.flotationActive = cfg.occupied && cfg.flotationEnabled;

        // Sliding Sanctuary Privacy Door & Occupant-Only Interior Safety Latch
        node.doorTargetX = cfg.occupied ? -0.06 : -0.42;

        // 1. Occupancy doorway jewel & interior safety latch (Emerald = Vacant, Gold = You, Soft Coral = Occupied 1/1)
        if (!cfg.occupied) {
          node.statusJewelMat.color.set('#34D399');
          node.statusJewelMat.emissive.set('#10B981');
          node.statusJewelMat.emissiveIntensity = 0.85;
          node.interiorLatchMat.color.set('#7CE0A3');
          node.interiorLatchMat.emissive.set('#10B981');
          node.interiorLatchMat.emissiveIntensity = 0.45;
        } else if (cfg.isCurrentUser) {
          node.statusJewelMat.color.set('#FFE484');
          node.statusJewelMat.emissive.set('#F59E0B');
          node.statusJewelMat.emissiveIntensity = 1.45;
          node.interiorLatchMat.color.set('#FFE484');
          node.interiorLatchMat.emissive.set('#F59E0B');
          node.interiorLatchMat.emissiveIntensity = 0.95;
        } else {
          node.statusJewelMat.color.set('#FDA4AF');
          node.statusJewelMat.emissive.set('#E11D48');
          node.statusJewelMat.emissiveIntensity = 0.95;
          node.interiorLatchMat.color.set('#FDA4AF');
          node.interiorLatchMat.emissive.set('#E11D48');
          node.interiorLatchMat.emissiveIntensity = 0.7;
        }

        // 2. Ceramic Hearth Heater glow
        if (cfg.occupied && cfg.heaterEnabled) {
          node.heaterMat.color.set('#FB923C');
          node.heaterMat.emissive.set('#EA580C');
          node.heaterMat.emissiveIntensity = 1.45;
        } else {
          node.heaterMat.color.set('#3A2820');
          node.heaterMat.emissive.set('#000000');
          node.heaterMat.emissiveIntensity = 0;
        }

        // 3. Sensory Calm Overhead Lamp (Turns off completely for dark sensory calm)
        if (cfg.occupied && cfg.lightsOffCalm) {
          node.lampMat.color.set('#1E293B');
          node.lampMat.emissive.set('#000000');
          node.lampMat.emissiveIntensity = 0;
        } else {
          node.lampMat.color.set('#FFE6AD');
          node.lampMat.emissive.set('#F59E0B');
          node.lampMat.emissiveIntensity = 0.65;
        }

        // 4. Sensory Water Flotation Basin
        node.waterMesh.visible = cfg.occupied && cfg.flotationEnabled;
        node.waterMat.emissiveIntensity =
          cfg.occupied && cfg.flotationEnabled ? 0.58 : 0.08;

        // 5. Heavy Weighted Quilt (Vegan Sage Bamboo-Linen vs Natural Duck Feather Cream)
        node.quiltGroup.visible = cfg.occupied && cfg.quiltType !== 'none';
        if (cfg.quiltType === 'vegan') {
          node.quiltMat.color.set('#5E8C71');
        } else if (cfg.quiltType === 'natural_duck_feather') {
          node.quiltMat.color.set('#F3E8D2');
        }

        // 6. Snuggled Companion Welly Plushie from the Clothes-Washing Laundry Tub
        const plushieId = cfg.occupied ? cfg.wellyPlushieId : null;
        node.companionPlushieGroup.visible = Boolean(plushieId);
        if (plushieId === 'mossy_green') {
          node.companionPlushieUpperMat.color.set('#2E7D4F');
        } else if (plushieId === 'sunny_yellow') {
          node.companionPlushieUpperMat.color.set('#F4C430');
        } else if (plushieId === 'bramble_berry') {
          node.companionPlushieUpperMat.color.set('#9E4770');
        } else if (plushieId === 'oatie_cream') {
          node.companionPlushieUpperMat.color.set('#EADBC4');
        }
      }
    }

    if (!this.webglFallback && this.canopyRig?.mezzanineLight) {
      this.canopyRig.mezzanineLight.intensity = myPodLightsOff ? 0.38 : 1.35;
    }

    if (myPod && this.activeChillPodId !== myPod) {
      this.poise = 100;
      this.focusedPodId = myPod;
    }
    this.activeChillPodId = myPod;
    this.emitHudSnapshot(true);
  }

  public setExternalModalOpen(
    open: boolean,
    studioDrawer = false,
    welcomeDrawer = false
  ): void {
    this.externalModalOpen = open;
    this.studioDrawerOpen = studioDrawer;
    this.welcomeDrawerOpen = welcomeDrawer;
    if (open) {
      this.clearHeldInputs();
    } else if (
      this.cameraPreset === CameraPreset.ROOT_SANCTUARY ||
      (this.cameraPreset === CameraPreset.CANOPY_SUMMIT && this.liftY < 29.0)
    ) {
      this.cameraPreset = CameraPreset.LIFT_FOLLOW;
      this.orbitYawOffset = 0;
      this.orbitPitchOffset = 0;
      this.roofCutaway = false;
    }
  }

  public applyTreeProgress(
    progress: TreeProgressState,
    bannerMessage?: string
  ): void {
    const validOwned = Array.isArray(progress.ownedFurnishings)
      ? progress.ownedFurnishings
          .filter((item): item is CanopyFurnishingKind =>
            CANOPY_FURNISHING_KINDS.includes(item)
          )
          .slice(0, 6)
      : [];
    this.treeProgress = {
      tryingTokens: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.tryingTokens))
      ),
      gatheringTokens: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.gatheringTokens))
      ),
      treehouseTokens: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.treehouseTokens ?? 0))
      ),
      ownedFurnishings: Array.from(new Set(validOwned)),
      sharesCompleted: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.sharesCompleted))
      ),
      welcomeCheckedIn: Boolean(progress.welcomeCheckedIn),
      dailyStreak: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.dailyStreak ?? 0))
      ),
      bestStreak: Math.min(
        MAX_TOKEN_COUNT,
        Math.max(0, Math.floor(progress.bestStreak ?? 0))
      ),
      lastStreakDate:
        typeof progress.lastStreakDate === 'string'
          ? progress.lastStreakDate.slice(0, 10)
          : '',
    };
    if (bannerMessage) {
      this.statusBanner = bannerMessage;
      this.spawnParticles(CABLE_X, this.liftY + 1.0, CABLE_Z, 14, 0xffd166);
      soundEngine.playTokenCollect();
    }
    this.emitHudSnapshot(true);
  }

  public applyPassiveHabitUpgrades(lifetimeEnergyEarned: number): void {
    let changed = false;
    if (lifetimeEnergyEarned >= 30 && !this.counterweightUpgraded) {
      this.counterweightUpgraded = true;
      changed = true;
    }
    if (lifetimeEnergyEarned >= 60 && !this.windShieldUpgraded) {
      this.windShieldUpgraded = true;
      if (this.liftRig) {
        this.liftRig.windShieldGroup.visible = true;
      }
      changed = true;
    }
    if (changed) {
      this.emitHudSnapshot(true);
    }
  }

  public awardMasteryHabitEnergy(
    milestoneLabel: string,
    energyAwarded: number,
    lifetimeEnergyEarned: number
  ): void {
    soundEngine.unlock();
    this.poise = Math.min(100, this.poise + 15);
    this.squashY = 1.08;
    this.flashTimer = 0.2;
    this.spawnParticles(CABLE_X, this.liftY + 1.05, CABLE_Z, 18, 0x7ce0a3);

    const unlockedCounterweight =
      lifetimeEnergyEarned >= 30 && !this.counterweightUpgraded;
    const unlockedWindShield =
      lifetimeEnergyEarned >= 60 && !this.windShieldUpgraded;

    if (unlockedCounterweight) {
      this.counterweightUpgraded = true;
    }
    if (unlockedWindShield) {
      this.windShieldUpgraded = true;
      if (this.liftRig) {
        this.liftRig.windShieldGroup.visible = true;
      }
    }

    if (unlockedWindShield) {
      soundEngine.playCanopyDelivery(false);
      this.statusBanner = `Logged "${milestoneLabel}" (+${energyAwarded} Energy, +15% Poise) · Brass Wind-Shield Louvers unlocked at 60 Lifetime Energy!`;
    } else if (unlockedCounterweight) {
      soundEngine.playCanopyDelivery(false);
      this.statusBanner = `Logged "${milestoneLabel}" (+${energyAwarded} Energy, +15% Poise) · Counterweight Balance unlocked at 30 Lifetime Energy!`;
    } else {
      soundEngine.playTokenCollect();
      this.statusBanner = `Logged "${milestoneLabel}" · +${energyAwarded} Tree-Climbing Energy & +15% Lift Poise (${Math.round(this.poise)}%).`;
    }
    this.emitHudSnapshot(true);
  }

  public triggerEnergyClimbBoost(
    targetElevationMeters: number,
    label: string,
    energySpent: number
  ): void {
    soundEngine.unlock();
    if (this.screen === GameScreen.TITLE) {
      this.screen = GameScreen.PLAYING;
    }
    this.poise = 100;
    this.gustPhase = 'IDLE';
    if (this.gustGroup) {
      this.gustGroup.visible = false;
    }
    this.swayVelocity = 0;
    this.shakeIntensity = 0;
    this.squashY = 1.1;
    this.flashTimer = 0.24;
    this.spawnParticles(CABLE_X, this.liftY + 1.15, CABLE_Z, 22, 0xffd166);
    soundEngine.playCanopyDelivery(false);
    this.glideToElevation(
      targetElevationMeters,
      `${label} (Channeled ${energySpent} Energy · 100% Poise)`
    );
  }

  public syncRemoteCollaborators(
    peers: CollabPeer[],
    selfClientId: string
  ): void {
    this.onlineCollaborators = Math.max(1, peers.length);
    const remotes = peers
      .filter((p) => p.clientId !== selfClientId)
      .slice(0, this.collabRelaySlots.length);

    for (let i = 0; i < this.collabRelaySlots.length; i++) {
      const slot = this.collabRelaySlots[i];
      const peer = remotes[i];
      if (peer) {
        slot.active = true;
        slot.group.visible = true;
        slot.targetY = THREE.MathUtils.clamp(
          MIN_LIFT_Y + peer.elevationMeters,
          MIN_LIFT_Y,
          MAX_LIFT_Y
        );
        slot.beaconMat.color.set(peer.color || '#7CE0A3');
        slot.beaconMat.emissive.set(peer.color || '#7CE0A3');
      } else {
        slot.active = false;
        slot.group.visible = false;
      }
    }
    this.emitHudSnapshot(false);
  }

  public toggleAutoGather(): void {
    this.autoGatherEnabled = !this.autoGatherEnabled;
    this.statusBanner = this.autoGatherEnabled
      ? 'Auto-Gather on Pass enabled · Bough bundles collect smoothly without stopping.'
      : 'Manual Bough Gather enabled · Press Space near a bough station to collect.';
    this.emitHudSnapshot(true);
  }

  public glideToElevation(targetElevationMeters: number, label?: string): void {
    soundEngine.unlock();
    if (this.screen === GameScreen.TITLE) {
      this.screen = GameScreen.PLAYING;
    }
    this.cameraPreset = CameraPreset.LIFT_FOLLOW;
    const clampedTargetY = THREE.MathUtils.clamp(
      MIN_LIFT_Y + targetElevationMeters,
      MIN_LIFT_Y,
      MAX_LIFT_Y
    );
    if (Math.abs(this.liftY - clampedTargetY) <= 0.22) {
      this.autoGlideTargetY = null;
      this.liftY = clampedTargetY;
      this.statusBanner = `Docked steady at ${label || `${Math.round(targetElevationMeters)}m`}.`;
      if (this.getZone() === ZoneType.CANOPY_SUMMIT) {
        this.wasAtCanopySummit = true;
        this.onCanopySummitReached?.();
      }
      this.emitHudSnapshot(true);
      return;
    }
    this.autoGlideTargetY = clampedTargetY;
    this.statusBanner = `Express Pulley gliding smoothly to ${label || `${Math.round(targetElevationMeters)}m`}...`;
    this.emitHudSnapshot(true);
  }

  public applyStowedToolKinds(
    visualKinds: ToolVisualKind[],
    celebrate = false
  ): void {
    const activeSet = new Set(
      visualKinds.filter((k) => TOOL_VISUAL_KINDS.includes(k))
    );
    this.stowedToolsCount = activeSet.size;
    if (!this.webglFallback && this.canopyRig) {
      TOOL_VISUAL_KINDS.forEach((kind) => {
        const mesh = this.canopyRig.toolMeshes[kind];
        if (mesh) {
          mesh.visible = activeSet.has(kind);
        }
      });
      if (celebrate) {
        this.spawnParticles(-2.6, 34.4, -1.45, 16, 0x7ce0a3);
        soundEngine.playCraftLoad();
      }
    }
    this.emitHudSnapshot(true);
  }

  public setCanopyInspectAngle(
    angle: CanopyInspectAngle,
    immediate = false
  ): void {
    this.canopyInspectAngle = angle;
    this.cameraPreset = CameraPreset.CANOPY_SUMMIT;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    // Automatically enable roof cutaway when stepping inside the Canopy interior
    this.roofCutaway =
      angle === 'interior' ||
      angle === 'tools_rack' ||
      angle === 'lanterns_floor' ||
      angle === 'mezzanine_overview' ||
      angle === 'mezzanine_relaxation' ||
      angle === 'mezzanine_library' ||
      angle === 'mezzanine_refreshments' ||
      angle === 'chill_pod';
    if (immediate || this.isSoftwareGl) {
      this.updateCamera(10);
    }
    this.emitHudSnapshot(true);
  }

  public setCanopyZoom(nextZoom: number): void {
    this.canopyZoom = THREE.MathUtils.clamp(
      Math.round(nextZoom * 100) / 100,
      0.65,
      1.55
    );
    this.emitHudSnapshot(true);
  }

  public setRoofCutaway(enabled: boolean): void {
    this.roofCutaway = enabled;
    this.emitHudSnapshot(true);
  }

  public resetCanopyInspectionOrbit(): void {
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    this.canopyZoom = 1.0;
    this.emitHudSnapshot(true);
  }

  public activateSharePathway(pathway: SharePathwayKind): void {
    soundEngine.unlock();
    this.squashY = 1.09;
    this.flashTimer = 0.24;

    if (pathway === 'collab_ready') {
      this.communityTokens += 15;
      this.spawnParticles(CABLE_X, this.liftY + 1.1, CABLE_Z, 18, 0x7ce0a3);
      soundEngine.playCanopyDelivery(false);
      this.statusBanner =
        'Collab Bundle ready to share · Special interest notes & papers organized (+15 Community)!';
    } else if (pathway === 'trade_building') {
      this.communityTokens += 25;
      this.counterweightUpgraded = true;
      this.spawnParticles(CABLE_X, this.liftY + 1.1, CABLE_Z, 20, 0xe5a93c);
      soundEngine.playCanopyDelivery(false);
      this.statusBanner =
        'Trade Building step complete · Pulley Counterweight Balance unlocked (+25 Community)!';
    } else if (pathway === 'job_steps') {
      this.communityTokens += 25;
      this.windShieldUpgraded = true;
      if (this.liftRig) {
        this.liftRig.windShieldGroup.visible = true;
      }
      this.spawnParticles(CABLE_X, this.liftY + 1.1, CABLE_Z, 20, 0xffd166);
      soundEngine.playCanopyDelivery(false);
      this.statusBanner =
        'Practical Job Steps mapped · Brass Wind-Shield Louvers fitted to the Lift (+25 Community)!';
    } else if (pathway === 'trade_sharing') {
      this.communityTokens += 35;
      this.tradesCompleted += 1;
      if (this.beaconsLit < 3) {
        this.beaconsLit += 1;
        this.updateBeaconVisuals();
      }
      this.spawnParticles(0, 36.5, 1.2, 24, 0xffb647);
      soundEngine.playCanopyDelivery(true);
      this.statusBanner =
        this.beaconsLit >= 3
          ? 'Trade Sharing complete · All three Canopy Beacons (▲ ▲ ▲) shine across the forest!'
          : `Trade Sharing complete · Canopy Beacon ${this.beaconsLit}/3 illuminated (+35 Community)!`;
    }
    this.emitHudSnapshot(true);
  }

  public applyCanopyStudioConfig(
    config: CanopyStudioConfig,
    celebrate = false
  ): void {
    const cleanFurnished = Array.isArray(config.furnishedItems)
      ? Array.from(
          new Set(
            config.furnishedItems.filter((item): item is CanopyFurnishingKind =>
              CANOPY_FURNISHING_KINDS.includes(item)
            )
          )
        ).slice(0, 6)
      : [];

    this.studioConfig = {
      ...config,
      furnishedItems: cleanFurnished,
    };

    if (!this.webglFallback && this.textures && this.canopyRig) {
      const floorSpecs: Record<
        CanopyFloorStyle,
        { roughness: number; metalness: number }
      > = {
        interlocking_oak: { roughness: 0.68, metalness: 0.1 },
        nonslip_slate: { roughness: 0.84, metalness: 0.18 },
        cork_sanctuary: { roughness: 0.9, metalness: 0.02 },
        herringbone_cedar: { roughness: 0.62, metalness: 0.06 },
      };
      const trimSpecs: Record<
        CanopyTrimAccent,
        { hex: string; roughness: number; metalness: number }
      > = {
        warm_brass: { hex: '#E5A93C', roughness: 0.24, metalness: 0.86 },
        forged_iron: { hex: '#34403C', roughness: 0.42, metalness: 0.82 },
        forest_sage: { hex: '#548263', roughness: 0.56, metalness: 0.22 },
        terracotta_clay: { hex: '#C76540', roughness: 0.62, metalness: 0.16 },
      };

      const fSpec =
        floorSpecs[config.floorStyle] || floorSpecs.interlocking_oak;
      this.canopyRig.floorMat.map =
        this.textures.canopyFloorMaps[config.floorStyle] ||
        this.textures.canopyFloorMaps.interlocking_oak;
      this.canopyRig.floorMat.roughness = fSpec.roughness;
      this.canopyRig.floorMat.metalness = fSpec.metalness;
      this.canopyRig.floorMat.needsUpdate = true;

      const tSpec = trimSpecs[config.trimAccent] || trimSpecs.warm_brass;
      this.canopyRig.trimAccentMat.color.set(tSpec.hex);
      this.canopyRig.trimAccentMat.roughness = tSpec.roughness;
      this.canopyRig.trimAccentMat.metalness = tSpec.metalness;
      this.canopyRig.trimAccentMat.needsUpdate = true;

      this.textures.updateCanopyStudioSign(
        config.studioName,
        config.tradeFocus
      );

      CANOPY_TRADE_FOCUSES.forEach((focus) => {
        const grp = this.canopyRig.tradeFocusProps[focus];
        if (grp) {
          grp.visible = focus === config.tradeFocus;
        }
      });

      const activeSet = new Set(cleanFurnished);
      let lightPower = 0;
      CANOPY_FURNISHING_KINDS.forEach((fKind) => {
        const mesh = this.canopyRig.furnishingMeshes[fKind];
        const isPlaced = activeSet.has(fKind);
        if (mesh) {
          mesh.visible = isPlaced;
        }
        if (
          isPlaced &&
          (fKind === 'brass_hanging_lantern' ||
            fKind === 'amber_floor_lantern' ||
            fKind === 'starlight_garland' ||
            fKind === 'cedar_reading_lamp')
        ) {
          lightPower += 1.25;
        }
      });
      this.canopyRig.furnishingLight.intensity = lightPower;

      if (celebrate) {
        this.spawnParticles(0, 34.1, -0.8, 18, 0xffd166);
      }
    }
    this.emitHudSnapshot(true);
  }

  // Public Controls API for React HUD
  public startPlaying(): void {
    soundEngine.unlock();
    soundEngine.playSanctuaryRest();
    this.screen = GameScreen.PLAYING;
    this.cameraPreset = CameraPreset.LIFT_FOLLOW;
    this.statusBanner =
      'Root Sanctuary · Select or load a craft piece [Space], then hold W / Up to haul the pulley at your pace.';
    this.emitHudSnapshot(true);
  }

  public setScreen(next: GameScreen): void {
    this.clearHeldInputs();
    this.screen = next;
    this.emitHudSnapshot(true);
  }

  public resetSession(): void {
    this.clearHeldInputs();
    this.liftY = MIN_LIFT_Y;
    this.liftVelocity = 0;
    this.autoGlideTargetY = null;
    this.wasAtCanopySummit = false;
    this.poise = 100;
    this.carriedCraft = null;
    this.boughTokensCarried = 0;
    this.communityTokens = 0;
    this.beaconsLit = 0;
    this.tradesCompleted = 0;
    this.counterweightUpgraded = false;
    this.windShieldUpgraded = false;
    this.liftRig.windShieldGroup.visible = false;
    this.updateCarriedCargoMesh();
    this.updateBeaconVisuals();
    this.stations.forEach((st) => {
      st.collected = false;
      st.respawnTimer = 0;
      st.tokenMesh.visible = true;
    });
    this.gustPhase = 'IDLE';
    this.gustTimer = 6.0;
    this.gustGroup.visible = false;
    this.screen = GameScreen.PLAYING;
    this.cameraPreset = CameraPreset.LIFT_FOLLOW;
    this.statusBanner =
      'Fresh Apprentice session started at the Root Base Workshop.';
    soundEngine.playSanctuaryRest();
    this.emitHudSnapshot(true);
  }

  public setUiHoldAscend(active: boolean): void {
    if (active) {
      soundEngine.unlock();
      this.continuousLiftDir = 0;
      this.autoGlideTargetY = null;
    }
    this.uiHoldAscend = active;
    this.emitHudSnapshot(true);
  }

  public setUiHoldDescend(active: boolean): void {
    if (active) {
      soundEngine.unlock();
      this.continuousLiftDir = 0;
      this.autoGlideTargetY = null;
    }
    this.uiHoldDescend = active;
    this.emitHudSnapshot(true);
  }

  public toggleContinuousLift(direction: 'ascend' | 'descend'): void {
    soundEngine.unlock();
    if (this.screen !== GameScreen.PLAYING) {
      this.screen = GameScreen.PLAYING;
    }
    this.autoGlideTargetY = null;
    this.uiHoldAscend = false;
    this.uiHoldDescend = false;
    const targetDir: -1 | 1 = direction === 'ascend' ? 1 : -1;
    this.continuousLiftDir =
      this.continuousLiftDir === targetDir ? 0 : targetDir;
    this.statusBanner =
      this.continuousLiftDir > 0
        ? 'Agarwood Lift climbing steadily · Press Rest / Hold anytime to pause.'
        : this.continuousLiftDir < 0
          ? 'Agarwood Lift lowering gently · Press Rest / Hold anytime to pause.'
          : 'Agarwood Lift resting steady.';
    this.emitHudSnapshot(true);
  }

  public stopLift(): void {
    soundEngine.unlock();
    this.continuousLiftDir = 0;
    this.autoGlideTargetY = null;
    this.uiHoldAscend = false;
    this.uiHoldDescend = false;
    this.liftVelocity = 0;
    this.braceTimer = 0.75;
    soundEngine.playBrakeLatch(false);
    this.statusBanner =
      'Brass Ratchet Brake latched on the Agarwood trunk · Resting steady.';
    this.emitHudSnapshot(true);
  }

  public setCameraPreset(preset: CameraPreset, immediate = false): void {
    this.cameraPreset = preset;
    this.orbitYawOffset = 0;
    this.orbitPitchOffset = 0;
    if (immediate || this.isSoftwareGl) {
      this.updateCamera(10);
    }
    this.emitHudSnapshot(true);
  }

  public cycleCameraPreset(): void {
    const order = [
      CameraPreset.LIFT_FOLLOW,
      CameraPreset.DIAGRAM_WIDE,
      CameraPreset.CANOPY_SUMMIT,
      CameraPreset.ROOT_SANCTUARY,
    ];
    const nextIdx = (order.indexOf(this.cameraPreset) + 1) % order.length;
    this.setCameraPreset(order[nextIdx]);
  }

  public setPaceMode(mode: PaceMode, silent = false): void {
    this.paceMode = mode;
    if (mode === PaceMode.SUPER_SLOW || mode === PaceMode.SONIC) {
      // Clear any active crosswind gust immediately when switching to Super Slow sensory calm or Sonic Busy-Day
      this.gustPhase = 'IDLE';
      this.gustGroup.visible = false;
      this.swayVelocity = 0;
      this.shakeIntensity = 0;
    }
    if (!silent) {
      soundEngine.unlock();
      if (mode === PaceMode.SUPER_SLOW) {
        soundEngine.playSanctuaryRest();
      } else if (mode === PaceMode.SONIC) {
        soundEngine.playTokenCollect();
      } else {
        soundEngine.playCraftLoad();
      }
      const meta = PACE_MODE_LABELS[mode];
      this.statusBanner = `Lift Pace: ${meta.buttonLabel} · ${meta.description}.`;
    }
    this.emitHudSnapshot(true);
  }

  public togglePaceMode(): void {
    const nextIdx =
      (PACE_MODE_ORDER.indexOf(this.paceMode) + 1) % PACE_MODE_ORDER.length;
    this.setPaceMode(PACE_MODE_ORDER[nextIdx]);
  }

  public selectRootCraft(kind: CraftKind): void {
    this.selectedRootCraft = kind;
    if (this.getZone() === ZoneType.ROOT_SANCTUARY) {
      this.carriedCraft = kind;
      this.updateCarriedCargoMesh();
      this.squashY = 0.91;
      this.spawnParticles(CABLE_X, this.liftY + 0.8, CABLE_Z, 12, 0xe5a93c);
      soundEngine.playCraftLoad();
      this.statusBanner = `Loaded ${CRAFT_CATALOG[kind].label} onto the Lift · Haul upward [W / Up] whenever ready.`;
    }
    this.emitHudSnapshot(true);
  }

  public triggerPrimaryAction(): void {
    soundEngine.unlock();
    this.executeContextAction();
  }

  public triggerCanopyTrade(): void {
    if (this.getZone() !== ZoneType.CANOPY_SUMMIT) return;
    if (!this.carriedCraft && this.boughTokensCarried === 0) {
      this.statusBanner =
        'Descend to the Root Workshop or Bough Stations to gather craft work for Trade.';
      this.emitHudSnapshot(true);
      return;
    }

    const baseVal = this.carriedCraft
      ? CRAFT_CATALOG[this.carriedCraft].baseValue
      : 0;
    const tokenBonus = this.boughTokensCarried * 8;
    const totalEarned = baseVal + tokenBonus;

    this.communityTokens += totalEarned;
    this.tradesCompleted += 1;
    this.carriedCraft = null;
    this.boughTokensCarried = 0;
    this.updateCarriedCargoMesh();

    this.squashY = 1.09;
    this.flashTimer = 0.22;
    this.spawnParticles(CABLE_X - 1.4, this.liftY + 1.1, CABLE_Z, 18, 0xffd166);
    soundEngine.playCanopyDelivery(false);

    // Unlock helpful workshop upgrades automatically through Community Trade!
    if (this.communityTokens >= 20 && !this.counterweightUpgraded) {
      this.counterweightUpgraded = true;
      this.statusBanner = `Traded for +${totalEarned} Community Tokens · Counterweight Balance unlocked (smoother, faster haul)!`;
    } else if (this.communityTokens >= 45 && !this.windShieldUpgraded) {
      this.windShieldUpgraded = true;
      this.liftRig.windShieldGroup.visible = true;
      this.statusBanner = `Traded for +${totalEarned} Community Tokens · Brass Wind-Shield Louvers fitted to the Lift!`;
    } else {
      this.statusBanner = `Community Trade complete (+${totalEarned} Tokens) · Descend at your pace for another craft run.`;
    }
    this.emitHudSnapshot(true);
  }

  public triggerCanopyMastery(): void {
    if (this.getZone() !== ZoneType.CANOPY_SUMMIT) return;
    if (!this.carriedCraft) {
      this.statusBanner =
        'Bring a crafted piece from the Root Base Workshop to dedicate toward Summit Mastery.';
      this.emitHudSnapshot(true);
      return;
    }

    const bonusTokens = this.boughTokensCarried * 6 + 10;
    this.communityTokens += bonusTokens;
    this.carriedCraft = null;
    this.boughTokensCarried = 0;
    this.updateCarriedCargoMesh();

    if (this.beaconsLit < 3) {
      this.beaconsLit += 1;
      this.updateBeaconVisuals();
    }

    this.hitstopTimer = 0.055;
    this.flashTimer = 0.3;
    this.squashY = 1.12;
    this.spawnParticles(0, 38.2, 1.5, 26, 0xffb647);
    soundEngine.playCanopyDelivery(true);

    if (this.beaconsLit >= 3) {
      this.statusBanner =
        'All three Canopy Beacons (▲ ▲ ▲) shine across the forest · Passion turned to Purpose!';
      this.screen = GameScreen.MASTERY_COMPLETE;
    } else {
      this.statusBanner = `Summit Beacon ${this.beaconsLit} of 3 lit (▲) · Descend to the Root Workshop whenever ready for your next craft.`;
    }
    this.emitHudSnapshot(true);
  }

  public triggerReturnToRoots(): void {
    this.glideToElevation(0, 'Ground Sanctuary (0m)');
  }

  private collectStationBundle(st: BoughStationNode, automatic: boolean): void {
    if (st.collected) return;
    st.collected = true;
    st.respawnTimer = 20.0;
    st.tokenMesh.visible = false;
    this.boughTokensCarried += 1;
    this.treeProgress = {
      ...this.treeProgress,
      gatheringTokens: Math.min(
        MAX_TOKEN_COUNT,
        this.treeProgress.gatheringTokens + 1
      ),
    };
    this.onTreeProgressChange?.({ ...this.treeProgress });
    this.poise = Math.min(100, this.poise + 10);
    this.squashY = 1.07;
    this.flashTimer = 0.16;
    this.spawnParticles(
      st.tokenMesh.position.x,
      st.elevation + 0.55,
      CABLE_Z,
      16,
      0x7ce0a3
    );
    soundEngine.playTokenCollect();
    this.statusBanner = automatic
      ? `Auto-gathered ${st.label} on pass (+1 Gathering Token, +10% Poise).`
      : `Gathered Special Interest Bundle at ${st.label} (+1 Gathering Token, +10% Poise).`;
    this.emitHudSnapshot(true);
  }

  private handleNumberShortcut(num: 1 | 2 | 3): void {
    const zone = this.getZone();
    if (zone === ZoneType.ROOT_SANCTUARY) {
      const kinds = [
        CraftKind.CEDAR_JOINERY,
        CraftKind.COPPER_LANTERN,
        CraftKind.LOOMED_TAPESTRY,
      ];
      this.selectRootCraft(kinds[num - 1]);
    } else if (zone === ZoneType.CANOPY_SUMMIT) {
      if (num === 1) this.triggerCanopyTrade();
      if (num === 2) this.triggerCanopyMastery();
    }
  }

  private executeContextAction(): void {
    const zone = this.getZone();

    // 1. At Root Base Sanctuary -> Load selected craft onto carriage
    if (zone === ZoneType.ROOT_SANCTUARY) {
      if (this.carriedCraft) {
        const order = [
          CraftKind.CEDAR_JOINERY,
          CraftKind.COPPER_LANTERN,
          CraftKind.LOOMED_TAPESTRY,
        ];
        const next =
          order[(order.indexOf(this.carriedCraft) + 1) % order.length];
        this.selectRootCraft(next);
      } else {
        this.selectRootCraft(this.selectedRootCraft);
      }
      return;
    }

    // 2. At Canopy Treehouse Summit -> Dedicate Mastery (if beacon remaining & carrying craft) or Trade
    if (zone === ZoneType.CANOPY_SUMMIT) {
      if (this.carriedCraft && this.beaconsLit < 3) {
        this.triggerCanopyMastery();
      } else {
        this.triggerCanopyTrade();
      }
      return;
    }

    // 3. Along the Vertical Cable -> Collect Second-Level Gathering Token OR Engage Ratchet Brace
    const nearbyStation = this.getNearbyCollectibleStation();
    if (nearbyStation) {
      this.collectStationBundle(nearbyStation, false);
      return;
    }

    // Engage Ratchet Brake / Brace against Crosswind
    if (this.braceCooldown <= 0) {
      this.braceTimer = 0.95;
      this.braceCooldown = 1.15;
      this.liftVelocity = 0;

      const inGustBand =
        (this.gustPhase === 'SWEEP' || this.gustPhase === 'TELEGRAPH') &&
        Math.abs(this.liftY - this.gustY) <= 3.0 &&
        !this.gustResolvedThisSweep;

      if (inGustBand) {
        this.gustResolvedThisSweep = true;
        this.hitstopTimer = 0.045;
        this.flashTimer = 0.25;
        this.squashY = 0.92;
        this.poise = Math.min(100, this.poise + 15);
        this.communityTokens += 5;
        this.spawnParticles(CABLE_X, this.liftY + 1.2, CABLE_Z, 18, 0xe5a93c);
        soundEngine.playBrakeLatch(true);
        this.statusBanner =
          'Ratchet Brake latched into the breeze! +15% Poise & +5 Community Tokens.';
      } else {
        soundEngine.playBrakeLatch(false);
        this.statusBanner =
          'Brass Ratchet Brake engaged · Carriage locked steady on the Vertical Cable.';
      }
      this.emitHudSnapshot(true);
    }
  }

  private updateCarriedCargoMesh(): void {
    Object.values(CraftKind).forEach((k) => {
      this.liftRig.cargoMeshes[k].visible = this.carriedCraft === k;
    });
  }

  private updateBeaconVisuals(): void {
    this.canopyRig.beacons.forEach((b, idx) => {
      const lit = idx < this.beaconsLit;
      b.mat.color.setHex(lit ? 0xffd166 : 0x46524b);
      b.mat.emissive.setHex(lit ? 0xff9f2e : 0x000000);
      b.mat.emissiveIntensity = lit ? 1.8 : 0;
      b.light.intensity = lit ? 3.2 : 0;
    });
  }

  private getZone(): ZoneType {
    if (this.liftY <= 2.4) return ZoneType.ROOT_SANCTUARY;
    if (this.liftY >= 30.8) return ZoneType.CANOPY_SUMMIT;
    return ZoneType.TRUNK_CABLE;
  }

  private getNearbyStation(): BoughStationNode | null {
    for (let i = 0; i < this.stations.length; i++) {
      const st = this.stations[i];
      if (Math.abs(this.liftY - st.elevation) <= 1.85) {
        return st;
      }
    }
    return null;
  }

  private getNearbyCollectibleStation(): BoughStationNode | null {
    const st = this.getNearbyStation();
    if (st && !st.collected) return st;
    return null;
  }

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.stepSimulation(dt);

      if (this.renderer && !this.webglFallback) {
        this.renderer.render(this.scene, this.camera);
        if (this.isSoftwareGl) {
          this.afterDraw(tick);
        } else {
          this.frameId = requestAnimationFrame(tick);
        }
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    if (!this.renderer || this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number): void {
    this.elapsed += dt;

    // Brief tactile hitstop on heavy positive impacts (braced gusts, beacon ignitions)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      this.updateCamera(dt);
      return;
    }

    if (this.screen === GameScreen.PLAYING) {
      this.stepPlaying(dt);
    } else if (this.screen === GameScreen.TITLE && !this.webglFallback) {
      // Realistic, unhurried ambient pulley glide (~0.055 rad/s)
      const liftWave = Math.sin(this.elapsed * 0.055) * 0.5 + 0.5;
      const prevY = this.liftY;
      this.liftY = THREE.MathUtils.lerp(MIN_LIFT_Y, MAX_LIFT_Y - 1.2, liftWave);
      const deltaY = this.liftY - prevY;
      if (Math.abs(deltaY) > 0.0001) {
        const wheelRot = deltaY / 0.28;
        this.liftRig.overheadSheave.rotation.x += wheelRot;
        this.canopyRig.crownSheave.rotation.x += wheelRot;
        this.liftRig.handWheel.rotation.z -= wheelRot * 1.35;
      }
      this.liftRig.root.position.y = this.liftY;
      this.counterweight.position.y =
        32.8 - (this.liftY - MIN_LIFT_Y) * 0.92;
      const groundProximity =
        1 - THREE.MathUtils.clamp((this.liftY - MIN_LIFT_Y) / 4.5, 0, 1);
      const shadowMat = this.liftRig.groundContactShadow
        .material as THREE.MeshBasicMaterial;
      shadowMat.opacity = groundProximity * 0.55;
    }

    this.animateWorldProps(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);

    this.hudEmitAccumulator += dt;
    if (this.hudEmitAccumulator >= 0.08) {
      this.hudEmitAccumulator = 0;
      this.emitHudSnapshot(false);
    }
  }

  private stepPlaying(dt: number): void {
    // 1. Buffered Action Execution
    if (this.actionBufferTimer > 0) {
      this.actionBufferTimer -= dt;
      this.actionBufferTimer = 0;
      this.executeContextAction();
    }

    if (this.braceTimer > 0) this.braceTimer = Math.max(0, this.braceTimer - dt);
    if (this.braceCooldown > 0)
      this.braceCooldown = Math.max(0, this.braceCooldown - dt);

    // 2. Manual & Agarwood-Embedded Pulley Velocity — Realistic, Unhurried Human Pace
    const holdUp =
      this.uiHoldAscend ||
      this.continuousLiftDir === 1 ||
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('ArrowUp');
    const holdDown =
      this.uiHoldDescend ||
      this.continuousLiftDir === -1 ||
      this.heldKeys.has('KeyS') ||
      this.heldKeys.has('ArrowDown');

    if (
      this.uiHoldAscend ||
      this.uiHoldDescend ||
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('ArrowUp') ||
      this.heldKeys.has('KeyS') ||
      this.heldKeys.has('ArrowDown')
    ) {
      this.autoGlideTargetY = null;
    }

    if (
      (this.continuousLiftDir === 1 && this.liftY >= MAX_LIFT_Y - 0.04) ||
      (this.continuousLiftDir === -1 && this.liftY <= MIN_LIFT_Y + 0.04)
    ) {
      this.continuousLiftDir = 0;
    }

    const shiftFine =
      this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');
    // Four inclusive lift speeds: Super Slow (0.55 m/s), Gentle Fine (1.35 m/s), Steady (2.6 m/s), and Sonic Busy-Day (16.5 m/s)
    const topSpeed =
      this.paceMode === PaceMode.SUPER_SLOW
        ? 0.55
        : shiftFine || this.paceMode === PaceMode.FINE
          ? 1.35
          : this.paceMode === PaceMode.SONIC
            ? 16.5
            : this.counterweightUpgraded
              ? 3.1
              : 2.6;

    const glideCruiseSpeed =
      this.paceMode === PaceMode.SUPER_SLOW
        ? 0.65
        : this.paceMode === PaceMode.FINE
          ? 1.55
          : this.paceMode === PaceMode.SONIC
            ? 18.5
            : 3.2;

    let targetVel = 0;
    if (this.braceTimer > 0) {
      targetVel = 0;
    } else if (this.autoGlideTargetY !== null) {
      const diff = this.autoGlideTargetY - this.liftY;
      const snapThreshold = this.paceMode === PaceMode.SONIC ? 0.22 : 0.08;
      if (Math.abs(diff) > snapThreshold) {
        const approachSpan = this.paceMode === PaceMode.SONIC ? 4.2 : 2.2;
        const approachFactor = THREE.MathUtils.clamp(
          Math.abs(diff) / approachSpan,
          this.paceMode === PaceMode.SUPER_SLOW ? 0.45 : 0.26,
          1
        );
        targetVel = Math.sign(diff) * glideCruiseSpeed * approachFactor;
      } else {
        this.liftY = this.autoGlideTargetY;
        const arrivedElevation = Math.round(this.liftY - MIN_LIFT_Y);
        this.autoGlideTargetY = null;
        if (this.liftY <= MIN_LIFT_Y + 0.15) {
          this.poise = 100;
          soundEngine.playSanctuaryRest();
          this.statusBanner =
            'Docked at 0m Root Sanctuary · Different, not less — be prepared to put your goals to fruition by catapulting special interests into a job, trade, or community outreach.';
        } else if (this.liftY >= MAX_LIFT_Y - 0.5) {
          soundEngine.playCanopyDelivery(false);
          this.statusBanner =
            'Docked at 33m Treetop Canopy · Welcome to the Learn-a-Trade Workshop Rota.';
        } else {
          soundEngine.playTokenCollect();
          this.statusBanner = `Docked steady at ${arrivedElevation}m Agarwood Bough.`;
        }
      }
    } else {
      if (holdUp && !holdDown) targetVel = topSpeed;
      else if (holdDown && !holdUp) targetVel = -topSpeed;
    }

    const velDamp =
      this.paceMode === PaceMode.SONIC
        ? 16.0
        : this.paceMode === PaceMode.SUPER_SLOW
          ? 5.0
          : 7.5;
    this.liftVelocity = THREE.MathUtils.damp(
      this.liftVelocity,
      targetVel,
      velDamp,
      dt
    );
    if (Math.abs(this.liftVelocity) < 0.01 && targetVel === 0) {
      this.liftVelocity = 0;
    }

    const prevY = this.liftY;
    this.liftY = THREE.MathUtils.clamp(
      this.liftY + this.liftVelocity * dt,
      MIN_LIFT_Y,
      MAX_LIFT_Y
    );
    const deltaY = this.liftY - prevY;

    // Pulley wheel & hand-crank mechanical linkage
    if (Math.abs(deltaY) > 0.0001) {
      const wheelRot = deltaY / 0.28;
      this.liftRig.overheadSheave.rotation.x += wheelRot;
      this.canopyRig.crownSheave.rotation.x += wheelRot;
      this.liftRig.handWheel.rotation.z -= wheelRot * 1.35;

      const clickStep =
        this.paceMode === PaceMode.SONIC
          ? 2.2
          : this.paceMode === PaceMode.SUPER_SLOW
            ? 0.85
            : 0.58;
      this.clickDistanceAccum += Math.abs(deltaY);
      if (this.clickDistanceAccum >= clickStep) {
        this.clickDistanceAccum = 0;
        soundEngine.playPulleyClick(
          (this.liftY - MIN_LIFT_Y) / (MAX_LIFT_Y - MIN_LIFT_Y),
          deltaY > 0
        );
      }

      if (
        this.paceMode === PaceMode.SONIC &&
        Math.abs(this.liftVelocity) > 6.5
      ) {
        this.sonicTrailTimer += dt;
        if (this.sonicTrailTimer >= 0.085) {
          this.sonicTrailTimer = 0;
          this.spawnParticles(CABLE_X, this.liftY + 0.6, CABLE_Z, 4, 0x7ce0a3);
        }
      }
    }

    // Update Lift & Counterweight positions
    this.liftRig.root.position.y = this.liftY;
    this.counterweight.position.y =
      32.8 - (this.liftY - MIN_LIFT_Y) * 0.92;

    // Ground Contact Shadow fades smoothly with altitude
    const groundProximity =
      1 - THREE.MathUtils.clamp((this.liftY - MIN_LIFT_Y) / 4.5, 0, 1);
    const shadowMat = this.liftRig.groundContactShadow
      .material as THREE.MeshBasicMaterial;
    shadowMat.opacity = groundProximity * 0.55;
    const shadowScale = 1 + (1 - groundProximity) * 0.45;
    this.liftRig.groundContactShadow.scale.set(shadowScale, 1, shadowScale);

    // 3. Root Base Sanctuary Restoration & Canopy Daily Streak Detection
    const zone = this.getZone();
    if (zone === ZoneType.ROOT_SANCTUARY) {
      if (this.poise < 100) {
        this.poise = Math.min(100, this.poise + dt * 28);
      }
      this.wasAtCanopySummit = false;
    } else if (zone === ZoneType.CANOPY_SUMMIT) {
      if (this.poise < 100) {
        this.poise = Math.min(100, this.poise + dt * 14);
      }
      if (!this.wasAtCanopySummit) {
        this.wasAtCanopySummit = true;
        this.onCanopySummitReached?.();
      }
    } else {
      this.wasAtCanopySummit = false;
    }

    // 4. Bough Station Token Respawn + Bottleneck-Free Auto-Gather on Pass
    this.stations.forEach((st) => {
      if (st.collected) {
        st.respawnTimer -= dt;
        if (st.respawnTimer <= 0) {
          st.collected = false;
          st.tokenMesh.visible = true;
        }
      } else if (
        this.autoGatherEnabled &&
        Math.abs(this.liftY - st.elevation) <=
          (this.paceMode === PaceMode.SONIC ? 2.65 : 1.45)
      ) {
        this.collectStationBundle(st, true);
      }
    });

    // 5. Gentle Telegraphed Crosswind Gust Encounters along the Trunk
    this.stepWindEncounter(dt, zone);
  }

  private stepWindEncounter(dt: number, zone: ZoneType): void {
    // Super Slow sensory calm & Sonic Busy-Day modes keep the carriage 100% shielded from crosswind sway
    if (
      this.paceMode === PaceMode.SUPER_SLOW ||
      this.paceMode === PaceMode.SONIC
    ) {
      if (this.gustPhase !== 'IDLE') {
        this.gustPhase = 'IDLE';
        this.gustGroup.visible = false;
      }
      return;
    }

    // Calm sanctuary rule: breezes only form while exploring the open trunk
    if (this.gustPhase === 'IDLE') {
      if (zone === ZoneType.TRUNK_CABLE) {
        this.gustTimer -= dt;
        if (this.gustTimer <= 0) {
          this.gustPhase = 'TELEGRAPH';
          this.gustTimer = 1.85;
          this.gustResolvedThisSweep = false;
          this.gustDir = Math.random() > 0.5 ? 1 : -1;
          this.gustY = THREE.MathUtils.clamp(
            this.liftY + (Math.random() - 0.35) * 4.5,
            7.5,
            27.5
          );
          this.gustGroup.position.set(-this.gustDir * 6.5, this.gustY, 0);
          this.gustGroup.visible = true;
          this.gustMat.opacity = 0.35;
          soundEngine.playGustTelegraph();
        }
      }
      return;
    }

    if (this.gustPhase === 'TELEGRAPH') {
      this.gustTimer -= dt;
      const progress = 1 - Math.max(0, this.gustTimer) / 1.85;
      this.gustMat.opacity = 0.25 + Math.sin(progress * Math.PI * 3) * 0.2 + 0.25;
      this.gustGroup.position.x = THREE.MathUtils.lerp(
        -this.gustDir * 6.8,
        -this.gustDir * 3.4,
        progress
      );

      if (this.gustTimer <= 0) {
        this.gustPhase = 'SWEEP';
        this.gustTimer = 1.35;
      }
      return;
    }

    if (this.gustPhase === 'SWEEP') {
      this.gustTimer -= dt;
      const progress = 1 - Math.max(0, this.gustTimer) / 1.35;
      this.gustGroup.position.x = THREE.MathUtils.lerp(
        -this.gustDir * 3.4,
        this.gustDir * 8.2,
        progress
      );
      this.gustMat.opacity = Math.sin(progress * Math.PI) * 0.72;

      // Check overlap when wind crosses the central Vertical Cable
      if (
        !this.gustResolvedThisSweep &&
        progress > 0.25 &&
        progress < 0.72 &&
        Math.abs(this.liftY - this.gustY) <= 2.35
      ) {
        this.gustResolvedThisSweep = true;
        if (this.braceTimer > 0) {
          this.hitstopTimer = 0.045;
          this.flashTimer = 0.25;
          this.squashY = 0.92;
          this.poise = Math.min(100, this.poise + 15);
          this.communityTokens += 5;
          this.spawnParticles(CABLE_X, this.liftY + 1.2, CABLE_Z, 18, 0xe5a93c);
          soundEngine.playBrakeLatch(true);
          this.statusBanner =
            'Braced cleanly through the crosswind · +15% Poise & +5 Community Tokens!';
        } else {
          const loss = this.windShieldUpgraded ? 6 : 14;
          this.poise = Math.max(15, this.poise - loss);
          this.swayVelocity += this.gustDir * (this.windShieldUpgraded ? 0.55 : 1.15);
          this.shakeIntensity = this.windShieldUpgraded ? 0.07 : 0.16;
          soundEngine.playGustSway();
          this.statusBanner =
            this.poise <= 35
              ? 'Crosswind swayed the carriage · Descend to the Root Sanctuary anytime to rest and restore Poise.'
              : 'Crosswind brushed the carriage · Tip: wait out gusts or tap Space to latch the Ratchet Brake.';
        }
      }

      if (this.gustTimer <= 0) {
        this.gustPhase = 'IDLE';
        // Smooth gentle ramp based on beacons lit (never overwhelming)
        this.gustTimer = Math.max(5.5, 9.0 - this.beaconsLit * 1.1);
        this.gustGroup.visible = false;
      }
    }
  }

  private animateWorldProps(dt: number): void {
    // Rotate collectible Bough Craft Tokens
    this.stations.forEach((st, idx) => {
      if (!st.collected) {
        st.tokenMesh.rotation.y = this.elapsed * 1.4 + idx;
        st.tokenMesh.position.y =
          st.elevation + 0.55 + Math.sin(this.elapsed * 2.2 + idx) * 0.09;
      }
    });

    // Rotate lit Canopy Summit Beacons (▲ ▲ ▲) gently
    this.canopyRig.beacons.forEach((b, idx) => {
      if (idx < this.beaconsLit) {
        b.prism.rotation.y = Math.PI / 4 + this.elapsed * 0.8 + idx * 0.5;
      }
    });

    // Smoothly damp real-time remote collaborator relay carriages
    for (let i = 0; i < this.collabRelaySlots.length; i++) {
      const slot = this.collabRelaySlots[i];
      if (!slot.active) continue;
      const prevSlotY = slot.currentY;
      slot.currentY = THREE.MathUtils.damp(
        slot.currentY,
        slot.targetY,
        7.5,
        dt
      );
      slot.group.position.y = slot.currentY;
      const slotDelta = slot.currentY - prevSlotY;
      if (Math.abs(slotDelta) > 0.0002) {
        slot.sheave.rotation.x += slotDelta / 0.16;
      }
    }

    // Smoothly articulate Embedded Agarwood Trunk Control Console & 3D Plunger Buttons
    if (this.agarwoodControlRig && this.textures) {
      const targetConsoleY = THREE.MathUtils.clamp(
        this.liftY + 1.32,
        MIN_LIFT_Y + 1.32,
        MAX_LIFT_Y - 0.15
      );
      this.agarwoodControlRig.consoleCarriage.position.y = THREE.MathUtils.damp(
        this.agarwoodControlRig.consoleCarriage.position.y,
        targetConsoleY,
        12.0,
        dt
      );

      const motionState = this.getLiftMotionState();
      const elevMeters = Math.max(0, this.liftY - MIN_LIFT_Y);
      const plaque = getAgarwoodMotivationForElevation(elevMeters);
      const roundedElev = (Math.round(elevMeters * 2) / 2).toFixed(1);
      const motionLabel =
        motionState === 'ascending'
          ? 'CLIMBING STEADY'
          : motionState === 'descending'
            ? 'LOWERING GENTLY'
            : motionState === 'gliding'
              ? 'WAYSTATION GLIDE'
              : 'RESTING STEADY';

      const signKey = `${roundedElev}|${plaque.id}|${motionLabel}`;
      if (signKey !== this.lastConsoleSignKey) {
        this.lastConsoleSignKey = signKey;
        this.textures.updateAgarwoodConsoleSign(
          Number(roundedElev),
          plaque.carvedTitle,
          plaque.motivationalMessage,
          motionLabel
        );
      }

      const allActions: TreeLiftControlAction[] = [
        'ascend',
        'stop',
        'descend',
        'glide_0',
        'glide_18',
        'glide_33',
      ];
      for (const act of allActions) {
        const btn = this.agarwoodControlRig.buttons[act];
        if (!btn) continue;
        const isHeldOrActive =
          this.activeTreeButtonPress === act ||
          (act === 'ascend' && motionState === 'ascending') ||
          (act === 'descend' && motionState === 'descending') ||
          (act === 'stop' && this.braceTimer > 0) ||
          (act === 'glide_0' &&
            this.autoGlideTargetY !== null &&
            Math.abs(this.autoGlideTargetY - MIN_LIFT_Y) < 0.3) ||
          (act === 'glide_18' &&
            this.autoGlideTargetY !== null &&
            Math.abs(this.autoGlideTargetY - (MIN_LIFT_Y + 18)) < 0.3) ||
          (act === 'glide_33' &&
            this.autoGlideTargetY !== null &&
            Math.abs(this.autoGlideTargetY - MAX_LIFT_Y) < 0.5);
        const isHovered = this.hoveredTreeControl === act;

        const targetPress = isHeldOrActive ? 0.045 : isHovered ? 0.016 : 0;
        btn.currentPress = THREE.MathUtils.damp(
          btn.currentPress,
          targetPress,
          16.0,
          dt
        );
        btn.plungerGroup.position.z = btn.baseZ - btn.currentPress;

        const targetEmissive = isHeldOrActive ? 0.85 : isHovered ? 0.45 : 0.12;
        btn.bezelMat.emissiveIntensity = THREE.MathUtils.damp(
          btn.bezelMat.emissiveIntensity,
          targetEmissive,
          14.0,
          dt
        );
      }
    }

    // Subtle warm beacon glow on the 3D Entry Kiosk, Welcome Shoe Bench & 33m Canopy PayPal Store
    if (this.entryKioskBeaconMat) {
      const idleGlow = 0.88 + Math.sin(this.elapsed * 2.1) * 0.18;
      const targetKioskGlow =
        this.hoveredEntryKiosk || this.welcomeDrawerOpen ? 1.85 : idleGlow;
      this.entryKioskBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
        this.entryKioskBeaconMat.emissiveIntensity,
        targetKioskGlow,
        12.0,
        dt
      );
    }
    if (this.welcomeShoeBeaconMat) {
      const idleShoeGlow = 0.92 + Math.sin(this.elapsed * 2.3 + 1.1) * 0.2;
      const targetShoeGlow = this.hoveredWelcomeShoes ? 2.0 : idleShoeGlow;
      this.welcomeShoeBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
        this.welcomeShoeBeaconMat.emissiveIntensity,
        targetShoeGlow,
        12.0,
        dt
      );
    }
    if (this.jobBoardBeaconMat) {
      const idleJobGlow = 0.98 + Math.sin(this.elapsed * 2.4 + 0.6) * 0.22;
      const targetJobGlow = this.hoveredJobBoard ? 2.15 : idleJobGlow;
      this.jobBoardBeaconMat.emissiveIntensity = THREE.MathUtils.damp(
        this.jobBoardBeaconMat.emissiveIntensity,
        targetJobGlow,
        12.0,
        dt
      );
    }
    if (this.canopyRig?.canopyStoreBeaconMat) {
      const idleStoreGlow = 1.0 + Math.sin(this.elapsed * 2.2 + 0.5) * 0.22;
      const targetStoreGlow = this.hoveredCanopyStore ? 2.1 : idleStoreGlow;
      this.canopyRig.canopyStoreBeaconMat.emissiveIntensity =
        THREE.MathUtils.damp(
          this.canopyRig.canopyStoreBeaconMat.emissiveIntensity,
          targetStoreGlow,
          12.0,
          dt
        );
    }

    // Animate Mezzanine Private Chill Pods (sliding privacy doors, 4-blade cooling fan & warm water flotation gentle wave)
    if (this.canopyRig?.chillPods) {
      const podKeys: ChillPodId[] = ['pod_1', 'pod_2', 'pod_3', 'pod_4'];
      for (const pid of podKeys) {
        const pod = this.canopyRig.chillPods[pid];
        if (!pod) continue;
        pod.privacyDoorGroup.position.x = THREE.MathUtils.damp(
          pod.privacyDoorGroup.position.x,
          pod.doorTargetX,
          8.5,
          dt
        );
        if (pod.fanActive) {
          pod.fanBladesGroup.rotation.y += dt * 5.8;
        }
        if (pod.flotationActive && pod.waterMesh.visible) {
          pod.waterMesh.position.y =
            0.31 + Math.sin(this.elapsed * 2.1 + pid.charCodeAt(4)) * 0.018;
          pod.waterMesh.rotation.z =
            Math.sin(this.elapsed * 1.4 + pid.charCodeAt(4)) * 0.015;
        }
      }
    }

    // Gentle cosy breathing settle on the soft Welly plushies in the Clothes-Washing Laundry Tub
    if (this.canopyRig?.wellyPlushieNodes) {
      for (let i = 0; i < this.canopyRig.wellyPlushieNodes.length; i++) {
        const plushie = this.canopyRig.wellyPlushieNodes[i];
        const baseY = (plushie.userData.baseY as number | undefined) ?? 0.23;
        plushie.position.y =
          baseY + Math.sin(this.elapsed * 1.7 + i * 1.15) * 0.007;
      }
    }

    // Expressive Rhythmic Stepping Gait on the Playable 3D Shoe Character in the Lift Carriage
    if (this.liftRig?.shoeCharacter) {
      const motion = this.getLiftMotionState();
      const moving = motion !== 'idle';
      if (moving) {
        const strideCadence =
          this.paceMode === PaceMode.SUPER_SLOW
            ? 3.1
            : this.paceMode === PaceMode.FINE
              ? 5.2
              : this.paceMode === PaceMode.SONIC
                ? 15.5
                : 7.2;
        this.shoeStridePhase += dt * strideCadence;
      }
      const leftLift = moving
        ? Math.max(0, Math.sin(this.shoeStridePhase)) * 0.085
        : 0;
      const rightLift = moving
        ? Math.max(0, Math.sin(this.shoeStridePhase + Math.PI)) * 0.085
        : 0;
      const leftPitch = moving
        ? Math.cos(this.shoeStridePhase) * 0.16
        : 0;
      const rightPitch = moving
        ? Math.cos(this.shoeStridePhase + Math.PI) * 0.16
        : 0;

      const lGrp = this.liftRig.shoeCharacter.leftShoe.group;
      const rGrp = this.liftRig.shoeCharacter.rightShoe.group;
      lGrp.position.y = THREE.MathUtils.damp(lGrp.position.y, leftLift, 14, dt);
      rGrp.position.y = THREE.MathUtils.damp(rGrp.position.y, rightLift, 14, dt);
      lGrp.rotation.x = THREE.MathUtils.damp(lGrp.rotation.x, leftPitch, 14, dt);
      rGrp.rotation.x = THREE.MathUtils.damp(rGrp.rotation.x, rightPitch, 14, dt);
    }

    // Brake lever articulation
    const targetLeverRot = this.braceTimer > 0 ? 0.48 : -0.15;
    this.liftRig.brakeLever.rotation.z = THREE.MathUtils.damp(
      this.liftRig.brakeLever.rotation.z,
      targetLeverRot,
      14,
      dt
    );

    // Hit flash on Lift brass frame
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.liftRig.brassFrameMat.emissive.setHex(0xffb84d);
      this.liftRig.brassFrameMat.emissiveIntensity = (this.flashTimer / 0.3) * 1.2;
    } else {
      this.liftRig.brassFrameMat.emissiveIntensity = 0;
    }

    // Spring squash-and-stretch & carriage pendulum sway
    this.squashY = THREE.MathUtils.damp(this.squashY, 1.0, 10.0, dt);
    const invXz = 1 / Math.sqrt(Math.max(0.5, this.squashY));
    this.liftRig.carriageInner.scale.set(invXz, this.squashY, invXz);

    // Damped harmonic pendulum sway on carriage
    const springK = 18.0;
    const damping = 5.5;
    const accel = -springK * this.swayAngle - damping * this.swayVelocity;
    this.swayVelocity += accel * dt;
    this.swayAngle += this.swayVelocity * dt;
    this.liftRig.carriageInner.rotation.z = this.swayAngle;

    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 0.55);
    }

    // Smoothly articulate Canopy Secure Floor Hatch Leaves & Safety Gate Bar
    if (this.canopyRig) {
      const liftEnteringBay = this.liftY >= 29.6;
      const liftDockedAtTop = this.liftY >= 32.15;

      // When safetyGateClosed is true and Lift is below the bay, leaves seal flush at ±0.72.
      // When Lift enters the bay, leaves retract under the side wings (±2.12) for smooth passage.
      const targetLeafOffset =
        this.studioConfig.safetyGateClosed && !liftEnteringBay ? 0.72 : 2.12;
      this.canopyRig.hatchLeafLeft.position.x = THREE.MathUtils.damp(
        this.canopyRig.hatchLeafLeft.position.x,
        -targetLeafOffset,
        9.0,
        dt
      );
      this.canopyRig.hatchLeafRight.position.x = THREE.MathUtils.damp(
        this.canopyRig.hatchLeafRight.position.x,
        targetLeafOffset,
        9.0,
        dt
      );

      // Waist-high Safety Gate Bar stays latched across the bay (0 rad) whenever safetyGateClosed is true
      // and the Lift is not yet docked; swings smoothly open (1.28 rad) once docked or unlatched.
      const targetGateRot =
        this.studioConfig.safetyGateClosed && !liftDockedAtTop ? 0 : 1.28;
      this.canopyRig.safetyGateBar.rotation.z = THREE.MathUtils.damp(
        this.canopyRig.safetyGateBar.rotation.z,
        targetGateRot,
        10.0,
        dt
      );

      // Smooth Roof Cutaway Lift & Fade when inspecting inside the Canopy
      const cutawayActive =
        this.cameraPreset === CameraPreset.CANOPY_SUMMIT &&
        (this.roofCutaway || this.canopyZoom >= 1.25);
      const targetRoofY = cutawayActive ? 7.65 : 6.25;
      const targetRoofOpacity = cutawayActive ? 0.14 : 1.0;

      this.canopyRig.roofMesh.position.y = THREE.MathUtils.damp(
        this.canopyRig.roofMesh.position.y,
        targetRoofY,
        8.5,
        dt
      );
      this.roofOpacityCurrent = THREE.MathUtils.damp(
        this.roofOpacityCurrent,
        targetRoofOpacity,
        8.5,
        dt
      );
      const needsTransparency = this.roofOpacityCurrent < 0.98;
      if (this.canopyRig.shingleMat.transparent !== needsTransparency) {
        this.canopyRig.shingleMat.transparent = needsTransparency;
        this.canopyRig.shingleMat.depthWrite = !needsTransparency;
        this.canopyRig.shingleMat.needsUpdate = true;
      }
      this.canopyRig.shingleMat.opacity = this.roofOpacityCurrent;
    }
  }

  private updateParticles(dt: number): void {
    if (this.webglFallback) return;
    let dirty = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _particleDummy.position.set(0, -50, 0);
        _particleDummy.scale.setScalar(0.001);
        _particleDummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
        continue;
      }

      p.vy -= 4.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = 1 - p.life / p.maxLife;
      _particleDummy.position.set(p.x, p.y, p.z);
      _particleDummy.rotation.set(p.life * 4, p.life * 3, 0);
      _particleDummy.scale.setScalar(Math.max(0.01, p.scale * t));
      _particleDummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _particleDummy.matrix);
    }

    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    if (this.screen === GameScreen.TITLE) {
      // Serene centered live-world glide from Root Base Sanctuary up toward the 33m Canopy & back
      const panWave = Math.sin(this.elapsed * 0.22) * 0.5 + 0.5;
      const focusY = THREE.MathUtils.lerp(4.2, 27.5, panWave);
      const camAngle = Math.sin(this.elapsed * 0.14) * 0.34;
      const dist = 21.0;

      _camTargetPos.set(0, focusY, 0.4);
      _camDesiredPos.set(
        Math.sin(camAngle) * dist,
        focusY + 2.8,
        Math.cos(camAngle) * dist
      );
    } else if (this.cameraPreset === CameraPreset.DIAGRAM_WIDE) {
      _camTargetPos.set(0, 17.8, 1.0);
      _camDesiredPos.set(
        Math.sin(this.orbitYawOffset) * 44,
        18.5 + this.orbitPitchOffset * 14,
        Math.cos(this.orbitYawOffset) * 44
      );
    } else if (this.cameraPreset === CameraPreset.CANOPY_SUMMIT) {
      const isMobileViewport = this.container.clientWidth < 640;
      const aspect = this.camera.aspect || 1;
      const portraitPullback =
        aspect < 0.85
          ? THREE.MathUtils.clamp(0.88 / Math.max(0.46, aspect), 1.0, 1.55)
          : 1.0;
      const drawerShift =
        this.studioDrawerOpen && !isMobileViewport ? 2.15 : 0;
      const mobileSheetPitchDown =
        this.studioDrawerOpen && isMobileViewport ? 1.15 : 0;
      const zoomScale =
        (1 / Math.max(0.65, this.canopyZoom)) * portraitPullback;

      if (this.canopyInspectAngle === 'tools_rack') {
        _camTargetPos.set(
          -2.45 + drawerShift * 0.45,
          34.35 - mobileSheetPitchDown * 0.5,
          -1.45
        );
        const r = 6.2 * zoomScale;
        const baseYaw = 0.45 + this.orbitYawOffset;
        _camDesiredPos.set(
          -2.45 + Math.sin(baseYaw) * r + drawerShift * 0.45,
          35.15 + this.orbitPitchOffset * 3.8,
          -1.45 + Math.cos(baseYaw) * r
        );
      } else if (this.canopyInspectAngle === 'lanterns_floor') {
        _camTargetPos.set(
          -0.2 + drawerShift * 0.5,
          34.1 - mobileSheetPitchDown * 0.5,
          -0.35
        );
        const r = 7.8 * zoomScale;
        const baseYaw = -0.24 + this.orbitYawOffset;
        _camDesiredPos.set(
          Math.sin(baseYaw) * r + drawerShift * 0.5,
          35.65 + this.orbitPitchOffset * 4.2,
          Math.cos(baseYaw) * r + 0.85
        );
      } else if (this.canopyInspectAngle === 'mezzanine_library') {
        _camTargetPos.set(-3.45, 36.15 - mobileSheetPitchDown * 0.65, -0.25);
        const r = 6.2 * zoomScale;
        const baseYaw = 0.72 + this.orbitYawOffset;
        _camDesiredPos.set(
          -3.45 + Math.sin(baseYaw) * r,
          37.15 + this.orbitPitchOffset * 3.6,
          -0.25 + Math.cos(baseYaw) * r
        );
      } else if (this.canopyInspectAngle === 'mezzanine_refreshments') {
        _camTargetPos.set(3.45, 36.15 - mobileSheetPitchDown * 0.65, -0.25);
        const r = 6.2 * zoomScale;
        const baseYaw = -0.72 + this.orbitYawOffset;
        _camDesiredPos.set(
          3.45 + Math.sin(baseYaw) * r,
          37.15 + this.orbitPitchOffset * 3.6,
          -0.25 + Math.cos(baseYaw) * r
        );
      } else if (this.canopyInspectAngle === 'chill_pod') {
        const podNode = this.canopyRig?.chillPods[this.focusedPodId];
        const px = podNode ? podNode.worldFocusPos.x : -3.05;
        const py = podNode ? podNode.worldFocusPos.y : 36.3;
        const pz = podNode ? podNode.worldFocusPos.z : -3.55;
        // On mobile phones, aim slightly below the pod so the live 3D Chill Pod renders clearly in the upper visible viewport above the bottom sheet
        _camTargetPos.set(px, py - mobileSheetPitchDown * 0.92, pz);
        const r = 4.65 * zoomScale;
        const baseYaw = this.orbitYawOffset * 0.55;
        _camDesiredPos.set(
          px + Math.sin(baseYaw) * r,
          py + 0.95 - mobileSheetPitchDown * 0.35 + this.orbitPitchOffset * 2.5,
          pz + Math.cos(baseYaw) * r + 0.85
        );
      } else if (this.canopyInspectAngle === 'mezzanine_relaxation') {
        // Welcoming close-up of the Safe Cushioned Floor, Tactile Guide Strips, Pod Grab Bars & Welly Plushie Laundry Tub
        _camTargetPos.set(0, 35.85 - mobileSheetPitchDown * 0.72, -2.35);
        const r = 5.45 * zoomScale;
        const baseYaw = this.orbitYawOffset * 0.65;
        _camDesiredPos.set(
          Math.sin(baseYaw) * r,
          37.35 - mobileSheetPitchDown * 0.25 + this.orbitPitchOffset * 2.8,
          -2.35 + Math.cos(baseYaw) * r + 0.65
        );
      } else if (this.canopyInspectAngle === 'mezzanine_overview') {
        _camTargetPos.set(0, 36.15 - mobileSheetPitchDown * 0.75, -1.65);
        const r = 10.6 * zoomScale;
        _camDesiredPos.set(
          Math.sin(this.orbitYawOffset) * r,
          38.6 + this.orbitPitchOffset * 4.5,
          Math.cos(this.orbitYawOffset) * r + 1.85
        );
      } else if (this.canopyInspectAngle === 'interior') {
        _camTargetPos.set(
          drawerShift * 0.55,
          33.75 - mobileSheetPitchDown * 0.5,
          -0.75
        );
        const r = 8.4 * zoomScale;
        const baseYaw = 0.08 + this.orbitYawOffset;
        _camDesiredPos.set(
          Math.sin(baseYaw) * r + drawerShift * 0.55,
          36.15 + this.orbitPitchOffset * 4.5,
          Math.cos(baseYaw) * r + 1.25
        );
      } else {
        // 'overview'
        _camTargetPos.set(drawerShift, 34.45 - mobileSheetPitchDown * 0.6, -0.45);
        const r = 13.4 * zoomScale;
        _camDesiredPos.set(
          Math.sin(this.orbitYawOffset) * r + drawerShift * 0.55,
          38.2 + this.orbitPitchOffset * 5.5,
          Math.cos(this.orbitYawOffset) * r + 2.6
        );
      }
    } else if (this.cameraPreset === CameraPreset.ROOT_SANCTUARY) {
      const isMobileViewport = this.container.clientWidth < 640;
      const aspect = this.camera.aspect || 1;
      const portraitPullback =
        aspect < 0.85
          ? THREE.MathUtils.clamp(0.86 / Math.max(0.46, aspect), 1.0, 1.48)
          : 1.0;
      const xFramingOffset =
        this.welcomeDrawerOpen && !isMobileViewport ? 2.55 : 0.25;
      _camTargetPos.set(xFramingOffset, 1.95, 0.8);
      const r = 13.6 * portraitPullback;
      _camDesiredPos.set(
        Math.sin(this.orbitYawOffset) * r +
          (this.welcomeDrawerOpen && !isMobileViewport ? 1.35 : 0),
        3.8 + this.orbitPitchOffset * 5,
        Math.cos(this.orbitYawOffset) * r + 2.4
      );
    } else {
      // Default: LIFT_FOLLOW — balanced framing showing Agarwood Trunk Console (-1.68), Pulley Carriage (0), and Motivational Plaques (+1.68)
      const aspect = this.camera.aspect || 1;
      const portraitPullback =
        aspect < 0.85
          ? THREE.MathUtils.clamp(0.88 / Math.max(0.46, aspect), 1.0, 1.38)
          : 1.0;
      const followY = this.liftY + 1.32;
      _camTargetPos.set(-0.22, followY, CABLE_Z * 0.62);
      const dist = 12.6 * portraitPullback;
      const yaw = this.orbitYawOffset + 0.06;
      _camDesiredPos.set(
        Math.sin(yaw) * dist - 0.18,
        followY + 1.25 + this.orbitPitchOffset * 5.0,
        CABLE_Z + Math.cos(yaw) * dist
      );
    }

    const camDampRate =
      this.cameraPreset === CameraPreset.LIFT_FOLLOW &&
      this.paceMode === PaceMode.SONIC
        ? 13.5
        : 4.6;
    const alpha = 1 - Math.exp(-camDampRate * dt);
    this.camera.position.lerp(_camDesiredPos, alpha);
    _lookCurrent.lerp(_camTargetPos, alpha);

    if (this.shakeIntensity > 0.001) {
      this.camera.position.x +=
        Math.sin(this.elapsed * 47) * this.shakeIntensity;
      this.camera.position.y +=
        Math.cos(this.elapsed * 53) * this.shakeIntensity * 0.6;
    }

    this.camera.lookAt(_lookCurrent);
  }

  private getLiftMotionState(): 'idle' | 'ascending' | 'descending' | 'gliding' {
    if (this.autoGlideTargetY !== null) return 'gliding';
    if (
      this.uiHoldAscend ||
      this.continuousLiftDir === 1 ||
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('ArrowUp') ||
      this.liftVelocity > 0.05
    ) {
      return 'ascending';
    }
    if (
      this.uiHoldDescend ||
      this.continuousLiftDir === -1 ||
      this.heldKeys.has('KeyS') ||
      this.heldKeys.has('ArrowDown') ||
      this.liftVelocity < -0.05
    ) {
      return 'descending';
    }
    return 'idle';
  }

  private emitHudSnapshot(force: boolean): void {
    const nearbySt = this.getNearbyStation();
    const elevationMeters = Math.round((this.liftY - MIN_LIFT_Y) * 10) / 10;
    const autoGlideTargetMeters =
      this.autoGlideTargetY !== null
        ? Math.round(this.autoGlideTargetY - MIN_LIFT_Y)
        : null;
    const activePlaque = getAgarwoodMotivationForElevation(elevationMeters);
    const liftMotionState = this.getLiftMotionState();

    const snapshot: HudSnapshot = {
      screen: this.screen,
      elevationMeters,
      maxElevationMeters: Math.round((MAX_LIFT_Y - MIN_LIFT_Y) * 10) / 10,
      zone: this.getZone(),
      poisePercent: Math.round(this.poise),
      isBraced: this.braceTimer > 0,
      carriedCraft: this.carriedCraft,
      selectedRootCraft: this.selectedRootCraft,
      boughTokensCarried: this.boughTokensCarried,
      tryingTokens: this.treeProgress.tryingTokens,
      gatheringTokens: this.treeProgress.gatheringTokens,
      treehouseTokens: this.treeProgress.treehouseTokens,
      sharesCompleted: this.treeProgress.sharesCompleted,
      welcomeCheckedIn: this.treeProgress.welcomeCheckedIn,
      dailyStreak: this.treeProgress.dailyStreak ?? 0,
      bestStreak: this.treeProgress.bestStreak ?? 0,
      autoGatherEnabled: this.autoGatherEnabled,
      autoGlideTargetMeters,
      onlineCollaborators: this.onlineCollaborators,
      communityTokens: this.communityTokens,
      beaconsLit: this.beaconsLit,
      tradesCompleted: this.tradesCompleted,
      stowedToolsCount: this.stowedToolsCount,
      placedFurnishingsCount: this.studioConfig.furnishedItems.length,
      cameraPreset: this.cameraPreset,
      canopyInspectAngle: this.canopyInspectAngle,
      canopyZoom: this.canopyZoom,
      roofCutaway: this.roofCutaway,
      paceMode: this.paceMode,
      gustWarningActive:
        this.gustPhase === 'TELEGRAPH' || this.gustPhase === 'SWEEP',
      gustBandMeters:
        this.gustPhase === 'IDLE'
          ? null
          : Math.round(this.gustY - MIN_LIFT_Y),
      nearbyStationLabel: nearbySt ? nearbySt.label : null,
      nearbyTokenAvailable: Boolean(nearbySt && !nearbySt.collected),
      statusBanner: this.statusBanner,
      counterweightUpgraded: this.counterweightUpgraded,
      windShieldUpgraded: this.windShieldUpgraded,
      safetyHatchLatched: this.studioConfig.safetyGateClosed,
      studioName: this.studioConfig.studioName,
      webglFallback: this.webglFallback,
      liftMotionState,
      hoveredTreeControl: this.hoveredTreeControl,
      hoveredEntryKiosk: this.hoveredEntryKiosk,
      hoveredWelcomeShoes: this.hoveredWelcomeShoes,
      hoveredJobBoard: this.hoveredJobBoard,
      hoveredCanopyStore: this.hoveredCanopyStore,
      hoveredCanopyStudio: this.hoveredCanopyStudio,
      hoveredMezzanine: this.hoveredMezzanine,
      hoveredChillPodId: this.hoveredChillPodId,
      activeChillPodId: this.activeChillPodId,
      hoveredSignId: this.hoveredEntryKiosk
        ? 'entry_kiosk'
        : this.hoveredWelcomeShoes
          ? 'welcome_shoe_bench'
          : this.hoveredJobBoard
            ? 'job_board'
            : this.hoveredCanopyStore
              ? 'canopy_paypal_store'
              : this.hoveredCanopyStudio
                ? 'canopy_studio'
                : this.hoveredChillPodId
                  ? 'mezzanine_chill_pods'
                  : this.hoveredMezzanine
                    ? 'mezzanine_library'
                    : this.hoveredTreeControl
                      ? 'trunk_console'
                      : null,
      activeShoeLabel: this.activeShoeLabel,
      motivationalTitle: activePlaque.carvedTitle,
      motivationalMessage: activePlaque.motivationalMessage,
    };

    const sig = `${snapshot.screen}|${snapshot.elevationMeters}|${snapshot.zone}|${snapshot.poisePercent}|${snapshot.isBraced}|${snapshot.tryingTokens}|${snapshot.gatheringTokens}|${snapshot.treehouseTokens}|${snapshot.autoGlideTargetMeters}|${snapshot.paceMode}|${snapshot.liftMotionState}|${snapshot.hoveredTreeControl}|${snapshot.hoveredEntryKiosk}|${snapshot.hoveredWelcomeShoes}|${snapshot.hoveredJobBoard}|${snapshot.hoveredCanopyStore}|${snapshot.hoveredCanopyStudio}|${snapshot.hoveredMezzanine}|${snapshot.hoveredChillPodId}|${snapshot.activeChillPodId}|${snapshot.activeShoeLabel}|${snapshot.placedFurnishingsCount}|${snapshot.studioName}|${snapshot.motivationalTitle}|${snapshot.statusBanner}`;

    if (force || sig !== this.lastHudSignature) {
      this.lastHudSignature = sig;
      this.onHudUpdate(snapshot);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.handlePointerDown);
      canvas.removeEventListener('pointermove', this.handlePointerMove);
      canvas.removeEventListener('pointerleave', this.handlePointerLeave);
      canvas.removeEventListener('wheel', this.handleWheel);
      canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      canvas.removeEventListener(
        'webglcontextrestored',
        this.handleContextRestored
      );
      if (canvas.parentElement === this.container) {
        this.container.removeChild(canvas);
      }
    }

    this.disposables.forEach((d) => d.dispose());
    this.textures?.dispose();
    this.renderer?.dispose();
  }
}
