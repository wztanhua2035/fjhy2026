export type RemoteAssetType = 'scene-background' | 'scene-foreground';

/** A portable resource contract: IDs and paths are stable across CDN providers. */
export interface RemoteAssetManifestEntry {
  resourceId: string;
  path: string;
  version: number;
  type: RemoteAssetType;
  /** Transitional packaged source. Remove only after remote delivery is verified on devices. */
  fallbackPath: string;
}

export interface RemoteAssetManifest {
  manifestVersion: number;
  resources: Record<string, RemoteAssetManifestEntry>;
}

const interior = (resourceId: string, path: string, fallbackPath: string, type: RemoteAssetType, version = 1): RemoteAssetManifestEntry => ({ resourceId, path, version, type, fallbackPath });

export const remoteAssetManifest: RemoteAssetManifest = {
  manifestVersion: 1,
  resources: {
    BAISHI_INTERIOR_SALON_BG: interior('BAISHI_INTERIOR_SALON_BG', 'world/baishi/interiors/salon/background_v1.png', '/scene-layers/baishi/interiors/interior_salon_v1.png', 'scene-background'),
    BAISHI_INTERIOR_SALON_FG: interior('BAISHI_INTERIOR_SALON_FG', 'world/baishi/interiors/salon/foreground_v1.png', '/scene-layers/baishi/interiors/interior_salon_fg_v1.png', 'scene-foreground'),
    BAISHI_INTERIOR_GROCERY_BG: interior('BAISHI_INTERIOR_GROCERY_BG', 'world/baishi/interiors/grocery/background_v1.png', '/scene-layers/baishi/interiors/interior_grocery_v1.png', 'scene-background'),
    BAISHI_INTERIOR_GROCERY_FG: interior('BAISHI_INTERIOR_GROCERY_FG', 'world/baishi/interiors/grocery/foreground_v1.png', '/scene-layers/baishi/interiors/interior_grocery_fg_v1.png', 'scene-foreground'),
    BAISHI_INTERIOR_TRADE_BG: interior('BAISHI_INTERIOR_TRADE_BG', 'world/baishi/interiors/trade/background_v1.png', '/scene-layers/baishi/interiors/interior_trade_v1.png', 'scene-background'),
    BAISHI_INTERIOR_TRADE_FG: interior('BAISHI_INTERIOR_TRADE_FG', 'world/baishi/interiors/trade/foreground_v1.png', '/scene-layers/baishi/interiors/interior_trade_fg_v1.png', 'scene-foreground'),
    BAISHI_INTERIOR_CLOTH_BG: interior('BAISHI_INTERIOR_CLOTH_BG', 'world/baishi/interiors/cloth/background_v1.png', '/scene-layers/baishi/interiors/interior_cloth_v1.png', 'scene-background'),
    BAISHI_INTERIOR_CLOTH_FG: interior('BAISHI_INTERIOR_CLOTH_FG', 'world/baishi/interiors/cloth/foreground_v1.png', '/scene-layers/baishi/interiors/interior_cloth_fg_v1.png', 'scene-foreground'),
    BAISHI_INTERIOR_INN_BG: interior('BAISHI_INTERIOR_INN_BG', 'world/baishi/interiors/inn/background_v1.png', '/scene-layers/baishi/interiors/interior_inn_v1.png', 'scene-background'),
    BAISHI_INTERIOR_INN_FG: interior('BAISHI_INTERIOR_INN_FG', 'world/baishi/interiors/inn/foreground_v1.png', '/scene-layers/baishi/interiors/interior_inn_fg_v1.png', 'scene-foreground'),
    BAISHI_INTERIOR_GUEST_ROOM_BG: interior('BAISHI_INTERIOR_GUEST_ROOM_BG', 'world/baishi/interiors/guest-room/background_v2.png', '/scene-layers/baishi/interiors/interior_guest_room_v2.png', 'scene-background', 2),
    BAISHI_INTERIOR_GUEST_ROOM_FG: interior('BAISHI_INTERIOR_GUEST_ROOM_FG', 'world/baishi/interiors/guest-room/foreground_v2.png', '/scene-layers/baishi/interiors/interior_guest_room_fg_v2.png', 'scene-foreground', 2),
  }
};

export const DEFAULT_ASSET_BASE_URL = 'https://res-fjhy.wzpy.net';

export function remoteAsset(resourceId: string): RemoteAssetManifestEntry {
  const asset = remoteAssetManifest.resources[resourceId];
  if (!asset) throw new Error(`Unknown remote asset resourceId: ${resourceId}`);
  return asset;
}

export function assetUrl(resource: Pick<RemoteAssetManifestEntry, 'path'>, assetBaseUrl = DEFAULT_ASSET_BASE_URL) {
  return `${assetBaseUrl.replace(/\/$/, '')}/${resource.path.replace(/^\//, '')}`;
}

export function manifestContainsVendorUrls(manifest: RemoteAssetManifest = remoteAssetManifest) {
  return Object.values(manifest.resources).some(resource => /(^https?:\/\/|\.cos\.ap-)/i.test(resource.path));
}
