import { initialWorld } from '../../../packages/game-config/index.js';
import { sceneView } from '../../../packages/game-rules/index.js';
import type { QuestRuntime, SceneView } from '../../../packages/shared-types/index.js';

function canonical(value: any): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function baishiCompatibility(actual: SceneView, quests: QuestRuntime[]) {
  const expected = sceneView(initialWorld, 'STREET_BAISHI_01', new Date('2026-09-12T02:00:00Z'), true);
  const missing: string[] = [];
  for (const plot of expected.plots.filter(p => p.buildingId)) {
    const other = actual.plots.find(p => p.id === plot.id);
    if (!other || canonical(other) !== canonical(plot)) missing.push(plot.id);
  }
  if (canonical(actual.scene.collision) !== canonical(expected.scene.collision)) missing.push('scene.collision');
  for (const id of ['Q_001', 'Q_003']) {
    if (canonical(quests.find(q => q.id === id)?.steps) !== canonical(initialWorld.quests.find(q => q.id === id)?.steps)) missing.push(id);
  }
  return missing;
}
