/** Creates character animations from LPC sprite sheets. */
export class AnimationFactory {
  private static readonly COLS = 13;

  // LPC row order: up=0, left=1, down=2, right=3
  // Game direction order: down=0, left=1, right=2, up=3
  private static readonly LPC_DIR_ROW = [2, 1, 3, 0];
  private static readonly DIR_NAMES   = ['down', 'left', 'right', 'up'];

  /**
   * Register walk/idle/cast animations for any LPC-format spritesheet.
   * @param textureKey  The Phaser texture key for the spritesheet.
   * @param prefix      Animation key prefix (e.g. 'wizard', 'f-wizard', 'darklight').
   */
  static createLPCAnimations(
    anims: Phaser.Animations.AnimationManager,
    textureKey: string,
    prefix: string,
  ): void {
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];

      // Walk — LPC rows 8-11, frames 1-8
      const walkRow = 8 + lpcDir;
      anims.create({
        key: `${prefix}-walk-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: walkRow * this.COLS + 1,
          end:   walkRow * this.COLS + 8,
        }),
        frameRate: 10,
        repeat: -1,
      });

      // Idle — first frame of walk row
      anims.create({
        key: `${prefix}-idle-${dirName}`,
        frames: [{ key: textureKey, frame: walkRow * this.COLS }],
        frameRate: 1,
      });

      // Spellcast — LPC rows 0-3, frames 0-6
      const castRow = lpcDir;
      anims.create({
        key: `${prefix}-cast-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: castRow * this.COLS,
          end:   castRow * this.COLS + 6,
        }),
        frameRate: 12,
        repeat: 0,
      });

      // Thrust (unarmed / spear) — LPC rows 4-7, frames 0-7
      const thrustRow = 4 + lpcDir;
      anims.create({
        key: `${prefix}-thrust-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: thrustRow * this.COLS,
          end:   thrustRow * this.COLS + 7,
        }),
        frameRate: 14,
        repeat: 0,
      });

      // Slash (sword / axe) — LPC rows 12-15, frames 0-5
      const slashRow = 12 + lpcDir;
      anims.create({
        key: `${prefix}-slash-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: slashRow * this.COLS,
          end:   slashRow * this.COLS + 5,
        }),
        frameRate: 14,
        repeat: 0,
      });
    }
  }

  /**
   * Register walk/idle/attack animations for the skeleton mob sheet.
   * Same LPC row layout as characters but frame size is 128×128.
   */
  static createSkeletonAnimations(anims: Phaser.Animations.AnimationManager): void {
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];

      // Idle — frame 0 of the walk row
      const walkRow = 8 + lpcDir;
      anims.create({
        key: `skeleton-idle-${dirName}`,
        frames: [{ key: 'skeleton', frame: walkRow * this.COLS }],
        frameRate: 1,
      });

      // Walk — LPC rows 8-11, frames 1-8
      anims.create({
        key: `skeleton-walk-${dirName}`,
        frames: anims.generateFrameNumbers('skeleton', {
          start: walkRow * this.COLS + 1,
          end:   walkRow * this.COLS + 8,
        }),
        frameRate: 10,
        repeat: -1,
      });

      // Attack — slash rows 12-15, frames 0-5
      const slashRow = 12 + lpcDir;
      anims.create({
        key: `skeleton-attack-${dirName}`,
        frames: anims.generateFrameNumbers('skeleton', {
          start: slashRow * this.COLS,
          end:   slashRow * this.COLS + 5,
        }),
        frameRate: 12,
        repeat: 0,
      });
    }
  }

  /** Convenience: register all sheets that are always loaded. */
  static createAllAnimations(anims: Phaser.Animations.AnimationManager): void {
    this.createLPCAnimations(anims, 'wizard',    'wizard');
    this.createLPCAnimations(anims, 'f-wizard',  'f-wizard');
    this.createLPCAnimations(anims, 'darklight',  'darklight');
    this.createSkeletonAnimations(anims);
  }
}
