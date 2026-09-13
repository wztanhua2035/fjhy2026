import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { manifestContainsVendorUrls, remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';
import { assertAssetBudget } from './asset-budget.js';

const staticRoot = path.resolve(process.argv[2] ?? 'assets/remote');
const resources = Object.values(remoteAssetManifest.resources);
if (manifestContainsVendorUrls()) throw new Error('Remote manifest must not contain provider URLs');
const ids = new Set<string>(), paths = new Set<string>(), missing: string[] = [];
const metadata: Record<string, object> = {};
for (const resource of resources) {
  if (!/^[A-Z0-9_]+$/.test(resource.resourceId) || ids.has(resource.resourceId)) throw new Error(`Invalid or duplicate resourceId: ${resource.resourceId}`);
  if (!Number.isInteger(resource.version) || resource.version < 1) throw new Error(`Invalid resource version: ${resource.resourceId}`);
  if (!resource.path || resource.path.startsWith('/') || resource.path.includes('..') || paths.has(resource.path)) throw new Error(`Invalid or duplicate relative path: ${resource.path}`);
  ids.add(resource.resourceId); paths.add(resource.path);
  const target = path.resolve(staticRoot, resource.path);
  if (!target.startsWith(staticRoot + path.sep)) throw new Error(`Unsafe relative path: ${resource.path}`);
  try {
    const info = await stat(target);
    if (!info.isFile() || info.size <= 0) { missing.push(resource.path); continue; }
    const data = await readFile(target);
    if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || data.readUInt32BE(16) <= 0 || data.readUInt32BE(20) <= 0) throw new Error(`Invalid PNG: ${resource.path}`);
    assertAssetBudget(resource, data.length);
    metadata[resource.resourceId] = {
      path: resource.path, version: resource.version, type: resource.type,
      width: data.readUInt32BE(16), height: data.readUInt32BE(20), format: 'png',
      byteSize: data.length, sha256: createHash('sha256').update(data).digest('hex'),
      ...(resource.sizeBudgetOverride ? { sizeBudgetOverride: resource.sizeBudgetOverride } : {})
    };
  }
  catch (error: any) {
    if (error?.code === 'ENOENT') missing.push(resource.path);
    else throw error;
  }
}
if (missing.length) throw new Error(`Remote asset directory is incomplete: ${missing.join(', ')}`);
const portablePath = path.join(staticRoot, 'manifests/remote-asset-manifest-v1.json');
try {
  const portable = JSON.parse(await readFile(portablePath, 'utf8'));
  if (portable.manifestVersion !== remoteAssetManifest.manifestVersion || JSON.stringify(portable.resources) !== JSON.stringify(metadata)) throw new Error('portable manifest differs from shared manifest or local files');
} catch (error: any) { throw new Error(`Portable remote manifest invalid: ${error.message}`); }
console.log(`Remote asset directory verified: ${resources.length} files in ${staticRoot}`);
