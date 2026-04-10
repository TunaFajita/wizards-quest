import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, TILE_IMG_HEIGHT } from '@shared/constants';

/** Generates the 5-tile isometric tileset as a Phaser canvas texture. */
export class TilesetGenerator {
  static generate(textures: Phaser.Textures.TextureManager): void {
    const W = ISO_TILE_WIDTH;
    const H = TILE_IMG_HEIGHT;
    const DH = ISO_TILE_HEIGHT;
    const cols = 5;
    const canvas = textures.createCanvas('tileset', W * cols, H)!;
    const ctx = canvas.context;

    this.drawStoneTile(ctx, 0, 0, W, H, DH);
    this.drawGrassTile(ctx, W, 0, W, H, DH);
    this.drawWallTile(ctx, W * 2, 0, W, H, DH);
    this.drawWaterTile(ctx, W * 3, 0, W, H, DH);
    this.drawDarkStoneTile(ctx, W * 4, 0, W, H, DH);

    canvas.refresh();
  }

  private static diamondPath(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(ox + w / 2, oy);
    ctx.lineTo(ox + w, oy + h / 2);
    ctx.lineTo(ox + w / 2, oy + h);
    ctx.lineTo(ox, oy + h / 2);
    ctx.closePath();
  }

  private static drawStoneTile(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number, dh: number,
  ): void {
    const dy = h - dh;
    ctx.save();
    this.diamondPath(ctx, ox, oy + dy, w, dh);
    ctx.clip();
    ctx.fillStyle = '#5a5a6e';
    ctx.fillRect(ox, oy + dy, w, dh);
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 1;
    for (const [sx, sy, sw, sh] of [
      [4,4,14,10],[18,2,12,12],[32,6,14,8],[48,3,12,11],
      [8,16,16,10],[26,14,14,12],[42,15,16,10],
      [2,26,12,5],[16,27,18,4],[36,26,14,5],[52,26,10,5],
    ]) {
      ctx.strokeRect(ox + sx, oy + dy + sy, sw, sh);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(ox + 18, oy + dy + 3, 11, 11);
    ctx.fillRect(ox + 42, oy + dy + 15, 15, 9);
    ctx.restore();
  }

  private static drawGrassTile(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number, dh: number,
  ): void {
    const dy = h - dh;
    ctx.save();
    this.diamondPath(ctx, ox, oy + dy, w, dh);
    ctx.clip();
    ctx.fillStyle = '#2d5a1e';
    ctx.fillRect(ox, oy + dy, w, dh);
    ctx.fillStyle = '#3a6b28';
    ctx.fillRect(ox + 10, oy + dy + 6, 8, 6);
    ctx.fillRect(ox + 30, oy + dy + 12, 12, 8);
    ctx.fillRect(ox + 48, oy + dy + 4, 6, 10);
    ctx.fillStyle = '#245216';
    ctx.fillRect(ox + 20, oy + dy + 14, 10, 6);
    ctx.fillRect(ox + 4, oy + dy + 18, 8, 8);
    ctx.fillStyle = '#4a8a38';
    for (const [gx, gy] of [[14,8],[22,18],[36,6],[50,14],[28,22],[8,12],[44,20]]) {
      ctx.fillRect(ox + gx, oy + dy + gy, 1, 3);
      ctx.fillRect(ox + gx + 2, oy + dy + gy + 1, 1, 2);
    }
    ctx.restore();
  }

  private static drawWallTile(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number, dh: number,
  ): void {
    const dy = h - dh;
    const wallH = 28;
    const topY = dy - wallH;

    this.diamondPath(ctx, ox, oy + topY, w, dh);
    ctx.fillStyle = '#3a3a4e';
    ctx.fill();
    this.diamondPath(ctx, ox + 4, oy + topY + 2, w - 8, dh - 4);
    ctx.fillStyle = '#444458';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(ox, oy + topY + dh / 2);
    ctx.lineTo(ox + w / 2, oy + topY + dh);
    ctx.lineTo(ox + w / 2, oy + dy + dh);
    ctx.lineTo(ox, oy + dy + dh / 2);
    ctx.closePath();
    ctx.fillStyle = '#2a2a3e';
    ctx.fill();

    ctx.strokeStyle = '#222236';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ly = oy + topY + dh / 2 + i * 7;
      ctx.beginPath();
      ctx.moveTo(ox + 1, ly + (dh / 2) * (i / 4));
      ctx.lineTo(ox + w / 2 - 1, ly + dh - (dh / 2) * (1 - i / 4));
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(ox + w / 2, oy + topY + dh);
    ctx.lineTo(ox + w, oy + topY + dh / 2);
    ctx.lineTo(ox + w, oy + dy + dh / 2);
    ctx.lineTo(ox + w / 2, oy + dy + dh);
    ctx.closePath();
    ctx.fillStyle = '#353548';
    ctx.fill();

    ctx.strokeStyle = '#2d2d42';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ly = oy + topY + dh / 2 + i * 7;
      ctx.beginPath();
      ctx.moveTo(ox + w / 2 + 1, ly + dh - (dh / 2) * (1 - i / 4));
      ctx.lineTo(ox + w - 1, ly + (dh / 2) * (i / 4));
      ctx.stroke();
    }

    const winX = ox + w / 2 + 10;
    const winY = oy + topY + dh + 4;
    ctx.fillStyle = '#ff9933';
    ctx.fillRect(winX, winY, 8, 6);
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(winX + 1, winY + 1, 6, 4);
    ctx.fillStyle = '#ffeeaa';
    ctx.fillRect(winX + 2, winY + 2, 4, 2);
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    ctx.strokeRect(winX, winY, 8, 6);
    ctx.beginPath();
    ctx.moveTo(winX + 4, winY);
    ctx.lineTo(winX + 4, winY + 6);
    ctx.stroke();
  }

  private static drawWaterTile(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number, dh: number,
  ): void {
    const dy = h - dh;
    ctx.save();
    this.diamondPath(ctx, ox, oy + dy, w, dh);
    ctx.clip();
    ctx.fillStyle = '#1a3a5e';
    ctx.fillRect(ox, oy + dy, w, dh);
    ctx.fillStyle = '#2a5a8a';
    ctx.fillRect(ox + 12, oy + dy + 8, 16, 2);
    ctx.fillRect(ox + 32, oy + dy + 16, 12, 2);
    ctx.fillRect(ox + 8, oy + dy + 20, 10, 1);
    ctx.fillRect(ox + 40, oy + dy + 10, 8, 1);
    ctx.fillStyle = 'rgba(120,180,255,0.3)';
    ctx.fillRect(ox + 20, oy + dy + 10, 4, 1);
    ctx.fillRect(ox + 38, oy + dy + 18, 6, 1);
    ctx.restore();
  }

  private static drawDarkStoneTile(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, w: number, h: number, dh: number,
  ): void {
    const dy = h - dh;
    ctx.save();
    this.diamondPath(ctx, ox, oy + dy, w, dh);
    ctx.clip();
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(ox, oy + dy, w, dh);
    ctx.strokeStyle = '#2e2e3e';
    ctx.lineWidth = 1;
    for (const [bx, by, bw, bh] of [
      [6,4,14,10],[22,2,16,12],[40,5,14,9],
      [4,16,18,10],[24,15,14,11],[40,16,16,10],
    ]) {
      ctx.strokeRect(ox + bx, oy + dy + by, bw, bh);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(ox + 8, oy + dy + 8, 20, 14);
    ctx.fillRect(ox + 36, oy + dy + 12, 16, 10);
    ctx.restore();
  }
}
