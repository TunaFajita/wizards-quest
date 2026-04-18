/** Creates character animations from LPC v3 (Universal) spritesheets (13 cols × 54 rows). */
export class AnimationFactory {
  private static readonly COLS = 13;

  // LPC row order: up=0, left=1, down=2, right=3
  // Game direction order: down=0, left=1, right=2, up=3
  private static readonly LPC_DIR_ROW = [2, 1, 3, 0];
  private static readonly DIR_NAMES   = ['down', 'left', 'right', 'up'];

  /** Helper: create a directional animation for a 4-row block. */
  private static createDirectional(
    anims: Phaser.Animations.AnimationManager,
    textureKey: string,
    animKey: string,            // e.g. 'wizard-walk'
    baseRow: number,            // first LPC row (up)
    frameCount: number,         // frames per direction
    frameRate: number,
    repeat: number,
    startFrame = 0,
  ): void {
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];
      const row     = baseRow + lpcDir;
      anims.create({
        key: `${animKey}-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: row * this.COLS + startFrame,
          end:   row * this.COLS + startFrame + frameCount - 1,
        }),
        frameRate,
        repeat,
      });
    }
  }

  /** Create every LPC v3 animation for one character sheet. */
  static createLPCAnimations(
    anims: Phaser.Animations.AnimationManager,
    textureKey: string,
    prefix: string,
  ): void {
    // ── Combat actions (rows 0-19) ───────────────────────────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-cast`,   0, 7,  12, 0);
    this.createDirectional(anims, textureKey, `${prefix}-thrust`, 4, 8,  14, 0);
    this.createDirectional(anims, textureKey, `${prefix}-walk`,   8, 8,  10, -1, 1); // skip frame 0 (idle)
    this.createDirectional(anims, textureKey, `${prefix}-slash`, 12, 6,  14, 0);
    this.createDirectional(anims, textureKey, `${prefix}-shoot`, 16, 13, 12, 0);

    // Idle — first frame of walk row, per direction
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];
      anims.create({
        key: `${prefix}-idle-${dirName}`,
        frames: [{ key: textureKey, frame: (8 + lpcDir) * this.COLS }],
        frameRate: 1,
      });
    }

    // ── Row 20: Hurt (6 frames, non-directional) ─────────────────────────────
    anims.create({
      key: `${prefix}-hurt`,
      frames: anims.generateFrameNumbers(textureKey, {
        start: 20 * this.COLS, end: 20 * this.COLS + 5,
      }),
      frameRate: 10, repeat: 0,
    });

    // ── Row 21: Climb (6 frames) ─────────────────────────────────────────────
    anims.create({
      key: `${prefix}-climb`,
      frames: anims.generateFrameNumbers(textureKey, {
        start: 21 * this.COLS, end: 21 * this.COLS + 5,
      }),
      frameRate: 8, repeat: -1,
    });

    // ── Rows 22-25: Dedicated idle (2 frames per direction) ──────────────────
    this.createDirectional(anims, textureKey, `${prefix}-idle-breathe`, 22, 2, 2, -1);

    // ── Rows 26-29: Jump (5 frames per direction) ────────────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-jump`, 26, 5, 10, 0);

    // ── Rows 30-33: Sit — 3 hold variants per direction ──────────────────────
    // col 0 = kneel, col 1 = cross-legged, col 2 = chair-sit (reserved for chair interactions)
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];
      for (let v = 0; v < 3; v++) {
        anims.create({
          key: `${prefix}-sit-idle-${v}-${dirName}`,
          frames: [{ key: textureKey, frame: (30 + lpcDir) * this.COLS + v }],
          frameRate: 1,
        });
      }
    }

    // ── Rows 34-37: Emote (3 frames per direction) ───────────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-emote`, 34, 3, 6, 0);

    // ── Rows 38-41: Run (8 frames per direction, looping) ────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-run`, 38, 8, 14, -1);

    // ── Rows 42-45: Combat idle (2 frames per direction, looping) ────────────
    this.createDirectional(anims, textureKey, `${prefix}-combat-idle`, 42, 2, 4, -1);

    // ── Rows 46-49: Backslash (13 frames per direction) ──────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-backslash`, 46, 13, 16, 0);

    // ── Rows 50-53: Halfslash (7 frames per direction) ───────────────────────
    this.createDirectional(anims, textureKey, `${prefix}-halfslash`, 50, 7, 16, 0);

    // ── Die — alias of halfslash freeze on last frame ────────────────────────
    // (LPC v3 has no dedicated die row — use halfslash last frame as death pose)
    for (let d = 0; d < 4; d++) {
      const lpcDir  = this.LPC_DIR_ROW[d];
      const dirName = this.DIR_NAMES[d];
      anims.create({
        key: `${prefix}-die-${dirName}`,
        frames: anims.generateFrameNumbers(textureKey, {
          start: (50 + lpcDir) * this.COLS,
          end:   (50 + lpcDir) * this.COLS + 6,
        }),
        frameRate: 8, repeat: 0,
      });
    }
  }

  /**
   * Create simple 4-direction walk animations for a mob spritesheet.
   * Assumes rows 0-3 = walk down/left/right/up, `framesPerDir` frames each.
   */
  static createMobAnimations(
    anims: Phaser.Animations.AnimationManager,
    textureKey: string,
    prefix: string,
    framesPerDir = 4,
    frameRate    = 8,
  ): void {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, i) => {
      const start = i * framesPerDir;
      anims.create({
        key:       `${prefix}-walk-${dir}`,
        frames:    anims.generateFrameNumbers(textureKey, { start, end: start + framesPerDir - 1 }),
        frameRate,
        repeat:    -1,
      });
    });
  }

  /** Convenience: register all sheets that are always loaded. */
  static createAllAnimations(anims: Phaser.Animations.AnimationManager): void {
    this.createLPCAnimations(anims, 'wizard',     'wizard');
    this.createLPCAnimations(anims, 'f-wizard',   'f-wizard');
    this.createLPCAnimations(anims, 'darklight',  'darklight');
    this.createLPCAnimations(anims, 'lizardman',  'lizardman');
  }
}
