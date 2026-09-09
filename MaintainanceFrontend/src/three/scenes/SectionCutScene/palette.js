import { AdditiveBlending, Color, NormalBlending } from 'three';
import { ROOMS } from './rooms';

/**
 * Every colour in the scene comes from a CSS variable, which is what lets a
 * theme toggle repaint the model in place rather than stranding it in the old
 * palette or replaying the build.
 */

/** `--gold: 34 58% 45%` → a Color. The tokens are bare triples, not functions. */
function cssColor(styles, name, fallback) {
  const raw = styles.getPropertyValue(name).trim();
  const [h, s, l] = raw.split(/[\s/]+/);
  if (!h || !s || !l) return new Color(fallback);
  return new Color().setHSL(parseFloat(h) / 360, parseFloat(s) / 100, parseFloat(l) / 100);
}

const HSL = { h: 0, s: 0, l: 0 };
/** Keeps a token's hue but forces its lightness — used for the three lights. */
const tintL = (c, l) => { c.getHSL(HSL); return c.setHSL(HSL.h, HSL.s, l); };

const TOKENS = {
  substrate: ['--build-substrate', '#9aa3a6'],
  screed: ['--build-screed', '#c8b49a'],
  membrane: ['--build-membrane', '#1f7fc4'],
  adhesive: ['--build-adhesive', '#a8b6ae'],
  tile: ['--build-tile', '#c2704a'],
  board: ['--build-board', '#cbc5b8'],
  wallTile: ['--build-walltile', '#3f8f92'],
  live: ['--trade-live', '#f08b1d'],
  cold: ['--trade-cold', '#3fa9e8'],
  porcelain: ['--trade-porcelain', '#f6f3ec'],
  hot: ['--destructive', '#b93b32'],
  waste: ['--muted-foreground', '#6b7276'],
  gold: ['--gold', '#c08a3e'],
  ink: ['--ink', '#0a1418'],
  paper: ['--background', '#faf8f5'],
  primary: ['--primary', '#154c59'],
  outline: ['--foreground', '#1b262b'],
  timber: ['--room-timber', '#8a5a34'],
  fabric: ['--room-fabric', '#96806e'],
  rug: ['--room-rug', '#2f5f63'],
};

/**
 * Reads the stylesheet and pushes it into the model's materials and lights.
 * Called once at build and again on every theme change; `applyPose` is
 * re-run afterwards, since the pose owns emissive strength and blending.
 */
export function paint(model) {
  const {
    hemi, key, fill, roomFloor, roomWall,
    substrateMat, substrateShadeMat, screedMat, membraneMat, adhesiveMat, boardMat, timberMat,
    fabricMat, liveMat, coldMat, hotMat, wasteMat, porcelainMat, brassMat, cutCapMat, darkMat,
    rugMat, flashMat, fallMat, discMat, outlineMat, outlineGoldMat,
  } = model;

  const styles = getComputedStyle(document.documentElement);
  const c = {};
  for (const k of Object.keys(TOKENS)) c[k] = cssColor(styles, TOKENS[k][0], TOKENS[k][1]);
  const isDark = document.documentElement.classList.contains('dark');

  // Each room's two surfaces, kept as Colors so a transition is a lerp
  // rather than a re-read of the stylesheet on every frame.
  ROOMS.forEach((room, i) => {
    roomFloor[i] = cssColor(styles, room.floor, '#b06a46');
    roomWall[i] = cssColor(styles, room.wall, '#3f8f92');
  });

  substrateMat.color.copy(c.substrate);
  substrateShadeMat.color.copy(c.substrate).multiplyScalar(0.7);
  screedMat.color.copy(c.screed);
  membraneMat.color.copy(c.membrane);
  adhesiveMat.color.copy(c.adhesive);
  boardMat.color.copy(c.board);
  timberMat.color.copy(c.timber);
  fabricMat.color.copy(c.fabric);
  liveMat.color.copy(c.live);
  coldMat.color.copy(c.cold);
  hotMat.color.copy(c.hot);
  wasteMat.color.copy(c.waste);
  porcelainMat.color.copy(c.porcelain);
  porcelainMat.specular.setRGB(0.35, 0.35, 0.35);
  brassMat.color.copy(c.gold);
  brassMat.specular.copy(tintL(c.gold.clone(), 0.86));
  brassMat.emissive.copy(c.gold).multiplyScalar(0.10);
  cutCapMat.color.copy(c.gold);
  darkMat.color.copy(c.ink).lerp(c.paper, 0.12);
  rugMat.color.copy(c.rug);
  flashMat.color.copy(c.gold);
  fallMat.color.copy(c.gold);
  discMat.color.copy(c.ink);
  outlineMat.color.copy(c.outline);
  outlineGoldMat.color.copy(c.gold);

  // A thin pipe in shadow desaturates to grey and takes the hue-coding with
  // it, so every service run carries a little of its own colour as emissive.
  membraneMat.emissive.copy(c.membrane);
  liveMat.emissive.copy(c.live);
  coldMat.emissive.copy(c.cold);
  hotMat.emissive.copy(c.hot);
  wasteMat.emissive.copy(c.waste);

  // Additive gold has nothing to add to on near-white paper, so the fall
  // line changes blending with the theme rather than vanishing in light mode.
  fallMat.blending = isDark ? AdditiveBlending : NormalBlending;
  fallMat.needsUpdate = true;

  hemi.color.copy(tintL(c.paper.clone(), isDark ? 0.58 : 0.94));
  hemi.groundColor.copy(tintL(c.ink.clone(), isDark ? 0.10 : 0.20));
  hemi.intensity = isDark ? 0.70 : 1.05;
  key.color.copy(tintL(c.gold.clone(), 0.90));
  key.intensity = isDark ? 0.62 : 0.95;
  fill.color.copy(tintL(c.primary.clone(), 0.62));
  fill.intensity = isDark ? 0.40 : 0.26;

  // Read back by applyPose: additive gold needs a different opacity on paper.
  model.isDark = isDark;
}
