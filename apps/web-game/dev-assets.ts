import type { Plugin } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import release from '../../assets/remote/manifests/remote-asset-manifest-v1.json';

/** DEV can recover from CDN failure using the exact same versioned source, never a legacy public image. */
export function canonicalDevAssets(): Plugin {
  const allowed=new Set(Object.values(release.resources).map(resource=>resource.path));
  return {name:'fjhy-canonical-dev-assets',configureServer(server){
    server.middlewares.use('/__fjhy_source__',async(req,res)=>{
      const relative=new URL(req.url??'/','http://localhost').pathname.slice(1);
      if(!allowed.has(relative)){res.statusCode=404;res.end();return;}
      try{const bytes=await readFile(path.resolve('assets/remote',relative));res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end(bytes);}
      catch{res.statusCode=404;res.end();}
    });
  }};
}
