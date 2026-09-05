// Optional Windows-only real PostgreSQL harness. Binaries stay in ignored artifacts/.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const bin=path.resolve('artifacts/pg-tools/node_modules/@embedded-postgres/windows-x64/native/bin');
if(!fs.existsSync(path.join(bin,'initdb.exe')))throw new Error('Install @embedded-postgres/windows-x64 into artifacts/pg-tools first.');
const dir=path.resolve(`artifacts/pg-test-${Date.now()}`);fs.mkdirSync(dir,{recursive:true});
const pass=randomBytes(24).toString('hex'),passwordFile=path.join(dir,'password.txt');fs.writeFileSync(passwordFile,pass);
const data=path.join(dir,'data'),port=55439;
function run(exe,args,env=process.env){const r=spawnSync(exe,args,{stdio:'inherit',env,windowsHide:true});if(r.status!==0)throw new Error(`Command failed (${r.status}): ${path.basename(exe)}`);}
let started=false;
try{
 run(path.join(bin,'initdb.exe'),['-D',data,'-U','fjhy','-A','scram-sha-256','--pwfile',passwordFile,'--encoding=UTF8','--locale=C']);
 fs.unlinkSync(passwordFile);
 run(path.join(bin,'pg_ctl.exe'),['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 const base=`postgresql://fjhy:${pass}@127.0.0.1:${port}`,db=new PrismaClient({datasourceUrl:base+'/postgres'});
 try{await db.$executeRawUnsafe('CREATE DATABASE fjhy_test');}finally{await db.$disconnect();}
 const env={...process.env,DATABASE_URL:base+'/fjhy_test',TEST_DATABASE_URL:base+'/fjhy_test'};
 run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--schema','database/prisma/schema.prisma'],env);
 run(process.execPath,['--import','tsx','database/seed.ts'],env);
 run(process.execPath,['--import','tsx','--test','tests/game.test.ts','tests/postgres.test.ts','tests/client.test.ts'],env);
 console.log('Real PostgreSQL migration, concurrency and persistence checks passed.');
}finally{if(started)run(path.join(bin,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(passwordFile))fs.unlinkSync(passwordFile);}
