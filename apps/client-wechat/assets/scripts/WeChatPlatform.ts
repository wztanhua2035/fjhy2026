import type { LifecycleState, PlatformAdapter, PlatformTransport } from './generated/platform-adapter/index';

declare const wx: undefined | {
  login(options:{success:(result:{code:string})=>void;fail:(error:unknown)=>void}):void;
  request(options:any):void;
  getStorageSync(key:string):unknown;
  setStorageSync(key:string,value:string):void;
  onHide(listener:()=>void):void;
  offHide(listener:()=>void):void;
  onShow(listener:()=>void):void;
  offShow(listener:()=>void):void;
};

/** WeChat-only APIs stay here; GameController remains platform-neutral. */
export class WeChatPlatform implements PlatformAdapter {
  readonly kind='wechat' as const;
  get canLoginWithWeChat(){return typeof wx!=='undefined';}
  readonly transport: PlatformTransport;
  constructor(apiBase:string){const base=apiBase.replace(/\/$/,'');this.transport=(path,body,token)=>{
    if(typeof wx==='undefined')return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined}).then(async response=>{const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message??'网络请求失败'),{status:response.status});return data;});
    return new Promise((resolve,reject)=>wx.request({url:base+path,method:body?'POST':'GET',header:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},data:body,timeout:10000,success:(result:any)=>result.statusCode>=200&&result.statusCode<300?resolve(result.data):reject(Object.assign(new Error(result.data?.message??'请求失败'),{status:result.statusCode})),fail:()=>reject(new Error('网络连接中断'))}));
  };}
  getLoginCode(){return new Promise<string>((resolve,reject)=>{if(!wx)return reject(new Error('请在微信小游戏中打开'));wx.login({success:result=>resolve(result.code),fail:reject});});}
  readLocal(key:string){try{return typeof wx==='undefined'?localStorage.getItem(key):String(wx.getStorageSync(key)||'')||null;}catch{return null;}}
  writeLocal(key:string,value:string){try{if(typeof wx==='undefined')localStorage.setItem(key,value);else wx.setStorageSync(key,value);}catch{}}
  onLifecycle(listener:(state:LifecycleState)=>void){if(!wx)return()=>{};const show=()=>listener('show'),hide=()=>listener('hide');wx.onShow(show);wx.onHide(hide);return()=>{wx.offShow(show);wx.offHide(hide);};}
}