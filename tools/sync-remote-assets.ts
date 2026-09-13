import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';

const remoteRoot = path.resolve('assets/remote');
const publicRoot = path.resolve('apps/admin/public');
for (const resource of Object.values(remoteAssetManifest.resources)) {
  // Generated remote-only assets (such as transparent shop signs) already live
  // under assets/remote and deliberately have no packaged fallback copy.
  if (!resource.fallbackPath) continue;
  const source = path.resolve(publicRoot, resource.fallbackPath.replace(/^\//, ''));
  const target = path.resolve(remoteRoot, resource.path);
  if (!source.startsWith(publicRoot + path.sep) || !target.startsWith(remoteRoot + path.sep)) throw new Error(`Unsafe resource mapping: ${resource.resourceId}`);
  await mkdir(path.dirname(target), { recursive: true });
  // The public copy is a source archive, never overwrite an already optimized,
  // versioned runtime file when regenerating the portable manifest.
  const existing = await stat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!existing) await cp(source, target);
}
const portableResources = await Promise.all(Object.values(remoteAssetManifest.resources).map(async resource => {
  const data = await readFile(path.resolve(remoteRoot, resource.path));
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
