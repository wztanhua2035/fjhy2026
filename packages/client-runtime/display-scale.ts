export const OUTDOOR_CAMERA_ZOOM = 1.08;
export const OUTDOOR_ACTOR_SCALE = 1.09;
export const INDOOR_ACTOR_SCALE_MULTIPLIER = 1.43;
export const PLAYER_NAME_GAP_PX = 6;
/** Shared scene-sign HUD metrics. Platform renderers only adapt safe-area offsets. */
export const SCENE_PLAQUE = {
  width: 148, minHeight: 34, top: 12, right: 14,
  fontSize: 16, paddingX: 12, paddingY: 7,
  backgroundColor: '#f8f3e5', color: '#315b51', stroke: '#d8caa9', strokeThickness: 1
} as const;
/** Keep 64px character sheets crisp on both Phaser Canvas runtimes. */
export const PIXEL_ART_RENDER_CONFIG = { pixelArt: true, antialias: false, roundPixels: true } as const;
export const PLAYER_NAME_STYLE = {
  fontFamily: 'Microsoft YaHei, Arial', fontSize: '17px', fontStyle: 'bold',
  color: '#fff8e8', backgroundColor: '#28554d', padding: { x: 7, y: 3 },
  stroke: '#183d36', strokeThickness: 1
};

export function actorVisualScale(sceneId: string): number {
  return OUTDOOR_ACTOR_SCALE * (sceneId === 'STREET_BAISHI_01' ? 1 : INDOOR_ACTOR_SCALE_MULTIPLIER);
}

export function playerNameTopY(footY: number, footAnchorY: number, renderScale: number, sceneId: string, frameOffsetY = 0): number {
  return footY + frameOffsetY - footAnchorY * renderScale * actorVisualScale(sceneId) - PLAYER_NAME_GAP_PX;
}

/** One formal scene keeps one stable short label across Web and WeChat. */
export function sceneLabelFor(scene?: { name?: string; sceneLabel?: string } | null): string {
  return scene?.sceneLabel?.trim() || scene?.name?.trim() || '横阳';
}

export function formatCyclingQuestTracker(tracker: string, index: number, count: number): string {
  return count > 1 ? `${index + 1}/${count} · 点击切换任务\n${tracker}` : tracker;
}
