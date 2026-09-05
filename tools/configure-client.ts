import fs from 'node:fs/promises';
const value=process.env.CLIENT_API_BASE_URL;
if(!value||!value.startsWith('https://'))throw new Error('CLIENT_API_BASE_URL 必须是线上 HTTPS API 地址');
const parsed=new URL(value);if(parsed.username||parsed.password||parsed.search||parsed.hash)throw new Error('API 地址不得包含凭据、查询参数或片段');
await fs.writeFile('apps/client-wechat/assets/scripts/Environment.ts',`// Generated public configuration. No secrets.\nexport const environment = ${JSON.stringify({apiBase:value.replace(/\/$/,''),devAccount:'',allowDevLogin:false})};\n`);
console.log('已生成微信客户端线上地址，开发登录已关闭。');
