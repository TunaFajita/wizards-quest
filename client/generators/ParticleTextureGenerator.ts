/** Generates particle canvas textures: firefly, spark, fog. */
export class ParticleTextureGenerator {
  static generate(textures: Phaser.Textures.TextureManager): void {
    this.generateFirefly(textures);
    this.generateFog(textures);
  }

  private static generateFirefly(textures: Phaser.Textures.TextureManager): void {
    const canvas = textures.createCanvas('firefly', 8, 8)!;
    const ctx = canvas.context;
    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, 'rgba(255,220,100,1)');
    grad.addColorStop(0.4, 'rgba(255,180,50,0.6)');
    grad.addColorStop(1, 'rgba(255,150,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 8);
    canvas.refresh();
  }

  private static generateFog(textures: Phaser.Textures.TextureManager): void {
    const canvas = textures.createCanvas('fog', 64, 64)!;
    const ctx = canvas.context;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(150,160,200,0.12)');
    grad.addColorStop(1, 'rgba(100,110,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    canvas.refresh();
  }
}
