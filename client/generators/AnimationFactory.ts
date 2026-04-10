/** Creates character animations from LPC sprite sheets. */
export class AnimationFactory {
  /**
   * Register wizard walk/idle/cast animations from the LPC sprite sheet.
   * Assumes 'wizard' spritesheet texture is already loaded (64x64 frames, 13 cols).
   */
  static createWizardAnimations(anims: Phaser.Animations.AnimationManager): void {
    const COLS = 13;
    // LPC directions: up=0, left=1, down=2, right=3
    // Our game: down=0, left=1, right=2, up=3
    const lpcDirRow = [2, 1, 3, 0];
    const dirNames = ['down', 'left', 'right', 'up'];

    for (let d = 0; d < 4; d++) {
      const lpcDir = lpcDirRow[d];

      // Walk (LPC rows 8-11, 9 frames)
      const walkRow = 8 + lpcDir;
      anims.create({
        key: `wizard-walk-${dirNames[d]}`,
        frames: anims.generateFrameNumbers('wizard', {
          start: walkRow * COLS + 1,
          end: walkRow * COLS + 8,
        }),
        frameRate: 10,
        repeat: -1,
      });

      // Idle (first frame of walk row)
      anims.create({
        key: `wizard-idle-${dirNames[d]}`,
        frames: [{ key: 'wizard', frame: walkRow * COLS }],
        frameRate: 1,
      });

      // Spellcast (LPC rows 0-3, 7 frames)
      const castRow = lpcDir;
      anims.create({
        key: `wizard-cast-${dirNames[d]}`,
        frames: anims.generateFrameNumbers('wizard', {
          start: castRow * COLS,
          end: castRow * COLS + 6,
        }),
        frameRate: 12,
        repeat: 0,
      });
    }
  }
}
