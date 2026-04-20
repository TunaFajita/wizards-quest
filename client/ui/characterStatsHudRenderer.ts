/**
 * Standalone pixel-art character-stats HUD renderer. Canvas 2D, no Phaser.
 * Port of the character-stats-hud JSX reference.
 */

export interface Stat {
  key:   string;
  label: string;
  name:  string;
  color: string;
  dark:  string;
}

export const STATS: Stat[] = [
  { key: 'vit', label: 'VIT', name: 'VIGOR',        color: '#ff4455', dark: '#6b1020' },
  { key: 'mnd', label: 'MND', name: 'MIND',         color: '#55aaff', dark: '#1a3a8b' },
  { key: 'end', label: 'END', name: 'ENDURANCE',    color: '#55ff77', dark: '#1a6b2a' },
  { key: 'str', label: 'STR', name: 'STRENGTH',     color: '#ff9955', dark: '#6b3010' },
  { key: 'dex', label: 'DEX', name: 'DEXTERITY',    color: '#ffdd55', dark: '#6b5510' },
  { key: 'int', label: 'INT', name: 'INTELLIGENCE', color: '#aa88ff', dark: '#3a1a6b' },
  { key: 'fth', label: 'FTH', name: 'FAITH',        color: '#eeddaa', dark: '#6b5530' },
  { key: 'arc', label: 'ARC', name: 'ARCANE',       color: '#ff88dd', dark: '#6b1a4a' },
];

export const TRACKED_STATS = ['vit', 'mnd', 'end', 'str', 'dex', 'int', 'fth', 'arc'];

export interface StatsState {
  level:       number;
  runes:       number;
  skillPoints: number;
  stats:       Record<string, number>;  // actual stat values — shown on left panel
  invested:    Record<string, number>;  // skill points spent per stat — shown on right panel
}

export interface PlusRegion { x: number; y: number; w: number; h: number; index: number; }
export interface Region     { x: number; y: number; w: number; h: number; }

// ── Canvas size ───────────────────────────────────────────────────────────────
export const W = 328;
export const H = 196;

// ── Internal layout ───────────────────────────────────────────────────────────
const LEFT_W           = 180;
const DIVIDER_X        = LEFT_W;
const HEADER_H         = 30;
export const PORTRAIT_Y    = HEADER_H + 4;
export const PORTRAIT_SIZE = 100;
export const PORTRAIT_X    = Math.floor((LEFT_W - PORTRAIT_SIZE) / 2);
const RIGHT_X       = DIVIDER_X + 4;
const RIGHT_W       = W - RIGHT_X - 4;
const SP_Y          = HEADER_H + 4;
const SP_H          = 10;
const STATS_START_Y = SP_Y + SP_H + 6;
const ROW_H         = 14;
const PLUS_SIZE     = 10;
const SUBMIT_Y      = H - 22;
const SUBMIT_H      = 13;

const C = {
  frameDark: '#1c1c2e', frameMid: '#2e2e4a', frameLight: '#4a4a6e',
  rivet1: '#8a7a4a', rivet2: '#c4a84a', rivet3: '#e8d888',
  bgOuter: '#0e0e1a', bgInner: '#161628',
  g1: '#6a5a2a', g2: '#a08830', g3: '#d4b840', g4: '#ffe870',
  text: '#e8e0d0', textDim: '#9a9ab8', shadow: '#08080f',
  plusBg: '#1a4a20', plusBgHi: '#2a6a30', plusBorder: '#55ff77',
  plusDisabled: '#222237', plusDisabledBorder: '#333347',
  portraitBg: '#0a0a1a', portraitBorder: '#2a2a4a',
  submitBg: '#0a0a14', submitBorder: '#a08830',
  submitBgHover: '#1a1430', submitBorderHover: '#ffe870',
};

// 3x5 pixel font (uppercase + digits + symbols)
const FONT: Record<string, string[]> = {
  A:['111','101','111','101','101'],B:['110','101','110','101','110'],
  C:['111','100','100','100','111'],D:['110','101','101','101','110'],
  E:['111','100','110','100','111'],F:['111','100','110','100','100'],
  G:['111','100','101','101','111'],H:['101','101','111','101','101'],
  I:['111','010','010','010','111'],J:['011','001','001','101','111'],
  K:['101','110','100','110','101'],L:['100','100','100','100','111'],
  M:['101','111','111','101','101'],N:['101','111','111','111','101'],
  O:['111','101','101','101','111'],P:['111','101','111','100','100'],
  Q:['111','101','101','111','001'],R:['111','101','111','110','101'],
  S:['111','100','111','001','111'],T:['111','010','010','010','010'],
  U:['101','101','101','101','111'],V:['101','101','101','101','010'],
  W:['101','101','111','111','101'],X:['101','101','010','101','101'],
  Y:['101','101','111','010','010'],Z:['111','001','010','100','111'],
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'],'7':['111','001','001','010','010'],
  '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],
  ' ':['000','000','000','000','000'],'.':['000','000','000','000','100'],
  '-':['000','000','111','000','000'],':':['000','010','000','010','000'],
  '+':['000','010','111','010','000'],
};

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color: string, scale: number, shadow?: string,
): void {
  const px = (a: number, b: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(a * scale, b * scale, scale, scale);
  };
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch];
    if (!g) { cx += 4; continue; }
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < g[r].length; c++)
        if (g[r][c] === '1') {
          if (shadow) px(cx + c, y + r + 1, shadow);
          px(cx + c, y + r, color);
        }
    cx += g[0].length + 1;
  }
}

function textWidth(text: string): number {
  let w = 0;
  for (const c of text.toUpperCase()) {
    const g = FONT[c];
    w += g ? g[0].length + 1 : 4;
  }
  return w > 0 ? w - 1 : 0;
}

function drawFrame(ctx: CanvasRenderingContext2D, scale: number): void {
  const px   = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); };
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); };

  rect(0, 0, W, H, C.bgOuter);

  for (let x = 0; x < W; x++) {
    px(x, 0, C.frameDark);   px(x, 1, C.frameMid);   px(x, 2, C.frameLight);
    px(x, H - 1, C.frameDark); px(x, H - 2, C.frameMid); px(x, H - 3, C.frameLight);
  }
  for (let y = 0; y < H; y++) {
    px(0, y, C.frameDark);   px(1, y, C.frameMid);   px(2, y, C.frameLight);
    px(W - 1, y, C.frameDark); px(W - 2, y, C.frameMid); px(W - 3, y, C.frameLight);
  }
  for (let x = 3; x < W - 3; x++) px(x, 3, 'rgba(255,255,255,0.06)');
  for (let y = 3; y < H - 3; y++) px(3, y, 'rgba(255,255,255,0.06)');

  rect(4, 4, W - 8, H - 8, C.bgInner);

  const rv = (cx: number, cy: number) => {
    px(cx,     cy,     C.rivet2); px(cx + 1, cy,     C.rivet3);
    px(cx,     cy + 1, C.rivet1); px(cx + 1, cy + 1, C.rivet2);
  };
  rv(1, 1); rv(W - 3, 1); rv(1, H - 3); rv(W - 3, H - 3);

  for (let x = 5; x < W - 5; x++) {
    if (x % 4 === 0)      { px(x, 4, C.g2); px(x, H - 5, C.g2); }
    else if (x % 4 === 2) { px(x, 4, C.g1); px(x, H - 5, C.g1); }
  }

  for (let y = 5; y < H - 5; y++) {
    px(DIVIDER_X - 1, y, C.frameDark);
    px(DIVIDER_X,     y, C.frameMid);
    px(DIVIDER_X + 1, y, C.frameLight);
  }
  px(DIVIDER_X - 1, 5,     C.rivet2); px(DIVIDER_X, 5,     C.rivet3);
  px(DIVIDER_X - 1, 6,     C.rivet1); px(DIVIDER_X, 6,     C.rivet2);
  px(DIVIDER_X - 1, H - 7, C.rivet1); px(DIVIDER_X, H - 7, C.rivet2);
  px(DIVIDER_X - 1, H - 6, C.rivet2); px(DIVIDER_X, H - 6, C.rivet3);
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  state: StatsState, xOffset: number, panelW: number, scale: number,
): void {
  const px = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); };

  const title = 'CHARACTER';
  const tw = textWidth(title);
  drawText(ctx, title, xOffset + Math.floor((panelW - tw) / 2), 8, C.g4, scale, '#2a2010');

  for (let x = xOffset + 5; x < xOffset + panelW - 5; x++) {
    if (x % 3 === 0)      px(x, 16, C.g2);
    else if (x % 3 === 1) px(x, 16, C.g1);
  }

  drawText(ctx, 'LV', xOffset + 6, 20, C.g3, scale, C.shadow);
  drawText(ctx, String(state.level), xOffset + 18, 20, C.text, scale, C.shadow);

  const runeVal = String(state.runes);
  const rvw     = textWidth(runeVal);
  drawText(ctx, 'RUNES', xOffset + panelW - 8 - rvw - 4 - textWidth('RUNES'), 20, C.g3, scale, C.shadow);
  drawText(ctx, runeVal, xOffset + panelW - 8 - rvw, 20, C.text, scale, C.shadow);
}

interface RowOptions { valueColor?: string; valueX?: number; plusRoom?: boolean; }

function drawStatRow(
  ctx: CanvasRenderingContext2D,
  stat: Stat, value: number | undefined,
  x: number, y: number, panelW: number, scale: number,
  options: RowOptions = {},
): void {
  const px = (a: number, b: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(a * scale, b * scale, scale, scale); };

  px(x,     y + 1, stat.color);
  px(x + 1, y + 1, stat.color);
  px(x,     y + 2, stat.dark);
  px(x + 1, y + 2, stat.dark);

  drawText(ctx, stat.label, x + 4, y, stat.color, scale, C.shadow);
  drawText(ctx, stat.name,  x + 4 + textWidth(stat.label) + 3, y, C.textDim, scale, C.shadow);

  if (value !== undefined) {
    const valStr = String(value);
    const vw     = textWidth(valStr);
    const valX   = options.valueX !== undefined
      ? options.valueX
      : x + panelW - vw - (options.plusRoom ? PLUS_SIZE + 4 : 4);
    drawText(ctx, valStr, valX, y, options.valueColor || C.text, scale, C.shadow);
  }
}

function drawPlus(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, enabled: boolean, hovered: boolean, scale: number,
): void {
  const px   = (a: number, b: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(a * scale, b * scale, scale, scale); };
  const rect = (a: number, b: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(a * scale, b * scale, w * scale, h * scale); };

  const bgCol = enabled ? (hovered ? C.plusBgHi : C.plusBg) : C.plusDisabled;
  const bdCol = enabled ? (hovered ? '#aaffbb' : C.plusBorder) : C.plusDisabledBorder;

  rect(x, y, PLUS_SIZE, PLUS_SIZE, bgCol);
  for (let i = x; i < x + PLUS_SIZE; i++) { px(i, y, bdCol); px(i, y + PLUS_SIZE - 1, bdCol); }
  for (let i = y; i < y + PLUS_SIZE; i++) { px(x, i, bdCol); px(x + PLUS_SIZE - 1, i, bdCol); }

  if (enabled) {
    px(x,                y, '#ddffee');
    px(x + PLUS_SIZE - 1, y, '#ddffee');
  }

  const plusCol = enabled ? (hovered ? '#ffffff' : '#aaffbb') : '#555566';
  const cx      = x + Math.floor(PLUS_SIZE / 2);
  const cy      = y + Math.floor(PLUS_SIZE / 2);
  for (let i = -2; i <= 2; i++) { px(cx + i, cy, plusCol); px(cx, cy + i, plusCol); }
}

export function drawStats(
  ctx: CanvasRenderingContext2D,
  state: StatsState,
  scale: number,
  hoveredPlus: number,
  submitHover: boolean,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W * scale, H * scale);
  const px   = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); };
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); };

  drawFrame(ctx, scale);

  // ── LEFT PANEL ─────────────────────────────────────────────────────────────
  drawHeader(ctx, state, 4, LEFT_W - 4, scale);

  rect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE, C.portraitBg);
  for (let i = PORTRAIT_X; i < PORTRAIT_X + PORTRAIT_SIZE; i++) {
    px(i, PORTRAIT_Y, C.portraitBorder);
    px(i, PORTRAIT_Y + PORTRAIT_SIZE - 1, C.portraitBorder);
  }
  for (let i = PORTRAIT_Y; i < PORTRAIT_Y + PORTRAIT_SIZE; i++) {
    px(PORTRAIT_X, i, C.portraitBorder);
    px(PORTRAIT_X + PORTRAIT_SIZE - 1, i, C.portraitBorder);
  }

  const trackedY    = PORTRAIT_Y + PORTRAIT_SIZE + 6;
  const trackedCols = 2;
  const colW        = Math.floor((LEFT_W - 10) / trackedCols);

  TRACKED_STATS.forEach((key, i) => {
    const stat = STATS.find(s => s.key === key);
    if (!stat) return;
    const col = i % trackedCols;
    const row = Math.floor(i / trackedCols);
    const sx  = 6 + col * colW;
    const sy  = trackedY + row * 11;

    const val = state.stats[key];
    drawStatRow(ctx, stat, val, sx, sy, colW - 2, scale, {
      valueColor: C.g4,
      valueX:     sx + colW - textWidth(String(val)) - 4,
    });
  });

  // ── RIGHT PANEL ────────────────────────────────────────────────────────────
  drawHeader(ctx, state, DIVIDER_X + 2, RIGHT_W, scale);

  const spLabel  = 'SKILL PTS:' + String(state.skillPoints);
  const spTW     = textWidth(spLabel);
  const spBoxW   = spTW + 10;
  const spBoxX   = RIGHT_X + Math.floor((RIGHT_W - spBoxW) / 2);
  const hasPts   = state.skillPoints > 0;

  if (hasPts) {
    rect(spBoxX, SP_Y, spBoxW, SP_H, '#3a2a10');
    for (let x = spBoxX + 1; x < spBoxX + spBoxW - 1; x++) px(x, SP_Y + 1, '#5a4a20');
  } else {
    rect(spBoxX, SP_Y, spBoxW, SP_H, '#1a1430');
  }
  const spBd = hasPts ? C.g3 : '#a08830';
  for (let x = spBoxX; x < spBoxX + spBoxW; x++) { px(x, SP_Y, spBd); px(x, SP_Y + SP_H - 1, spBd); }
  for (let y = SP_Y; y < SP_Y + SP_H; y++) { px(spBoxX, y, spBd); px(spBoxX + spBoxW - 1, y, spBd); }
  drawText(ctx, spLabel, spBoxX + 5, SP_Y + 3, hasPts ? C.g4 : '#888', scale, C.shadow);

  STATS.forEach((stat, i) => {
    const rowY = STATS_START_Y + i * ROW_H;
    const val  = state.invested[stat.key] ?? 0;

    if (i % 2 === 0) rect(RIGHT_X, rowY - 1, RIGHT_W, ROW_H - 2, '#12122a');

    drawStatRow(ctx, stat, val, RIGHT_X + 3, rowY, RIGHT_W - 6, scale, {
      plusRoom: true,
      valueX:   RIGHT_X + RIGHT_W - PLUS_SIZE - 6 - textWidth(String(val ?? 0)),
    });

    const plusX = RIGHT_X + RIGHT_W - PLUS_SIZE - 2;
    const plusY = rowY - 2;
    drawPlus(ctx, plusX, plusY, hasPts, hoveredPlus === i, scale);
  });

  // ── SUBMIT button ──────────────────────────────────────────────────────────
  const hintY = SUBMIT_Y - 9;
  const hint  = hasPts ? 'TAP + TO SPEND POINT' : 'NO POINTS AVAILABLE';
  const hw    = textWidth(hint);
  drawText(ctx, hint, RIGHT_X + Math.floor((RIGHT_W - hw) / 2), hintY,
    hasPts ? C.g3 : '#555566', scale, C.shadow);

  const submitBg = submitHover ? C.submitBgHover : C.submitBg;
  const submitBd = submitHover ? C.submitBorderHover : C.submitBorder;
  const submitX  = RIGHT_X + 10;
  const submitW  = RIGHT_W - 20;
  rect(submitX, SUBMIT_Y, submitW, SUBMIT_H, submitBg);
  for (let x = submitX; x < submitX + submitW; x++) {
    px(x, SUBMIT_Y,              submitBd);
    px(x, SUBMIT_Y + SUBMIT_H - 1, submitBd);
  }
  for (let y = SUBMIT_Y; y < SUBMIT_Y + SUBMIT_H; y++) {
    px(submitX,              y, submitBd);
    px(submitX + submitW - 1, y, submitBd);
  }
  px(submitX,              SUBMIT_Y,              C.g4);
  px(submitX + submitW - 1, SUBMIT_Y,              C.g4);
  px(submitX,              SUBMIT_Y + SUBMIT_H - 1, C.g4);
  px(submitX + submitW - 1, SUBMIT_Y + SUBMIT_H - 1, C.g4);

  const subText = 'SUBMIT';
  const sw      = textWidth(subText);
  drawText(ctx, subText, submitX + Math.floor((submitW - sw) / 2), SUBMIT_Y + 4,
    submitHover ? '#ffffff' : C.g4, scale, C.shadow);
}

export function getPlusRegions(): PlusRegion[] {
  return STATS.map((_, i) => ({
    x:     RIGHT_X + RIGHT_W - PLUS_SIZE - 2,
    y:     STATS_START_Y + i * ROW_H - 2,
    w:     PLUS_SIZE,
    h:     PLUS_SIZE,
    index: i,
  }));
}

export function getSubmitRegion(): Region {
  return {
    x: RIGHT_X + 10,
    y: SUBMIT_Y,
    w: RIGHT_W - 20,
    h: SUBMIT_H,
  };
}
