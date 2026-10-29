import * as THREE from 'three';
import {
  CanopyFurnishingKind,
  CanopyTradeFocus,
  ToolVisualKind,
} from '../firebase';
import { AGARWOOD_MOTIVATIONAL_PLAQUES } from '../shared/agarwoodMotivation';
import {
  SHOE_CHARACTER_CATALOG,
  SHOE_COLORWAY_CATALOG,
  ShoeCharacterKind,
  ShoeColorway,
} from '../shared/shoeCharacterCatalog';
import {
  ChillPodId,
  CraftKind,
  TreeLiftControlAction,
} from '../types/game';
import { ProceduralTextureSet } from './textures';

export const CABLE_X = 0;
export const CABLE_Z = 2.45;
export const MIN_LIFT_Y = 0.35;
export const MAX_LIFT_Y = 33.0;

/**
 * Ground height function: keeps the Root Base Sanctuary flat (r <= 9.5m)
 * and gently rises into natural woodland knolls around the outer perimeter.
 */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= 9.5) return 0;
  const blend = THREE.MathUtils.smoothstep(r, 9.5, 28.0);
  const hills =
    Math.sin(x * 0.085) * Math.cos(z * 0.085) * 1.85 +
    Math.sin(x * 0.04 - z * 0.05) * 1.2 +
    (r - 9.5) * 0.055;
  return blend * Math.max(-0.35, hills);
}

export interface BoughStationNode {
  elevation: number;
  label: string;
  tokenMesh: THREE.Group;
  lanternGlow: THREE.MeshStandardMaterial;
  collected: boolean;
  respawnTimer: number;
}

export interface SingleShoeParts {
  group: THREE.Group;
  shaftMesh: THREE.Mesh;
  cuffRimMesh: THREE.Mesh;
  buckleStrapGroup: THREE.Group;
  steelCapMesh: THREE.Mesh;
  rubberToeMesh: THREE.Mesh;
  pullLoopsGroup: THREE.Group;
  lacesGroup: THREE.Group;
  heelSpurMesh: THREE.Mesh;
}

export interface ShoeCharacterRig {
  root: THREE.Group;
  leftShoe: SingleShoeParts;
  rightShoe: SingleShoeParts;
  upperMat: THREE.MeshStandardMaterial;
  secondaryMat: THREE.MeshStandardMaterial;
  soleMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
}

export interface ManualLiftRig {
  root: THREE.Group;
  carriageInner: THREE.Group;
  overheadSheave: THREE.Group;
  handWheel: THREE.Group;
  brakeLever: THREE.Group;
  brassFrameMat: THREE.MeshStandardMaterial;
  windShieldGroup: THREE.Group;
  cargoGroup: THREE.Group;
  cargoMeshes: Record<CraftKind, THREE.Group>;
  shoeCharacter: ShoeCharacterRig;
  groundContactShadow: THREE.Mesh;
}

export interface ChillPodRigNode {
  podId: ChillPodId;
  group: THREE.Group;
  worldFocusPos: THREE.Vector3;
  fanBladesGroup: THREE.Group;
  heaterMat: THREE.MeshStandardMaterial;
  lampMat: THREE.MeshStandardMaterial;
  waterMesh: THREE.Mesh;
  waterMat: THREE.MeshStandardMaterial;
  quiltGroup: THREE.Group;
  quiltMat: THREE.MeshStandardMaterial;
  statusJewelMat: THREE.MeshStandardMaterial;
  privacyDoorGroup: THREE.Group;
  interiorLatchMat: THREE.MeshStandardMaterial;
  companionPlushieGroup: THREE.Group;
  companionPlushieUpperMat: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  fanActive: boolean;
  flotationActive: boolean;
  doorTargetX: number;
}

export interface CanopySummitRig {
  root: THREE.Group;
  crownSheave: THREE.Group;
  roofMesh: THREE.Mesh;
  shingleMat: THREE.MeshStandardMaterial;
  floorMat: THREE.MeshStandardMaterial;
  trimAccentMat: THREE.MeshStandardMaterial;
  tactileWayfindingMat: THREE.MeshStandardMaterial;
  hatchLeafLeft: THREE.Group;
  hatchLeafRight: THREE.Group;
  safetyGateBar: THREE.Group;
  tradeFocusProps: Record<CanopyTradeFocus, THREE.Group>;
  toolMeshes: Record<ToolVisualKind, THREE.Group>;
  furnishingMeshes: Record<CanopyFurnishingKind, THREE.Group>;
  furnishingLight: THREE.PointLight;
  mezzanineLight: THREE.PointLight;
  canopyStoreHitProxy: THREE.Mesh;
  canopyStoreBeaconMat: THREE.MeshStandardMaterial;
  canopyStudioHitProxy: THREE.Mesh;
  mezzanineLibraryHitProxy: THREE.Mesh;
  mezzanineRefreshmentsHitProxy: THREE.Mesh;
  wellyTubHitProxy: THREE.Mesh;
  wellyPlushieNodes: THREE.Group[];
  chillPods: Record<ChillPodId, ChillPodRigNode>;
  chillPodHitProxies: THREE.Mesh[];
  beacons: Array<{
    prism: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    light: THREE.PointLight;
  }>;
}

export interface CollaboratorRelaySlot {
  group: THREE.Group;
  sheave: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
  currentY: number;
  targetY: number;
  active: boolean;
}

export interface AgarwoodControlButtonNode {
  action: TreeLiftControlAction;
  plungerGroup: THREE.Group;
  bezelMat: THREE.MeshStandardMaterial;
  hitProxy: THREE.Mesh;
  baseZ: number;
  currentPress: number;
}

export interface AgarwoodPlaqueGlowNode {
  elevationMeters: number;
  frameMat: THREE.MeshStandardMaterial;
  sconceMat: THREE.MeshStandardMaterial;
}

export interface AgarwoodTrunkControlRig {
  root: THREE.Group;
  consoleCarriage: THREE.Group;
  sapLight: THREE.PointLight;
  buttons: Record<TreeLiftControlAction, AgarwoodControlButtonNode>;
  hitProxies: THREE.Mesh[];
  plaqueGlows: AgarwoodPlaqueGlowNode[];
}

function createOctagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createTerrainAndPerimeter(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();

  // 1. Subdivided outdoor forest floor with moss-to-loam vertex colors
  const terrainGeo = new THREE.PlaneGeometry(170, 170, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cCenter = new THREE.Color('#2B3F2B');
  const cMid = new THREE.Color('#233524');
  const cOuter = new THREE.Color('#1A291E');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = groundHeightAt(vx, vz);
    pos.setY(i, vy);

    const dist = Math.hypot(vx, vz);
    const t = THREE.MathUtils.clamp(dist / 55, 0, 1);
    if (t < 0.35) {
      tmpColor.lerpColors(cCenter, cMid, t / 0.35);
    } else {
      tmpColor.lerpColors(cMid, cOuter, (t - 0.35) / 0.65);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  disposables.push(terrainGeo);

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
  });
  disposables.push(terrainMat);

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 2. Surrounding Woodland Grove (InstancedMesh > 50 trees, zero indoor walls)
  const treeCount = 64;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 4.6, 8);
  trunkGeo.translate(0, 2.3, 0);
  const lowerTierGeo = new THREE.ConeGeometry(2.1, 4.8, 9);
  lowerTierGeo.translate(0, 5.4, 0);
  const upperTierGeo = new THREE.ConeGeometry(1.55, 4.2, 9);
  upperTierGeo.translate(0, 8.1, 0);
  disposables.push(trunkGeo, lowerTierGeo, upperTierGeo);

  const groveTrunkMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    roughness: 0.9,
    metalness: 0.04,
  });
  const groveLeafMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.82,
    metalness: 0.03,
  });
  disposables.push(groveTrunkMat, groveLeafMat);

  const instTrunks = new THREE.InstancedMesh(trunkGeo, groveTrunkMat, treeCount);
  const instLower = new THREE.InstancedMesh(lowerTierGeo, groveLeafMat, treeCount);
  const instUpper = new THREE.InstancedMesh(upperTierGeo, groveLeafMat, treeCount);
  instLower.castShadow = true;
  instUpper.castShadow = true;
  instLower.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const leafPalette = [
    new THREE.Color('#2E4E34'),
    new THREE.Color('#395E3D'),
    new THREE.Color('#26422C'),
    new THREE.Color('#446842'),
  ];

  for (let i = 0; i < treeCount; i++) {
    const ring = i < 28 ? 17 + (i % 5) * 2.4 : 29 + (i % 7) * 3.8;
    // Leave a clear camera sightseeing corridor in front (+Z)
    const rawAngle = (i / treeCount) * Math.PI * 2;
    let angle = rawAngle;
    if (Math.abs(Math.sin(angle - Math.PI / 2)) > 0.85 && Math.cos(angle - Math.PI / 2) > 0.65) {
      angle += 0.52;
    }
    const tx = Math.cos(angle) * ring;
    const tz = Math.sin(angle) * ring;
    const ty = groundHeightAt(tx, tz);
    const scale = 0.85 + ((i * 37) % 30) / 100;

    dummy.position.set(tx, ty - 0.1, tz);
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set(scale, scale * (0.92 + (i % 4) * 0.12), scale);
    dummy.updateMatrix();

    instTrunks.setMatrixAt(i, dummy.matrix);
    instLower.setMatrixAt(i, dummy.matrix);
    instUpper.setMatrixAt(i, dummy.matrix);

    const tint = leafPalette[i % leafPalette.length];
    instLower.setColorAt(i, tint);
    instUpper.setColorAt(i, tint.clone().offsetHSL(0.01, 0.02, 0.04));
  }

  instTrunks.instanceMatrix.needsUpdate = true;
  instLower.instanceMatrix.needsUpdate = true;
  instUpper.instanceMatrix.needsUpdate = true;
  if (instLower.instanceColor) instLower.instanceColor.needsUpdate = true;
  if (instUpper.instanceColor) instUpper.instanceColor.needsUpdate = true;
  instTrunks.computeBoundingSphere();
  instLower.computeBoundingSphere();
  instUpper.computeBoundingSphere();

  group.add(instTrunks, instLower, instUpper);

  // 3. Mossy Perimeter Stones (InstancedMesh > 25 rocks)
  const rockCount = 30;
  const rockGeo = new THREE.DodecahedronGeometry(0.85, 1);
  rockGeo.scale(1.25, 0.68, 1.05);
  rockGeo.translate(0, 0.32, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.88,
    metalness: 0.08,
  });
  disposables.push(rockGeo, rockMat);

  const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  instRocks.receiveShadow = true;
  instRocks.castShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const angle = (i / rockCount) * Math.PI * 2 + 0.25;
    const rad = 9.8 + (i % 5) * 3.1;
    // Keep front walkway open
    if (Math.abs(Math.atan2(Math.cos(angle), Math.sin(angle))) < 0.35 && rad < 15) {
      continue;
    }
    const rx = Math.sin(angle) * rad;
    const rz = Math.cos(angle) * rad;
    const ry = groundHeightAt(rx, rz);
    const sc = 0.65 + (i % 5) * 0.22;

    dummy.position.set(rx, ry - 0.08, rz);
    dummy.rotation.set((i % 3) * 0.12, i * 0.9, 0);
    dummy.scale.set(sc, sc * 0.85, sc);
    dummy.updateMatrix();
    instRocks.setMatrixAt(i, dummy.matrix);
    instRocks.setColorAt(
      i,
      new THREE.Color(i % 2 === 0 ? '#576258' : '#4A544C')
    );
  }
  instRocks.instanceMatrix.needsUpdate = true;
  if (instRocks.instanceColor) instRocks.instanceColor.needsUpdate = true;
  instRocks.computeBoundingSphere();
  group.add(instRocks);

  return group;
}

export function createGreatTreeAndStations(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): { treeGroup: THREE.Group; stations: BoughStationNode[] } {
  const treeGroup = new THREE.Group();

  // 1. Primary Silhouette: Fluted Ancient Trunk (LatheGeometry)
  const trunkPoints: THREE.Vector2[] = [
    new THREE.Vector2(2.45, 0),
    new THREE.Vector2(1.85, 1.8),
    new THREE.Vector2(1.42, 5.5),
    new THREE.Vector2(1.26, 14.0),
    new THREE.Vector2(1.12, 24.0),
    new THREE.Vector2(0.96, 32.5),
    new THREE.Vector2(0.75, 37.5),
    new THREE.Vector2(0.0, 38.2),
  ];
  const mainTrunkGeo = new THREE.LatheGeometry(trunkPoints, 20);
  disposables.push(mainTrunkGeo);

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    bumpMap: textures.barkBump,
    bumpScale: 0.08,
    roughness: 0.88,
    metalness: 0.04,
  });
  disposables.push(barkMat);

  const mainTrunkMesh = new THREE.Mesh(mainTrunkGeo, barkMat);
  mainTrunkMesh.castShadow = true;
  mainTrunkMesh.receiveShadow = true;
  treeGroup.add(mainTrunkMesh);

  // 2. Wide Buttress Roots (═════╩═════) anchoring into Ground Sanctuary
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.38;
    // Keep exact cable slot at +Z neat by flanking it symmetrically
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dirX * 1.2, 2.8, dirZ * 1.2),
      new THREE.Vector3(dirX * 2.4, 1.15, dirZ * 2.4),
      new THREE.Vector3(dirX * 4.4, 0.38, dirZ * 4.4),
      new THREE.Vector3(dirX * 6.4, -0.12, dirZ * 6.4),
    ]);
    const rootGeo = new THREE.TubeGeometry(rootCurve, 18, 0.36, 9, false);
    disposables.push(rootGeo);
    const rootMesh = new THREE.Mesh(rootGeo, barkMat);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    treeGroup.add(rootMesh);
  }

  // 3. Elevation MeterPlaques along the trunk (5m .. 30m)
  const plaqueGeo = new THREE.BoxGeometry(0.68, 0.34, 0.08);
  const plaqueFrameMat = new THREE.MeshStandardMaterial({
    color: '#2B2118',
    roughness: 0.65,
    metalness: 0.2,
  });
  disposables.push(plaqueGeo, plaqueFrameMat);

  textures.elevationMarkers.forEach((tex, meters) => {
    const faceMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.4,
      metalness: 0.1,
    });
    disposables.push(faceMat);
    const plaque = new THREE.Mesh(plaqueGeo, [
      plaqueFrameMat,
      plaqueFrameMat,
      plaqueFrameMat,
      plaqueFrameMat,
      faceMat,
      plaqueFrameMat,
    ]);
    plaque.position.set(-1.35, meters, 0.92);
    plaque.rotation.y = -0.32;
    treeGroup.add(plaque);
  });

  // 3b. Six Carved Agarwood Motivational Plaques Embedded into Sculpted Heartwood Niches up the Trunk
  const motivBurlGeo = new THREE.BoxGeometry(2.12, 0.92, 0.22);
  const motivTrimGeo = new THREE.BoxGeometry(1.98, 0.78, 0.25);
  const motivFaceGeo = new THREE.PlaneGeometry(1.88, 0.7);
  const motivHoodGeo = new THREE.CylinderGeometry(0.08, 0.16, 0.12, 10);
  const motivGemGeo = new THREE.SphereGeometry(0.075, 10, 10);
  const agarwoodBurlMat = new THREE.MeshStandardMaterial({
    color: '#24160D',
    roughness: 0.74,
    metalness: 0.08,
  });
  const agarwoodBrassTrimMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.26,
    metalness: 0.86,
  });
  disposables.push(
    motivBurlGeo,
    motivTrimGeo,
    motivFaceGeo,
    motivHoodGeo,
    motivGemGeo,
    agarwoodBurlMat,
    agarwoodBrassTrimMat
  );

  AGARWOOD_MOTIVATIONAL_PLAQUES.forEach((spec) => {
    const plaqueTex = textures.agarwoodPlaques.get(spec.id);
    if (!plaqueTex) return;

    const nicheGroup = new THREE.Group();
    // Recessed into the right-front heartwood face of the Agarwood trunk beside the lift
    nicheGroup.position.set(1.68, spec.elevationMeters + 0.55, 1.38);
    nicheGroup.rotation.y = -0.22;

    const burlBack = new THREE.Mesh(motivBurlGeo, agarwoodBurlMat);
    burlBack.castShadow = true;
    burlBack.receiveShadow = true;

    const brassRim = new THREE.Mesh(motivTrimGeo, agarwoodBrassTrimMat);
    brassRim.position.z = 0.01;

    const faceMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.36,
      metalness: 0.08,
    });
    disposables.push(faceMat);

    const faceMesh = new THREE.Mesh(motivFaceGeo, faceMat);
    faceMesh.position.z = 0.142;

    // Warm Amber Agarwood Resin Sconce atop the carved plaque
    const sconceMat = new THREE.MeshStandardMaterial({
      color: '#FFD166',
      emissive: '#FF9E2C',
      emissiveIntensity: 1.25,
      roughness: 0.22,
    });
    disposables.push(sconceMat);

    const hood = new THREE.Mesh(motivHoodGeo, agarwoodBrassTrimMat);
    hood.position.set(0, 0.52, 0.12);
    const sconceBulb = new THREE.Mesh(motivGemGeo, sconceMat);
    sconceBulb.position.set(0, 0.43, 0.12);

    nicheGroup.add(burlBack, brassRim, faceMesh, hood, sconceBulb);
    treeGroup.add(nicheGroup);
  });

  // 4. Three Second-Level Gathering Bough Landings along the Trunk (10m, 18m, 25m)
  const stationSpecs = [
    {
      elevation: 10.0,
      label: '10m · Special Interest Items Bough',
      side: -1,
    },
    {
      elevation: 18.0,
      label: '18m · Ideas & Working Papers Perch',
      side: 1,
    },
    {
      elevation: 25.0,
      label: '25m · Collab & Job Steps Lookout',
      side: -1,
    },
  ];

  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timberAlbedo,
    roughness: 0.72,
    metalness: 0.06,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#DF9F35',
    roughness: 0.24,
    metalness: 0.86,
  });
  const folioMat = new THREE.MeshStandardMaterial({
    color: '#345441',
    roughness: 0.78,
    metalness: 0.04,
  });
  const paperSheetMat = new THREE.MeshStandardMaterial({
    color: '#F5EFE0',
    roughness: 0.85,
    metalness: 0.02,
  });
  disposables.push(timberMat, brassMat, folioMat, paperSheetMat);

  const folioBoxGeo = new THREE.BoxGeometry(0.42, 0.09, 0.32);
  const paperStackGeo = new THREE.BoxGeometry(0.36, 0.06, 0.26);
  const scrollTubeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.44, 10);
  scrollTubeGeo.rotateZ(Math.PI / 2);
  disposables.push(folioBoxGeo, paperStackGeo, scrollTubeGeo);

  const stations: BoughStationNode[] = [];

  stationSpecs.forEach((spec, idx) => {
    const stGroup = new THREE.Group();
    const s = spec.side;

    // Sweeping bough limb
    const limbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.8, spec.elevation - 0.6, 0.3),
      new THREE.Vector3(s * 2.1, spec.elevation + 0.1, 1.15),
      new THREE.Vector3(s * 3.2, spec.elevation + 0.45, 1.85),
    ]);
    const limbGeo = new THREE.TubeGeometry(limbCurve, 14, 0.24, 8, false);
    disposables.push(limbGeo);
    const limbMesh = new THREE.Mesh(limbGeo, barkMat);
    limbMesh.castShadow = true;
    stGroup.add(limbMesh);

    // Braced timber resting shelf
    const shelfGeo = new THREE.BoxGeometry(1.42, 0.14, 1.04);
    disposables.push(shelfGeo);
    const shelf = new THREE.Mesh(shelfGeo, timberMat);
    shelf.position.set(s * 2.15, spec.elevation + 0.28, 1.45);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    stGroup.add(shelf);

    // Bundled Special Interest Items, Ideas & Working Papers perched on the shelf
    const folio = new THREE.Mesh(folioBoxGeo, folioMat);
    folio.position.set(s * 2.02, spec.elevation + 0.395, 1.42);
    folio.rotation.y = s * 0.18;
    const papers = new THREE.Mesh(paperStackGeo, paperSheetMat);
    papers.position.set(s * 2.02, spec.elevation + 0.47, 1.42);
    papers.rotation.y = -s * 0.12;
    const scrollA = new THREE.Mesh(scrollTubeGeo, paperSheetMat);
    scrollA.position.set(s * 2.38, spec.elevation + 0.395, 1.56);
    scrollA.rotation.y = 0.35 + idx * 0.2;
    const scrollBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10).rotateZ(Math.PI / 2),
      brassMat
    );
    disposables.push(scrollBand.geometry);
    scrollBand.position.copy(scrollA.position);
    scrollBand.rotation.copy(scrollA.rotation);
    stGroup.add(folio, papers, scrollA, scrollBand);

    // Hanging station lantern
    const lanternGlow = new THREE.MeshStandardMaterial({
      color: '#FFCF70',
      emissive: '#FF9E2C',
      emissiveIntensity: 1.4,
      roughness: 0.25,
    });
    const lanternCapGeo = new THREE.CylinderGeometry(0.08, 0.2, 0.12, 8);
    const lanternCoreGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.26, 8);
    disposables.push(lanternGlow, lanternCapGeo, lanternCoreGeo);

    const lanternCap = new THREE.Mesh(lanternCapGeo, brassMat);
    lanternCap.position.set(s * 2.55, spec.elevation + 0.05, 1.85);
    const lanternCore = new THREE.Mesh(lanternCoreGeo, lanternGlow);
    lanternCore.position.set(s * 2.55, spec.elevation - 0.14, 1.85);
    stGroup.add(lanternCap, lanternCore);

    // Collectible Second-Level Gathering Token floating cleanly adjacent to the Lift's side rail
    const tokenGroup = new THREE.Group();
    tokenGroup.position.set(s * 1.48, spec.elevation + 0.55, CABLE_Z);

    const ringGeo = new THREE.TorusGeometry(0.3, 0.045, 10, 24);
    const innerRingGeo = new THREE.TorusGeometry(0.21, 0.025, 8, 20);
    innerRingGeo.rotateY(Math.PI / 2);
    const gemGeo = new THREE.OctahedronGeometry(0.17, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: '#7CE0A3',
      emissive: '#2EA866',
      emissiveIntensity: 0.9,
      roughness: 0.18,
      metalness: 0.4,
    });
    disposables.push(ringGeo, innerRingGeo, gemGeo, gemMat);

    const ringMesh = new THREE.Mesh(ringGeo, brassMat);
    const innerRingMesh = new THREE.Mesh(innerRingGeo, brassMat);
    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    tokenGroup.add(ringMesh, innerRingMesh, gemMesh);
    stGroup.add(tokenGroup);

    treeGroup.add(stGroup);
    stations.push({
      elevation: spec.elevation,
      label: spec.label,
      tokenMesh: tokenGroup,
      lanternGlow,
      collected: false,
      respawnTimer: 0,
    });
  });

  // 5. Lush Canopy Crown Foliage (InstancedMesh > 80 foliage clusters around Summit)
  const crownCount = 86;
  const puffGeo = new THREE.DodecahedronGeometry(1.85, 1);
  const puffMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.84,
    metalness: 0.02,
  });
  disposables.push(puffGeo, puffMat);

  const crownInst = new THREE.InstancedMesh(puffGeo, puffMat, crownCount);
  crownInst.castShadow = true;
  crownInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const canopyShades = [
    new THREE.Color('#2E5636'),
    new THREE.Color('#3D6B41'),
    new THREE.Color('#4B7A47'),
    new THREE.Color('#25472D'),
  ];

  for (let i = 0; i < crownCount; i++) {
    const layer = i / crownCount;
    const angle = i * 2.39996; // Golden angle distribution
    const radius =
      i < 22
        ? 4.6 + (i % 4) * 1.1 // Frame around the treehouse walls without blocking front dock
        : 2.2 + Math.sqrt(layer) * 5.8;
    const py =
      i < 22
        ? 31.2 + (i % 3) * 1.3
        : 36.2 + Math.sin(layer * Math.PI) * 4.4 + (i % 3) * 0.6;

    let px = Math.cos(angle) * radius;
    let pz = Math.sin(angle) * radius;

    // Keep the front Canopy Lift bay & window vista open (+Z around CABLE_Z)
    if (py < 36.2 && pz > 1.4 && Math.abs(px) < 3.6) {
      pz = -Math.abs(pz) - 2.0;
    }

    const sc = 0.85 + ((i * 19) % 35) / 100;
    dummy.position.set(px, py, pz);
    dummy.rotation.set(i * 0.4, i * 0.8, 0);
    dummy.scale.set(sc * 1.2, sc * 0.78, sc * 1.15);
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
    crownInst.setColorAt(i, canopyShades[i % canopyShades.length]);
  }
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  crownInst.computeBoundingSphere();
  treeGroup.add(crownInst);

  return { treeGroup, stations };
}

export interface GroundWorkshopRig {
  group: THREE.Group;
  entryKioskHitProxy: THREE.Mesh;
  entryKioskBeaconMat: THREE.MeshStandardMaterial;
  welcomeShoeHitProxy: THREE.Mesh;
  welcomeShoeBeaconMat: THREE.MeshStandardMaterial;
  jobBoardHitProxy: THREE.Mesh;
  jobBoardBeaconMat: THREE.MeshStandardMaterial;
  drazellaStallHitProxy: THREE.Mesh;
}

export function createGroundWorkshopGroup(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): GroundWorkshopRig {
  const group = new THREE.Group();

  // Contact shadow grounding (offset +0.015 on Y to prevent coplanar Z-fighting)
  const shadowGeo = new THREE.PlaneGeometry(14.5, 14.5);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.62,
  });
  disposables.push(shadowGeo, shadowMat);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.015;
  group.add(shadowPlane);

  // 1. Wide Stable Root Sanctuary Octagonal Deck (═════╩═════)
  const deckShape = createOctagonShape(5.8);
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  deckGeo.rotateX(-Math.PI / 2);
  disposables.push(deckGeo);

  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.timberAlbedo,
    roughness: 0.76,
    metalness: 0.05,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: '#2A302D',
    roughness: 0.42,
    metalness: 0.82,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.22,
    metalness: 0.88,
  });
  disposables.push(deckMat, darkIronMat, brassMat);

  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.y = 0.03;
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  group.add(deckMesh);

  // Welcoming Front Entry Steps
  const stepGeo = new THREE.BoxGeometry(2.8, 0.16, 0.75);
  disposables.push(stepGeo);
  const frontStep = new THREE.Mesh(stepGeo, deckMat);
  frontStep.position.set(0, 0.08, 5.75);
  frontStep.receiveShadow = true;
  frontStep.castShadow = true;
  group.add(frontStep);

  // 2. Pulley Ground Anchor Block (╩) right at (CABLE_X, 0.31, CABLE_Z)
  const padGeo = new THREE.CylinderGeometry(0.95, 1.08, 0.14, 16);
  const ringAnchorGeo = new THREE.TorusGeometry(0.18, 0.045, 10, 20);
  disposables.push(padGeo, ringAnchorGeo);

  const landingPad = new THREE.Mesh(padGeo, darkIronMat);
  landingPad.position.set(CABLE_X, 0.34, CABLE_Z);
  landingPad.receiveShadow = true;
  const anchorRing = new THREE.Mesh(ringAnchorGeo, brassMat);
  anchorRing.position.set(CABLE_X, 0.44, CABLE_Z);
  group.add(landingPad, anchorRing);

  // 3. High-Contrast Architectural Banner Gateway (JAY'S JOB CLUB • Ages 18+ • Passion to Purpose)
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0.31, 5.15);

  const postGeo = new THREE.BoxGeometry(0.24, 3.35, 0.24);
  const headerBeamGeo = new THREE.BoxGeometry(4.5, 0.22, 0.32);
  const signBoxGeo = new THREE.BoxGeometry(3.95, 0.98, 0.14);
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.bannerSign,
    roughness: 0.32,
    metalness: 0.08,
  });
  disposables.push(postGeo, headerBeamGeo, signBoxGeo, signFaceMat);

  const leftPost = new THREE.Mesh(postGeo, deckMat);
  leftPost.position.set(-1.95, 1.67, 0);
  leftPost.castShadow = true;
  const rightPost = new THREE.Mesh(postGeo, deckMat);
  rightPost.position.set(1.95, 1.67, 0);
  rightPost.castShadow = true;

  const topBeam = new THREE.Mesh(headerBeamGeo, darkIronMat);
  topBeam.position.set(0, 3.38, 0);
  topBeam.castShadow = true;

  const signBoard = new THREE.Mesh(signBoxGeo, [
    darkIronMat,
    darkIronMat,
    darkIronMat,
    darkIronMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 2.75, 0.04);
  signBoard.castShadow = true;

  archGroup.add(leftPost, rightPost, topBeam, signBoard);
  group.add(archGroup);

  // 4. Composite Carpenter's Ground Workbench (Rear-Left Deck Bay)
  const benchGroup = new THREE.Group();
  benchGroup.position.set(-2.95, 0.31, -2.15);
  benchGroup.rotation.y = 0.56;

  const benchTopGeo = new THREE.BoxGeometry(2.1, 0.14, 0.95);
  const legGeo = new THREE.BoxGeometry(0.14, 0.82, 0.14);
  const viseGeo = new THREE.BoxGeometry(0.32, 0.22, 0.26);
  const crateGeo = new THREE.BoxGeometry(0.56, 0.44, 0.52);
  disposables.push(benchTopGeo, legGeo, viseGeo, crateGeo);

  const benchTop = new THREE.Mesh(benchTopGeo, deckMat);
  benchTop.position.y = 0.86;
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  benchGroup.add(benchTop);

  [
    [-0.88, -0.35],
    [0.88, -0.35],
    [-0.88, 0.35],
    [0.88, 0.35],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, deckMat);
    leg.position.set(lx, 0.41, lz);
    leg.castShadow = true;
    benchGroup.add(leg);
  });

  const vise = new THREE.Mesh(viseGeo, darkIronMat);
  vise.position.set(0.75, 0.84, 0.52);
  const toolCrate = new THREE.Mesh(crateGeo, brassMat);
  toolCrate.position.set(-0.52, 1.14, -0.08);
  toolCrate.castShadow = true;
  benchGroup.add(vise, toolCrate);
  group.add(benchGroup);

  // 5. Quiet Sanctuary Rest Bench & Warm Floor Lantern (Right Flank)
  const sanctuaryGroup = new THREE.Group();
  sanctuaryGroup.position.set(3.45, 0.31, 2.45);
  sanctuaryGroup.rotation.y = -0.48;

  const seatGeo = new THREE.BoxGeometry(1.85, 0.1, 0.58);
  const backrestGeo = new THREE.BoxGeometry(1.85, 0.52, 0.08);
  const benchLegGeo = new THREE.BoxGeometry(0.12, 0.45, 0.52);
  const lanternPostGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.45, 8);
  const lanternGlobeGeo = new THREE.SphereGeometry(0.2, 14, 12);
  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFE099',
    emissive: '#FFA938',
    emissiveIntensity: 1.7,
    roughness: 0.2,
  });
  disposables.push(
    seatGeo,
    backrestGeo,
    benchLegGeo,
    lanternPostGeo,
    lanternGlobeGeo,
    warmGlowMat
  );

  const seat = new THREE.Mesh(seatGeo, deckMat);
  seat.position.set(0, 0.46, 0);
  seat.castShadow = true;
  const backrest = new THREE.Mesh(backrestGeo, deckMat);
  backrest.position.set(0, 0.78, -0.24);
  backrest.rotation.x = -0.14;
  backrest.castShadow = true;

  const bLegL = new THREE.Mesh(benchLegGeo, darkIronMat);
  bLegL.position.set(-0.75, 0.225, 0);
  const bLegR = new THREE.Mesh(benchLegGeo, darkIronMat);
  bLegR.position.set(0.75, 0.225, 0);

  const lPost = new THREE.Mesh(lanternPostGeo, darkIronMat);
  lPost.position.set(1.25, 0.72, 0.2);
  const lGlobe = new THREE.Mesh(lanternGlobeGeo, warmGlowMat);
  lGlobe.position.set(1.25, 1.52, 0.2);

  sanctuaryGroup.add(seat, backrest, bLegL, bLegR, lPost, lGlobe);
  group.add(sanctuaryGroup);

  // 6. Prominent Front-Right Heritage Old-Style Job Centre Vacancy Card Pavilion
  const {
    pavilion: groundBoard,
    hitProxy: jobBoardHitProxy,
    beaconMat: jobBoardBeaconMat,
  } = createGroundJobCollabPavilion(
    textures,
    deckMat,
    darkIronMat,
    brassMat,
    warmGlowMat,
    disposables
  );
  groundBoard.position.set(3.62, 0.31, 1.38);
  groundBoard.rotation.y = -0.52;
  group.add(groundBoard);

  // 7. Interactive Ground Floor Entry Kiosk, Trying-Token Dish & Sign-Up Lectern (Front-Left Plaza)
  const {
    kiosk: welcomeKiosk,
    hitProxy: entryKioskHitProxy,
    beaconMat: entryKioskBeaconMat,
  } = createGroundWelcomeKiosk(
    textures,
    deckMat,
    darkIronMat,
    brassMat,
    warmGlowMat,
    disposables
  );
  welcomeKiosk.position.set(-3.68, 0.31, 2.72);
  welcomeKiosk.rotation.y = 0.36;
  group.add(welcomeKiosk);

  // 8. Ground Floor Drazella Sprinkes Youth Development Publishing & Artisan Book Stall
  const { stall: artisanStall, hitProxy: drazellaStallHitProxy } =
    createGroundArtisanMarketStall(
      textures,
      deckMat,
      darkIronMat,
      brassMat,
      warmGlowMat,
      disposables
    );
  artisanStall.position.set(-4.35, 0.31, -0.35);
  artisanStall.rotation.y = 1.18;
  group.add(artisanStall);

  // 9. Welcome Area Boot & Shoe Character Fitting Bench (Wellies, Work Boots & Work Shoes)
  const {
    benchGroup: welcomeShoeBench,
    hitProxy: welcomeShoeHitProxy,
    beaconMat: welcomeShoeBeaconMat,
  } = createWelcomeShoeBenchGroup(
    textures,
    deckMat,
    darkIronMat,
    brassMat,
    disposables
  );
  welcomeShoeBench.position.set(1.92, 0.31, 4.18);
  welcomeShoeBench.rotation.y = -0.22;
  group.add(welcomeShoeBench);

  return {
    group,
    entryKioskHitProxy,
    entryKioskBeaconMat,
    welcomeShoeHitProxy,
    welcomeShoeBeaconMat,
    jobBoardHitProxy,
    jobBoardBeaconMat,
    drazellaStallHitProxy,
  };
}

function createGroundArtisanMarketStall(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  warmGlowMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): { stall: THREE.Group; hitProxy: THREE.Mesh } {
  const stall = new THREE.Group();

  const plinthGeo = new THREE.BoxGeometry(2.36, 0.08, 0.88);
  const counterGeo = new THREE.BoxGeometry(2.12, 0.86, 0.68);
  const counterTopGeo = new THREE.BoxGeometry(2.24, 0.09, 0.78);
  const postGeo = new THREE.BoxGeometry(0.12, 2.34, 0.12);
  const awningGeo = new THREE.BoxGeometry(2.38, 0.1, 0.88);
  const signGeo = new THREE.BoxGeometry(2.18, 0.5, 0.11);

  // Handcrafted item miniatures on counter: Cedar Chest, Brass Lantern, Woven Runner, Walnut Totem
  const miniChestGeo = new THREE.BoxGeometry(0.42, 0.26, 0.28);
  const miniChestBandGeo = new THREE.BoxGeometry(0.44, 0.27, 0.04);
  const miniLanternBaseGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.08, 10);
  const miniLanternCoreGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10);
  const miniLanternCapGeo = new THREE.ConeGeometry(0.15, 0.12, 10);
  const runnerClothGeo = new THREE.BoxGeometry(0.54, 0.025, 0.36);
  const totemBaseGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.08, 12);
  const totemSpindleGeo = new THREE.SphereGeometry(0.085, 12, 10);
  const totemRingGeo = new THREE.TorusGeometry(0.095, 0.018, 8, 16);

  const cedarMat = new THREE.MeshStandardMaterial({
    color: '#A5633C',
    roughness: 0.58,
    metalness: 0.06,
  });
  const woolRunnerMat = new THREE.MeshStandardMaterial({
    color: '#3F6A4E',
    roughness: 0.88,
    metalness: 0.02,
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: '#3D2618',
    roughness: 0.42,
    metalness: 0.08,
  });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.artisanShopSign,
    roughness: 0.3,
    metalness: 0.08,
  });

  disposables.push(
    plinthGeo,
    counterGeo,
    counterTopGeo,
    postGeo,
    awningGeo,
    signGeo,
    miniChestGeo,
    miniChestBandGeo,
    miniLanternBaseGeo,
    miniLanternCoreGeo,
    miniLanternCapGeo,
    runnerClothGeo,
    totemBaseGeo,
    totemSpindleGeo,
    totemRingGeo,
    cedarMat,
    woolRunnerMat,
    walnutMat,
    signFaceMat
  );

  const plinth = new THREE.Mesh(plinthGeo, timberMat);
  plinth.position.set(0, 0.04, 0);
  plinth.receiveShadow = true;
  stall.add(plinth);

  const counter = new THREE.Mesh(counterGeo, timberMat);
  counter.position.set(0, 0.47, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;

  const counterTop = new THREE.Mesh(counterTopGeo, cedarMat);
  counterTop.position.set(0, 0.94, 0.02);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  stall.add(counter, counterTop);

  [-1.02, 1.02].forEach((px) => {
    const post = new THREE.Mesh(postGeo, timberMat);
    post.position.set(px, 1.17, -0.22);
    post.castShadow = true;
    stall.add(post);
  });

  const signBoard = new THREE.Mesh(signGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 2.02, -0.14);
  signBoard.castShadow = true;

  const awning = new THREE.Mesh(awningGeo, brassMat);
  awning.position.set(0, 2.34, -0.04);
  awning.rotation.x = 0.16;
  awning.castShadow = true;
  stall.add(signBoard, awning);

  // Handcrafted Item 1: Dovetail Red Cedar Chest (left)
  const chest = new THREE.Mesh(miniChestGeo, cedarMat);
  chest.position.set(-0.68, 1.11, 0.04);
  chest.rotation.y = 0.14;
  chest.castShadow = true;
  const chestBand = new THREE.Mesh(miniChestBandGeo, brassMat);
  chestBand.position.copy(chest.position);
  chestBand.rotation.y = 0.14 + Math.PI / 2;
  stall.add(chest, chestBand);

  // Handcrafted Item 2: Hand-Loomed Botanical Wool Runner + Brass Beacon Lantern (center)
  const runner = new THREE.Mesh(runnerClothGeo, woolRunnerMat);
  runner.position.set(0.02, 0.995, 0.06);
  stall.add(runner);

  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(0.02, 1.01, 0.06);
  const lBase = new THREE.Mesh(miniLanternBaseGeo, brassMat);
  lBase.position.y = 0.04;
  const lCore = new THREE.Mesh(miniLanternCoreGeo, warmGlowMat);
  lCore.position.y = 0.18;
  const lCap = new THREE.Mesh(miniLanternCapGeo, brassMat);
  lCap.position.y = 0.34;
  lanternGroup.add(lBase, lCore, lCap);
  stall.add(lanternGroup);

  // Handcrafted Item 3: Turned Black Walnut & Brass Calm Totem (right)
  const totemGroup = new THREE.Group();
  totemGroup.position.set(0.68, 1.01, 0.05);
  const tBase = new THREE.Mesh(totemBaseGeo, walnutMat);
  tBase.position.y = 0.04;
  const tSphere = new THREE.Mesh(totemSpindleGeo, walnutMat);
  tSphere.position.y = 0.14;
  const tRing = new THREE.Mesh(totemRingGeo, brassMat);
  tRing.rotation.x = Math.PI / 2;
  tRing.position.y = 0.14;
  totemGroup.add(tBase, tSphere, tRing);
  stall.add(totemGroup);

  const hitProxyGeo = new THREE.BoxGeometry(2.55, 2.55, 1.12);
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(hitProxyGeo, hitProxyMat);
  const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  hitProxy.position.set(0, 1.24, 0);
  hitProxy.layers.set(1);
  hitProxy.userData = { sceneAction: 'open_drazella_notice' };
  stall.add(hitProxy);

  return { stall, hitProxy };
}

function createGroundWelcomeKiosk(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  warmGlowMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  kiosk: THREE.Group;
  hitProxy: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const kiosk = new THREE.Group();

  const plinthGeo = new THREE.BoxGeometry(2.48, 0.08, 0.86);
  const postGeo = new THREE.BoxGeometry(0.13, 2.38, 0.13);
  const hoodGeo = new THREE.BoxGeometry(2.54, 0.1, 0.56);
  const signBoxGeo = new THREE.BoxGeometry(2.3, 0.54, 0.12);
  const deskBodyGeo = new THREE.BoxGeometry(1.72, 0.88, 0.56);
  const lecternSlopeGeo = new THREE.BoxGeometry(1.78, 0.08, 0.66);
  const journalCoverGeo = new THREE.BoxGeometry(0.62, 0.035, 0.44);
  const journalPageGeo = new THREE.BoxGeometry(0.28, 0.025, 0.38);
  const ribbonGeo = new THREE.BoxGeometry(0.03, 0.03, 0.42);
  const bowlGeo = new THREE.CylinderGeometry(0.22, 0.14, 0.09, 14);
  const tokenCoinGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12);

  const leatherMat = new THREE.MeshStandardMaterial({
    color: '#5C3824',
    roughness: 0.72,
    metalness: 0.06,
  });
  const parchmentMat = new THREE.MeshStandardMaterial({
    color: '#F7F1E1',
    roughness: 0.86,
    metalness: 0.02,
  });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.welcomeKioskSign,
    roughness: 0.32,
    metalness: 0.08,
  });
  const tryingTokenGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFD166',
    emissive: '#E5951A',
    emissiveIntensity: 0.75,
    roughness: 0.22,
    metalness: 0.78,
  });

  disposables.push(
    plinthGeo,
    postGeo,
    hoodGeo,
    signBoxGeo,
    deskBodyGeo,
    lecternSlopeGeo,
    journalCoverGeo,
    journalPageGeo,
    ribbonGeo,
    bowlGeo,
    tokenCoinGeo,
    leatherMat,
    parchmentMat,
    signFaceMat,
    tryingTokenGlowMat
  );

  const plinth = new THREE.Mesh(plinthGeo, timberMat);
  plinth.position.set(0, 0.04, 0.12);
  plinth.receiveShadow = true;
  kiosk.add(plinth);

  [-1.06, 1.06].forEach((px) => {
    const post = new THREE.Mesh(postGeo, timberMat);
    post.position.set(px, 1.19, -0.08);
    post.castShadow = true;
    kiosk.add(post);
  });

  const signBoard = new THREE.Mesh(signBoxGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 2.08, -0.02);
  signBoard.castShadow = true;

  const hood = new THREE.Mesh(hoodGeo, ironMat);
  hood.position.set(0, 2.42, 0.02);
  hood.rotation.x = 0.14;
  hood.castShadow = true;

  const lampStripGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8);
  lampStripGeo.rotateZ(Math.PI / 2);
  disposables.push(lampStripGeo);
  const lampStrip = new THREE.Mesh(lampStripGeo, warmGlowMat);
  lampStrip.position.set(0, 2.34, 0.16);

  // Welcome Counter & Sloped Personal Journal Lectern
  const deskBody = new THREE.Mesh(deskBodyGeo, timberMat);
  deskBody.position.set(0, 0.48, 0.12);
  deskBody.castShadow = true;
  deskBody.receiveShadow = true;

  const lecternTop = new THREE.Mesh(lecternSlopeGeo, timberMat);
  lecternTop.position.set(0, 0.95, 0.14);
  lecternTop.rotation.x = 0.18;
  lecternTop.castShadow = true;

  // Open Personal Journal Ledger on Left of Lectern
  const journalGroup = new THREE.Group();
  journalGroup.position.set(-0.36, 1.01, 0.15);
  journalGroup.rotation.x = 0.18;
  const cover = new THREE.Mesh(journalCoverGeo, leatherMat);
  const leftPage = new THREE.Mesh(journalPageGeo, parchmentMat);
  leftPage.position.set(-0.15, 0.022, 0);
  const rightPage = new THREE.Mesh(journalPageGeo, parchmentMat);
  rightPage.position.set(0.15, 0.022, 0);
  const ribbon = new THREE.Mesh(ribbonGeo, brassMat);
  ribbon.position.set(0, 0.03, 0.04);
  journalGroup.add(cover, leftPage, rightPage, ribbon);

  // Brass Trying-Token Dish & Stacked Trying Tokens on Right of Lectern
  const tokenBowlGroup = new THREE.Group();
  tokenBowlGroup.position.set(0.46, 1.01, 0.15);
  tokenBowlGroup.rotation.x = 0.18;
  const bowl = new THREE.Mesh(bowlGeo, ironMat);
  tokenBowlGroup.add(bowl);
  [
    [-0.06, 0.055, -0.03],
    [0.06, 0.055, 0.02],
    [0.0, 0.08, -0.01],
    [0.02, 0.105, 0.01],
  ].forEach(([cx, cy, cz]) => {
    const coin = new THREE.Mesh(tokenCoinGeo, tryingTokenGlowMat);
    coin.position.set(cx, cy, cz);
    tokenBowlGroup.add(coin);
  });

  // Illuminated Active Entry Kiosk Finial Beacon & Brass Bell Plunger
  const beaconFinialGeo = new THREE.OctahedronGeometry(0.16, 1);
  const beaconPedestalGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.08, 12);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#FFE08A',
    emissive: '#F59E0B',
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.35,
  });
  const hitProxyGeo = new THREE.BoxGeometry(2.65, 2.75, 1.18);
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(
    beaconFinialGeo,
    beaconPedestalGeo,
    beaconMat,
    hitProxyGeo,
    hitProxyMat
  );

  const beaconPedestal = new THREE.Mesh(beaconPedestalGeo, brassMat);
  beaconPedestal.position.set(0, 2.5, 0.02);
  const beaconGem = new THREE.Mesh(beaconFinialGeo, beaconMat);
  beaconGem.position.set(0, 2.68, 0.02);

  const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  hitProxy.position.set(0, 1.38, 0.08);
  hitProxy.layers.set(1);
  hitProxy.userData = { sceneAction: 'open_entry_kiosk' };

  kiosk.add(
    signBoard,
    hood,
    lampStrip,
    deskBody,
    lecternTop,
    journalGroup,
    tokenBowlGroup,
    beaconPedestal,
    beaconGem,
    hitProxy
  );
  return { kiosk, hitProxy, beaconMat };
}

function createGroundJobCollabPavilion(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  warmGlowMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  pavilion: THREE.Group;
  hitProxy: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const pavilion = new THREE.Group();

  // Heritage Old-Style Job Centre Slotted Display Stand (Bottle-Green Enamel & Brass)
  const plinthGeo = new THREE.BoxGeometry(3.16, 0.1, 0.92);
  const postGeo = new THREE.BoxGeometry(0.15, 2.72, 0.15);
  const cabinetBackGeo = new THREE.BoxGeometry(2.86, 1.56, 0.12);
  const rackFaceGeo = new THREE.BoxGeometry(2.68, 1.42, 0.04);
  const brassRailGeo = new THREE.BoxGeometry(2.74, 0.035, 0.07);
  const ledgeGeo = new THREE.BoxGeometry(2.92, 0.08, 0.34);
  const signBoxGeo = new THREE.BoxGeometry(2.88, 0.64, 0.14);
  const hoodGeo = new THREE.BoxGeometry(3.12, 0.11, 0.64);
  const lampBarGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.1, 8);
  lampBarGeo.rotateZ(Math.PI / 2);
  const cardReliefGeo = new THREE.BoxGeometry(0.72, 0.56, 0.022);
  const pinGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10);
  pinGeo.rotateX(Math.PI / 2);
  const beaconPedestalGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.09, 12);
  const beaconFinialGeo = new THREE.OctahedronGeometry(0.18, 1);
  const hitProxyGeo = new THREE.BoxGeometry(3.25, 3.05, 1.25);

  const heritageGreenMat = new THREE.MeshStandardMaterial({
    color: '#0C3B24',
    roughness: 0.42,
    metalness: 0.28,
  });
  const rackFaceMat = new THREE.MeshStandardMaterial({
    map: textures.jobCardRackFace,
    roughness: 0.38,
    metalness: 0.05,
  });
  const creamSlipMat = new THREE.MeshStandardMaterial({
    color: '#FFFDF5',
    roughness: 0.82,
    metalness: 0.02,
  });
  const mintCollabSlipMat = new THREE.MeshStandardMaterial({
    color: '#E6F9EE',
    roughness: 0.8,
    metalness: 0.02,
  });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.groundBoardSign,
    roughness: 0.28,
    metalness: 0.08,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#A8F5C4',
    emissive: '#34D399',
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.35,
  });
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    plinthGeo,
    postGeo,
    cabinetBackGeo,
    rackFaceGeo,
    brassRailGeo,
    ledgeGeo,
    signBoxGeo,
    hoodGeo,
    lampBarGeo,
    cardReliefGeo,
    pinGeo,
    beaconPedestalGeo,
    beaconFinialGeo,
    hitProxyGeo,
    heritageGreenMat,
    rackFaceMat,
    creamSlipMat,
    mintCollabSlipMat,
    signFaceMat,
    beaconMat,
    hitProxyMat
  );

  const plinth = new THREE.Mesh(plinthGeo, timberMat);
  plinth.position.set(0, 0.05, 0.12);
  plinth.receiveShadow = true;
  pavilion.add(plinth);

  [-1.38, 0, 1.38].forEach((px) => {
    const post = new THREE.Mesh(postGeo, heritageGreenMat);
    post.position.set(px, 1.36, 0);
    post.castShadow = true;
    pavilion.add(post);
  });

  const cabinetBack = new THREE.Mesh(cabinetBackGeo, heritageGreenMat);
  cabinetBack.position.set(0, 1.32, 0.03);
  cabinetBack.castShadow = true;

  const rackFace = new THREE.Mesh(rackFaceGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    rackFaceMat,
    ironMat,
  ]);
  rackFace.position.set(0, 1.32, 0.1);

  // Horizontal brass card-holder rails like a classic Jobcentre display rack
  [0.64, 1.31, 1.98].forEach((ry) => {
    const rail = new THREE.Mesh(brassRailGeo, brassMat);
    rail.position.set(0, ry, 0.125);
    pavilion.add(rail);
  });

  // Note-taking & slip shelf along bottom of board
  const slipLedge = new THREE.Mesh(ledgeGeo, timberMat);
  slipLedge.position.set(0, 0.56, 0.2);
  slipLedge.castShadow = true;

  // Subtle 3D relief cards & brass pins over the slotted rack
  [-0.86, 0, 0.86].forEach((cx, colIdx) => {
    [1.64, 0.99].forEach((cy, rowIdx) => {
      const pin = new THREE.Mesh(pinGeo, brassMat);
      pin.position.set(cx, cy + 0.24, 0.132);
      const relief = new THREE.Mesh(
        cardReliefGeo,
        (colIdx + rowIdx) % 2 === 1 ? mintCollabSlipMat : creamSlipMat
      );
      relief.position.set(cx, cy, 0.088);
      pavilion.add(relief, pin);
    });
  });

  const signBoard = new THREE.Mesh(signBoxGeo, [
    heritageGreenMat,
    heritageGreenMat,
    heritageGreenMat,
    heritageGreenMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 2.42, 0.06);
  signBoard.castShadow = true;

  const hood = new THREE.Mesh(hoodGeo, brassMat);
  hood.position.set(0, 2.8, 0.12);
  hood.rotation.x = 0.16;
  hood.castShadow = true;

  const readingLamp = new THREE.Mesh(lampBarGeo, warmGlowMat);
  readingLamp.position.set(0, 2.08, 0.24);

  const beaconPedestal = new THREE.Mesh(beaconPedestalGeo, brassMat);
  beaconPedestal.position.set(0, 2.89, 0.08);
  const beaconGem = new THREE.Mesh(beaconFinialGeo, beaconMat);
  beaconGem.position.set(0, 3.09, 0.08);

  const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  hitProxy.position.set(0, 1.54, 0.14);
  hitProxy.layers.set(1);
  hitProxy.userData = { sceneAction: 'open_job_board' };

  pavilion.add(
    cabinetBack,
    rackFace,
    slipLedge,
    signBoard,
    hood,
    readingLamp,
    beaconPedestal,
    beaconGem,
    hitProxy
  );

  return { pavilion, hitProxy, beaconMat };
}

export function createCanopyTreehouseGroup(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
  disposables: Array<{ dispose: () => void }>
): CanopySummitRig {
  const root = new THREE.Group();
  const baseY = 32.65;
  root.position.set(0, baseY, 0);

  // Customizable Non-Slip Secure Flooring Material
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.canopyFloorMaps.interlocking_oak,
    roughness: 0.72,
    metalness: 0.08,
  });

  // Customizable Perimeter Safety Curb & Hatch Trim Accent Material
  const trimAccentMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.24,
    metalness: 0.86,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.timberAlbedo,
    roughness: 0.74,
    metalness: 0.06,
  });
  const shingleMat = new THREE.MeshStandardMaterial({
    map: textures.shingleAlbedo,
    roughness: 0.85,
    metalness: 0.04,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#28302C',
    roughness: 0.4,
    metalness: 0.84,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.2,
    metalness: 0.9,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#FFE6B3',
    metalness: 0.05,
    roughness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.42 : 1.0,
    ior: 1.5,
    thickness: 0.35,
    depthWrite: false,
  });
  disposables.push(
    floorMat,
    trimAccentMat,
    timberMat,
    shingleMat,
    ironMat,
    brassMat,
    glassMat
  );

  // 1. Secure Enclosed Treehouse Deck ([=======]) surrounding the Lift Arrival Court on all 4 sides
  const backDeckGeo = new THREE.BoxGeometry(7.6, 0.34, 4.4);
  const sideWingGeo = new THREE.BoxGeometry(2.35, 0.34, 3.2);
  const frontBridgeGeo = new THREE.BoxGeometry(2.96, 0.34, 0.44);
  disposables.push(backDeckGeo, sideWingGeo, frontBridgeGeo);

  const backDeck = new THREE.Mesh(backDeckGeo, floorMat);
  backDeck.position.set(0, 0, -1.05);
  backDeck.castShadow = true;
  backDeck.receiveShadow = true;

  const leftWing = new THREE.Mesh(sideWingGeo, floorMat);
  leftWing.position.set(-2.62, 0, 2.35);
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;

  const rightWing = new THREE.Mesh(sideWingGeo, floorMat);
  rightWing.position.set(2.62, 0, 2.35);
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;

  const frontBridge = new THREE.Mesh(frontBridgeGeo, floorMat);
  frontBridge.position.set(0, 0, 3.73);
  frontBridge.castShadow = true;
  frontBridge.receiveShadow = true;

  root.add(backDeck, leftWing, rightWing, frontBridge);

  // 1B. Raised Perimeter Toe-Kick Curbs & Lift Bay Safety Coaming (Zero Slip / Zero Drop)
  const baySideCurbGeo = new THREE.BoxGeometry(0.1, 0.1, 2.42);
  const bayFrontBackCurbGeo = new THREE.BoxGeometry(2.96, 0.1, 0.1);
  const outerFrontTrimGeo = new THREE.BoxGeometry(7.62, 0.12, 0.1);
  disposables.push(baySideCurbGeo, bayFrontBackCurbGeo, outerFrontTrimGeo);

  const curbBayL = new THREE.Mesh(baySideCurbGeo, trimAccentMat);
  curbBayL.position.set(-1.43, 0.22, 2.34);
  const curbBayR = new THREE.Mesh(baySideCurbGeo, trimAccentMat);
  curbBayR.position.set(1.43, 0.22, 2.34);
  const curbBayBack = new THREE.Mesh(bayFrontBackCurbGeo, trimAccentMat);
  curbBayBack.position.set(0, 0.22, 1.13);
  const curbBayFront = new THREE.Mesh(bayFrontBackCurbGeo, trimAccentMat);
  curbBayFront.position.set(0, 0.22, 3.54);
  const outerFrontTrim = new THREE.Mesh(outerFrontTrimGeo, trimAccentMat);
  outerFrontTrim.position.set(0, 0.16, 3.96);

  root.add(curbBayL, curbBayR, curbBayBack, curbBayFront, outerFrontTrim);

  // 1C. Sliding Interlocking Secure Floor Hatch Leaves + Protective Lift Bay Latch Bar
  const hatchLeafGeo = new THREE.BoxGeometry(1.42, 0.14, 2.34);
  const hatchEdgeGeo = new THREE.BoxGeometry(0.06, 0.16, 2.36);
  disposables.push(hatchLeafGeo, hatchEdgeGeo);

  const hatchLeafLeft = new THREE.Group();
  hatchLeafLeft.position.set(-0.72, 0.08, 2.34);
  const leafMeshL = new THREE.Mesh(hatchLeafGeo, floorMat);
  leafMeshL.receiveShadow = true;
  const leafEdgeL = new THREE.Mesh(hatchEdgeGeo, trimAccentMat);
  leafEdgeL.position.set(0.7, 0.01, 0);
  hatchLeafLeft.add(leafMeshL, leafEdgeL);

  const hatchLeafRight = new THREE.Group();
  hatchLeafRight.position.set(0.72, 0.08, 2.34);
  const leafMeshR = new THREE.Mesh(hatchLeafGeo, floorMat);
  leafMeshR.receiveShadow = true;
  const leafEdgeR = new THREE.Mesh(hatchEdgeGeo, trimAccentMat);
  leafEdgeR.position.set(-0.7, 0.01, 0);
  hatchLeafRight.add(leafMeshR, leafEdgeR);

  // Articulated Safety Gate Bar guarding the Lift shaft from the Trade Area floor
  const gatePostGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.96, 10);
  const gateBarGeo = new THREE.BoxGeometry(2.86, 0.09, 0.09);
  disposables.push(gatePostGeo, gateBarGeo);

  const gatePostL = new THREE.Mesh(gatePostGeo, ironMat);
  gatePostL.position.set(-1.43, 0.65, 1.13);
  const gatePostR = new THREE.Mesh(gatePostGeo, ironMat);
  gatePostR.position.set(1.43, 0.65, 1.13);
  root.add(gatePostL, gatePostR);

  const safetyGateBar = new THREE.Group();
  safetyGateBar.position.set(-1.43, 1.04, 1.13);
  const gateRailMesh = new THREE.Mesh(gateBarGeo, trimAccentMat);
  gateRailMesh.position.set(1.43, 0, 0);
  gateRailMesh.castShadow = true;
  safetyGateBar.add(gateRailMesh);

  root.add(hatchLeafLeft, hatchLeafRight, safetyGateBar);

  // 2. Angled Timber Knee-Braces anchoring platform to trunk
  const braceGeo = new THREE.BoxGeometry(0.24, 3.9, 0.24);
  disposables.push(braceGeo);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.52;
    const brace = new THREE.Mesh(braceGeo, timberMat);
    brace.position.set(Math.sin(a) * 2.3, -1.65, Math.cos(a) * 2.1);
    brace.lookAt(0, -3.5, 0);
    brace.rotateX(Math.PI / 2);
    brace.castShadow = true;
    root.add(brace);
  }

  // 3. Safe Enclosed Walls, Full Perimeter Guardrails & Warm Windows
  const wallPostGeo = new THREE.BoxGeometry(0.22, 2.9, 0.22);
  const sideWallGeo = new THREE.BoxGeometry(0.16, 1.25, 6.9);
  const backWallGeo = new THREE.BoxGeometry(7.5, 1.25, 0.16);
  const frontRailWingGeo = new THREE.BoxGeometry(2.3, 1.08, 0.16);
  const frontCenterRailGeo = new THREE.BoxGeometry(2.96, 1.08, 0.14);
  const windowPaneGeo = new THREE.BoxGeometry(0.08, 1.35, 4.8);
  disposables.push(
    wallPostGeo,
    sideWallGeo,
    backWallGeo,
    frontRailWingGeo,
    frontCenterRailGeo,
    windowPaneGeo
  );

  [
    [-3.68, -3.1],
    [3.68, -3.1],
    [-3.68, 3.88],
    [3.68, 3.88],
    [-1.48, 3.88],
    [1.48, 3.88],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(wallPostGeo, timberMat);
    post.position.set(px, 1.55, pz);
    post.castShadow = true;
    root.add(post);
  });

  const leftWall = new THREE.Mesh(sideWallGeo, timberMat);
  leftWall.position.set(-3.68, 0.72, 0.42);
  leftWall.castShadow = true;
  const rightWall = new THREE.Mesh(sideWallGeo, timberMat);
  rightWall.position.set(3.68, 0.72, 0.42);
  rightWall.castShadow = true;
  const backWall = new THREE.Mesh(backWallGeo, timberMat);
  backWall.position.set(0, 0.72, -3.1);
  backWall.castShadow = true;

  const frontRailL = new THREE.Mesh(frontRailWingGeo, timberMat);
  frontRailL.position.set(-2.6, 0.68, 3.88);
  const frontRailR = new THREE.Mesh(frontRailWingGeo, timberMat);
  frontRailR.position.set(2.6, 0.68, 3.88);
  const frontRailCenter = new THREE.Mesh(frontCenterRailGeo, trimAccentMat);
  frontRailCenter.position.set(0, 0.68, 3.9);

  const leftGlass = new THREE.Mesh(windowPaneGeo, glassMat);
  leftGlass.position.set(-3.68, 2.02, 0.35);
  leftGlass.renderOrder = 4;
  const rightGlass = new THREE.Mesh(windowPaneGeo, glassMat);
  rightGlass.position.set(3.68, 2.02, 0.35);
  rightGlass.renderOrder = 4;

  root.add(
    leftWall,
    rightWall,
    backWall,
    frontRailL,
    frontRailR,
    frontRailCenter,
    leftGlass,
    rightGlass
  );

  // 4. Personal Trade Area Studio Booth (Back Studio Wall + Left Exchange Counter + Right Mastery Pedestal)
  const studioBooth = new THREE.Group();
  studioBooth.position.set(0, 0.17, -2.35);

  const boothBenchGeo = new THREE.BoxGeometry(3.4, 0.88, 0.92);
  const boothTopGeo = new THREE.BoxGeometry(3.56, 0.1, 1.04);
  const pegboardGeo = new THREE.BoxGeometry(3.3, 1.25, 0.08);
  const studioSignGeo = new THREE.BoxGeometry(3.36, 0.82, 0.12);
  const studioSignMat = new THREE.MeshStandardMaterial({
    map: textures.canopyStudioSign,
    roughness: 0.3,
    metalness: 0.08,
  });
  disposables.push(
    boothBenchGeo,
    boothTopGeo,
    pegboardGeo,
    studioSignGeo,
    studioSignMat
  );

  const boothBody = new THREE.Mesh(boothBenchGeo, timberMat);
  boothBody.position.set(0, 0.44, 0);
  boothBody.castShadow = true;
  boothBody.receiveShadow = true;

  const boothCounterTop = new THREE.Mesh(boothTopGeo, trimAccentMat);
  boothCounterTop.position.set(0, 0.92, 0);
  boothCounterTop.castShadow = true;

  const pegboard = new THREE.Mesh(pegboardGeo, ironMat);
  pegboard.position.set(0, 1.56, -0.58);

  const studioSignMesh = new THREE.Mesh(studioSignGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    studioSignMat,
    studioSignMat,
  ]);
  studioSignMesh.position.set(0, 2.52, -0.54);
  studioSignMesh.castShadow = true;

  studioBooth.add(boothBody, boothCounterTop, pegboard, studioSignMesh);

  // Layer 1 Interactive HitProxy on Personal Trade Studio Booth for Upstairs Customisation
  const studioHitGeo = new THREE.BoxGeometry(3.6, 2.95, 1.35);
  const studioHitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(studioHitGeo, studioHitMat);
  const canopyStudioHitProxy = new THREE.Mesh(studioHitGeo, studioHitMat);
  canopyStudioHitProxy.position.set(0, 1.5, -0.15);
  canopyStudioHitProxy.layers.set(1);
  canopyStudioHitProxy.userData.sceneAction = 'open_canopy_customizer';
  studioBooth.add(canopyStudioHitProxy);

  // Specialty Display Props on the Personal Trade Booth Counter
  const tradeFocusProps = createTradeSpecialtyProps(
    timberMat,
    ironMat,
    brassMat,
    disposables
  );
  Object.values(tradeFocusProps).forEach((propGrp) => {
    propGrp.position.set(0, 0.97, 0.05);
    studioBooth.add(propGrp);
  });

  root.add(studioBooth);

  // Side Exchange Counter (Left Wing) & Dedicated 33m Canopy PayPal Maker Storefront (Right Wing)
  const counterGeo = new THREE.BoxGeometry(1.4, 0.9, 0.75);
  disposables.push(counterGeo);

  const tradeCounter = new THREE.Mesh(counterGeo, timberMat);
  tradeCounter.position.set(-2.55, 0.58, 2.1);
  tradeCounter.castShadow = true;
  root.add(tradeCounter);

  const {
    stallGroup: canopyPaypalStall,
    hitProxy: canopyStoreHitProxy,
    beaconMat: canopyStoreBeaconMat,
  } = createCanopyPaypalStoreStall(
    textures,
    timberMat,
    ironMat,
    brassMat,
    disposables
  );
  canopyPaypalStall.position.set(2.45, 0.17, 1.85);
  canopyPaypalStall.rotation.y = -0.46;
  root.add(canopyPaypalStall);

  // 4B. Tools of the Trade Show & Tell Locker & Pegboard (Left Interior Alcove)
  const { rackGroup: toolsRackGroup, toolMeshes } = createToolsShowAndTellRack(
    timberMat,
    ironMat,
    brassMat,
    disposables
  );
  toolsRackGroup.position.set(-2.75, 0.17, -1.55);
  toolsRackGroup.rotation.y = 0.42;
  root.add(toolsRackGroup);

  // 4C. Player-Store Canopy Lanterns & Furnishings (Toggled Live as Purchased & Placed)
  const {
    furnishingGroup,
    furnishingMeshes,
    furnishingLight,
  } = createCanopyFurnishingsRig(
    timberMat,
    ironMat,
    brassMat,
    disposables
  );
  root.add(furnishingGroup);

  // 4D. Expanded Upper Treetop Mezzanine Gallery (y = +2.58m above Canopy Deck)
  // Includes: Safe Accessible Non-Slip Cushion Flooring, Enclosed Vertigo-Shield Parapets,
  // Welly Plushie Laundry Tub Relaxation Lounge, West Library Wing, East Refreshments Bar,
  // and 4 Private 1-Per-Person Sensory Chill Pods with Grab Bars & Interior Privacy Latches
  const {
    mezzanineGroup,
    mezzanineLight,
    tactileWayfindingMat,
    libraryHitProxy: mezzanineLibraryHitProxy,
    refreshmentsHitProxy: mezzanineRefreshmentsHitProxy,
    wellyTubHitProxy,
    wellyPlushieNodes,
    chillPods,
    chillPodHitProxies,
  } = createTreetopMezzanineRig(
    textures,
    floorMat,
    trimAccentMat,
    timberMat,
    ironMat,
    brassMat,
    isSoftwareGl,
    baseY,
    disposables
  );
  root.add(mezzanineGroup);

  // 5. Expanded High-Clearance Pitched Shingle Canopy & Mezzanine Roof (/ [=======] \)
  const roofGeo = new THREE.ConeGeometry(7.35, 2.65, 8);
  roofGeo.rotateY(Math.PI / 8);
  disposables.push(roofGeo);
  const roofMesh = new THREE.Mesh(roofGeo, shingleMat);
  roofMesh.position.set(0, 6.25, -0.25);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  root.add(roofMesh);

  // 6. Overhead Pulley Crown Beam & Rotating Top Sheave directly over (CABLE_X, y, CABLE_Z)
  const crownBeamGeo = new THREE.BoxGeometry(3.2, 0.26, 0.34);
  const crownGroup = new THREE.Group();
  crownGroup.position.set(CABLE_X, 3.55, CABLE_Z);

  const crownBeam = new THREE.Mesh(crownBeamGeo, ironMat);
  crownBeam.position.set(CABLE_X, 3.85, CABLE_Z);
  crownBeam.castShadow = true;
  root.add(crownBeam);

  const sheaveRimGeo = new THREE.TorusGeometry(0.42, 0.08, 12, 28);
  const sheaveHubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12);
  sheaveHubGeo.rotateZ(Math.PI / 2);
  disposables.push(crownBeamGeo, sheaveRimGeo, sheaveHubGeo);

  const sheaveRim = new THREE.Mesh(sheaveRimGeo, brassMat);
  sheaveRim.rotation.y = Math.PI / 2;
  const sheaveHub = new THREE.Mesh(sheaveHubGeo, ironMat);
  crownGroup.add(sheaveRim, sheaveHub);

  for (let sp = 0; sp < 4; sp++) {
    const spokeGeo = new THREE.BoxGeometry(0.05, 0.78, 0.05);
    disposables.push(spokeGeo);
    const spoke = new THREE.Mesh(spokeGeo, brassMat);
    spoke.rotation.x = (sp / 4) * Math.PI;
    crownGroup.add(spoke);
  }
  root.add(crownGroup);

  // 7. Three Summit Beacons (▲ ▲ ▲) atop the Expanded Mezzanine Roof Ridge
  const beacons: CanopySummitRig['beacons'] = [];
  const beaconConeGeo = new THREE.ConeGeometry(0.42, 0.96, 4);
  beaconConeGeo.rotateY(Math.PI / 4);
  const beaconBaseGeo = new THREE.CylinderGeometry(0.34, 0.42, 0.18, 8);
  disposables.push(beaconConeGeo, beaconBaseGeo);

  [-1.65, 0, 1.65].forEach((bx) => {
    const bBase = new THREE.Mesh(beaconBaseGeo, ironMat);
    bBase.position.set(bx, 7.32, 0.95);
    root.add(bBase);

    const bMat = new THREE.MeshStandardMaterial({
      color: '#46524B',
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: 0.28,
      metalness: 0.65,
    });
    disposables.push(bMat);

    const prism = new THREE.Mesh(beaconConeGeo, bMat);
    prism.position.set(bx, 7.88, 0.95);
    prism.castShadow = true;
    root.add(prism);

    const light = new THREE.PointLight('#FFB647', 0, 12, 2);
    light.position.set(bx, 8.15, 1.25);
    root.add(light);

    beacons.push({ prism, mat: bMat, light });
  });

  return {
    root,
    crownSheave: crownGroup,
    roofMesh,
    shingleMat,
    floorMat,
    trimAccentMat,
    tactileWayfindingMat,
    hatchLeafLeft,
    hatchLeafRight,
    safetyGateBar,
    tradeFocusProps,
    toolMeshes,
    furnishingMeshes,
    furnishingLight,
    mezzanineLight,
    canopyStoreHitProxy,
    canopyStoreBeaconMat,
    canopyStudioHitProxy,
    mezzanineLibraryHitProxy,
    mezzanineRefreshmentsHitProxy,
    wellyTubHitProxy,
    wellyPlushieNodes,
    chillPods,
    chillPodHitProxies,
    beacons,
  };
}

function createSingleWellyPlushie(
  bootHex: string,
  cuffHex: string,
  accentHex: string,
  disposables: Array<{ dispose: () => void }>
): {
  plushieGroup: THREE.Group;
  bootMat: THREE.MeshStandardMaterial;
} {
  const plushieGroup = new THREE.Group();

  // Ultra-matte soft fleece / sherpa plushie materials (roughness >= 0.92, zero metallic glare)
  const bootMat = new THREE.MeshStandardMaterial({
    color: bootHex,
    roughness: 0.94,
    metalness: 0.01,
  });
  const cuffSherpaMat = new THREE.MeshStandardMaterial({
    color: cuffHex,
    roughness: 0.98,
    metalness: 0.0,
  });
  const soleSoftMat = new THREE.MeshStandardMaterial({
    color: '#3B2F2A',
    roughness: 0.92,
    metalness: 0.02,
  });
  const accentSoftMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const eyeStitchMat = new THREE.MeshStandardMaterial({
    color: '#191412',
    roughness: 0.45,
    metalness: 0.08,
  });
  const rosyCheekMat = new THREE.MeshStandardMaterial({
    color: '#F497A9',
    roughness: 0.92,
    metalness: 0.0,
  });

  const soleGeo = new THREE.CapsuleGeometry(0.068, 0.11, 6, 12);
  soleGeo.rotateX(Math.PI / 2);
  const vampGeo = new THREE.CapsuleGeometry(0.074, 0.115, 8, 14);
  vampGeo.rotateX(Math.PI / 2);
  const shaftGeo = new THREE.CylinderGeometry(0.076, 0.072, 0.22, 14);
  const sherpaCuffGeo = new THREE.TorusGeometry(0.076, 0.026, 10, 18);
  sherpaCuffGeo.rotateX(Math.PI / 2);
  const bucklePatchGeo = new THREE.BoxGeometry(0.022, 0.036, 0.055);
  const eyeGeo = new THREE.SphereGeometry(0.012, 8, 8);
  const cheekGeo = new THREE.SphereGeometry(0.015, 8, 8);

  disposables.push(
    bootMat,
    cuffSherpaMat,
    soleSoftMat,
    accentSoftMat,
    eyeStitchMat,
    rosyCheekMat,
    soleGeo,
    vampGeo,
    shaftGeo,
    sherpaCuffGeo,
    bucklePatchGeo,
    eyeGeo,
    cheekGeo
  );

  // 1. Soft quilted plush sole
  const sole = new THREE.Mesh(soleGeo, soleSoftMat);
  sole.position.set(0, 0.035, 0.025);
  sole.scale.set(1.06, 0.52, 1.05);
  plushieGroup.add(sole);

  // 2. Plump huggable Welly foot vamp
  const vamp = new THREE.Mesh(vampGeo, bootMat);
  vamp.position.set(0, 0.085, 0.035);
  vamp.scale.set(1.08, 0.92, 1.04);
  vamp.castShadow = true;
  plushieGroup.add(vamp);

  // 3. Soft rounded Welly plush shaft
  const shaft = new THREE.Mesh(shaftGeo, bootMat);
  shaft.position.set(0, 0.19, -0.02);
  shaft.rotation.x = 0.05;
  shaft.castShadow = true;
  plushieGroup.add(shaft);

  // 4. Fluffy cream sherpa-fleece top cuff
  const cuff = new THREE.Mesh(sherpaCuffGeo, cuffSherpaMat);
  cuff.position.set(0, 0.3, -0.015);
  plushieGroup.add(cuff);

  // 5. Felt Welly side buckle tab
  const buckle = new THREE.Mesh(bucklePatchGeo, accentSoftMat);
  buckle.position.set(0.075, 0.24, -0.01);
  plushieGroup.add(buckle);

  // 6. Friendly stitched button eyes & rosy plushie cheeks on front of shaft/toe
  [-0.026, 0.026].forEach((ex) => {
    const eye = new THREE.Mesh(eyeGeo, eyeStitchMat);
    eye.position.set(ex, 0.215, 0.052);
    plushieGroup.add(eye);
  });
  [-0.044, 0.044].forEach((cx) => {
    const cheek = new THREE.Mesh(cheekGeo, rosyCheekMat);
    cheek.position.set(cx, 0.192, 0.048);
    cheek.scale.set(1.1, 0.75, 0.55);
    plushieGroup.add(cheek);
  });

  return { plushieGroup, bootMat };
}

function createWellyPlushieLaundryTubRig(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  loungeGroup: THREE.Group;
  hitProxy: THREE.Mesh;
  plushieNodes: THREE.Group[];
} {
  const loungeGroup = new THREE.Group();

  // 1. Super-Welcoming Braided Oval Sanctuary Rug + Floor Cushions (grounded at y = 0)
  const rugOuterGeo = new THREE.CylinderGeometry(1.18, 1.2, 0.018, 28);
  const rugMiddleGeo = new THREE.CylinderGeometry(0.94, 0.95, 0.022, 28);
  const rugCenterGeo = new THREE.CylinderGeometry(0.68, 0.69, 0.026, 28);
  const pouffeGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.13, 18);
  const pouffeButtonGeo = new THREE.SphereGeometry(0.035, 10, 8);

  // 2. Vintage Clothes-Type Washing Laundry Tub Geometries (Oval Flared Ribbed Wash-Tub)
  const tubWallGeo = new THREE.CylinderGeometry(0.56, 0.44, 0.42, 24, 1, true);
  const tubBottomGeo = new THREE.CircleGeometry(0.44, 24);
  tubBottomGeo.rotateX(-Math.PI / 2);
  const tubFleeceBedGeo = new THREE.CylinderGeometry(0.49, 0.42, 0.16, 22);
  const tubRimGeo = new THREE.TorusGeometry(0.56, 0.028, 10, 28);
  tubRimGeo.rotateX(Math.PI / 2);
  const tubRibHoopGeo = new THREE.TorusGeometry(0.515, 0.013, 8, 26);
  tubRibHoopGeo.rotateX(Math.PI / 2);
  const tubLowerHoopGeo = new THREE.TorusGeometry(0.475, 0.013, 8, 26);
  tubLowerHoopGeo.rotateX(Math.PI / 2);
  const handleArchGeo = new THREE.TorusGeometry(0.085, 0.016, 8, 14, Math.PI);
  const handleWoodGripGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.09, 10);
  const drapedTowelGeo = new THREE.BoxGeometry(0.34, 0.18, 0.08);
  const washboardFrameGeo = new THREE.BoxGeometry(0.36, 0.48, 0.04);
  const washboardCrimpGeo = new THREE.BoxGeometry(0.28, 0.24, 0.048);
  const signPostGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.86, 8);
  const signPlaqueGeo = new THREE.BoxGeometry(1.18, 0.32, 0.06);
  const hitProxyGeo = new THREE.BoxGeometry(2.15, 1.35, 1.45);

  const rugGoldMat = new THREE.MeshStandardMaterial({
    color: '#D9A752',
    roughness: 0.92,
    metalness: 0.02,
  });
  const rugSageMat = new THREE.MeshStandardMaterial({
    color: '#3E6850',
    roughness: 0.94,
    metalness: 0.01,
  });
  const rugCreamMat = new THREE.MeshStandardMaterial({
    color: '#EFE6D2',
    roughness: 0.95,
    metalness: 0.01,
  });
  const pouffeRoseMat = new THREE.MeshStandardMaterial({
    color: '#C97A63',
    roughness: 0.92,
    metalness: 0.01,
  });
  const tubEnamelMintMat = new THREE.MeshStandardMaterial({
    color: '#CFE8DC',
    roughness: 0.36,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });
  const tubZincBandMat = new THREE.MeshStandardMaterial({
    color: '#94A3B8',
    roughness: 0.34,
    metalness: 0.68,
  });
  const waffleBlanketMat = new THREE.MeshStandardMaterial({
    color: '#FAF2E1',
    roughness: 0.96,
    metalness: 0.01,
  });
  const tubSignFaceMat = new THREE.MeshStandardMaterial({
    map: textures.mezzaninePlushieTubSign,
    roughness: 0.28,
    metalness: 0.06,
  });
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    rugOuterGeo,
    rugMiddleGeo,
    rugCenterGeo,
    pouffeGeo,
    pouffeButtonGeo,
    tubWallGeo,
    tubBottomGeo,
    tubFleeceBedGeo,
    tubRimGeo,
    tubRibHoopGeo,
    tubLowerHoopGeo,
    handleArchGeo,
    handleWoodGripGeo,
    drapedTowelGeo,
    washboardFrameGeo,
    washboardCrimpGeo,
    signPostGeo,
    signPlaqueGeo,
    hitProxyGeo,
    rugGoldMat,
    rugSageMat,
    rugCreamMat,
    pouffeRoseMat,
    tubEnamelMintMat,
    tubZincBandMat,
    waffleBlanketMat,
    tubSignFaceMat,
    hitProxyMat
  );

  // Braided oval rug on floor
  const rugOuter = new THREE.Mesh(rugOuterGeo, rugGoldMat);
  rugOuter.position.set(0, 0.009, 0);
  rugOuter.scale.set(1.28, 1, 0.84);
  rugOuter.receiveShadow = true;
  const rugMiddle = new THREE.Mesh(rugMiddleGeo, rugSageMat);
  rugMiddle.position.set(0, 0.012, 0);
  rugMiddle.scale.set(1.28, 1, 0.84);
  rugMiddle.receiveShadow = true;
  const rugCenter = new THREE.Mesh(rugCenterGeo, rugCreamMat);
  rugCenter.position.set(0, 0.015, 0);
  rugCenter.scale.set(1.28, 1, 0.84);
  rugCenter.receiveShadow = true;
  loungeGroup.add(rugOuter, rugMiddle, rugCenter);

  // Soft floor cushions beside the laundry tub for sitting & hugging plushies
  [
    { x: -1.05, z: 0.14, mat: pouffeRoseMat },
    { x: 1.05, z: 0.14, mat: rugCreamMat },
  ].forEach(({ x, z, mat }) => {
    const pouffe = new THREE.Mesh(pouffeGeo, mat);
    pouffe.position.set(x, 0.075, z);
    pouffe.castShadow = true;
    pouffe.receiveShadow = true;
    const tuft = new THREE.Mesh(pouffeButtonGeo, rugGoldMat);
    tuft.position.set(x, 0.142, z);
    loungeGroup.add(pouffe, tuft);
  });

  // Oval Clothes-Washing Laundry Tub Container
  const tubOvalGroup = new THREE.Group();
  tubOvalGroup.position.set(0, 0.02, -0.02);
  tubOvalGroup.scale.set(1.32, 1.0, 0.88);

  const tubWall = new THREE.Mesh(tubWallGeo, tubEnamelMintMat);
  tubWall.position.y = 0.21;
  tubWall.castShadow = true;
  tubWall.receiveShadow = true;
  const tubBottom = new THREE.Mesh(tubBottomGeo, tubZincBandMat);
  tubBottom.position.y = 0.01;
  const fleeceBed = new THREE.Mesh(tubFleeceBedGeo, waffleBlanketMat);
  fleeceBed.position.y = 0.14;
  const topRim = new THREE.Mesh(tubRimGeo, brassMat);
  topRim.position.y = 0.42;
  const midHoop = new THREE.Mesh(tubRibHoopGeo, tubZincBandMat);
  midHoop.position.y = 0.27;
  const lowHoop = new THREE.Mesh(tubLowerHoopGeo, tubZincBandMat);
  lowHoop.position.y = 0.14;

  tubOvalGroup.add(tubWall, tubBottom, fleeceBed, topRim, midHoop, lowHoop);

  // Twin side laundry tub handles with turned wooden grips
  [-1, 1].forEach((side) => {
    const hArch = new THREE.Mesh(handleArchGeo, tubZincBandMat);
    hArch.position.set(side * 0.54, 0.34, 0);
    hArch.rotation.y = Math.PI / 2;
    hArch.rotation.x = side * 0.35;
    const wGrip = new THREE.Mesh(handleWoodGripGeo, timberMat);
    wGrip.position.set(side * 0.59, 0.37, 0);
    wGrip.rotation.x = Math.PI / 2;
    tubOvalGroup.add(hArch, wGrip);
  });

  // Cozy folded waffle-knit laundry towel draped over front-right lip of tub
  const drapedTowel = new THREE.Mesh(drapedTowelGeo, waffleBlanketMat);
  drapedTowel.position.set(0.24, 0.38, 0.52);
  drapedTowel.rotation.x = 0.26;
  drapedTowel.rotation.z = -0.08;
  drapedTowel.castShadow = true;
  tubOvalGroup.add(drapedTowel);

  // Decorative miniature cedar & zinc laundry washboard tucked gently at back-left of tub
  const washboardGroup = new THREE.Group();
  washboardGroup.position.set(-0.34, 0.38, -0.32);
  washboardGroup.rotation.set(-0.24, 0.22, 0.08);
  const wbFrame = new THREE.Mesh(washboardFrameGeo, timberMat);
  const wbCrimp = new THREE.Mesh(washboardCrimpGeo, tubZincBandMat);
  wbCrimp.position.y = 0.02;
  washboardGroup.add(wbFrame, wbCrimp);
  tubOvalGroup.add(washboardGroup);

  loungeGroup.add(tubOvalGroup);

  // 3. Five Welly-Themed Shoe Plushies Snuggled Happily in the Clothes-Washing Laundry Tub!
  const plushieSpecs = [
    {
      // Mossy Forest-Green Welly Plushie
      bootHex: '#2E7D4F',
      cuffHex: '#FAF3E3',
      accentHex: '#FFD166',
      pos: [-0.36, 0.23, 0.02] as [number, number, number],
      rot: [0.12, 0.28, 0.14] as [number, number, number],
      scale: 1.05,
    },
    {
      // Sunny Puddle-Yellow Welly Plushie
      bootHex: '#F4C430',
      cuffHex: '#FFFDF7',
      accentHex: '#2E7D4F',
      pos: [-0.04, 0.25, 0.08] as [number, number, number],
      rot: [0.08, -0.12, -0.08] as [number, number, number],
      scale: 1.12,
    },
    {
      // Bramble Heather-Berry Welly Plushie
      bootHex: '#9E4770',
      cuffHex: '#FCE7F3',
      accentHex: '#FFD166',
      pos: [0.34, 0.23, 0.0] as [number, number, number],
      rot: [0.14, -0.34, -0.15] as [number, number, number],
      scale: 1.04,
    },
    {
      // Oatie Weighted Cream Sherpa Welly Plushie
      bootHex: '#EADBC4',
      cuffHex: '#FFFDF9',
      accentHex: '#D99B38',
      pos: [0.18, 0.22, -0.18] as [number, number, number],
      rot: [-0.06, -0.18, 0.1] as [number, number, number],
      scale: 0.98,
    },
    {
      // Puddle Sky-Teal Mini Welly Plushie
      bootHex: '#3B8EA5',
      cuffHex: '#F0FDFA',
      accentHex: '#FFD166',
      pos: [-0.2, 0.22, -0.18] as [number, number, number],
      rot: [-0.08, 0.22, -0.1] as [number, number, number],
      scale: 0.95,
    },
  ];

  const plushieNodes: THREE.Group[] = [];
  plushieSpecs.forEach((sp) => {
    const { plushieGroup } = createSingleWellyPlushie(
      sp.bootHex,
      sp.cuffHex,
      sp.accentHex,
      disposables
    );
    plushieGroup.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    plushieGroup.rotation.set(sp.rot[0], sp.rot[1], sp.rot[2]);
    plushieGroup.scale.setScalar(sp.scale);
    plushieGroup.userData.baseY = sp.pos[1];
    loungeGroup.add(plushieGroup);
    plushieNodes.push(plushieGroup);
  });

  // Low-glare welcoming wooden sign post behind the Laundry Tub
  const signPost = new THREE.Mesh(signPostGeo, timberMat);
  signPost.position.set(0, 0.43, -0.52);
  const signBoard = new THREE.Mesh(signPlaqueGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    tubSignFaceMat,
    tubSignFaceMat,
  ]);
  signBoard.position.set(0, 0.82, -0.52);
  signBoard.castShadow = true;
  loungeGroup.add(signPost, signBoard);

  // Layer 1 Interactive HitProxy for tapping the Welly Plushie Laundry Tub
  const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
  hitProxy.position.set(0, 0.58, 0);
  hitProxy.layers.set(1);
  hitProxy.userData = { sceneAction: 'open_plushie_tub' };
  loungeGroup.add(hitProxy);

  return { loungeGroup, hitProxy, plushieNodes };
}

function createTreetopMezzanineRig(
  textures: ProceduralTextureSet,
  _floorMat: THREE.Material,
  trimAccentMat: THREE.Material,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  isSoftwareGl: boolean,
  canopyBaseY: number,
  disposables: Array<{ dispose: () => void }>
): {
  mezzanineGroup: THREE.Group;
  mezzanineLight: THREE.PointLight;
  tactileWayfindingMat: THREE.MeshStandardMaterial;
  libraryHitProxy: THREE.Mesh;
  refreshmentsHitProxy: THREE.Mesh;
  wellyTubHitProxy: THREE.Mesh;
  wellyPlushieNodes: THREE.Group[];
  chillPods: Record<ChillPodId, ChillPodRigNode>;
  chillPodHitProxies: THREE.Mesh[];
} {
  const mezzanineGroup = new THREE.Group();
  const mezY = 2.58; // Raised U-gallery 2.58m above Canopy Workshop deck (top floor surface = mezY + 0.12)
  const floorTopY = mezY + 0.12;

  // ---------------------------------------------------------------------------
  // 1. SAFE ACCESSIBLE FLOORING & ENCLOSED VERTIGO-SHIELD ARCHITECTURE
  // Designed for physical impairment (step-free, wide wheelchair turning, grab rails),
  // visual impairment (matte zero-glare surface, >70 LRV contrast edges & tactile strips),
  // and neurobiological safety (zero open height drops, solid 1.18m parapets, safe sightlines).
  // ---------------------------------------------------------------------------
  const colGeo = new THREE.CylinderGeometry(0.13, 0.15, mezY, 12);
  // Seamless flush edge-to-edge U-decking (zero coplanar overlap, zero floor gaps!)
  const northPodDeckGeo = new THREE.BoxGeometry(9.44, 0.28, 3.54);
  const sideWingDeckGeo = new THREE.BoxGeometry(2.55, 0.28, 3.28);
  const soffitBeamGeo = new THREE.BoxGeometry(9.48, 0.14, 0.22);

  // Solid 1.18m Vertigo-Shield Perimeter Parapet Walls (eliminates fear-of-heights look-down gaps)
  const backParapetWallGeo = new THREE.BoxGeometry(9.44, 1.22, 0.16);
  const sideParapetWallGeo = new THREE.BoxGeometry(0.16, 1.22, 6.82);
  const wingEndParapetGeo = new THREE.BoxGeometry(2.55, 1.16, 0.16);
  const innerSolidWainscotGeo = new THREE.BoxGeometry(4.36, 0.88, 0.16);
  const innerFrostedScreenGeo = new THREE.BoxGeometry(4.32, 0.28, 0.06);
  const innerSideReturnWallGeo = new THREE.BoxGeometry(0.16, 1.08, 3.24);

  // Continuous Rounded Warm-Brass Mobility Handrails & High-Contrast Toe-Kick Curbs
  const backHandrailGeo = new THREE.CylinderGeometry(0.042, 0.042, 9.44, 12);
  backHandrailGeo.rotateZ(Math.PI / 2);
  const sideHandrailGeo = new THREE.CylinderGeometry(0.042, 0.042, 6.82, 12);
  sideHandrailGeo.rotateX(Math.PI / 2);
  const innerHandrailGeo = new THREE.CylinderGeometry(0.045, 0.045, 4.38, 12);
  innerHandrailGeo.rotateZ(Math.PI / 2);
  const contrastEdgeLongGeo = new THREE.BoxGeometry(9.2, 0.016, 0.14);
  const contrastEdgeInnerGeo = new THREE.BoxGeometry(4.34, 0.016, 0.14);

  // Tactile Blister & Corduroy Wayfinding Strips (BS 8300 Low-Vision & Cane Guidance)
  const tactileSpineGeo = new THREE.BoxGeometry(7.2, 0.018, 0.22);
  const tactilePodSpurGeo = new THREE.BoxGeometry(0.24, 0.018, 0.68);
  const tactileWingSpurGeo = new THREE.BoxGeometry(0.22, 0.018, 1.85);
  const tactileBlisterPadGeo = new THREE.BoxGeometry(0.92, 0.022, 0.32);

  // Step-Free Gently Graded Non-Slip Mobility Ramp + Solid Enclosed Side Balustrades
  const rampLength = 3.68;
  const rampRise = mezY - 0.06;
  const rampAngle = Math.atan2(rampRise, 2.72);
  const rampDeckGeo = new THREE.BoxGeometry(1.06, 0.14, rampLength);
  const rampSideWallGeo = new THREE.BoxGeometry(0.1, 0.78, rampLength);
  const rampHandrailGeo = new THREE.CylinderGeometry(0.036, 0.036, rampLength, 10);
  rampHandrailGeo.rotateX(Math.PI / 2);

  const signGeo = new THREE.BoxGeometry(2.38, 0.56, 0.1);

  // Matte Zero-Glare Cushion-Cork & Sage Non-Slip Sanctuary Floor Material
  const chillSanctuaryMat = new THREE.MeshStandardMaterial({
    map: textures.chillSanctuaryFloor,
    roughness: 0.9,
    metalness: 0.01,
  });
  const highContrastBorderMat = new THREE.MeshStandardMaterial({
    color: '#101A14',
    roughness: 0.86,
    metalness: 0.02,
  });
  const tactileWayfindingMat = new THREE.MeshStandardMaterial({
    color: '#FFE066',
    emissive: '#D99B26',
    emissiveIntensity: 0.32,
    roughness: 0.68,
    metalness: 0.08,
  });
  const frostedSafetyScreenMat = new THREE.MeshPhysicalMaterial({
    color: '#E6F4EC',
    roughness: 0.35,
    metalness: 0.02,
    transmission: isSoftwareGl ? 0 : 0.45,
    transparent: true,
    opacity: isSoftwareGl ? 0.58 : 0.82,
    depthWrite: false,
  });
  const cedarWarmMat = new THREE.MeshStandardMaterial({
    color: '#9C5E38',
    roughness: 0.64,
    metalness: 0.05,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: '#D47A46',
    roughness: 0.26,
    metalness: 0.84,
  });
  const glassJugMat = new THREE.MeshStandardMaterial({
    color: '#CBEFF6',
    emissive: '#38BDF8',
    emissiveIntensity: 0.18,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
  });
  const creamMugMat = new THREE.MeshStandardMaterial({
    color: '#FAF3E3',
    roughness: 0.45,
    metalness: 0.04,
  });
  const bookRedMat = new THREE.MeshStandardMaterial({ color: '#8F322A', roughness: 0.72 });
  const bookGreenMat = new THREE.MeshStandardMaterial({ color: '#285943', roughness: 0.72 });
  const bookNavyMat = new THREE.MeshStandardMaterial({ color: '#274469', roughness: 0.72 });
  const bookGoldMat = new THREE.MeshStandardMaterial({ color: '#B88328', roughness: 0.65 });
  const bankerLampMat = new THREE.MeshStandardMaterial({
    color: '#34D399',
    emissive: '#10B981',
    emissiveIntensity: 0.65,
    roughness: 0.25,
  });

  const libSignMat = new THREE.MeshStandardMaterial({
    map: textures.mezzanineLibrarySign,
    roughness: 0.3,
    metalness: 0.08,
  });
  const refSignMat = new THREE.MeshStandardMaterial({
    map: textures.mezzanineRefreshmentsSign,
    roughness: 0.3,
    metalness: 0.08,
  });
  const podsSignMat = new THREE.MeshStandardMaterial({
    map: textures.mezzanineChillPodsSign,
    roughness: 0.3,
    metalness: 0.08,
  });
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    colGeo,
    northPodDeckGeo,
    sideWingDeckGeo,
    soffitBeamGeo,
    backParapetWallGeo,
    sideParapetWallGeo,
    wingEndParapetGeo,
    innerSolidWainscotGeo,
    innerFrostedScreenGeo,
    innerSideReturnWallGeo,
    backHandrailGeo,
    sideHandrailGeo,
    innerHandrailGeo,
    contrastEdgeLongGeo,
    contrastEdgeInnerGeo,
    tactileSpineGeo,
    tactilePodSpurGeo,
    tactileWingSpurGeo,
    tactileBlisterPadGeo,
    rampDeckGeo,
    rampSideWallGeo,
    rampHandrailGeo,
    signGeo,
    chillSanctuaryMat,
    highContrastBorderMat,
    tactileWayfindingMat,
    frostedSafetyScreenMat,
    cedarWarmMat,
    copperMat,
    glassJugMat,
    creamMugMat,
    bookRedMat,
    bookGreenMat,
    bookNavyMat,
    bookGoldMat,
    bankerLampMat,
    libSignMat,
    refSignMat,
    podsSignMat,
    hitProxyMat
  );

  // Sturdy Grounded Support Columns
  [
    [-4.15, -4.25],
    [4.15, -4.25],
    [-4.15, 1.45],
    [4.15, 1.45],
    [-2.18, -1.52],
    [2.18, -1.52],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(colGeo, timberMat);
    col.position.set(cx, mezY / 2, cz);
    col.castShadow = true;
    mezzanineGroup.add(col);
  });

  // Seamless Flush Non-Slip Cushion-Cork Mezzanine Decking (Top Surface = floorTopY)
  const northPodDeck = new THREE.Mesh(northPodDeckGeo, chillSanctuaryMat);
  northPodDeck.position.set(0, mezY - 0.02, -3.19);
  northPodDeck.receiveShadow = true;
  northPodDeck.castShadow = true;

  const westLibDeck = new THREE.Mesh(sideWingDeckGeo, chillSanctuaryMat);
  westLibDeck.position.set(-3.445, mezY - 0.02, 0.22);
  westLibDeck.receiveShadow = true;
  westLibDeck.castShadow = true;

  const eastRefDeck = new THREE.Mesh(sideWingDeckGeo, chillSanctuaryMat);
  eastRefDeck.position.set(3.445, mezY - 0.02, 0.22);
  eastRefDeck.receiveShadow = true;
  eastRefDeck.castShadow = true;

  // Solid Under-Deck Structural Joist Beams so floor feels architectural & unshakeable
  [-4.65, -3.19, -1.52].forEach((bz) => {
    const beam = new THREE.Mesh(soffitBeamGeo, timberMat);
    beam.position.set(0, mezY - 0.21, bz);
    mezzanineGroup.add(beam);
  });

  mezzanineGroup.add(northPodDeck, westLibDeck, eastRefDeck);

  // High-Contrast (>70 LRV) Dark Edge Framing & Raised Tactile Wayfinding Guidance Network
  const backContrastStrip = new THREE.Mesh(contrastEdgeLongGeo, highContrastBorderMat);
  backContrastStrip.position.set(0, floorTopY + 0.008, -2.74);
  const innerContrastStrip = new THREE.Mesh(contrastEdgeInnerGeo, highContrastBorderMat);
  innerContrastStrip.position.set(0, floorTopY + 0.008, -1.56);
  mezzanineGroup.add(backContrastStrip, innerContrastStrip);

  const mainTactileSpine = new THREE.Mesh(tactileSpineGeo, tactileWayfindingMat);
  mainTactileSpine.position.set(0, floorTopY + 0.009, -2.42);
  mezzanineGroup.add(mainTactileSpine);

  [-3.44, 3.44].forEach((wx) => {
    const wingSpur = new THREE.Mesh(tactileWingSpurGeo, tactileWayfindingMat);
    wingSpur.position.set(wx, floorTopY + 0.009, -1.42);
    mezzanineGroup.add(wingSpur);
  });

  // Solid 1.18m Vertigo-Shield Perimeter Safety Parapet Walls + Continuous Grab Handrails
  const backParapet = new THREE.Mesh(backParapetWallGeo, cedarWarmMat);
  backParapet.position.set(0, floorTopY + 0.61, -4.88);
  backParapet.castShadow = true;

  const westParapet = new THREE.Mesh(sideParapetWallGeo, cedarWarmMat);
  westParapet.position.set(-4.68, floorTopY + 0.61, -1.52);
  westParapet.castShadow = true;

  const eastParapet = new THREE.Mesh(sideParapetWallGeo, cedarWarmMat);
  eastParapet.position.set(4.68, floorTopY + 0.61, -1.52);
  eastParapet.castShadow = true;

  const westFrontEndWall = new THREE.Mesh(wingEndParapetGeo, cedarWarmMat);
  westFrontEndWall.position.set(-3.445, floorTopY + 0.58, 1.82);
  const eastFrontEndWall = new THREE.Mesh(wingEndParapetGeo, cedarWarmMat);
  eastFrontEndWall.position.set(3.445, floorTopY + 0.58, 1.82);

  // Inner Atrium Overlook: Solid 0.88m Cedar Wainscot + Frosted Comfort Screen + Brass Grab Rail (Zero Open Drop!)
  const innerWainscot = new THREE.Mesh(innerSolidWainscotGeo, cedarWarmMat);
  innerWainscot.position.set(0, floorTopY + 0.44, -1.46);
  innerWainscot.castShadow = true;
  const innerFrosted = new THREE.Mesh(innerFrostedScreenGeo, frostedSafetyScreenMat);
  innerFrosted.position.set(0, floorTopY + 1.01, -1.46);
  innerFrosted.renderOrder = 3;

  const westInnerReturn = new THREE.Mesh(innerSideReturnWallGeo, cedarWarmMat);
  westInnerReturn.position.set(-2.22, floorTopY + 0.54, 0.2);
  const eastInnerReturn = new THREE.Mesh(innerSideReturnWallGeo, cedarWarmMat);
  eastInnerReturn.position.set(2.22, floorTopY + 0.54, 0.2);

  const backGrabRail = new THREE.Mesh(backHandrailGeo, trimAccentMat);
  backGrabRail.position.set(0, floorTopY + 1.24, -4.88);
  const westGrabRail = new THREE.Mesh(sideHandrailGeo, trimAccentMat);
  westGrabRail.position.set(-4.68, floorTopY + 1.24, -1.52);
  const eastGrabRail = new THREE.Mesh(sideHandrailGeo, trimAccentMat);
  eastGrabRail.position.set(4.68, floorTopY + 1.24, -1.52);
  const innerGrabRail = new THREE.Mesh(innerHandrailGeo, brassMat);
  innerGrabRail.position.set(0, floorTopY + 1.16, -1.46);

  mezzanineGroup.add(
    backParapet,
    westParapet,
    eastParapet,
    westFrontEndWall,
    eastFrontEndWall,
    innerWainscot,
    innerFrosted,
    westInnerReturn,
    eastInnerReturn,
    backGrabRail,
    westGrabRail,
    eastGrabRail,
    innerGrabRail
  );

  // Step-Free Enclosed Mobility Ramp connecting Canopy Deck -> Mezzanine (Zero Floating Step Gaps!)
  const mobilityRampGroup = new THREE.Group();
  mobilityRampGroup.position.set(-2.68, mezY * 0.5, 0.52);
  mobilityRampGroup.rotation.x = rampAngle;

  const rampDeck = new THREE.Mesh(rampDeckGeo, chillSanctuaryMat);
  rampDeck.castShadow = true;
  rampDeck.receiveShadow = true;
  mobilityRampGroup.add(rampDeck);

  [-0.52, 0.52].forEach((rx) => {
    const rWall = new THREE.Mesh(rampSideWallGeo, cedarWarmMat);
    rWall.position.set(rx, 0.39, 0);
    rWall.castShadow = true;
    const rRail = new THREE.Mesh(rampHandrailGeo, brassMat);
    rRail.position.set(rx, 0.8, 0);
    mobilityRampGroup.add(rWall, rRail);
  });
  mezzanineGroup.add(mobilityRampGroup);

  // ---------------------------------------------------------------------------
  // D. SUPER-WELCOMING RELAXATION AREA: WELLY PLUSHIES IN A CLOTHES-WASHING LAUNDRY TUB
  // Positioned right on the cushioned Chill Pods lounge floor!
  // ---------------------------------------------------------------------------
  const {
    loungeGroup: wellyTubLounge,
    hitProxy: wellyTubHitProxy,
    plushieNodes: wellyPlushieNodes,
  } = createWellyPlushieLaundryTubRig(
    textures,
    timberMat,
    ironMat,
    brassMat,
    disposables
  );
  wellyTubLounge.position.set(0, floorTopY, -2.02);
  mezzanineGroup.add(wellyTubLounge);

  // ---------------------------------------------------------------------------
  // A. WEST MEZZANINE LIBRARY WING (Bookcases, Brass Ladder, Reading Desk & Lamp)
  // ---------------------------------------------------------------------------
  const libraryWing = new THREE.Group();
  libraryWing.position.set(-3.55, floorTopY, -0.15);

  const bookcaseGeo = new THREE.BoxGeometry(0.46, 1.92, 2.56);
  const shelfPlankGeo = new THREE.BoxGeometry(0.48, 0.05, 2.48);
  const bookBlockGeo = new THREE.BoxGeometry(0.28, 0.32, 0.09);
  const deskGeo = new THREE.BoxGeometry(0.86, 0.72, 1.42);
  const lampStemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.32, 8);
  const lampShadeGeo = new THREE.CylinderGeometry(0.09, 0.14, 0.12, 10);
  const ladderRailGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.05, 8);
  const libHitGeo = new THREE.BoxGeometry(2.55, 2.6, 3.4);

  disposables.push(
    bookcaseGeo,
    shelfPlankGeo,
    bookBlockGeo,
    deskGeo,
    lampStemGeo,
    lampShadeGeo,
    ladderRailGeo,
    libHitGeo
  );

  const bookcase = new THREE.Mesh(bookcaseGeo, timberMat);
  bookcase.position.set(-0.78, 0.96, 0);
  bookcase.castShadow = true;
  libraryWing.add(bookcase);

  [0.42, 0.92, 1.42].forEach((sy, rIdx) => {
    const shelf = new THREE.Mesh(shelfPlankGeo, brassMat);
    shelf.position.set(-0.75, sy, 0);
    libraryWing.add(shelf);

    const mats = [bookRedMat, bookGreenMat, bookNavyMat, bookGoldMat];
    for (let b = -9; b <= 9; b += 2) {
      const book = new THREE.Mesh(
        bookBlockGeo,
        mats[Math.abs(b + rIdx) % mats.length]
      );
      book.position.set(-0.68, sy + 0.19, b * 0.11);
      book.rotation.x = (b % 3) * 0.03;
      libraryWing.add(book);
    }
  });

  // Brass library ladder secured against shelves
  [-0.16, 0.16].forEach((lz) => {
    const lRail = new THREE.Mesh(ladderRailGeo, brassMat);
    lRail.position.set(-0.42, 1.0, 0.65 + lz);
    lRail.rotation.z = -0.16;
    libraryWing.add(lRail);
  });

  // Wheelchair-accessible Reading Desk + Green Banker Lamp
  const readingDesk = new THREE.Mesh(deskGeo, cedarWarmMat);
  readingDesk.position.set(0.32, 0.36, -0.15);
  readingDesk.castShadow = true;
  const lampStem = new THREE.Mesh(lampStemGeo, brassMat);
  lampStem.position.set(0.32, 0.88, -0.45);
  const lampShade = new THREE.Mesh(lampShadeGeo, bankerLampMat);
  lampShade.position.set(0.32, 1.04, -0.45);
  libraryWing.add(readingDesk, lampStem, lampShade);

  const libSign = new THREE.Mesh(signGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    libSignMat,
    libSignMat,
  ]);
  libSign.position.set(-0.15, 2.28, 0);
  libSign.rotation.y = Math.PI / 2;
  libraryWing.add(libSign);

  const libraryHitProxy = new THREE.Mesh(libHitGeo, hitProxyMat);
  libraryHitProxy.position.set(-0.1, 1.25, 0);
  libraryHitProxy.layers.set(1);
  libraryHitProxy.userData = { sceneAction: 'open_mezzanine_library' };
  libraryWing.add(libraryHitProxy);

  mezzanineGroup.add(libraryWing);

  // ---------------------------------------------------------------------------
  // B. EAST MEZZANINE REFRESHMENTS BAR (Copper Tea Urn, Spring Water, Mugs & Stools)
  // ---------------------------------------------------------------------------
  const refreshmentsWing = new THREE.Group();
  refreshmentsWing.position.set(3.55, floorTopY, -0.15);

  const barCounterGeo = new THREE.BoxGeometry(0.88, 0.86, 2.48);
  const barTopGeo = new THREE.BoxGeometry(0.98, 0.08, 2.58);
  const urnBodyGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.52, 14);
  const urnLidGeo = new THREE.ConeGeometry(0.19, 0.14, 14);
  const waterDispenserGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.46, 14);
  const mugGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.11, 10);
  const trayGeo = new THREE.BoxGeometry(0.42, 0.04, 0.58);
  const stoolSeatGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 12);
  const stoolLegGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.54, 8);
  const refHitGeo = new THREE.BoxGeometry(2.55, 2.6, 3.4);

  disposables.push(
    barCounterGeo,
    barTopGeo,
    urnBodyGeo,
    urnLidGeo,
    waterDispenserGeo,
    mugGeo,
    trayGeo,
    stoolSeatGeo,
    stoolLegGeo,
    refHitGeo
  );

  // Lowered accessible tea counter height (0.88m)
  const barCounter = new THREE.Mesh(barCounterGeo, timberMat);
  barCounter.position.set(0.52, 0.43, 0);
  barCounter.castShadow = true;
  const barTop = new THREE.Mesh(barTopGeo, cedarWarmMat);
  barTop.position.set(0.52, 0.89, 0);
  refreshmentsWing.add(barCounter, barTop);

  const urnBody = new THREE.Mesh(urnBodyGeo, copperMat);
  urnBody.position.set(0.52, 1.19, -0.68);
  const urnLid = new THREE.Mesh(urnLidGeo, brassMat);
  urnLid.position.set(0.52, 1.51, -0.68);

  const waterJug = new THREE.Mesh(waterDispenserGeo, glassJugMat);
  waterJug.position.set(0.52, 1.16, 0.05);

  const oatTray = new THREE.Mesh(trayGeo, brassMat);
  oatTray.position.set(0.52, 0.95, 0.72);
  [-0.14, 0.0, 0.14].forEach((mz) => {
    const mug = new THREE.Mesh(mugGeo, creamMugMat);
    mug.position.set(0.52, 1.02, 0.72 + mz);
    refreshmentsWing.add(mug);
  });

  [-0.55, 0.55].forEach((sz) => {
    const sLeg = new THREE.Mesh(stoolLegGeo, ironMat);
    sLeg.position.set(-0.22, 0.27, sz);
    const sSeat = new THREE.Mesh(stoolSeatGeo, cedarWarmMat);
    sSeat.position.set(-0.22, 0.56, sz);
    refreshmentsWing.add(sLeg, sSeat);
  });

  const refSign = new THREE.Mesh(signGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    refSignMat,
    refSignMat,
  ]);
  refSign.position.set(0.15, 2.28, 0);
  refSign.rotation.y = -Math.PI / 2;

  const refreshmentsHitProxy = new THREE.Mesh(refHitGeo, hitProxyMat);
  refreshmentsHitProxy.position.set(0.1, 1.25, 0);
  refreshmentsHitProxy.layers.set(1);
  refreshmentsHitProxy.userData = { sceneAction: 'open_mezzanine_refreshments' };

  refreshmentsWing.add(
    urnBody,
    urnLid,
    waterJug,
    oatTray,
    refSign,
    refreshmentsHitProxy
  );
  mezzanineGroup.add(refreshmentsWing);

  // ---------------------------------------------------------------------------
  // C. NORTH MEZZANINE PRIVATE SENSORY CHILL PODS (4 Pods · Strictly 1 Per Person)
  // Step-Free Bevelled Thresholds · Dual Grab Bars · Occupant-Only Privacy Door & Latch
  // ---------------------------------------------------------------------------
  const podsHeaderSign = new THREE.Mesh(signGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    podsSignMat,
    podsSignMat,
  ]);
  podsHeaderSign.position.set(0, floorTopY + 2.38, -2.85);
  mezzanineGroup.add(podsHeaderSign);

  const podWallSideGeo = new THREE.BoxGeometry(0.12, 1.88, 1.92);
  const podBackGeo = new THREE.BoxGeometry(1.68, 1.88, 0.12);
  const podRoofArchGeo = new THREE.CylinderGeometry(
    0.85,
    0.85,
    1.94,
    14,
    1,
    false,
    0,
    Math.PI
  );
  podRoofArchGeo.rotateZ(Math.PI / 2);
  podRoofArchGeo.rotateY(Math.PI / 2);
  // Low, step-free transfer berth + flush bevelled mobility threshold ramp
  const podBerthBaseGeo = new THREE.BoxGeometry(1.38, 0.22, 1.62);
  const podThresholdRampGeo = new THREE.BoxGeometry(1.36, 0.04, 0.28);
  const podGrabBarGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.56, 10);
  const podDoorPanelGeo = new THREE.BoxGeometry(0.84, 1.72, 0.055);
  const podDoorClerestoryGeo = new THREE.BoxGeometry(0.66, 0.28, 0.065);
  const podLatchBoltGeo = new THREE.BoxGeometry(0.09, 0.09, 0.08);
  const waterBasinGeo = new THREE.BoxGeometry(1.24, 0.12, 1.48);
  const quiltBodyGeo = new THREE.BoxGeometry(1.26, 0.15, 1.04);
  const quiltRollGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.24, 12);
  quiltRollGeo.rotateZ(Math.PI / 2);
  const fanHubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10);
  const fanBladeGeo = new THREE.BoxGeometry(0.58, 0.018, 0.11);
  const heaterBoxGeo = new THREE.BoxGeometry(0.68, 0.22, 0.12);
  const podLampGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const statusJewelGeo = new THREE.OctahedronGeometry(0.11, 0);
  const podHitGeo = new THREE.BoxGeometry(1.76, 2.25, 2.15);

  disposables.push(
    podWallSideGeo,
    podBackGeo,
    podRoofArchGeo,
    podBerthBaseGeo,
    podThresholdRampGeo,
    podGrabBarGeo,
    podDoorPanelGeo,
    podDoorClerestoryGeo,
    podLatchBoltGeo,
    waterBasinGeo,
    quiltBodyGeo,
    quiltRollGeo,
    fanHubGeo,
    fanBladeGeo,
    heaterBoxGeo,
    podLampGeo,
    statusJewelGeo,
    podHitGeo
  );

  const podSpecs: Array<{ podId: ChillPodId; x: number }> = [
    { podId: 'pod_1', x: -3.05 },
    { podId: 'pod_2', x: -1.02 },
    { podId: 'pod_3', x: 1.02 },
    { podId: 'pod_4', x: 3.05 },
  ];

  const chillPods = {} as Record<ChillPodId, ChillPodRigNode>;
  const chillPodHitProxies: THREE.Mesh[] = [];

  podSpecs.forEach(({ podId, x }) => {
    // Tactile Wayfinding Branch Spur & Blister Mat leading straight to this Pod's doorway
    const podSpur = new THREE.Mesh(tactilePodSpurGeo, tactileWayfindingMat);
    podSpur.position.set(x, floorTopY + 0.009, -2.56);
    const podBlisterMat = new THREE.Mesh(tactileBlisterPadGeo, tactileWayfindingMat);
    podBlisterMat.position.set(x, floorTopY + 0.011, -2.74);
    mezzanineGroup.add(podSpur, podBlisterMat);

    const podGroup = new THREE.Group();
    podGroup.position.set(x, floorTopY, -3.76);

    const wallL = new THREE.Mesh(podWallSideGeo, cedarWarmMat);
    wallL.position.set(-0.78, 0.94, 0);
    wallL.castShadow = true;
    const wallR = new THREE.Mesh(podWallSideGeo, cedarWarmMat);
    wallR.position.set(0.78, 0.94, 0);
    wallR.castShadow = true;
    const wallBack = new THREE.Mesh(podBackGeo, timberMat);
    wallBack.position.set(0, 0.94, -0.92);
    const roofCap = new THREE.Mesh(podRoofArchGeo, cedarWarmMat);
    roofCap.position.set(0, 1.86, 0);
    const berthBase = new THREE.Mesh(podBerthBaseGeo, chillSanctuaryMat);
    berthBase.position.set(0, 0.11, -0.05);

    // Flush Bevelled Wheelchair / Mobility-Aid Entry Ramp Plate (Zero Trip Lip)
    const thresholdRamp = new THREE.Mesh(podThresholdRampGeo, brassMat);
    thresholdRamp.position.set(0, 0.02, 0.88);
    thresholdRamp.rotation.x = 0.08;

    // Dual Rounded Warm-Brass Mobility Grab Bars on Doorway Frame
    const grabBarL = new THREE.Mesh(podGrabBarGeo, brassMat);
    grabBarL.position.set(-0.74, 0.88, 0.98);
    const grabBarR = new THREE.Mesh(podGrabBarGeo, brassMat);
    grabBarR.position.set(0.74, 0.88, 0.98);

    // Occupant-Only Sliding Cedar Sanctuary Privacy Door + Frosted Daylight Clerestory + Safety Latch
    const privacyDoorGroup = new THREE.Group();
    privacyDoorGroup.position.set(-0.42, 0.88, 0.93);
    const doorPanel = new THREE.Mesh(podDoorPanelGeo, cedarWarmMat);
    doorPanel.castShadow = true;
    const doorClerestory = new THREE.Mesh(
      podDoorClerestoryGeo,
      frostedSafetyScreenMat
    );
    doorClerestory.position.set(0, 0.56, 0);
    const interiorLatchMat = new THREE.MeshStandardMaterial({
      color: '#7CE0A3',
      emissive: '#10B981',
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.35,
    });
    const latchBolt = new THREE.Mesh(podLatchBoltGeo, interiorLatchMat);
    latchBolt.position.set(0.34, -0.04, 0.02);
    privacyDoorGroup.add(doorPanel, doorClerestory, latchBolt);

    // 1. Overhead 4-Blade Cooling Fan
    const fanBladesGroup = new THREE.Group();
    fanBladesGroup.position.set(0, 1.72, 0.05);
    const fanHub = new THREE.Mesh(fanHubGeo, brassMat);
    fanBladesGroup.add(fanHub);
    for (let b = 0; b < 4; b++) {
      const bladeWrap = new THREE.Group();
      bladeWrap.rotation.y = (b / 4) * Math.PI * 2;
      const blade = new THREE.Mesh(fanBladeGeo, brassMat);
      blade.position.set(0.32, -0.02, 0);
      blade.rotation.x = 0.18;
      bladeWrap.add(blade);
      fanBladesGroup.add(bladeWrap);
    }

    // 2. Ceramic Hearth Heater Element (Enclosed Safe Grille)
    const heaterMat = new THREE.MeshStandardMaterial({
      color: '#3A2820',
      emissive: '#000000',
      emissiveIntensity: 0,
      roughness: 0.38,
      metalness: 0.35,
    });

    // 3. Sensory Calm Overhead Pod Lamp
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#FFE6AD',
      emissive: '#F59E0B',
      emissiveIntensity: 0.65,
      roughness: 0.25,
    });

    // 4. Sensory Water Flotation Basin
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#1F4B57',
      emissive: '#0891B2',
      emissiveIntensity: 0.08,
      roughness: 0.16,
      metalness: 0.12,
      transparent: true,
      opacity: 0.88,
    });

    // 5. Heavy Weighted Quilt
    const quiltMat = new THREE.MeshStandardMaterial({
      color: '#5E8C71',
      roughness: 0.86,
      metalness: 0.02,
    });

    // 6. 1-Per-Person Doorway Occupancy Indicator Jewel
    const statusJewelMat = new THREE.MeshStandardMaterial({
      color: '#34D399',
      emissive: '#10B981',
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.28,
    });

    disposables.push(
      interiorLatchMat,
      heaterMat,
      lampMat,
      waterMat,
      quiltMat,
      statusJewelMat
    );

    const heaterMesh = new THREE.Mesh(heaterBoxGeo, heaterMat);
    heaterMesh.position.set(0, 0.32, -0.8);

    const lampMesh = new THREE.Mesh(podLampGeo, lampMat);
    lampMesh.position.set(0, 1.82, -0.45);

    const waterMesh = new THREE.Mesh(waterBasinGeo, waterMat);
    waterMesh.position.set(0, 0.26, -0.05);
    waterMesh.visible = false;

    const quiltGroup = new THREE.Group();
    quiltGroup.position.set(0, 0.32, 0.14);
    const quiltBody = new THREE.Mesh(quiltBodyGeo, quiltMat);
    const quiltBolster = new THREE.Mesh(quiltRollGeo, quiltMat);
    quiltBolster.position.set(0, 0.08, -0.46);
    quiltGroup.add(quiltBody, quiltBolster);
    quiltGroup.visible = false;

    // 7. Snuggled Companion Welly Plushie inside Pod (when brought from Laundry Tub!)
    const {
      plushieGroup: companionPlushieGroup,
      bootMat: companionPlushieUpperMat,
    } = createSingleWellyPlushie('#2E7D4F', '#FAF3E3', '#FFD166', disposables);
    companionPlushieGroup.position.set(0.36, 0.24, -0.42);
    companionPlushieGroup.rotation.set(0.1, -0.35, -0.14);
    companionPlushieGroup.scale.setScalar(0.92);
    companionPlushieGroup.visible = false;

    const statusJewel = new THREE.Mesh(statusJewelGeo, statusJewelMat);
    statusJewel.position.set(0, 2.02, 0.96);

    const hitProxy = new THREE.Mesh(podHitGeo, hitProxyMat);
    hitProxy.position.set(0, 1.08, 0);
    hitProxy.layers.set(1);
    hitProxy.userData = {
      sceneAction: 'open_chill_pod',
      podId,
    };
    chillPodHitProxies.push(hitProxy);

    podGroup.add(
      wallL,
      wallR,
      wallBack,
      roofCap,
      berthBase,
      thresholdRamp,
      grabBarL,
      grabBarR,
      privacyDoorGroup,
      fanBladesGroup,
      heaterMesh,
      lampMesh,
      waterMesh,
      quiltGroup,
      companionPlushieGroup,
      statusJewel,
      hitProxy
    );
    mezzanineGroup.add(podGroup);

    chillPods[podId] = {
      podId,
      group: podGroup,
      worldFocusPos: new THREE.Vector3(x, canopyBaseY + floorTopY + 0.95, -3.55),
      fanBladesGroup,
      heaterMat,
      lampMat,
      waterMesh,
      waterMat,
      quiltGroup,
      quiltMat,
      statusJewelMat,
      privacyDoorGroup,
      interiorLatchMat,
      companionPlushieGroup,
      companionPlushieUpperMat,
      hitProxy,
      fanActive: false,
      flotationActive: false,
      doorTargetX: -0.42,
    };
  });

  const mezzanineLight = new THREE.PointLight('#FFD89B', 1.45, 16, 2);
  mezzanineLight.position.set(0, floorTopY + 2.15, -1.95);
  mezzanineGroup.add(mezzanineLight);

  return {
    mezzanineGroup,
    mezzanineLight,
    tactileWayfindingMat,
    libraryHitProxy,
    refreshmentsHitProxy,
    wellyTubHitProxy,
    wellyPlushieNodes,
    chillPods,
    chillPodHitProxies,
  };
}

function createToolsShowAndTellRack(
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  rackGroup: THREE.Group;
  toolMeshes: Record<ToolVisualKind, THREE.Group>;
} {
  const rackGroup = new THREE.Group();

  const lockerBaseGeo = new THREE.BoxGeometry(1.56, 0.72, 0.54);
  const shelfTopGeo = new THREE.BoxGeometry(1.64, 0.08, 0.6);
  const pegboardGeo = new THREE.BoxGeometry(1.5, 1.38, 0.08);
  const sidePostGeo = new THREE.BoxGeometry(0.1, 2.15, 0.12);
  const headerBarGeo = new THREE.BoxGeometry(1.62, 0.16, 0.14);
  const pegGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8);
  pegGeo.rotateX(Math.PI / 2);

  const sageMat = new THREE.MeshStandardMaterial({
    color: '#3F6A52',
    roughness: 0.65,
    metalness: 0.12,
  });
  const woolMat = new THREE.MeshStandardMaterial({
    color: '#D1603D',
    roughness: 0.85,
    metalness: 0.04,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.25,
    metalness: 0.88,
  });

  disposables.push(
    lockerBaseGeo,
    shelfTopGeo,
    pegboardGeo,
    sidePostGeo,
    headerBarGeo,
    pegGeo,
    sageMat,
    woolMat,
    steelMat
  );

  const baseMesh = new THREE.Mesh(lockerBaseGeo, timberMat);
  baseMesh.position.set(0, 0.36, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;

  const shelfTop = new THREE.Mesh(shelfTopGeo, brassMat);
  shelfTop.position.set(0, 0.75, 0.02);

  const pegBack = new THREE.Mesh(pegboardGeo, ironMat);
  pegBack.position.set(0, 1.46, -0.2);
  pegBack.castShadow = true;

  const postL = new THREE.Mesh(sidePostGeo, timberMat);
  postL.position.set(-0.76, 1.08, -0.2);
  const postR = new THREE.Mesh(sidePostGeo, timberMat);
  postR.position.set(0.76, 1.08, -0.2);

  const headerBar = new THREE.Mesh(headerBarGeo, brassMat);
  headerBar.position.set(0, 2.18, -0.18);

  rackGroup.add(baseMesh, shelfTop, pegBack, postL, postR, headerBar);

  [-0.46, 0, 0.46].forEach((px) => {
    const peg = new THREE.Mesh(pegGeo, brassMat);
    peg.position.set(px, 1.66, -0.1);
    rackGroup.add(peg);
  });

  // 1. joinery_plane (Top-left peg)
  const planeGrp = new THREE.Group();
  planeGrp.position.set(-0.46, 1.62, -0.02);
  planeGrp.visible = false;
  const planeBodyGeo = new THREE.BoxGeometry(0.32, 0.12, 0.14);
  const planeBladeGeo = new THREE.BoxGeometry(0.04, 0.22, 0.1);
  const planeKnobGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.1, 8);
  disposables.push(planeBodyGeo, planeBladeGeo, planeKnobGeo);
  const pBody = new THREE.Mesh(planeBodyGeo, timberMat);
  const pBlade = new THREE.Mesh(planeBladeGeo, steelMat);
  pBlade.rotation.z = 0.48;
  pBlade.position.set(0.02, 0.06, 0);
  const pKnob = new THREE.Mesh(planeKnobGeo, brassMat);
  pKnob.position.set(-0.1, 0.09, 0);
  planeGrp.add(pBody, pBlade, pKnob);

  // 2. precision_calipers (Top-center peg)
  const caliperGrp = new THREE.Group();
  caliperGrp.position.set(0, 1.58, -0.04);
  caliperGrp.visible = false;
  const calBeamGeo = new THREE.BoxGeometry(0.05, 0.42, 0.025);
  const calJawGeo = new THREE.BoxGeometry(0.18, 0.045, 0.03);
  disposables.push(calBeamGeo, calJawGeo);
  const cBeam = new THREE.Mesh(calBeamGeo, brassMat);
  const cJawTop = new THREE.Mesh(calJawGeo, steelMat);
  cJawTop.position.set(0.06, 0.17, 0);
  const cJawMid = new THREE.Mesh(calJawGeo, brassMat);
  cJawMid.position.set(0.06, 0.03, 0);
  caliperGrp.add(cBeam, cJawTop, cJawMid);

  // 3. loom_shuttle (Top-right peg)
  const shuttleGrp = new THREE.Group();
  shuttleGrp.position.set(0.46, 1.6, -0.03);
  shuttleGrp.visible = false;
  const shuttleBodyGeo = new THREE.CapsuleGeometry(0.055, 0.28, 6, 10);
  const bobbinGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.18, 10);
  disposables.push(shuttleBodyGeo, bobbinGeo);
  const sBody = new THREE.Mesh(shuttleBodyGeo, timberMat);
  sBody.scale.set(1, 1, 0.6);
  const sBobbin = new THREE.Mesh(bobbinGeo, woolMat);
  shuttleGrp.add(sBody, sBobbin);

  // 4. soldering_iron_kit (Lower-left shelf)
  const solderGrp = new THREE.Group();
  solderGrp.position.set(-0.48, 0.79, 0.08);
  solderGrp.visible = false;
  const standBaseGeo = new THREE.BoxGeometry(0.24, 0.06, 0.22);
  const ironWandGeo = new THREE.CylinderGeometry(0.024, 0.016, 0.34, 8);
  ironWandGeo.rotateZ(-0.6);
  const spoolGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10);
  disposables.push(standBaseGeo, ironWandGeo, spoolGeo);
  const stBase = new THREE.Mesh(standBaseGeo, ironMat);
  stBase.position.y = 0.03;
  const wand = new THREE.Mesh(ironWandGeo, sageMat);
  wand.position.set(0.02, 0.16, 0);
  const spool = new THREE.Mesh(spoolGeo, brassMat);
  spool.position.set(-0.08, 0.08, 0.06);
  solderGrp.add(stBase, wand, spool);

  // 5. botanical_press (Lower-center shelf)
  const pressGrp = new THREE.Group();
  pressGrp.position.set(0, 0.79, 0.08);
  pressGrp.visible = false;
  const pressPlateGeo = new THREE.BoxGeometry(0.32, 0.045, 0.26);
  const herbPaperGeo = new THREE.BoxGeometry(0.28, 0.07, 0.22);
  const screwPostGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.19, 8);
  disposables.push(pressPlateGeo, herbPaperGeo, screwPostGeo);
  const plateBot = new THREE.Mesh(pressPlateGeo, timberMat);
  plateBot.position.y = 0.025;
  const paperStack = new THREE.Mesh(herbPaperGeo, sageMat);
  paperStack.position.y = 0.085;
  const plateTop = new THREE.Mesh(pressPlateGeo, timberMat);
  plateTop.position.y = 0.145;
  const screwL = new THREE.Mesh(screwPostGeo, brassMat);
  screwL.position.set(-0.13, 0.1, 0.09);
  const screwR = new THREE.Mesh(screwPostGeo, brassMat);
  screwR.position.set(0.13, 0.1, 0.09);
  pressGrp.add(plateBot, paperStack, plateTop, screwL, screwR);

  // 6. outreach_compass_kit (Lower-right shelf)
  const compassGrp = new THREE.Group();
  compassGrp.position.set(0.48, 0.79, 0.08);
  compassGrp.visible = false;
  const notebookGeo = new THREE.BoxGeometry(0.26, 0.06, 0.22);
  const compassCaseGeo = new THREE.CylinderGeometry(0.085, 0.09, 0.045, 14);
  const compassRingGeo = new THREE.TorusGeometry(0.032, 0.01, 6, 12);
  disposables.push(notebookGeo, compassCaseGeo, compassRingGeo);
  const notebook = new THREE.Mesh(notebookGeo, sageMat);
  notebook.position.set(-0.03, 0.03, 0);
  const compCase = new THREE.Mesh(compassCaseGeo, brassMat);
  compCase.position.set(0.05, 0.082, 0.02);
  const compRing = new THREE.Mesh(compassRingGeo, brassMat);
  compRing.position.set(0.05, 0.085, 0.12);
  compassGrp.add(notebook, compCase, compRing);

  // 7. agarwood_alembic_still (Upper-center copper hydro-distillation still)
  const stillGrp = new THREE.Group();
  stillGrp.position.set(0, 1.32, 0.08);
  stillGrp.visible = false;
  const boilerPotGeo = new THREE.CylinderGeometry(0.095, 0.115, 0.14, 14);
  const alembicDomeGeo = new THREE.SphereGeometry(
    0.095,
    14,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.55
  );
  const swanNeckGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.18, 8);
  disposables.push(boilerPotGeo, alembicDomeGeo, swanNeckGeo);
  const boilerPot = new THREE.Mesh(boilerPotGeo, brassMat);
  boilerPot.position.y = 0.07;
  const alembicDome = new THREE.Mesh(alembicDomeGeo, brassMat);
  alembicDome.position.y = 0.14;
  const swanNeck = new THREE.Mesh(swanNeckGeo, brassMat);
  swanNeck.position.set(0.07, 0.21, 0);
  swanNeck.rotation.z = -Math.PI * 0.34;
  stillGrp.add(boilerPot, alembicDome, swanNeck);

  // 8. amber_bottling_kit (Lower-right tray of amber dropper vials)
  const bottleKitGrp = new THREE.Group();
  bottleKitGrp.position.set(-0.24, 0.79, 0.12);
  bottleKitGrp.visible = false;
  const kitTrayGeo = new THREE.BoxGeometry(0.24, 0.03, 0.16);
  const kitVialGeo = new THREE.CylinderGeometry(0.026, 0.028, 0.11, 10);
  const kitCapGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.036, 8);
  disposables.push(kitTrayGeo, kitVialGeo, kitCapGeo);
  const kitTray = new THREE.Mesh(kitTrayGeo, timberMat);
  kitTray.position.y = 0.015;
  bottleKitGrp.add(kitTray);
  for (let i = 0; i < 3; i++) {
    const vial = new THREE.Mesh(kitVialGeo, brassMat);
    vial.position.set(-0.065 + i * 0.065, 0.085, 0);
    const cap = new THREE.Mesh(kitCapGeo, ironMat);
    cap.position.set(-0.065 + i * 0.065, 0.155, 0);
    bottleKitGrp.add(vial, cap);
  }

  rackGroup.add(
    planeGrp,
    caliperGrp,
    shuttleGrp,
    solderGrp,
    pressGrp,
    compassGrp,
    stillGrp,
    bottleKitGrp
  );

  return {
    rackGroup,
    toolMeshes: {
      joinery_plane: planeGrp,
      precision_calipers: caliperGrp,
      loom_shuttle: shuttleGrp,
      soldering_iron_kit: solderGrp,
      botanical_press: pressGrp,
      outreach_compass_kit: compassGrp,
      agarwood_alembic_still: stillGrp,
      amber_bottling_kit: bottleKitGrp,
    },
  };
}

function createCanopyFurnishingsRig(
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  furnishingGroup: THREE.Group;
  furnishingMeshes: Record<CanopyFurnishingKind, THREE.Group>;
  furnishingLight: THREE.PointLight;
} {
  const furnishingGroup = new THREE.Group();

  const warmGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFE6A8',
    emissive: '#FFAA33',
    emissiveIntensity: 2.1,
    roughness: 0.22,
    metalness: 0.05,
  });
  const rugBaseMat = new THREE.MeshStandardMaterial({
    color: '#8D3B28',
    roughness: 0.92,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const rugBorderMat = new THREE.MeshStandardMaterial({
    color: '#D99B38',
    roughness: 0.88,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const fernLeafMat = new THREE.MeshStandardMaterial({
    color: '#3F7D4E',
    roughness: 0.72,
    metalness: 0.04,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: '#2E2118',
    roughness: 0.95,
    metalness: 0.01,
  });

  disposables.push(
    warmGlowMat,
    rugBaseMat,
    rugBorderMat,
    fernLeafMat,
    soilMat
  );

  // Shared dynamic warm lantern PointLight inside Canopy interior
  const furnishingLight = new THREE.PointLight('#FFB84D', 0, 14, 1.7);
  furnishingLight.position.set(-0.4, 2.45, -0.35);
  furnishingGroup.add(furnishingLight);

  // 1. brass_hanging_lantern (Suspended from overhead Canopy beam)
  const hangingGrp = new THREE.Group();
  hangingGrp.position.set(-1.1, 2.75, -0.35);
  hangingGrp.visible = false;
  const chainGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8);
  const shadeConeGeo = new THREE.ConeGeometry(0.38, 0.22, 14);
  const glassCoreGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.38, 12);
  const bottomRingGeo = new THREE.CylinderGeometry(0.2, 0.14, 0.08, 12);
  disposables.push(chainGeo, shadeConeGeo, glassCoreGeo, bottomRingGeo);
  const hChain = new THREE.Mesh(chainGeo, ironMat);
  hChain.position.y = 0.52;
  const hShade = new THREE.Mesh(shadeConeGeo, brassMat);
  hShade.position.y = 0.18;
  const hCore = new THREE.Mesh(glassCoreGeo, warmGlowMat);
  hCore.position.y = -0.05;
  const hBase = new THREE.Mesh(bottomRingGeo, brassMat);
  hBase.position.y = -0.26;
  hangingGrp.add(hChain, hShade, hCore, hBase);

  // 2. amber_floor_lantern (Standing timber-and-brass beacon near front-left balustrade)
  const floorLanternGrp = new THREE.Group();
  floorLanternGrp.position.set(-2.25, 0.17, 3.15);
  floorLanternGrp.visible = false;
  const plinthGeo = new THREE.BoxGeometry(0.46, 0.12, 0.46);
  const postColGeo = new THREE.BoxGeometry(0.16, 0.86, 0.16);
  const lanternBoxGeo = new THREE.CylinderGeometry(0.2, 0.18, 0.42, 8);
  const capPyramidGeo = new THREE.ConeGeometry(0.3, 0.22, 4);
  capPyramidGeo.rotateY(Math.PI / 4);
  disposables.push(plinthGeo, postColGeo, lanternBoxGeo, capPyramidGeo);
  const fPlinth = new THREE.Mesh(plinthGeo, timberMat);
  fPlinth.position.y = 0.06;
  const fPost = new THREE.Mesh(postColGeo, timberMat);
  fPost.position.y = 0.54;
  const fGlow = new THREE.Mesh(lanternBoxGeo, warmGlowMat);
  fGlow.position.y = 1.16;
  const fCap = new THREE.Mesh(capPyramidGeo, brassMat);
  fCap.position.y = 1.46;
  floorLanternGrp.add(fPlinth, fPost, fGlow, fCap);

  // 3. starlight_garland (Festooned warm string lanterns across interior eaves)
  const garlandGrp = new THREE.Group();
  garlandGrp.visible = false;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-3.35, 2.88, -1.55),
    new THREE.Vector3(0, 2.48, -0.45),
    new THREE.Vector3(3.35, 2.88, -1.55)
  );
  const cordGeo = new THREE.TubeGeometry(curve, 20, 0.018, 6, false);
  const bulbGeo = new THREE.SphereGeometry(0.085, 10, 10);
  const socketGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.06, 8);
  disposables.push(cordGeo, bulbGeo, socketGeo);
  const cordMesh = new THREE.Mesh(cordGeo, ironMat);
  garlandGrp.add(cordMesh);
  for (let b = 1; b <= 7; b++) {
    const pt = curve.getPoint(b / 8);
    const socket = new THREE.Mesh(socketGeo, brassMat);
    socket.position.set(pt.x, pt.y - 0.03, pt.z);
    const bulb = new THREE.Mesh(bulbGeo, warmGlowMat);
    bulb.position.set(pt.x, pt.y - 0.11, pt.z);
    garlandGrp.add(socket, bulb);
  }

  // 4. cedar_reading_lamp (Articulated task lamp beside the Show & Tell rack & Trade Booth)
  const readingLampGrp = new THREE.Group();
  readingLampGrp.position.set(1.95, 0.17, -1.85);
  readingLampGrp.visible = false;
  const rBaseGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12);
  const rStemGeo = new THREE.CylinderGeometry(0.035, 0.04, 1.28, 8);
  const rArmGeo = new THREE.BoxGeometry(0.46, 0.045, 0.045);
  const rShadeGeo = new THREE.ConeGeometry(0.18, 0.2, 12);
  const rBulbGeo = new THREE.SphereGeometry(0.075, 8, 8);
  disposables.push(rBaseGeo, rStemGeo, rArmGeo, rShadeGeo, rBulbGeo);
  const rBase = new THREE.Mesh(rBaseGeo, ironMat);
  rBase.position.y = 0.04;
  const rStem = new THREE.Mesh(rStemGeo, timberMat);
  rStem.position.y = 0.7;
  const rArm = new THREE.Mesh(rArmGeo, brassMat);
  rArm.position.set(-0.18, 1.32, 0.08);
  rArm.rotation.z = 0.22;
  const rShade = new THREE.Mesh(rShadeGeo, brassMat);
  rShade.position.set(-0.36, 1.28, 0.12);
  const rBulb = new THREE.Mesh(rBulbGeo, warmGlowMat);
  rBulb.position.set(-0.36, 1.19, 0.12);
  readingLampGrp.add(rBase, rStem, rArm, rShade, rBulb);

  // 5. woven_sanctuary_rug (Hand-loomed wool runner grounded cleanly >= 0.025m above floor)
  const rugGrp = new THREE.Group();
  rugGrp.position.set(0, 0.196, -0.42);
  rugGrp.visible = false;
  const rugOuterGeo = new THREE.BoxGeometry(2.95, 0.024, 1.62);
  const rugInnerGeo = new THREE.BoxGeometry(2.62, 0.028, 1.3);
  const rugMedallionGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.032, 6);
  disposables.push(rugOuterGeo, rugInnerGeo, rugMedallionGeo);
  const rugOuter = new THREE.Mesh(rugOuterGeo, rugBorderMat);
  rugOuter.receiveShadow = true;
  const rugInner = new THREE.Mesh(rugInnerGeo, rugBaseMat);
  rugInner.receiveShadow = true;
  const rugMedallion = new THREE.Mesh(rugMedallionGeo, rugBorderMat);
  rugGrp.add(rugOuter, rugInner, rugMedallion);

  // 6. fern_planter_box (Humane native fern & pollinator cedar box along right balustrade)
  const planterGrp = new THREE.Group();
  planterGrp.position.set(2.92, 0.17, 0.25);
  planterGrp.visible = false;
  const boxGeo = new THREE.BoxGeometry(0.68, 0.44, 1.52);
  const soilBedGeo = new THREE.BoxGeometry(0.58, 0.06, 1.42);
  const frondGeo = new THREE.ConeGeometry(0.16, 0.56, 5);
  const blossomGeo = new THREE.DodecahedronGeometry(0.065, 0);
  disposables.push(boxGeo, soilBedGeo, frondGeo, blossomGeo);
  const pBox = new THREE.Mesh(boxGeo, timberMat);
  pBox.position.y = 0.22;
  pBox.castShadow = true;
  const pSoil = new THREE.Mesh(soilBedGeo, soilMat);
  pSoil.position.y = 0.43;
  planterGrp.add(pBox, pSoil);

  for (let f = 0; f < 6; f++) {
    const zOff = -0.52 + f * 0.21;
    const frondL = new THREE.Mesh(frondGeo, fernLeafMat);
    frondL.position.set(-0.08, 0.64, zOff);
    frondL.rotation.z = 0.36;
    const frondR = new THREE.Mesh(frondGeo, fernLeafMat);
    frondR.position.set(0.08, 0.66, zOff);
    frondR.rotation.z = -0.34;
    planterGrp.add(frondL, frondR);
    if (f % 2 === 0) {
      const bloom = new THREE.Mesh(blossomGeo, warmGlowMat);
      bloom.position.set(0, 0.72, zOff);
      planterGrp.add(bloom);
    }
  }

  furnishingGroup.add(
    hangingGrp,
    floorLanternGrp,
    garlandGrp,
    readingLampGrp,
    rugGrp,
    planterGrp
  );

  return {
    furnishingGroup,
    furnishingMeshes: {
      brass_hanging_lantern: hangingGrp,
      amber_floor_lantern: floorLanternGrp,
      starlight_garland: garlandGrp,
      cedar_reading_lamp: readingLampGrp,
      woven_sanctuary_rug: rugGrp,
      fern_planter_box: planterGrp,
    },
    furnishingLight,
  };
}

function createTradeSpecialtyProps(
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): Record<CanopyTradeFocus, THREE.Group> {
  // 1. Woodcraft & Joinery
  const woodGrp = new THREE.Group();
  const malletHeadGeo = new THREE.BoxGeometry(0.28, 0.16, 0.16);
  const malletShaftGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.42, 8);
  malletShaftGeo.rotateZ(Math.PI / 2.4);
  const chestShowcaseGeo = new THREE.BoxGeometry(0.68, 0.36, 0.44);
  disposables.push(malletHeadGeo, malletShaftGeo, chestShowcaseGeo);
  const chest = new THREE.Mesh(chestShowcaseGeo, timberMat);
  chest.position.set(-0.55, 0.18, 0);
  const mHead = new THREE.Mesh(malletHeadGeo, timberMat);
  mHead.position.set(0.48, 0.12, 0.08);
  const mShaft = new THREE.Mesh(malletShaftGeo, brassMat);
  mShaft.position.set(0.62, 0.14, 0.08);
  woodGrp.add(chest, mHead, mShaft);

  // 2. Metalwork & Lanterns
  const metalGrp = new THREE.Group();
  metalGrp.visible = false;
  const anvilGeo = new THREE.BoxGeometry(0.56, 0.28, 0.28);
  const domeLanternGeo = new THREE.OctahedronGeometry(0.24, 0);
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#FFE3A3',
    emissive: '#FFA733',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  disposables.push(anvilGeo, domeLanternGeo, glowMat);
  const anvil = new THREE.Mesh(anvilGeo, ironMat);
  anvil.position.set(-0.5, 0.14, 0);
  const lanternA = new THREE.Mesh(domeLanternGeo, glowMat);
  lanternA.position.set(0.35, 0.26, 0);
  const lanternB = new THREE.Mesh(domeLanternGeo, brassMat);
  lanternB.position.set(0.85, 0.22, -0.06);
  metalGrp.add(anvil, lanternA, lanternB);

  // 3. Textiles & Weaving
  const weaveGrp = new THREE.Group();
  weaveGrp.visible = false;
  const clothA = new THREE.MeshStandardMaterial({
    color: '#C85A32',
    roughness: 0.86,
  });
  const clothB = new THREE.MeshStandardMaterial({
    color: '#4B7A59',
    roughness: 0.86,
  });
  const boltGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.68, 12);
  boltGeo.rotateZ(Math.PI / 2);
  disposables.push(clothA, clothB, boltGeo);
  const b1 = new THREE.Mesh(boltGeo, clothA);
  b1.position.set(-0.45, 0.13, 0.05);
  const b2 = new THREE.Mesh(boltGeo, clothB);
  b2.position.set(-0.45, 0.34, -0.04);
  const b3 = new THREE.Mesh(boltGeo, brassMat);
  b3.position.set(0.52, 0.13, 0);
  weaveGrp.add(b1, b2, b3);

  // 4. Repair & Maker Tools
  const repairGrp = new THREE.Group();
  repairGrp.visible = false;
  const caddyGeo = new THREE.BoxGeometry(0.74, 0.3, 0.38);
  const gearShowGeo = new THREE.TorusGeometry(0.19, 0.045, 8, 18);
  disposables.push(caddyGeo, gearShowGeo);
  const caddy = new THREE.Mesh(caddyGeo, ironMat);
  caddy.position.set(-0.48, 0.15, 0);
  const gearA = new THREE.Mesh(gearShowGeo, brassMat);
  gearA.position.set(0.45, 0.22, 0);
  const gearB = new THREE.Mesh(gearShowGeo, ironMat);
  gearB.position.set(0.84, 0.22, 0.04);
  repairGrp.add(caddy, gearA, gearB);

  // 5. Community Outreach
  const outreachGrp = new THREE.Group();
  outreachGrp.visible = false;
  const crateOutGeo = new THREE.BoxGeometry(0.64, 0.32, 0.42);
  const bellGeo = new THREE.ConeGeometry(0.18, 0.32, 12);
  disposables.push(crateOutGeo, bellGeo);
  const careCrateA = new THREE.Mesh(crateOutGeo, timberMat);
  careCrateA.position.set(-0.55, 0.16, 0);
  const careCrateB = new THREE.Mesh(crateOutGeo, brassMat);
  careCrateB.scale.setScalar(0.82);
  careCrateB.position.set(0.18, 0.13, 0.04);
  const welcomeBell = new THREE.Mesh(bellGeo, brassMat);
  welcomeBell.position.set(0.82, 0.18, 0);
  outreachGrp.add(careCrateA, careCrateB, welcomeBell);

  return {
    'Woodcraft & Joinery': woodGrp,
    'Metalwork & Lanterns': metalGrp,
    'Textiles & Weaving': weaveGrp,
    'Repair & Maker Tools': repairGrp,
    'Community Outreach': outreachGrp,
  };
}

export function createManualLiftGroup(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): ManualLiftRig {
  const root = new THREE.Group();
  root.position.set(CABLE_X, MIN_LIFT_Y, CABLE_Z);

  const carriageInner = new THREE.Group();
  root.add(carriageInner);

  const oakMat = new THREE.MeshStandardMaterial({
    map: textures.timberAlbedo,
    roughness: 0.74,
    metalness: 0.06,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#242C29',
    roughness: 0.42,
    metalness: 0.84,
  });
  const brassFrameMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    emissive: '#000000',
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.9,
  });
  const lanternGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFE3A3',
    emissive: '#FFA733',
    emissiveIntensity: 1.5,
    roughness: 0.22,
  });
  disposables.push(oakMat, ironMat, brassFrameMat, lanternGlowMat);

  // 1. Beveled Oak Carriage Deck ([■])
  const floorGeo = new THREE.BoxGeometry(2.15, 0.18, 1.85);
  const trimGeo = new THREE.BoxGeometry(2.23, 0.08, 1.93);
  disposables.push(floorGeo, trimGeo);

  const floorMesh = new THREE.Mesh(floorGeo, oakMat);
  floorMesh.position.y = 0.09;
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;

  const brassTrim = new THREE.Mesh(trimGeo, brassFrameMat);
  brassTrim.position.y = 0.04;
  carriageInner.add(floorMesh, brassTrim);

  // 2. Four Chamfered Corner Stanchions + Waist Safety Rails
  const postGeo = new THREE.BoxGeometry(0.12, 2.25, 0.12);
  const railSideGeo = new THREE.BoxGeometry(0.08, 0.1, 1.75);
  const railFrontGeo = new THREE.BoxGeometry(2.05, 0.1, 0.08);
  const panelGeo = new THREE.BoxGeometry(0.05, 0.65, 1.68);
  disposables.push(postGeo, railSideGeo, railFrontGeo, panelGeo);

  [
    [-0.98, -0.82],
    [0.98, -0.82],
    [-0.98, 0.82],
    [0.98, 0.82],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, oakMat);
    post.position.set(px, 1.2, pz);
    post.castShadow = true;
    carriageInner.add(post);
  });

  const railL = new THREE.Mesh(railSideGeo, oakMat);
  railL.position.set(-0.98, 1.02, 0);
  const railR = new THREE.Mesh(railSideGeo, oakMat);
  railR.position.set(0.98, 1.02, 0);
  const railBack = new THREE.Mesh(railFrontGeo, oakMat);
  railBack.position.set(0, 1.02, -0.82);
  const railFront = new THREE.Mesh(railFrontGeo, brassFrameMat);
  railFront.position.set(0, 1.02, 0.82);

  const panelL = new THREE.Mesh(panelGeo, oakMat);
  panelL.position.set(-0.98, 0.52, 0);
  const panelR = new THREE.Mesh(panelGeo, oakMat);
  panelR.position.set(0.98, 0.52, 0);
  carriageInner.add(railL, railR, railBack, railFront, panelL, panelR);

  // 3. Forged-Iron Overhead Hoist Yoke + Grooved Brass Pulley Sheave
  const yokeTopGeo = new THREE.BoxGeometry(2.15, 0.14, 0.2);
  const yokeArchGeo = new THREE.BoxGeometry(0.2, 0.14, 1.76);
  disposables.push(yokeTopGeo, yokeArchGeo);

  const yokeBack = new THREE.Mesh(yokeTopGeo, ironMat);
  yokeBack.position.set(0, 2.34, -0.82);
  const yokeFront = new THREE.Mesh(yokeTopGeo, ironMat);
  yokeFront.position.set(0, 2.34, 0.82);
  const yokeCenter = new THREE.Mesh(yokeArchGeo, ironMat);
  yokeCenter.position.set(0, 2.38, 0);
  yokeCenter.castShadow = true;
  carriageInner.add(yokeBack, yokeFront, yokeCenter);

  const overheadSheave = new THREE.Group();
  overheadSheave.position.set(0, 2.66, 0);
  const sheaveTorus = new THREE.TorusGeometry(0.28, 0.06, 12, 24);
  const sheaveCore = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12);
  sheaveCore.rotateZ(Math.PI / 2);
  disposables.push(sheaveTorus, sheaveCore);

  const sRim = new THREE.Mesh(sheaveTorus, brassFrameMat);
  sRim.rotation.y = Math.PI / 2;
  const sCore = new THREE.Mesh(sheaveCore, ironMat);
  overheadSheave.add(sRim, sCore);

  for (let i = 0; i < 3; i++) {
    const spGeo = new THREE.BoxGeometry(0.04, 0.52, 0.04);
    disposables.push(spGeo);
    const sp = new THREE.Mesh(spGeo, brassFrameMat);
    sp.rotation.x = (i / 3) * Math.PI;
    overheadSheave.add(sp);
  }
  carriageInner.add(overheadSheave);

  // 4. Manual Hand-Crank Pulley Wheel inside Carriage (controlled by player!)
  const pedestalGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.92, 10);
  disposables.push(pedestalGeo);
  const crankPedestal = new THREE.Mesh(pedestalGeo, ironMat);
  crankPedestal.position.set(0, 0.62, 0.36);
  carriageInner.add(crankPedestal);

  const handWheel = new THREE.Group();
  handWheel.position.set(0, 1.08, 0.48);
  const hwRimGeo = new THREE.TorusGeometry(0.32, 0.038, 10, 24);
  disposables.push(hwRimGeo);
  const hwRim = new THREE.Mesh(hwRimGeo, brassFrameMat);
  handWheel.add(hwRim);

  for (let h = 0; h < 4; h++) {
    const spokeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8);
    const handleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8);
    handleGeo.rotateX(Math.PI / 2);
    disposables.push(spokeGeo, handleGeo);

    const spoke = new THREE.Mesh(spokeGeo, brassFrameMat);
    spoke.rotation.z = (h / 4) * Math.PI;
    const grip = new THREE.Mesh(handleGeo, oakMat);
    const ang = (h / 4) * Math.PI * 2;
    grip.position.set(Math.cos(ang) * 0.32, Math.sin(ang) * 0.32, 0.08);
    handWheel.add(spoke, grip);
  }
  carriageInner.add(handWheel);

  // 5. Articulating Brass Ratchet Brake Lever
  const brakeLever = new THREE.Group();
  brakeLever.position.set(0.55, 0.85, 0.42);
  const leverArmGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.55, 8);
  leverArmGeo.translate(0, 0.26, 0);
  const leverKnobGeo = new THREE.SphereGeometry(0.065, 10, 10);
  leverKnobGeo.translate(0, 0.55, 0);
  disposables.push(leverArmGeo, leverKnobGeo);

  const leverArm = new THREE.Mesh(leverArmGeo, ironMat);
  const leverKnob = new THREE.Mesh(leverKnobGeo, brassFrameMat);
  brakeLever.add(leverArm, leverKnob);
  carriageInner.add(brakeLever);

  // 6. Hanging Warm Carriage Lantern
  const cLanternGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.22, 8);
  disposables.push(cLanternGeo);
  const cLantern = new THREE.Mesh(cLanternGeo, lanternGlowMat);
  cLantern.position.set(-0.84, 1.92, 0.72);
  carriageInner.add(cLantern);

  // 7. Upgradeable Brass Wind-Shield Louvers (initially hidden until unlocked)
  const windShieldGroup = new THREE.Group();
  const louverGeo = new THREE.BoxGeometry(0.06, 0.9, 1.65);
  disposables.push(louverGeo);
  const louverL = new THREE.Mesh(louverGeo, brassFrameMat);
  louverL.position.set(-1.02, 1.56, 0);
  const louverR = new THREE.Mesh(louverGeo, brassFrameMat);
  louverR.position.set(1.02, 1.56, 0);
  windShieldGroup.add(louverL, louverR);
  windShieldGroup.visible = false;
  carriageInner.add(windShieldGroup);

  // 8. Dynamic Carried Craft Cargo Variants on the Lift Deck
  const cargoGroup = new THREE.Group();
  cargoGroup.position.set(-0.42, 0.2, -0.25);
  carriageInner.add(cargoGroup);

  // Variant A: Dovetail Cedar Chest
  const chestGroup = new THREE.Group();
  const chestBodyGeo = new THREE.BoxGeometry(0.66, 0.44, 0.48);
  const chestBandGeo = new THREE.BoxGeometry(0.69, 0.46, 0.07);
  disposables.push(chestBodyGeo, chestBandGeo);
  const chestBody = new THREE.Mesh(chestBodyGeo, oakMat);
  chestBody.position.y = 0.22;
  chestBody.castShadow = true;
  const band1 = new THREE.Mesh(chestBandGeo, brassFrameMat);
  band1.position.set(-0.2, 0.22, 0);
  band1.rotation.y = Math.PI / 2;
  const band2 = band1.clone();
  band2.position.set(0.2, 0.22, 0);
  chestGroup.add(chestBody, band1, band2);
  chestGroup.visible = false;

  // Variant B: Spun Brass Beacon Lamp
  const lampGroup = new THREE.Group();
  const lampBaseGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.14, 12);
  const lampCoreGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.36, 12);
  const lampCapGeo = new THREE.ConeGeometry(0.28, 0.2, 12);
  disposables.push(lampBaseGeo, lampCoreGeo, lampCapGeo);
  const lBase = new THREE.Mesh(lampBaseGeo, brassFrameMat);
  lBase.position.y = 0.07;
  const lCore = new THREE.Mesh(lampCoreGeo, lanternGlowMat);
  lCore.position.y = 0.31;
  const lCap = new THREE.Mesh(lampCapGeo, brassFrameMat);
  lCap.position.y = 0.58;
  lampGroup.add(lBase, lCore, lCap);
  lampGroup.visible = false;

  // Variant C: Woven Canopy Banner Roll
  const tapestryGroup = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({
    color: '#C85A32',
    roughness: 0.86,
    metalness: 0.04,
  });
  const rollGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.72, 14);
  rollGeo.rotateZ(Math.PI / 2);
  const strapGeo = new THREE.TorusGeometry(0.17, 0.025, 8, 18);
  strapGeo.rotateY(Math.PI / 2);
  disposables.push(clothMat, rollGeo, strapGeo);
  const roll1 = new THREE.Mesh(rollGeo, clothMat);
  roll1.position.y = 0.17;
  const strap1 = new THREE.Mesh(strapGeo, brassFrameMat);
  strap1.position.set(-0.2, 0.17, 0);
  const strap2 = strap1.clone();
  strap2.position.set(0.2, 0.17, 0);
  tapestryGroup.add(roll1, strap1, strap2);
  tapestryGroup.visible = false;

  cargoGroup.add(chestGroup, lampGroup, tapestryGroup);

  // 9. Playable 3D Footwear Character (Wellington Boots / Work Boots / Work Shoes) standing in the Lift Carriage
  const shoeCharacter = createShoeCharacterRig(disposables);
  shoeCharacter.root.position.set(0.32, 0.18, -0.06);
  shoeCharacter.root.rotation.y = 0.12;
  carriageInner.add(shoeCharacter.root);

  // Soft Ground Contact Shadow under the Lift when docked near Root Deck
  const liftShadowGeo = new THREE.PlaneGeometry(3.2, 3.0);
  liftShadowGeo.rotateX(-Math.PI / 2);
  const liftShadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  disposables.push(liftShadowGeo, liftShadowMat);
  const groundContactShadow = new THREE.Mesh(liftShadowGeo, liftShadowMat);
  groundContactShadow.position.set(CABLE_X, 0.33, CABLE_Z);

  return {
    root,
    carriageInner,
    overheadSheave,
    handWheel,
    brakeLever,
    brassFrameMat,
    windShieldGroup,
    cargoGroup,
    cargoMeshes: {
      [CraftKind.CEDAR_JOINERY]: chestGroup,
      [CraftKind.COPPER_LANTERN]: lampGroup,
      [CraftKind.LOOMED_TAPESTRY]: tapestryGroup,
    },
    shoeCharacter,
    groundContactShadow,
  };
}

export function createCableAndCounterweight(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; counterweight: THREE.Group } {
  const group = new THREE.Group();

  // Central Vertical Guide Cable (║)
  const cableHeight = 36.2;
  const cableGeo = new THREE.CylinderGeometry(0.055, 0.055, cableHeight, 10);
  const cableMat = new THREE.MeshStandardMaterial({
    map: textures.cableAlbedo,
    roughness: 0.65,
    metalness: 0.25,
  });
  disposables.push(cableGeo, cableMat);

  const mainCable = new THREE.Mesh(cableGeo, cableMat);
  mainCable.position.set(CABLE_X, cableHeight / 2 + 0.35, CABLE_Z);
  mainCable.castShadow = true;
  group.add(mainCable);

  // Secondary Return Cable & Moving Cast-Iron Counterweight
  const cwX = 1.65;
  const cwZ = 1.72;
  const cwCableGeo = new THREE.CylinderGeometry(0.032, 0.032, cableHeight, 8);
  disposables.push(cwCableGeo);
  const cwCable = new THREE.Mesh(cwCableGeo, cableMat);
  cwCable.position.set(cwX, cableHeight / 2 + 0.35, cwZ);
  group.add(cwCable);

  const counterweight = new THREE.Group();
  counterweight.position.set(cwX, 31.5, cwZ);

  const ironMat = new THREE.MeshStandardMaterial({
    color: '#2A3330',
    roughness: 0.45,
    metalness: 0.85,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.24,
    metalness: 0.88,
  });
  const cwBodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.35, 14);
  const cwCollarGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 14);
  disposables.push(ironMat, brassMat, cwBodyGeo, cwCollarGeo);

  const cwBody = new THREE.Mesh(cwBodyGeo, ironMat);
  cwBody.castShadow = true;
  const cwTop = new THREE.Mesh(cwCollarGeo, brassMat);
  cwTop.position.y = 0.52;
  const cwBot = new THREE.Mesh(cwCollarGeo, brassMat);
  cwBot.position.y = -0.52;
  counterweight.add(cwBody, cwTop, cwBot);
  group.add(counterweight);

  return { group, counterweight };
}

export function createCollaboratorRelayRig(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; slots: CollaboratorRelaySlot[] } {
  const group = new THREE.Group();
  const cableHeight = 35.4;

  const cableMat = new THREE.MeshStandardMaterial({
    map: textures.cableAlbedo,
    roughness: 0.68,
    metalness: 0.28,
  });
  const oakMat = new THREE.MeshStandardMaterial({
    map: textures.timberAlbedo,
    roughness: 0.68,
    metalness: 0.08,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#28312D',
    roughness: 0.42,
    metalness: 0.84,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.24,
    metalness: 0.88,
  });

  const auxCableGeo = new THREE.CylinderGeometry(0.024, 0.024, cableHeight, 8);
  const sledDeckGeo = new THREE.BoxGeometry(0.68, 0.1, 0.54);
  const sledYokeGeo = new THREE.BoxGeometry(0.06, 0.58, 0.06);
  const sledTopBarGeo = new THREE.BoxGeometry(0.68, 0.06, 0.08);
  const sheaveGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 16);
  const beaconCoreGeo = new THREE.OctahedronGeometry(0.14, 0);

  disposables.push(
    cableMat,
    oakMat,
    ironMat,
    brassMat,
    auxCableGeo,
    sledDeckGeo,
    sledYokeGeo,
    sledTopBarGeo,
    sheaveGeo,
    beaconCoreGeo
  );

  const laneCoords: Array<[number, number]> = [
    [-2.15, 2.08],
    [2.15, 2.08],
    [-2.55, 1.55],
    [2.55, 1.55],
    [-1.85, 2.65],
    [1.85, 2.65],
  ];

  // Flanking Auxiliary Collaborator Guide Cables on primary left/right lanes
  [-2.15, 2.15].forEach((lx) => {
    const cMesh = new THREE.Mesh(auxCableGeo, cableMat);
    cMesh.position.set(lx, cableHeight / 2 + 0.35, 2.08);
    group.add(cMesh);
  });

  const slots: CollaboratorRelaySlot[] = [];

  for (let i = 0; i < 6; i++) {
    const [sx, sz] = laneCoords[i];
    const slotGroup = new THREE.Group();
    slotGroup.position.set(sx, MIN_LIFT_Y, sz);
    slotGroup.visible = false;

    const deck = new THREE.Mesh(sledDeckGeo, oakMat);
    deck.castShadow = true;
    const yokeL = new THREE.Mesh(sledYokeGeo, ironMat);
    yokeL.position.set(-0.28, 0.32, 0);
    const yokeR = new THREE.Mesh(sledYokeGeo, ironMat);
    yokeR.position.set(0.28, 0.32, 0);
    const topBar = new THREE.Mesh(sledTopBarGeo, brassMat);
    topBar.position.set(0, 0.62, 0);

    const sheave = new THREE.Group();
    sheave.position.set(0, 0.74, 0);
    const sheaveMesh = new THREE.Mesh(sheaveGeo, brassMat);
    sheaveMesh.rotation.y = Math.PI / 2;
    sheave.add(sheaveMesh);

    const beaconMat = new THREE.MeshStandardMaterial({
      color: '#7CE0A3',
      emissive: '#7CE0A3',
      emissiveIntensity: 1.2,
      roughness: 0.22,
      metalness: 0.35,
    });
    disposables.push(beaconMat);

    const beacon = new THREE.Mesh(beaconCoreGeo, beaconMat);
    beacon.position.set(0, 0.28, 0);

    slotGroup.add(deck, yokeL, yokeR, topBar, sheave, beacon);
    group.add(slotGroup);

    slots.push({
      group: slotGroup,
      sheave,
      beaconMat,
      currentY: MIN_LIFT_Y,
      targetY: MIN_LIFT_Y,
      active: false,
    });
  }

  return { group, slots };
}

/**
 * Creates the Diegetic 3D Agarwood Tree Lift Control Console embedded directly into
 * a sculpted heartwood channel on the Agarwood trunk beside the pulley carriage.
 * Every control button has a physical 3D plunger + Layer 1 Raycast proxy.
 */
export function createAgarwoodTrunkControlRig(
  textures: ProceduralTextureSet,
  disposables: Array<{ dispose: () => void }>
): AgarwoodTrunkControlRig {
  const root = new THREE.Group();

  // Materials: Resinous Agarwood burl, carved heartwood, brushed brass, warm amber sap
  const burlHousingMat = new THREE.MeshStandardMaterial({
    map: textures.barkAlbedo,
    bumpMap: textures.barkBump,
    bumpScale: 0.05,
    color: '#4B3120',
    roughness: 0.82,
    metalness: 0.05,
  });
  const carvedHeartwoodMat = new THREE.MeshStandardMaterial({
    color: '#23150C',
    roughness: 0.64,
    metalness: 0.08,
  });
  const brassRailMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.24,
    metalness: 0.88,
  });
  const sapAmberMat = new THREE.MeshStandardMaterial({
    color: '#FFD166',
    emissive: '#FFA630',
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const proxyInvisibleMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(
    burlHousingMat,
    carvedHeartwoodMat,
    brassRailMat,
    sapAmberMat,
    proxyInvisibleMat
  );

  // 1. Living Agarwood Heartwood Channel & Brass Dovetail Guide Spine Embedded into Trunk
  const spineX = -1.68;
  const spineZ = 1.48;
  const spineHeight = 34.4;

  const barkSpineGeo = new THREE.BoxGeometry(0.62, spineHeight, 0.36);
  const brassTrackGeo = new THREE.CylinderGeometry(0.032, 0.032, spineHeight, 10);
  const barkCollarGeo = new THREE.TorusGeometry(0.38, 0.09, 8, 16);
  barkCollarGeo.rotateX(Math.PI / 2);
  disposables.push(barkSpineGeo, brassTrackGeo, barkCollarGeo);

  const barkSpine = new THREE.Mesh(barkSpineGeo, burlHousingMat);
  barkSpine.position.set(spineX, spineHeight / 2 + 0.35, spineZ - 0.14);
  barkSpine.rotation.y = 0.22;
  barkSpine.castShadow = true;
  barkSpine.receiveShadow = true;
  root.add(barkSpine);

  [-0.18, 0.18].forEach((offsetX) => {
    const rail = new THREE.Mesh(brassTrackGeo, brassRailMat);
    rail.position.set(spineX + offsetX, spineHeight / 2 + 0.35, spineZ + 0.04);
    root.add(rail);
  });

  // Living Agarwood bark collars clasping the guide spine into the tree every 4.5m
  for (let cy = 2.0; cy <= 33.5; cy += 4.5) {
    const collar = new THREE.Mesh(barkCollarGeo, burlHousingMat);
    collar.position.set(spineX, cy, spineZ - 0.08);
    collar.scale.set(1.15, 1, 0.72);
    root.add(collar);
  }

  // 2. Sculpted Agarwood Burl Control Console Housing (tracks liftY smoothly inside the bark spine)
  const consoleCarriage = new THREE.Group();
  consoleCarriage.position.set(spineX, MIN_LIFT_Y + 1.25, spineZ + 0.16);
  consoleCarriage.rotation.y = 0.22;

  const housingShape = new THREE.Shape();
  const hw = 1.16;
  const hh = 1.42;
  const rad = 0.16;
  housingShape.moveTo(-hw + rad, -hh);
  housingShape.lineTo(hw - rad, -hh);
  housingShape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  housingShape.lineTo(hw, hh - rad);
  housingShape.quadraticCurveTo(hw, hh, hw - rad, hh);
  housingShape.lineTo(-hw + rad, hh);
  housingShape.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  housingShape.lineTo(-hw, -hh + rad);
  housingShape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);

  const housingGeo = new THREE.ExtrudeGeometry(housingShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
  });
  const innerRecessGeo = new THREE.BoxGeometry(2.14, 2.66, 0.08);
  const consoleSignGeo = new THREE.PlaneGeometry(2.02, 1.01);
  const sapHoodGeo = new THREE.ConeGeometry(0.22, 0.18, 12);
  const sapOrbGeo = new THREE.SphereGeometry(0.09, 12, 12);
  disposables.push(
    housingGeo,
    innerRecessGeo,
    consoleSignGeo,
    sapHoodGeo,
    sapOrbGeo
  );

  const burlBody = new THREE.Mesh(housingGeo, burlHousingMat);
  burlBody.position.z = -0.12;
  burlBody.castShadow = true;
  burlBody.receiveShadow = true;

  const innerRecess = new THREE.Mesh(innerRecessGeo, carvedHeartwoodMat);
  innerRecess.position.z = 0.11;

  const consoleSignMat = new THREE.MeshStandardMaterial({
    map: textures.agarwoodConsoleSign,
    roughness: 0.34,
    metalness: 0.08,
  });
  disposables.push(consoleSignMat);

  const consoleSignMesh = new THREE.Mesh(consoleSignGeo, consoleSignMat);
  consoleSignMesh.position.set(0, 0.74, 0.162);

  // Overhead Warm Agarwood Resin Sap Sconce illuminating the embedded controls
  const sapHood = new THREE.Mesh(sapHoodGeo, brassRailMat);
  sapHood.position.set(0, 1.48, 0.22);
  const sapOrb = new THREE.Mesh(sapOrbGeo, sapAmberMat);
  sapOrb.position.set(0, 1.36, 0.22);

  const sapLight = new THREE.PointLight(0xffbe55, 2.4, 6.5, 1.8);
  sapLight.position.set(0, 1.32, 0.55);

  consoleCarriage.add(
    burlBody,
    innerRecess,
    consoleSignMesh,
    sapHood,
    sapOrb,
    sapLight
  );

  // 3. Tactile 3D Carved Wood & Brass Lift Control Buttons (Layer 1 Raycast Targets)
  const hitProxies: THREE.Mesh[] = [];
  const buttons = {} as Record<TreeLiftControlAction, AgarwoodControlButtonNode>;

  const createEmbeddedButton = (
    action: TreeLiftControlAction,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const plungerGroup = new THREE.Group();
    const baseZ = 0.175;
    plungerGroup.position.set(x, y, baseZ);

    const bezelMat = new THREE.MeshStandardMaterial({
      color: '#E5A93C',
      emissive: '#E5A93C',
      emissiveIntensity: 0.12,
      roughness: 0.26,
      metalness: 0.85,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: textures.liftControlFaces[action],
      roughness: 0.35,
      metalness: 0.12,
    });
    const bezelGeo = new THREE.BoxGeometry(width, height, 0.09);
    const faceGeo = new THREE.PlaneGeometry(width - 0.05, height - 0.05);
    const proxyGeo = new THREE.BoxGeometry(width + 0.12, height + 0.1, 0.28);
    disposables.push(bezelMat, faceMat, bezelGeo, faceGeo, proxyGeo);

    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.castShadow = true;
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.048;

    const hitProxy = new THREE.Mesh(proxyGeo, proxyInvisibleMat);
    hitProxy.position.z = 0.04;
    hitProxy.layers.set(1);
    hitProxy.userData.liftControl = action;

    plungerGroup.add(bezelMesh, faceMesh, hitProxy);
    consoleCarriage.add(plungerGroup);
    hitProxies.push(hitProxy);

    buttons[action] = {
      action,
      plungerGroup,
      bezelMat,
      hitProxy,
      baseZ,
      currentPress: 0,
    };
  };

  // Primary Lift Paddles: Haul Up, Rest / Hold, Lower Down
  createEmbeddedButton('ascend', 0, 0.02, 1.92, 0.34);
  createEmbeddedButton('stop', 0, -0.38, 1.92, 0.32);
  createEmbeddedButton('descend', 0, -0.78, 1.92, 0.34);

  // Engraved Brass Waystation Medallions: 0m Roots, 18m Bough, 33m Canopy
  createEmbeddedButton('glide_0', -0.66, -1.16, 0.6, 0.28);
  createEmbeddedButton('glide_18', 0, -1.16, 0.6, 0.28);
  createEmbeddedButton('glide_33', 0.66, -1.16, 0.6, 0.28);

  root.add(consoleCarriage);

  return {
    root,
    consoleCarriage,
    sapLight,
    buttons,
    hitProxies,
    plaqueGlows: [],
  };
}

export function createShoeCharacterRig(
  disposables: Array<{ dispose: () => void }>
): ShoeCharacterRig {
  const root = new THREE.Group();

  const upperMat = new THREE.MeshStandardMaterial({
    color: '#255C3B',
    roughness: 0.18,
    metalness: 0.06,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: '#183E27',
    roughness: 0.35,
    metalness: 0.08,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: '#1E2421',
    roughness: 0.86,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#E5A93C',
    roughness: 0.24,
    metalness: 0.85,
  });
  const steelCapMat = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.28,
    metalness: 0.86,
  });
  const rubberCapMat = new THREE.MeshStandardMaterial({
    color: '#F2ECE1',
    roughness: 0.72,
    metalness: 0.02,
  });

  // Shared footwear geometries (grounded at y = 0)
  const outsoleGeo = new THREE.BoxGeometry(0.19, 0.042, 0.42);
  const heelBlockGeo = new THREE.BoxGeometry(0.185, 0.032, 0.14);
  const lugGeo = new THREE.BoxGeometry(0.192, 0.018, 0.035);
  const vampGeo = new THREE.CapsuleGeometry(0.086, 0.18, 8, 14);
  vampGeo.rotateX(Math.PI / 2);
  const shaftGeo = new THREE.CylinderGeometry(0.094, 0.086, 0.44, 14);
  const cuffRimGeo = new THREE.TorusGeometry(0.096, 0.018, 8, 18);
  cuffRimGeo.rotateX(Math.PI / 2);
  const strapGeo = new THREE.BoxGeometry(0.024, 0.038, 0.085);
  const buckleGeo = new THREE.BoxGeometry(0.03, 0.048, 0.048);
  const steelCapGeo = new THREE.SphereGeometry(
    0.091,
    12,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  const pullLoopGeo = new THREE.TorusGeometry(0.032, 0.009, 6, 12);
  const laceBarGeo = new THREE.BoxGeometry(0.11, 0.014, 0.018);
  const heelSpurGeo = new THREE.BoxGeometry(0.075, 0.024, 0.035);

  disposables.push(
    upperMat,
    secondaryMat,
    soleMat,
    trimMat,
    steelCapMat,
    rubberCapMat,
    outsoleGeo,
    heelBlockGeo,
    lugGeo,
    vampGeo,
    shaftGeo,
    cuffRimGeo,
    strapGeo,
    buckleGeo,
    steelCapGeo,
    pullLoopGeo,
    laceBarGeo,
    heelSpurGeo
  );

  const buildSingleShoe = (sideSign: -1 | 1): SingleShoeParts => {
    const group = new THREE.Group();
    group.position.set(sideSign * 0.135, 0, 0);

    // 1. Lugged Outsole & Defined Heel Block
    const outsole = new THREE.Mesh(outsoleGeo, soleMat);
    outsole.position.set(0, 0.036, 0.03);
    outsole.castShadow = true;
    outsole.receiveShadow = true;
    group.add(outsole);

    const heel = new THREE.Mesh(heelBlockGeo, soleMat);
    heel.position.set(0, 0.016, -0.11);
    heel.castShadow = true;
    group.add(heel);

    for (let l = 0; l < 4; l++) {
      const lug = new THREE.Mesh(lugGeo, soleMat);
      lug.position.set(0, 0.012, 0.03 + l * 0.055);
      group.add(lug);
    }

    // 2. Sculpted Foot Vamp
    const vamp = new THREE.Mesh(vampGeo, upperMat);
    vamp.position.set(0, 0.105, 0.055);
    vamp.scale.set(1.02, 0.88, 1.08);
    vamp.castShadow = true;
    group.add(vamp);

    // 3. Adjustable Height Boot/Shoe Shaft (tall for Wellies, mid for Rigger/Work Boots, low for Shoes)
    const shaftMesh = new THREE.Mesh(shaftGeo, upperMat);
    shaftMesh.position.set(0, 0.31, -0.055);
    shaftMesh.rotation.x = 0.04;
    shaftMesh.castShadow = true;
    group.add(shaftMesh);

    // 4. Top Cuff Rim / Padded Ankle Collar
    const cuffRimMesh = new THREE.Mesh(cuffRimGeo, secondaryMat);
    cuffRimMesh.position.set(0, 0.53, -0.046);
    group.add(cuffRimMesh);

    // 5. Wellington Side Gusset Strap & Brass Buckle
    const buckleStrapGroup = new THREE.Group();
    const strap = new THREE.Mesh(strapGeo, secondaryMat);
    strap.position.set(sideSign * 0.094, 0.45, -0.04);
    const buckle = new THREE.Mesh(buckleGeo, trimMat);
    buckle.position.set(sideSign * 0.102, 0.45, -0.02);
    buckleStrapGroup.add(strap, buckle);
    group.add(buckleStrapGroup);

    // 6. Wellington Heel Kick-Off Spur
    const heelSpurMesh = new THREE.Mesh(heelSpurGeo, trimMat);
    heelSpurMesh.position.set(0, 0.09, -0.175);
    group.add(heelSpurMesh);

    // 7. Brushed-Steel Protective Toe Cap (Work Boots / Safety Wellies)
    const steelCapMesh = new THREE.Mesh(steelCapGeo, steelCapMat);
    steelCapMesh.position.set(0, 0.072, 0.178);
    steelCapMesh.rotation.x = Math.PI * 0.46;
    steelCapMesh.scale.set(1.03, 0.92, 0.85);
    steelCapMesh.visible = false;
    group.add(steelCapMesh);

    // 8. Soft Vulcanised Rubber Toe Cap (Canvas Maker Shoes)
    const rubberToeMesh = new THREE.Mesh(steelCapGeo, rubberCapMat);
    rubberToeMesh.position.set(0, 0.068, 0.18);
    rubberToeMesh.rotation.x = Math.PI * 0.46;
    rubberToeMesh.scale.set(1.04, 0.9, 0.86);
    rubberToeMesh.visible = false;
    group.add(rubberToeMesh);

    // 9. Twin Pull-On Side Loops (Timber Rigger Boots)
    const pullLoopsGroup = new THREE.Group();
    const loopOuter = new THREE.Mesh(pullLoopGeo, trimMat);
    loopOuter.position.set(sideSign * 0.095, 0.44, -0.05);
    loopOuter.rotation.y = Math.PI / 2;
    const loopInner = new THREE.Mesh(pullLoopGeo, trimMat);
    loopInner.position.set(-sideSign * 0.095, 0.44, -0.05);
    loopInner.rotation.y = Math.PI / 2;
    pullLoopsGroup.add(loopOuter, loopInner);
    pullLoopsGroup.visible = false;
    group.add(pullLoopsGroup);

    // 10. Crossed Workshop Laces across Instep
    const lacesGroup = new THREE.Group();
    for (let lc = 0; lc < 3; lc++) {
      const lace = new THREE.Mesh(laceBarGeo, trimMat);
      lace.position.set(0, 0.165 + lc * 0.036, 0.045 - lc * 0.024);
      lace.rotation.x = -0.5;
      lacesGroup.add(lace);
    }
    lacesGroup.visible = false;
    group.add(lacesGroup);

    return {
      group,
      shaftMesh,
      cuffRimMesh,
      buckleStrapGroup,
      steelCapMesh,
      rubberToeMesh,
      pullLoopsGroup,
      lacesGroup,
      heelSpurMesh,
    };
  };

  const leftShoe = buildSingleShoe(-1);
  const rightShoe = buildSingleShoe(1);
  root.add(leftShoe.group, rightShoe.group);

  const rig: ShoeCharacterRig = {
    root,
    leftShoe,
    rightShoe,
    upperMat,
    secondaryMat,
    soleMat,
    trimMat,
  };

  updateShoeCharacterAppearance(
    rig,
    'wellington_boots',
    'forest_welly_green'
  );

  return rig;
}

export function updateShoeCharacterAppearance(
  rig: ShoeCharacterRig,
  shoeKind: ShoeCharacterKind,
  colorway: ShoeColorway
): void {
  const spec =
    SHOE_CHARACTER_CATALOG[shoeKind] ||
    SHOE_CHARACTER_CATALOG.wellington_boots;
  const colorSpec =
    SHOE_COLORWAY_CATALOG[colorway] ||
    SHOE_COLORWAY_CATALOG[spec.defaultColorway];

  rig.upperMat.color.set(colorSpec.primaryHex);
  rig.upperMat.roughness = spec.upperRoughness;
  rig.upperMat.metalness = spec.upperMetalness;
  rig.upperMat.needsUpdate = true;

  rig.secondaryMat.color.set(
    shoeKind === 'safety_wellington_boots'
      ? '#FFD166'
      : colorSpec.secondaryHex
  );
  rig.secondaryMat.roughness = Math.min(0.9, spec.upperRoughness + 0.18);
  rig.secondaryMat.needsUpdate = true;

  rig.soleMat.color.set(spec.soleHex);
  rig.soleMat.needsUpdate = true;

  rig.trimMat.color.set(colorSpec.laceOrStrapHex);
  rig.trimMat.needsUpdate = true;

  const applyToSingle = (parts: SingleShoeParts) => {
    const hRatio = spec.shaftHeightRatio;
    const shaftHeight = 0.44 * hRatio;
    parts.shaftMesh.scale.set(1, hRatio, 1);
    parts.shaftMesh.position.y = 0.09 + shaftHeight * 0.5;

    parts.cuffRimMesh.position.y = 0.09 + shaftHeight;
    parts.buckleStrapGroup.visible = spec.hasBuckleStrap;
    parts.buckleStrapGroup.position.y = (hRatio - 1) * 0.34;
    parts.heelSpurMesh.visible = spec.footwearFamily === 'Wellington Boots';
    parts.steelCapMesh.visible = spec.hasSteelCap;
    parts.rubberToeMesh.visible = spec.hasRubberToeCap;
    parts.pullLoopsGroup.visible = spec.hasPullLoops;
    parts.pullLoopsGroup.position.y = (hRatio - 0.78) * 0.35;
    parts.lacesGroup.visible =
      !spec.hasBuckleStrap && !spec.hasPullLoops;
  };

  applyToSingle(rig.leftShoe);
  applyToSingle(rig.rightShoe);
}

function createWelcomeShoeBenchGroup(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  benchGroup: THREE.Group;
  hitProxy: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const benchGroup = new THREE.Group();

  const plinthGeo = new THREE.BoxGeometry(2.28, 0.08, 0.92);
  const lowerShelfGeo = new THREE.BoxGeometry(2.08, 0.08, 0.68);
  const upperShelfGeo = new THREE.BoxGeometry(2.08, 0.08, 0.56);
  const postGeo = new THREE.BoxGeometry(0.11, 2.32, 0.11);
  const signBoxGeo = new THREE.BoxGeometry(2.14, 0.52, 0.11);
  const beaconOrbGeo = new THREE.OctahedronGeometry(0.13, 0);
  const hitProxyGeo = new THREE.BoxGeometry(2.48, 2.65, 1.3);

  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.welcomeShoeSign,
    roughness: 0.28,
    metalness: 0.08,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#A8F5C4',
    emissive: '#4ADE80',
    emissiveIntensity: 0.95,
    roughness: 0.22,
  });
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    plinthGeo,
    lowerShelfGeo,
    upperShelfGeo,
    postGeo,
    signBoxGeo,
    beaconOrbGeo,
    hitProxyGeo,
    signFaceMat,
    beaconMat,
    hitMat
  );

  const plinth = new THREE.Mesh(plinthGeo, timberMat);
  plinth.position.set(0, 0.04, 0);
  plinth.receiveShadow = true;

  const lowerShelf = new THREE.Mesh(lowerShelfGeo, timberMat);
  lowerShelf.position.set(0, 0.38, 0.06);
  lowerShelf.castShadow = true;
  lowerShelf.receiveShadow = true;

  const upperShelf = new THREE.Mesh(upperShelfGeo, brassMat);
  upperShelf.position.set(0, 0.96, -0.04);
  upperShelf.castShadow = true;
  upperShelf.receiveShadow = true;

  const postL = new THREE.Mesh(postGeo, ironMat);
  postL.position.set(-1.02, 1.16, -0.24);
  postL.castShadow = true;
  const postR = new THREE.Mesh(postGeo, ironMat);
  postR.position.set(1.02, 1.16, -0.24);
  postR.castShadow = true;

  const signBoard = new THREE.Mesh(signBoxGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 2.02, -0.2);
  signBoard.castShadow = true;

  const beaconOrb = new THREE.Mesh(beaconOrbGeo, beaconMat);
  beaconOrb.position.set(0, 2.42, -0.2);

  benchGroup.add(
    plinth,
    lowerShelf,
    upperShelf,
    postL,
    postR,
    signBoard,
    beaconOrb
  );

  // Showcase 5 miniature 3D pairs on the Welcome Boot & Shoe Rack (including Green & Yellow Wellies!)
  const displayLineup: Array<{
    kind: ShoeCharacterKind;
    color: ShoeColorway;
    x: number;
    y: number;
    z: number;
    scale: number;
  }> = [
    {
      kind: 'wellington_boots',
      color: 'forest_welly_green',
      x: -0.68,
      y: 1.0,
      z: -0.02,
      scale: 0.78,
    },
    {
      kind: 'safety_wellington_boots',
      color: 'sunflower_welly_yellow',
      x: 0,
      y: 1.0,
      z: -0.02,
      scale: 0.78,
    },
    {
      kind: 'steel_toe_work_boots',
      color: 'heritage_oak_tan',
      x: 0.68,
      y: 1.0,
      z: -0.02,
      scale: 0.78,
    },
    {
      kind: 'artisan_work_shoes',
      color: 'oxblood_leather',
      x: -0.45,
      y: 0.42,
      z: 0.08,
      scale: 0.82,
    },
    {
      kind: 'canvas_maker_shoes',
      color: 'harbour_navy',
      x: 0.45,
      y: 0.42,
      z: 0.08,
      scale: 0.82,
    },
  ];

  displayLineup.forEach((slot) => {
    const sampleRig = createShoeCharacterRig(disposables);
    updateShoeCharacterAppearance(sampleRig, slot.kind, slot.color);
    sampleRig.root.position.set(slot.x, slot.y, slot.z);
    sampleRig.root.scale.setScalar(slot.scale);
    benchGroup.add(sampleRig.root);
  });

  const hitProxy = new THREE.Mesh(hitProxyGeo, hitMat);
  hitProxy.position.set(0, 1.32, 0);
  hitProxy.layers.set(1);
  hitProxy.userData.sceneAction = 'open_shoe_selector';
  benchGroup.add(hitProxy);

  return { benchGroup, hitProxy, beaconMat };
}

function createCanopyPaypalStoreStall(
  textures: ProceduralTextureSet,
  timberMat: THREE.Material,
  ironMat: THREE.Material,
  brassMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): {
  stallGroup: THREE.Group;
  hitProxy: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const stallGroup = new THREE.Group();

  const plinthGeo = new THREE.BoxGeometry(1.96, 0.08, 0.84);
  const counterGeo = new THREE.BoxGeometry(1.82, 0.84, 0.68);
  const counterTopGeo = new THREE.BoxGeometry(1.94, 0.09, 0.76);
  const postGeo = new THREE.BoxGeometry(0.1, 2.28, 0.1);
  const signGeo = new THREE.BoxGeometry(1.96, 0.5, 0.11);
  const bottleBodyGeo = new THREE.CylinderGeometry(0.055, 0.058, 0.18, 12);
  const bottleCapGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.06, 10);
  const chestGeo = new THREE.BoxGeometry(0.42, 0.24, 0.28);
  const beaconGeo = new THREE.OctahedronGeometry(0.14, 0);
  const hitProxyGeo = new THREE.BoxGeometry(2.2, 2.6, 1.15);

  const amberGlassMat = new THREE.MeshStandardMaterial({
    color: '#9A4B16',
    roughness: 0.18,
    metalness: 0.12,
  });
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: textures.canopyPaypalSign,
    roughness: 0.28,
    metalness: 0.08,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#FFE484',
    emissive: '#E5A93C',
    emissiveIntensity: 1.05,
    roughness: 0.22,
  });
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  disposables.push(
    plinthGeo,
    counterGeo,
    counterTopGeo,
    postGeo,
    signGeo,
    bottleBodyGeo,
    bottleCapGeo,
    chestGeo,
    beaconGeo,
    hitProxyGeo,
    amberGlassMat,
    signFaceMat,
    beaconMat,
    hitMat
  );

  const plinth = new THREE.Mesh(plinthGeo, timberMat);
  plinth.position.set(0, 0.04, 0);
  plinth.receiveShadow = true;

  const counter = new THREE.Mesh(counterGeo, timberMat);
  counter.position.set(0, 0.46, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;

  const counterTop = new THREE.Mesh(counterTopGeo, brassMat);
  counterTop.position.set(0, 0.92, 0.02);
  counterTop.castShadow = true;

  const postL = new THREE.Mesh(postGeo, ironMat);
  postL.position.set(-0.88, 1.14, -0.24);
  const postR = new THREE.Mesh(postGeo, ironMat);
  postR.position.set(0.88, 1.14, -0.24);

  const signBoard = new THREE.Mesh(signGeo, [
    ironMat,
    ironMat,
    ironMat,
    ironMat,
    signFaceMat,
    signFaceMat,
  ]);
  signBoard.position.set(0, 1.98, -0.2);
  signBoard.castShadow = true;

  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 2.38, -0.2);

  stallGroup.add(plinth, counter, counterTop, postL, postR, signBoard, beacon);

  // Handcrafted Canopy Wares on the Counter: 3 Amber Agarwood Essential Oil Dropper Bottles + Cedar Chest
  [-0.58, -0.38, -0.18].forEach((bx) => {
    const bBody = new THREE.Mesh(bottleBodyGeo, amberGlassMat);
    bBody.position.set(bx, 1.055, 0.05);
    bBody.castShadow = true;
    const bCap = new THREE.Mesh(bottleCapGeo, brassMat);
    bCap.position.set(bx, 1.175, 0.05);
    stallGroup.add(bBody, bCap);
  });

  const craftChest = new THREE.Mesh(chestGeo, timberMat);
  craftChest.position.set(0.42, 1.08, 0.04);
  craftChest.castShadow = true;
  stallGroup.add(craftChest);

  const hitProxy = new THREE.Mesh(hitProxyGeo, hitMat);
  hitProxy.position.set(0, 1.3, 0);
  hitProxy.layers.set(1);
  hitProxy.userData.sceneAction = 'open_canopy_paypal_store';
  stallGroup.add(hitProxy);

  return { stallGroup, hitProxy, beaconMat };
}


