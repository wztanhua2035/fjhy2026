export function containSize(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { width: maxWidth, height: maxHeight };
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

function axisOrigin(viewport: number, map: number, player: number, zoom: number) {
  const visibleWorld = viewport / zoom;
  if (map <= visibleWorld) return (viewport - map) / 2;
  const lower = viewport / 2 + visibleWorld / 2 - map;
  const upper = viewport / 2 - visibleWorld / 2;
  return Math.max(lower, Math.min(upper, viewport / 2 - player));
}

/** The Web scene positions world objects itself, so clamp its world origin rather than a Phaser follow camera. */
export function worldOrigin(
  viewportWidth: number, viewportHeight: number,
  mapWidth: number, mapHeight: number,
  playerX: number, playerY: number, zoom: number,
) {
  return {
    x: axisOrigin(viewportWidth, mapWidth, playerX, zoom),
    y: axisOrigin(viewportHeight, mapHeight, playerY, zoom),
  };
}
