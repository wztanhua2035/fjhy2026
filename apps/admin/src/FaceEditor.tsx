import {Alert,Input,InputNumber,Switch,Table} from 'antd';
import type {WorldConfig} from '../../../packages/shared-types/index.js';
import {faceConfigs,type FaceConfig} from '../../../packages/game-config/face-templates.js';

export function FaceEditor({json,onChange}:{json:string;onChange:(json:string)=>void}){
  let world:WorldConfig;try{world=JSON.parse(json);}catch{return <Alert type="warning" message="请先修正配置草稿 JSON"/>;}
  const faces=world.faces??faceConfigs;
  const update=(faceId:string,patch:Partial<FaceConfig>)=>onChange(JSON.stringify({...world,faces:faces.map(face=>face.faceId===faceId?{...face,...patch}:face)},null,2));
  return <><Alert type="info" message="Face 只在角色创建时选择。修改需保存、校验并发布；Face ID 与性别只读。"/>
    <Table rowKey="faceId" pagination={false} dataSource={faces} columns={[
      {title:'Face ID',dataIndex:'faceId'},{title:'性别',dataIndex:'gender'},
      {title:'名称',render:(_,face)=><Input value={face.displayName} onChange={e=>update(face.faceId,{displayName:e.target.value})}/>},
      {title:'资源 ID',render:(_,face)=><Input value={face.assetResourceId} onChange={e=>update(face.faceId,{assetResourceId:e.target.value})}/>},
      {title:'排序',render:(_,face)=><InputNumber value={face.sortOrder} precision={0} onChange={value=>value!==null&&update(face.faceId,{sortOrder:value})}/>},
      {title:'启用',render:(_,face)=><Switch checked={face.enabled} onChange={enabled=>update(face.faceId,{enabled})}/>}
    ]}/></>;
}
