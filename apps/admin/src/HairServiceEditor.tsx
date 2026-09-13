import {Alert,Input,InputNumber,Switch,Table} from 'antd';
import type {WorldConfig} from '../../../packages/shared-types/index.js';
import {hairServiceConfig,type HairConfig,type HairServiceOffer} from '../../../packages/game-config/hair-services.js';

export function HairServiceEditor({json,onChange}:{json:string;onChange:(json:string)=>void}){
  let world:WorldConfig;try{world=JSON.parse(json);}catch{return <Alert type="warning" message="请先修正配置草稿 JSON"/>;}
  const {hairs,offers}=hairServiceConfig(world);
  const updateHair=(hairId:string,patch:Partial<HairConfig>)=>onChange(JSON.stringify({...world,hairs:hairs.map(h=>h.hairId===hairId?{...h,...patch}:h),hairServiceOffers:offers},null,2));
  const updateOffer=(serviceId:string,patch:Partial<HairServiceOffer>)=>onChange(JSON.stringify({...world,hairs,hairServiceOffers:offers.map(o=>o.serviceId===serviceId?{...o,...patch}:o)},null,2));
  return <><Alert type="info" message="发型与服务报价独立。修改进入配置草稿，仍需保存、校验并发布。稳定 ID 与性别只读。"/>
    <Table rowKey="hairId" pagination={false} dataSource={hairs} columns={[
      {title:'Hair ID',dataIndex:'hairId'},{title:'性别',dataIndex:'gender'},
      {title:'名称',render:(_,h)=><Input value={h.displayName} onChange={e=>updateHair(h.hairId,{displayName:e.target.value})}/>},
      {title:'资源 ID',render:(_,h)=><Input value={h.assetResourceId} onChange={e=>updateHair(h.hairId,{assetResourceId:e.target.value})}/>},
      {title:'排序',render:(_,h)=><InputNumber value={h.sortOrder} precision={0} onChange={v=>v!==null&&updateHair(h.hairId,{sortOrder:v})}/>},
      {title:'启用',render:(_,h)=><Switch checked={h.enabled} onChange={enabled=>updateHair(h.hairId,{enabled})}/>}
    ]}/>
    <Table rowKey="serviceId" pagination={false} dataSource={offers} columns={[
      {title:'服务 ID',dataIndex:'serviceId'},{title:'店铺',dataIndex:'shopId'},{title:'发型',dataIndex:'hairId'},
      {title:'服务费（文）',render:(_,o)=><InputNumber min={1} max={1000000} precision={0} value={o.price} onChange={v=>v!==null&&updateOffer(o.serviceId,{price:v})}/>},
      {title:'排序',render:(_,o)=><InputNumber precision={0} value={o.sortOrder} onChange={v=>v!==null&&updateOffer(o.serviceId,{sortOrder:v})}/>},
      {title:'启用',render:(_,o)=><Switch checked={o.enabled} onChange={enabled=>updateOffer(o.serviceId,{enabled})}/>}
    ]}/></>;
}
