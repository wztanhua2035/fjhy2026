import release from '../../../assets/remote/manifests/remote-asset-manifest-v1.json';
import { remoteAsset, assetUrl } from '../../../packages/client-runtime/remote-assets.js';

export const GENERIC_INTERIOR_BG = '/scene-layers/baishi/interiors/generic_interior_fallback.png';
export const GENERIC_INTERIOR_FG = '/scene-layers/baishi/interiors/generic_interior_foreground.png';
export function interiorResource(resourceId: string, base: string) {
  const asset = remoteAsset(resourceId);
  const metadata = release.resources[resourceId as keyof typeof release.resources];
  if (!metadata || metadata.path !== asset.path || metadata.version !== asset.version) throw new Error(`Interior manifest mismatch: ${resourceId}`);
  return { ...asset, ...metadata, key: `web:${resourceId}:v${asset.version}:${metadata.sha256}`, url: `${assetUrl(asset,base)}?v=${asset.version}&h=${metadata.sha256.slice(0,16)}` };
}
export async function verifyInteriorBytes(resource: ReturnType<typeof interiorResource>, bytes: ArrayBuffer) {
  const data = new DataView(bytes);
  if (bytes.byteLength !== resource.byteSize || bytes.byteLength < 24 || data.getUint32(0) !== 0x89504e47 || data.getUint32(4) !== 0x0d0a1a0a || data.getUint32(16) !== resource.width || data.getUint32(20) !== resource.height) throw new Error(`Interior image metadata mismatch: ${resource.resourceId}`);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b=>b.toString(16).padStart(2,'0')).join('');
  if (digest !== resource.sha256) throw new Error(`Interior image hash mismatch: ${resource.resourceId}`);
}
export async function fetchInteriorResource(resourceId: string, base: string, devLocalSource: boolean, fetcher: typeof fetch = fetch) {
  const resource = interiorResource(resourceId,base);
  const attempts: {url:string;source:'cdn'|'local-canonical';cache:RequestCache}[] = [
    {url:resource.url,source:'cdn',cache:'default'}, {url:resource.url,source:'cdn',cache:'reload'},
    ...(devLocalSource ? [{url:`/__fjhy_source__/${resource.path}?h=${resource.sha256}`,source:'local-canonical' as const,cache:'no-store' as const}] : []),
  ];
  let failure: unknown;
  for (const attempt of attempts) {
    try {
      const response = await fetcher(attempt.url,{cache:attempt.cache,signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      await verifyInteriorBytes(resource,bytes);
      return {resource,source:attempt.source,url:attempt.url,blob:new Blob([bytes],{type:'image/png'})};
    } catch(error) { failure=error; }
  }
  throw failure;
}
export function decodeInterior(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image(),url=URL.createObjectURL(blob);
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Interior image decode failed'));};
    image.src=url;
  });
}
