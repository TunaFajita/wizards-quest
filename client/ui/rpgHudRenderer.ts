/**
 * Standalone pixel-art HUD renderer. Canvas 2D, no Phaser dependency.
 * Render to an offscreen canvas, feed the canvas to Phaser as a texture.
 */

export const HUD_W = 152;
export const HUD_H = 56;

export interface BarConfig {
  show:   boolean;
  label:  string;
  x: number; y: number; w: number; h: number;
  pct:    number;            // 0..100
  icon:   'hp' | 'mp' | 'sta' | 'none';
  dk: string; md: string; lt: string; hi: string;
  iconC1: string; iconC2: string;
}

export interface HudConfig {
  canvas: { w: number; h: number };
  frame:  { show: boolean; thickness: number; dark: string; mid: string; light: string };
  rivets: { show: boolean; c1: string; c2: string; c3: string };
  goldDots: { show: boolean; c1: string; c2: string };
  bg: { outer: string; inner: string };
  name: { show: boolean; text: string; x: number; y: number; color: string; shadow: string };
  level: {
    show: boolean; value: number; color: string; shadow: string;
    badgeBg: string; badgeBorder: string; align: 'left' | 'right'; offsetX: number; y: number;
  };
  divider: { show: boolean; y: number; c1: string; c2: string; pattern: number };
  bars: BarConfig[];
  barBg: string; barBgHi: string; barBorder: string;
}

export const HUD_CONFIG: HudConfig = {
  canvas: { w: 152, h: 56 },

  frame: {
    show: true,
    thickness: 3,
    dark:  '#1c1c2e',
    mid:   '#2e2e4a',
    light: '#4a4a6e',
  },

  rivets:   { show: true, c1: '#8a7a4a', c2: '#c4a84a', c3: '#e8d888' },
  goldDots: { show: true, c1: '#6a5a2a', c2: '#a08830' },
  bg:       { outer: '#0e0e1a', inner: '#161628' },

  name: {
    show:   true,
    text:   'ALDRIC',
    x:      7,
    y:      8,
    color:  '#e8e0d0',
    shadow: '#08080f',
  },

  level: {
    show:        true,
    value:       1,
    color:       '#ffe870',
    shadow:      '#2a2010',
    badgeBg:     '#1a1430',
    badgeBorder: '#a08830',
    align:       'right',
    offsetX:     5,
    y:           6,
  },

  divider: { show: true, y: 16, c1: '#6a5a2a', c2: '#a08830', pattern: 3 },

  bars: [
    {
      show: true, label: 'HP',
      x: 16, y: 20, w: 128, h: 8,
      pct: 100, icon: 'hp',
      dk: '#6b1020', md: '#c42040', lt: '#e85070', hi: '#ff90a0',
      iconC1: '#8b1a1a', iconC2: '#ff4455',
    },
    {
      show: true, label: 'MP',
      x: 16, y: 32, w: 128, h: 6,
      pct: 100, icon: 'mp',
      dk: '#102860', md: '#2050b0', lt: '#4080e0', hi: '#80b0ff',
      iconC1: '#1a3a8b', iconC2: '#55aaff',
    },
    {
      show: true, label: 'STA',
      x: 16, y: 42, w: 128, h: 4,
      pct: 100, icon: 'sta',
      dk: '#105820', md: '#20a040', lt: '#40d060', hi: '#80ff90',
      iconC1: '#1a6b2a', iconC2: '#55ff77',
    },
  ],

  ornaments: { show: true },
  barBg:     '#0a0a14',
  barBgHi:   '#1a1a28',
  barBorder: '#3a3a5a',
};

// 3x5 pixel font (uppercase + digits + a few symbols)
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
  '/':['001','001','010','100','100'],'+':['000','010','111','010','000'],
  '!':['010','010','010','000','010'],
};

const ICONS: Record<string, number[][] | null> = {
  hp:  [[0,0,0,0,0,0,0],[0,1,1,0,1,1,0],[1,2,1,1,1,2,0],[1,1,1,1,1,1,0],[0,1,1,1,1,0,0],[0,0,1,1,0,0,0],[0,0,0,0,0,0,0]],
  mp:  [[0,0,0,1,0,0,0],[0,0,1,2,1,0,0],[0,1,2,2,2,1,0],[0,1,2,2,2,1,0],[0,1,2,2,1,0,0],[0,0,1,1,0,0,0],[0,0,0,0,0,0,0]],
  sta: [[0,0,0,1,1,0,0],[0,0,1,1,0,0,0],[0,1,1,1,1,0,0],[0,0,0,1,1,0,0],[0,0,1,1,0,0,0],[0,1,1,0,0,0,0],[0,0,0,0,0,0,0]],
  none: null,
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

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  cfg: HudConfig,
  scale = 1,
): void {
  ctx.imageSmoothingEnabled = false;
  const W = cfg.canvas.w;
  const H = cfg.canvas.h;
  ctx.clearRect(0, 0, W * scale, H * scale);

  const px   = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  };

  rect(0, 0, W, H, cfg.bg.outer);

  if (cfg.frame.show) {
    const t = cfg.frame.thickness;
    const cols = [cfg.frame.dark, cfg.frame.mid, cfg.frame.light];
    for (let i = 0; i < t && i < 3; i++) {
      for (let x = 0; x < W; x++) { px(x, i, cols[i]); px(x, H - 1 - i, cols[i]); }
      for (let y = 0; y < H; y++) { px(i, y, cols[i]); px(W - 1 - i, y, cols[i]); }
    }
    for (let x = t; x < W - t; x++) px(x, t, 'rgba(255,255,255,0.06)');
    for (let y = t; y < H - t; y++) px(t, y, 'rgba(255,255,255,0.06)');
  }

  const pad = cfg.frame.show ? cfg.frame.thickness + 1 : 0;
  rect(pad, pad, W - pad * 2, H - pad * 2, cfg.bg.inner);

  if (cfg.rivets.show && cfg.frame.show) {
    const rv = (cx: number, cy: number) => {
      px(cx,     cy,     cfg.rivets.c2); px(cx + 1, cy,     cfg.rivets.c3);
      px(cx,     cy + 1, cfg.rivets.c1); px(cx + 1, cy + 1, cfg.rivets.c2);
    };
    rv(1, 1); rv(W - 3, 1); rv(1, H - 3); rv(W - 3, H - 3);
  }

  if (cfg.goldDots.show && cfg.frame.show) {
    for (let x = 5; x < W - 5; x++) {
      if (x % 4 === 0)      { px(x, pad, cfg.goldDots.c2); px(x, H - 1 - pad, cfg.goldDots.c2); }
      else if (x % 4 === 2) { px(x, pad, cfg.goldDots.c1); px(x, H - 1 - pad, cfg.goldDots.c1); }
    }
  }

  if (cfg.name.show) {
    const dn = cfg.name.text.length > 16 ? cfg.name.text.slice(0, 16) : cfg.name.text;
    drawText(ctx, dn, cfg.name.x, cfg.name.y, cfg.name.color, scale, cfg.name.shadow);
  }

  if (cfg.level.show) {
    const ls = 'LV' + String(cfg.level.value);
    const lw = textWidth(ls);
    const bw = lw + 6;
    const bh = 9;
    const bx = cfg.level.align === 'right' ? W - cfg.level.offsetX - bw : cfg.level.offsetX;
    const by = cfg.level.y;
    rect(bx, by, bw, bh, cfg.level.badgeBg);
    for (let x = bx; x < bx + bw; x++) { px(x, by, cfg.level.badgeBorder); px(x, by + bh - 1, cfg.level.badgeBorder); }
    for (let y = by; y < by + bh; y++) { px(bx, y, cfg.level.badgeBorder); px(bx + bw - 1, y, cfg.level.badgeBorder); }
    px(bx, by, cfg.goldDots.c2); px(bx + bw - 1, by, cfg.goldDots.c2);
    for (let x = bx + 1; x < bx + bw - 1; x++) px(x, by + 1, 'rgba(255,255,255,0.06)');
    drawText(ctx, ls, bx + 3, by + 2, cfg.level.color, scale, cfg.level.shadow);
  }

  if (cfg.divider.show) {
    for (let x = 5; x < W - 5; x++) {
      if (x % cfg.divider.pattern === 0)      px(x, cfg.divider.y, cfg.divider.c2);
      else if (x % cfg.divider.pattern === 1) px(x, cfg.divider.y, cfg.divider.c1);
    }
  }

  for (const bar of cfg.bars) {
    if (!bar.show) continue;
    const { x: bx, y: by, w: bw, h: bh, pct } = bar;

    rect(bx, by, bw, bh, cfg.barBg);
    for (let x = bx; x < bx + bw; x++) px(x, by, cfg.barBgHi);
    for (let y = by; y < by + bh; y++) px(bx, y, cfg.barBgHi);

    const fillW = Math.round(bw * pct / 100);
    if (fillW > 0) {
      rect(bx, by, fillW, bh, bar.md);
      for (let x = bx; x < bx + fillW; x++) { px(x, by, bar.lt); px(x, by + 1, bar.lt); }
      for (let x = bx; x < bx + fillW; x += 2) px(x, by, bar.hi);
      for (let x = bx; x < bx + fillW; x++) { px(x, by + bh - 1, bar.dk); if (bh > 4) px(x, by + bh - 2, bar.dk); }
      for (let x = bx + 3; x < bx + fillW - 1; x += 5)
        for (let d = 0; d < Math.min(3, bh - 4); d++)
          if (by + 2 + d < by + bh - 2) px(x + d, by + 2 + d, bar.hi + '30');
      if (fillW > 2) { px(bx + fillW - 1, by + 1, bar.hi); px(bx + fillW - 1, by + 2, bar.lt); }
    }

    for (let x = bx - 1; x <= bx + bw; x++) { px(x, by - 1, cfg.barBorder); px(x, by + bh, cfg.barBorder); }
    for (let y = by - 1; y <= by + bh; y++) { px(bx - 1, y, cfg.barBorder); px(bx + bw, y, cfg.barBorder); }

    const icon = ICONS[bar.icon];
    if (icon) {
      const ix = bx - 11;
      const iy = by;
      for (let r = 0; r < icon.length; r++)
        for (let c = 0; c < icon[r].length; c++) {
          const v = icon[r][c];
          if (v === 1)      px(ix + c, iy + r, bar.iconC1);
          else if (v === 2) px(ix + c, iy + r, bar.iconC2);
        }
    }
  }

  if (cfg.ornaments.show) {
    const rx = W - 7;
    px(rx,     20, cfg.goldDots.c2); px(rx + 1, 20, cfg.goldDots.c2);
    px(rx,     21, cfg.goldDots.c1); px(rx + 1, 21, cfg.goldDots.c2);
    px(rx,     H - 10, cfg.goldDots.c1); px(rx, H - 9, cfg.goldDots.c2); px(rx + 1, H - 9, cfg.goldDots.c2);
    const ox = 5;
    const oy = Math.min(22, H - 12);
    px(ox,     oy,     cfg.goldDots.c2); px(ox,     oy + 1, cfg.goldDots.c1);
    px(ox - 1 > pad ? ox - 1 : ox, oy + 1, cfg.goldDots.c1); px(ox + 1, oy + 1, cfg.goldDots.c1);
  }
}
