import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';

const remoteRoot = path.resolve('assets/remote');
// Versioned files must already exist in assets/remote. Never promote a fallback into a release.
const portableResources = await Promise.all(Object.values(remoteAssetManifest.resources).map(async resource => {
  const target=path.resolve(remoteRoot,resource.path);
  if(!target.startsWith(remoteRoot+path.sep))throw new Error(`Unsafe resource mapping: ${resource.resourceId}`);
  const data = await readFile(target);
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Not a PNG: ${resource.resourceId}`);
  return [resource.resourceId, {
    path: resource.path, version: resource.version, type: resource.type,
    width: data.readUInt32BE(16), height: data.readUInt32BE(20), format: 'png',
    byteSize: data.length, sha256: createHash('sha256').update(data).digest('hex'),
    ...(resource.sizeBudgetOverride ? { sizeBudgetOverride: resource.sizeBudgetOverride } : {})
  }] as const;
}));
const portable = { manifestVersion: remoteAssetManifest.manifestVersion, resources: Object.fromEntries(portableResources) };
await mkdir(path.join(remoteRoot, 'manifests'), { recursive: true });
await writeFile(path.join(remoteRoot, 'manifests/remote-asset-manifest-v1.json'), JSON.stringify(portable, null, 2) + '\n');
console.log(`Synchronized ${Object.keys(remoteAssetManifest.resources).length} remote assets into ${remoteRoot}`);
