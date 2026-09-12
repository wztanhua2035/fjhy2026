export const OUTDOOR_CAMERA_ZOOM = 1.08;
export const OUTDOOR_ACTOR_SCALE = 1.09;
export const INDOOR_ACTOR_SCALE_MULTIPLIER = 1.43;

export function actorVisualScale(sceneId: string): number {
  return OUTDOOR_ACTOR_SCALE * (sceneId === 'STREET_BAISHI_01' ? 1 : INDOOR_ACTOR_SCALE_MULTIPLIER);
}

export function formatCyclingQuestTracker(tracker: string, index: number, count: number): string {
  return count > 1 ? `${index + 1}/${count} · 点击切换任务\n${tracker}` : tracker;
}
