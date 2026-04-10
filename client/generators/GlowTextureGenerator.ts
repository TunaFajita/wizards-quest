/** Generates the radial glow canvas texture used by torch and player lights. */
export class GlowTextureGenerator {
  static generate(textures: Phaser.Textures.TextureManager): void {
    const size = 128;
    const canvas = textures.createCanvas('glow', size, size)!;
    const ctx = canvas.context;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,160,60,0.5)');
    grad.addColorStop(0.3, 'rgba(255,120,30,0.2)');
    grad.addColorStop(0.7, 'rgba(255,80,10,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
