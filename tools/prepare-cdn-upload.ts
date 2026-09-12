import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { remoteAssetManifest } from '../packages/client-runtime/remote-assets.js';

const outputRoot = path.resolve('artifacts/fjhy-cdn-upload-v1');
await mkdir(outputRoot, { recursive: true });
const rows: string[] = ['# FJHY CDN Upload Manifest V1', '', '| Resource ID | Version | Type | Local source | COS target path | Size |', '| --- | ---: | --- | --- | --- | ---: |'];
const publicRoot = path.resolve('assets/remote');
const portableManifest = { manifestVersion: remoteAssetManifest.manifestVersion, resources: Object.fromEntries(Object.values(remoteAssetManifest.resources).map(resource => [resource.resourceId, { path: resource.path, version: resource.version, type: resource.type }])) };
for (const resource of Object.values(remoteAssetManifest.resources)) {
  const source = path.resolve(publicRoot, resource.path);
  const target = path.resolve(outputRoot, resource.path);
  if (!source.startsWith(publicRoot + path.sep)) throw new Error(`Unsafe source: ${resource.fallbackPath}`);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
  const size = (await stat(source)).size;
  rows.push(`| ${resource.resourceId} | ${resource.version} | ${resource.type} | \`${path.relative(process.cwd(), source).replaceAll('\\', '/')}\` | \`${resource.path}\` | ${size} bytes |`);
}
await writeFile(path.join(outputRoot, 'remote-asset-manifest-v1.json'), JSON.stringify(portableManifest, null, 2));
await writeFile(path.resolve('CDN_UPLOAD_MANIFEST_V1.md'), rows.join('\n') + '\n');
console.log(`Prepared ${Object.keys(remoteAssetManifest.resources).length} CDN files in ${outputRoot}`);
