import {Alert,Input,InputNumber,Switch,Table} from 'antd';
import type {WorldConfig} from '../../../packages/shared-types/index.js';
import {outfitShopConfig,type OutfitConfig,type OutfitOffer} from '../../../packages/game-config/outfits.js';

export function OutfitEditor({json,onChange}:{json:string;onChange:(json:string)=>void}){
  let world:WorldConfig;try{world=JSON.parse(json);}catch{return <Alert type="warning" message="请先修正配置草稿 JSON"/>;}
  const {outfits,offers}=outfitShopConfig(world);
  const updateOutfit=(outfitId:string,patch:Partial<OutfitConfig>)=>onChange(JSON.stringify({...world,outfits:outfits.map(o=>o.outfitId===outfitId?{...o,...patch}:o),outfitOffers:offers},null,2));
  const updateOffer=(shopId:string,outfitId:string,patch:Partial<OutfitOffer>)=>onChange(JSON.stringify({...world,outfits,outfitOffers:offers.map(o=>o.shopId===shopId&&o.outfitId===outfitId?{...o,...patch}:o)},null,2));
  return <><Alert type="info" message="服装与店铺报价分开配置。ID、性别只读；保存草稿并发布后生效。"/>
    <Table rowKey="outfitId" pagination={false} dataSource={outfits} columns={[
      {title:'Outfit ID',dataIndex:'outfitId'},{title:'性别',dataIndex:'gender'},
      {title:'名称',render:(_,o)=><Input value={o.displayName} onChange={e=>updateOutfit(o.outfitId,{displayName:e.target.value})}/>},
      {title:'描述',render:(_,o)=><Input value={o.description} onChange={e=>updateOutfit(o.outfitId,{description:e.target.value})}/>},
      {title:'资源 ID',render:(_,o)=><Input value={o.assetResourceId} onChange={e=>updateOutfit(o.outfitId,{assetResourceId:e.target.value})}/>},
      {title:'排序',render:(_,o)=><InputNumber value={o.sortOrder} precision={0} onChange={v=>v!==null&&updateOutfit(o.outfitId,{sortOrder:v})}/>},
      {title:'启用',render:(_,o)=><Switch checked={o.enabled} onChange={enabled=>updateOutfit(o.outfitId,{enabled})}/>}
    ]}/>
    <Table rowKey={o=>`${o.shopId}:${o.outfitId}`} pagination={false} dataSource={offers} columns={[
      {title:'店铺',dataIndex:'shopId'},{title:'Outfit ID',dataIndex:'outfitId'},
      {title:'售价（文）',render:(_,o)=><InputNumber min={1} max={1000000} precision={0} value={o.price} onChange={v=>v!==null&&updateOffer(o.shopId,o.outfitId,{price:v})}/>},
      {title:'排序',render:(_,o)=><InputNumber precision={0} value={o.sortOrder} onChange={v=>v!==null&&updateOffer(o.shopId,o.outfitId,{sortOrder:v})}/>},
      {title:'上架',render:(_,o)=><Switch checked={o.enabled} onChange={enabled=>updateOffer(o.shopId,o.outfitId,{enabled})}/>}
    ]}/></>;
}
