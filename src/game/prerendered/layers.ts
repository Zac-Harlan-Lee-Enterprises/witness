import type Phaser from 'phaser';

/**
 * Story-mark overlays on a pre-rendered person: one sprite per overlay
 * sheet (a bandage, the spare cloak, a water skin), with the same frame
 * names as the person's sheet, kept in step with the person after every
 * update (frame, position, depth just above, tint, alpha, visibility) and
 * destroyed with them. A frame an overlay has nothing in is hidden.
 */
export function attachLayers(
  scene: Phaser.Scene,
  base: Phaser.GameObjects.Sprite,
  keys: readonly string[],
): Phaser.GameObjects.Sprite[] {
  if (keys.length === 0) return [];
  const layers = keys.map((key) =>
    scene.add
      .sprite(base.x, base.y, key)
      .setOrigin(base.originX, base.originY)
      .setScale(base.scaleX, base.scaleY),
  );
  const sync = (): void => {
    const name = base.frame.name;
    layers.forEach((layer, i) => {
      const has = layer.texture.has(name);
      if (has && layer.frame.name !== name) layer.setFrame(name);
      layer
        .setVisible(base.visible && has)
        .setPosition(base.x, base.y)
        .setDepth(base.depth + (i + 1) * 0.001)
        .setAlpha(base.alpha)
        .setScale(base.scaleX, base.scaleY)
        .setTint(base.tintTopLeft, base.tintTopRight, base.tintBottomLeft, base.tintBottomRight);
    });
  };
  scene.events.on('postupdate', sync);
  base.once('destroy', () => {
    scene.events.off('postupdate', sync);
    layers.forEach((l) => l.destroy());
  });
  sync();
  return layers;
}
