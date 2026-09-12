import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { manifestContainsVendorUrls, remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';

const staticRoot = path.resolve(process.argv[2] ?? 'assets/remote');
const resources = Object.values(remoteAssetManifest.resources);
if (manifestContainsVendorUrls()) throw new Error('Remote manifest must not contain provider URLs');
const ids = new Set<string>(), paths = new Set<string>(), missing: string[] = [];
for (const resource of resources) {
  if (!/^[A-Z0-9_]+$/.test(resource.resourceId) || ids.has(resource.resourceId)) throw new Error(`Invalid or duplicate resourceId: ${resource.resourceId}`);
  if (!Number.isInteger(resource.version) || resource.version < 1) throw new Error(`Invalid resource version: ${resource.resourceId}`);
  if (!resource.path || resource.path.startsWith('/') || resource.path.includes('..') || paths.has(resource.path)) throw new Error(`Invalid or duplicate relative path: ${resource.path}`);
  ids.add(resource.resourceId); paths.add(resource.path);
  const target = path.resolve(staticRoot, resource.path);
  if (!target.startsWith(staticRoot + path.sep)) throw new Error(`Unsafe relative path: ${resource.path}`);
  try { const info = await stat(target); if (!info.isFile() || info.size <= 0) missing.push(resource.path); }
  catch { missing.push(resource.path); }
}
if (missing.length) throw new Error(`Remote asset directory is incomplete: ${missing.join(', ')}`);
const portablePath = path.join(staticRoot, 'manifests/remote-asset-manifest-v1.json');
try {
  const portable = JSON.parse(await readFile(portablePath, 'utf8'));
  if (portable.manifestVersion !== remoteAssetManifest.manifestVersion || Object.keys(portable.resources ?? {}).length !== resources.length) throw new Error('portable manifest differs from shared manifest');
} catch (error: any) { throw new Error(`Portable remote manifest invalid: ${error.message}`); }
console.log(`Remote asset directory verified: ${resources.length} files in ${staticRoot}`);
