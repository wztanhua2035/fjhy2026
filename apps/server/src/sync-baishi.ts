import { initialWorld } from '../../../packages/game-config/index.js';
import type { WorldConfig } from '../../../packages/shared-types/index.js';
import type { Repository } from './repository.js';
import { validateWorld } from './config.js';

function merge<T extends { id: string }>(old: T[], current: T[]) {
  const updates = new Map(current.map(item => [item.id, item]));
  return [...old.map(item => updates.get(item.id) ?? item), ...current.filter(item => !old.some(previous => previous.id === item.id))];
}

// Publish content through the existing release lifecycle; never overwrite player saves.
export function baishiSyncPlan(previous: WorldConfig) {
  const scenes = initialWorld.scenes.filter(s => s.id === 'STREET_BAISHI_01' || s.id === 'INTERIOR_B_INN_GUEST_ROOM' || initialWorld.plots.some(p => p.sceneId === 'STREET_BAISHI_01' && initialWorld.buildings.some(b => b.id === p.buildingId && b.interiorSceneId === s.id)));
  const sceneIds = new Set(scenes.map(s => s.id));
  const plots = initialWorld.plots.filter(p => p.sceneId === 'STREET_BAISHI_01');
  const buildings = initialWorld.buildings.filter(b => plots.some(p => p.buildingId === b.id));
  const npcs = initialWorld.npcs.filter(n => sceneIds.has(n.sceneId));
  const quests = initialWorld.quests.filter(q => npcs.some(n => n.questId === q.id));
  const itemIds = new Set([...buildings.flatMap(b => Object.keys(b.stock)), ...quests.flatMap(q => q.steps.filter(s => s.type !== 'REPORT').map(s => s.target))]);
  const config = validateWorld({ ...previous, scenes: merge(previous.scenes, scenes), plots: merge(previous.plots, plots), buildings: merge(previous.buildings, buildings), npcs: merge(previous.npcs, npcs), quests: merge(previous.quests, quests), items: merge(previous.items, initialWorld.items.filter(i => itemIds.has(i.id))) }, previous);
  const changed = (['scenes', 'plots', 'buildings', 'npcs', 'quests', 'items'] as const).flatMap(key => config[key].filter(item => JSON.stringify(item) !== JSON.stringify(previous[key].find(old => old.id === item.id))).map(item => `${key}:${item.id}`));
  return { config, changed };
}

export async function syncBaishiContent(repo: Repository, apply = false) {
  const previous = await repo.world(), plan = baishiSyncPlan(previous);
  if (!apply || !plan.changed.length) return { changed: plan.changed, version: previous.configVersion, published: false };
  const draft = await repo.draft(plan.config, previous.configVersion);
  await repo.transition(draft.id, 'TEST');
  const published = await repo.transition(draft.id, 'PUBLISHED');
  return { changed: plan.changed, version: published.version, published: true };
}
