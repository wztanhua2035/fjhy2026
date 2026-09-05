import fs from 'node:fs/promises';
import { environment } from '../apps/server/src/config.js';
import { createHash } from 'node:crypto';
import { validateWorld } from '../apps/server/src/config.js';
import { initialWorld } from '../packages/game-config/index.js';
const errors:string[]=[];let env;
try{env=environment();if(env.appEnv==='DEV')errors.push('发布目标仍为 DEV；请使用 STAGING 或 PROD。');}catch(e:any){errors.push(e.message);}
for(const key of ['DATABASE_URL','REDIS_URL'])if(!process.env[key])errors.push(`${key} 未配置`);
validateWorld(initialWorld);
try{const manifest=JSON.parse(await fs.readFile('assets/public/1/manifest.json','utf8'));for(const f of manifest.files){const data=await fs.readFile(`assets/public/1/${f.path}`);if(createHash('sha256').update(data).digest('hex')!==f.sha256)errors.push(`资源校验失败: ${f.path}`);}}catch{errors.push('请先运行 npm run assets:build');}
const client=await fs.readFile('apps/client-wechat/assets/scripts/Environment.ts','utf8');
if(client.includes('allowDevLogin:true')||client.includes('localhost'))errors.push('微信客户端仍启用本地开发地址或开发登录；发布前需生成线上配置。');
if(errors.length){console.error('尚未通过发布检查：\n'+errors.map(e=>`- ${e}`).join('\n'));process.exitCode=1;}else console.log('静态发布检查通过。仍须完成数据库迁移、STAGING 冒烟、微信真机测试和平台审核。');
