import type { RemoteAssetManifestEntry, RemoteAssetType } from '../packages/client-runtime/remote-assets.js';

/** Target values are decimal KB; hard limits are KiB/MiB. */
export const assetBudgets: Record<RemoteAssetType, { target: number; hard: number }> = {
  'scene-map': { target: 900_000, hard: Math.floor(1.2 * 1024 * 1024) },
  'scene-background': { target: 500_000, hard: 700 * 1024 },
  'scene-foreground': { target: 150_000, hard: 250 * 1024 },
  'shop-sign': { target: 100_000, hard: 150 * 1024 },
  portrait: { target: 350_000, hard: 600 * 1024 },
  icon: { target: 50_000, hard: 80 * 1024 }
};

export function assertAssetBudget(resource: RemoteAssetManifestEntry, bytes: number, warn = console.warn): void {
  const budget = assetBudgets[resource.type];
  if (bytes > budget.hard && !resource.sizeBudgetOverride?.reason?.trim()) {
    throw new Error(`Asset exceeds hard size limit (${budget.hard} bytes): ${resource.resourceId} (${bytes} bytes)`);
  }
  if (bytes > budget.target) warn(`Asset budget warning: ${resource.resourceId} ${bytes} bytes > target ${budget.target}`);
}
