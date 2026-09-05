import { PrismaClient, Prisma } from '@prisma/client';
import { initialWorld } from '../packages/game-config/index.js';
import { validateWorld } from '../apps/server/src/config.js';
const db=new PrismaClient();
try{const world=validateWorld(initialWorld);await db.worldRelease.upsert({where:{version:1},update:{},create:{version:1,basedOn:0,status:'PUBLISHED',config:world as unknown as Prisma.InputJsonValue}});console.log('初始世界已就绪（不覆盖已有配置）');}finally{await db.$disconnect();}
