import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';

const remoteRoot = path.resolve('assets/remote');
const publicRoot = path.resolve('apps/admin/public');
for (const resource of Object.values(remoteAssetManifest.resources)) {
  const source = path.resolve(publicRoot, resource.fallbackPath.replace(/^\//, ''));
  const target = path.resolve(remoteRoot, resource.path);
  if (!source.startsWith(publicRoot + path.sep) || !target.startsWith(remoteRoot + path.sep)) throw new Error(`Unsafe resource mapping: ${resource.resourceId}`);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
}
const portable = { manifestVersion: remoteAssetManifest.manifestVersion, resources: Object.fromEntries(Object.values(remoteAssetManifest.resources).map(resource => [resource.resourceId, { path: resource.path, version: resource.version, type: resource.type }])) };
await mkdir(path.join(remoteRoot, 'manifests'), { recursive: true });
await writeFile(path.join(remoteRoot, 'manifests/remote-asset-manifest-v1.json'), JSON.stringify(portable, null, 2) + '\n');
console.log(`Synchronized ${Object.keys(remoteAssetManifest.resources).length} remote assets into ${remoteRoot}`);
