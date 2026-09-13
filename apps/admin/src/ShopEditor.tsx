import React from 'react';
import {Input,InputNumber,Select,Switch,Table} from 'antd';
import type {WorldConfig,ItemConfig,ShopListing} from '../../../packages/shared-types/index.js';
import {itemCategories} from '../../../packages/game-rules/inventory.js';

/** Edits the existing release draft; publication still uses TEST → PUBLISHED. */
export function ShopEditor({json,onChange}:{json:string;onChange:(json:string)=>void}){
  let world:WorldConfig;try{world=JSON.parse(json);}catch{return <p>请先修正配置草稿 JSON。</p>;}
  const save=()=>onChange(JSON.stringify(world,null,2));
  const set=(item:ItemConfig,key:keyof ItemConfig,value:unknown)=>{Object.assign(item,{[key]:value});save();};
  const setOffer=(offer:ShopListing,key:keyof ShopListing,value:unknown)=>{Object.assign(offer,{[key]:value});if(key==='baseBuyPrice')offer.buy=Number(value);if(key==='baseSellPrice')offer.sell=Number(value);save();};
  return <><h3>Item · 物品定义</h3><p>Item ID 只读；物品定义不保存价格。店铺报价在下方单独管理。</p>
    <Table rowKey="id" dataSource={world.items} pagination={false} scroll={{x:1300}} columns={[
      {title:'Item ID',dataIndex:'id'},
      {title:'名称',render:(_,i)=><Input aria-label={`${i.id} 名称`} value={i.name} onChange={e=>set(i,'name',e.target.value)}/>},
      {title:'描述',render:(_,i)=><Input value={i.description??''} onChange={e=>set(i,'description',e.target.value)}/>},
      {title:'分类',render:(_,i)=><Select value={i.category==='HOUSEHOLD'?'DAILY':i.category??'SPECIAL'} options={itemCategories.map(value=>({value}))} onChange={v=>set(i,'category',v)}/>},
      {title:'叠加上限',render:(_,i)=><InputNumber min={1} max={999} precision={0} value={i.stackMax} onChange={v=>v!==null&&set(i,'stackMax',v)}/>},
      {title:'可使用',render:(_,i)=><Switch checked={i.usable===true} disabled={!i.effectType||i.questOnly||i.keyItem} onChange={v=>set(i,'usable',v)}/>},
      {title:'任务/重要',render:(_,i)=><span>{i.questOnly?'任务 ':''}{i.keyItem?'重要':''}</span>},
      {title:'启用',render:(_,i)=><Switch checked={i.enabled!==false} onChange={v=>set(i,'enabled',v)}/>},
      {title:'所属店铺',render:(_,i)=><Select mode="multiple" style={{minWidth:170}} value={world.buildings.filter(b=>b.stock[i.id]).map(b=>b.id)} options={world.buildings.filter(b=>Object.keys(b.stock).length||b.id==='B_GROCERY').map(b=>({value:b.id,label:b.name}))} onChange={ids=>{for(const b of world.buildings){if(ids.includes(b.id)&&!b.stock[i.id])b.stock[i.id]={buy:1,sell:1,baseBuyPrice:1,baseSellPrice:1,canBuy:true,canSell:true,dailyLimit:999,stockMode:'INFINITE',pricingMode:'FIXED',enabled:false};else if(!ids.includes(b.id))delete b.stock[i.id];}save();}}/>}
    ]}/>
    <h3>Shop Listing · 店铺报价</h3><p>新增报价默认下架，填写后再启用。市场行情另行开发。</p>
    {world.buildings.filter(b=>Object.keys(b.stock).length).map(b=><section key={b.id}><h3>{b.name} · {b.id}</h3><Table rowKey="id" pagination={false} dataSource={Object.entries(b.stock).map(([id,stock])=>({id,...stock}))} columns={[
      {title:'商品 ID / 名称',render:(_,r)=><>{r.id}<br/>{world.items.find(i=>i.id===r.id)?.name??r.id}</>},
      {title:'出售基价',render:(_,r)=><InputNumber min={1} max={1000000} precision={0} value={r.baseBuyPrice??r.buy} onChange={v=>v!==null&&setOffer(b.stock[r.id],'baseBuyPrice',v)}/>},
      {title:'收购基价',render:(_,r)=><InputNumber min={1} max={1000000} precision={0} value={r.baseSellPrice??r.sell} onChange={v=>v!==null&&setOffer(b.stock[r.id],'baseSellPrice',v)}/>},
      {title:'出售',render:(_,r)=><Switch checked={r.canBuy!==false} onChange={v=>setOffer(b.stock[r.id],'canBuy',v)}/>},
      {title:'收购',render:(_,r)=><Switch checked={r.canSell!==false} onChange={v=>setOffer(b.stock[r.id],'canSell',v)}/>},
      {title:'库存模式',render:(_,r)=><Select value={r.stockMode??'INFINITE'} options={['INFINITE','PLAYER_PRIVATE','GLOBAL_LIMITED'].map(value=>({value,disabled:value!=='INFINITE'}))} onChange={v=>setOffer(b.stock[r.id],'stockMode',v)}/>},
      {title:'定价模式',render:(_,r)=><Select value={r.pricingMode??'FIXED'} options={[{value:'FIXED'},{value:'MARKET_DYNAMIC',disabled:true}]} onChange={v=>setOffer(b.stock[r.id],'pricingMode',v)}/>},
      {title:'上架',render:(_,r)=><Switch checked={r.enabled!==false} onChange={v=>setOffer(b.stock[r.id],'enabled',v)}/>}
      ,{title:'排序',render:(_,r)=><InputNumber precision={0} value={r.sortOrder??0} onChange={v=>v!==null&&setOffer(b.stock[r.id],'sortOrder',v)}/>}
    ]}/></section>)}
    <h3>Market · 市场行情</h3><p>本轮仅预留数据边界；动态价格和全服限量库存尚未开放。</p>
  </>;
}
