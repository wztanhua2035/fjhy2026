import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import { initialWorld } from '../packages/game-config/index.js';
const root=path.resolve('assets/public/1');await fs.mkdir(path.join(root,'maps'),{recursive:true});
const crc=(b:Buffer)=>{let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;};
const chunk=(type:string,data:Buffer)=>{const name=Buffer.from(type),len=Buffer.alloc(4),check=Buffer.alloc(4);len.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([len,name,data,check]);};
const w=96,h=32,raw=Buffer.alloc((w*4+1)*h),colors=[[183,203,165],[233,223,201],[232,217,188]];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const offset=y*(w*4+1)+1+x*4;const c=colors[Math.floor(x/32)];raw.set([...c.map(v=>v-((x%32===0||y===0)?5:0)),255],offset);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
await fs.writeFile(path.join(root,'maps/terrain.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
const layers=['00_Metadata','01_Ground','02_Road','03_Water','04_Decoration_Back','05_Plot_Base','06_Collision','07_NPC_Path','08_Ghost_Path','09_Portal','10_Interaction','11_Decoration_Front','12_Weather'];
for(const [name,scene] of [['baishi',initialWorld.scenes[0]],['interior',initialWorld.scenes[1]]] as const){
 const data=Array.from({length:scene.width*scene.height},(_,i)=>scene.buildingId?3:scene.roads.some(r=>i%scene.width>=r.x&&i%scene.width<r.x+r.width&&Math.floor(i/scene.width)>=r.y&&Math.floor(i/scene.width)<r.y+r.height)?2:1);
 const xml=`<?xml version="1.0" encoding="UTF-8"?><map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${scene.width}" height="${scene.height}" tilewidth="32" tileheight="32" infinite="0"><tileset firstgid="1" name="terrain" tilewidth="32" tileheight="32" tilecount="3" columns="3"><image source="terrain.png" width="96" height="32"/></tileset>${layers.map((layer,i)=>layer==='01_Ground'?`<layer id="${i+1}" name="${layer}" width="${scene.width}" height="${scene.height}"><data encoding="csv">${data.join(',')}</data></layer>`:`<objectgroup id="${i+1}" name="${layer}">${layer==='06_Collision'?scene.collision.map((r,j)=>`<object id="${j+1}" x="${r.x*32}" y="${r.y*32}" width="${r.width*32}" height="${r.height*32}"/>`).join(''):''}</objectgroup>`).join('')}</map>`;
 await fs.writeFile(path.join(root,`maps/${name}.tmx`),xml);
}
const files=['maps/terrain.png','maps/baishi.tmx','maps/interior.tmx'];
const manifest={version:1,minClientVersion:'0.1.0',prototypeAssets:true,files:await Promise.all(files.map(async file=>{const data=await fs.readFile(path.join(root,file));return {path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}))};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
const dest=path.resolve('apps/client-wechat/assets/scripts/generated');
for(const pkg of ['shared-types','game-rules','platform-adapter','client-runtime']){await fs.mkdir(path.join(dest,pkg),{recursive:true});let source=await fs.readFile(`packages/${pkg}/index.ts`,'utf8');source=source.replaceAll('../shared-types/index.js','../shared-types/index');await fs.writeFile(path.join(dest,pkg,'index.ts'),source);}
await fs.mkdir('apps/client-wechat/assets/resources/maps',{recursive:true});for(const file of files)await fs.copyFile(path.join(root,file),`apps/client-wechat/assets/resources/${file}`);
console.log('已生成 TMX、原型瓦片、SHA256 清单，以及 Cocos 共享 Runtime。');
