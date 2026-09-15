export type RemoteAssetType = 'scene-background' | 'scene-foreground' | 'shop-sign' | 'scene-map' | 'portrait' | 'icon';

/** A portable resource contract: IDs and paths are stable across CDN providers. */
export interface RemoteAssetManifestEntry {
  resourceId: string;
  path: string;
  version: number;
  type: RemoteAssetType;
  /** Low-cost fallback only; never a source for generating a new formal resource version. */
  fallbackPath: string;
  /** Explicit exception to the normal hard size limit, with an audit reason. */
  sizeBudgetOverride?: { reason: string };
}

export interface RemoteAssetManifest {
  manifestVersion: number;
  resources: Record<string, RemoteAssetManifestEntry>;
}

const interior = (resourceId: string, path: string, fallbackPath: string, type: RemoteAssetType, version = 1): RemoteAssetManifestEntry => ({ resourceId, path, version, type, fallbackPath });
const sign = (resourceId: string, path: string): RemoteAssetManifestEntry => ({ resourceId, path, version: 2, type: 'shop-sign', fallbackPath: '' });

export const remoteAssetManifest: RemoteAssetManifest = {
  manifestVersion: 1,
  resources: {
    BAISHI_INTERIOR_SALON_BG: interior('BAISHI_INTERIOR_SALON_BG', 'world/baishi/interiors/salon/background_v7.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 7),
    BAISHI_INTERIOR_SALON_FG: interior('BAISHI_INTERIOR_SALON_FG', 'world/baishi/interiors/salon/foreground_v1.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground'),
    BAISHI_INTERIOR_GROCERY_BG: interior('BAISHI_INTERIOR_GROCERY_BG', 'world/baishi/interiors/grocery/background_v4.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 4),
    BAISHI_INTERIOR_GROCERY_FG: interior('BAISHI_INTERIOR_GROCERY_FG', 'world/baishi/interiors/grocery/foreground_v1.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground'),
    BAISHI_INTERIOR_TRADE_BG: interior('BAISHI_INTERIOR_TRADE_BG', 'world/baishi/interiors/trade/background_v5.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 5),
    BAISHI_INTERIOR_TRADE_FG: interior('BAISHI_INTERIOR_TRADE_FG', 'world/baishi/interiors/trade/foreground_v1.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground'),
    BAISHI_INTERIOR_CLOTH_BG: interior('BAISHI_INTERIOR_CLOTH_BG', 'world/baishi/interiors/cloth/background_v7.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 7),
    BAISHI_INTERIOR_CLOTH_FG: interior('BAISHI_INTERIOR_CLOTH_FG', 'world/baishi/interiors/cloth/foreground_v2.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground', 2),
    BAISHI_INTERIOR_INN_BG: interior('BAISHI_INTERIOR_INN_BG', 'world/baishi/interiors/inn/background_v3.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 3),
    BAISHI_INTERIOR_INN_FG: interior('BAISHI_INTERIOR_INN_FG', 'world/baishi/interiors/inn/foreground_v1.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground'),
    BAISHI_INTERIOR_GUEST_ROOM_BG: interior('BAISHI_INTERIOR_GUEST_ROOM_BG', 'world/baishi/interiors/guest-room/background_v4.png', '/scene-layers/baishi/interiors/generic_interior_fallback.png', 'scene-background', 4),
    BAISHI_INTERIOR_GUEST_ROOM_FG: interior('BAISHI_INTERIOR_GUEST_ROOM_FG', 'world/baishi/interiors/guest-room/foreground_v2.png', '/scene-layers/baishi/interiors/generic_interior_foreground.png', 'scene-foreground', 2),
    SIGN_BAISHI_INN_V1: sign('SIGN_BAISHI_INN_V1', 'signs/baishi/inn/sign_v2.png'),
    SIGN_BAISHI_GROCERY_V1: sign('SIGN_BAISHI_GROCERY_V1', 'signs/baishi/grocery/sign_v2.png'),
    SIGN_BAISHI_TRADE_V1: sign('SIGN_BAISHI_TRADE_V1', 'signs/baishi/trade/sign_v2.png'),
    SIGN_BAISHI_SALON_V1: sign('SIGN_BAISHI_SALON_V1', 'signs/baishi/salon/sign_v2.png'),
    SIGN_BAISHI_CLOTH_V1: sign('SIGN_BAISHI_CLOTH_V1', 'signs/baishi/cloth/sign_v2.png'),
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
