import type Phaser from 'phaser';
import type {GameController} from './index.js';
import {UI_DEPTH_BASE} from './assets.js';
import {uiTokens} from './ui-design-tokens.js';
import {addUiButton,addUiPanel} from './ui-phaser.js';

/** Small shared facility panel; the server remains authoritative for every change. */
export function installGuestFacilities(scene:Phaser.Scene,game:GameController,width:number,height:number){
  const depth=UI_DEPTH_BASE+115,objects:(Phaser.GameObjects.GameObject&{setVisible(visible:boolean):unknown})[]=[];
  const text=(x:number,y:number,value:string,size=19)=>{const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, Arial',fontSize:`${size}px`,color:uiTokens.colors.textPrimary,align:'center',wordWrap:{width:Math.min(520,width-60)}}).setOrigin(.5).setDepth(depth+2);objects.push(t);return t;};
  const run=(action:()=>Promise<unknown>)=>void action().catch((error:Error)=>{game.message=error.message;game.onChange();});
  const button=(x:number,y:number,value:string,action:()=>void)=>{const t=addUiButton(scene,x,y,value,depth+2,()=>{if(!game.busy)action();});objects.push(t);return t;};
  const backdrop=addUiPanel(scene,width/2,height/2,Math.min(610,width-36),Math.min(350,height-28),depth);objects.push(backdrop);
  const title=text(width/2,height/2-130,'');
  const info=text(width/2,height/2-66,'',18);
  const left=button(width/2-160,height/2+12,'1 小时',()=>run(()=>game.startSleep(1)));
  const center=button(width/2,height/2+12,'3 小时',()=>run(()=>game.startSleep(3)));
  const right=button(width/2+160,height/2+12,'6 小时',()=>run(()=>game.startSleep(6)));
  const side=button(width/2-155,height/2-7,'存入',()=>game.setStorageSide(game.storageSide==='deposit'?'withdraw':'deposit'));
  const previous=button(width/2-150,height/2+48,'上一件',()=>game.cycleStorageItem(-1));
  const next=button(width/2+150,height/2+48,'下一件',()=>game.cycleStorageItem(1));
  const minus=button(width/2-82,height/2+94,'－',()=>game.setStorageQuantity(-1));
  const plus=button(width/2+82,height/2+94,'＋',()=>game.setStorageQuantity(1));
  const transfer=button(width/2+155,height/2+123,'确认转移',()=>run(()=>game.transferStorage()));
  const wake=button(width/2,height/2+72,'结束休息',()=>run(()=>game.wakeSleep()));
  const close=button(width/2-155,height/2+123,'返回',()=>game.closeGuestFacility());
  scene.cameras.main.ignore(objects);
  const update=()=>{
    const kind=game.facilityPanel;
    for(const object of objects)object.setVisible(!!kind);
    if(!kind)return;
    const bed=kind==='bed',storage=kind==='storage',sleep=game.player?.life.sleep;
    title.setText(bed?'休息':storage?'个人箱子':'书桌记录');
    if(bed){info.setText(sleep?`正在休息 ${sleep.intendedHours} 小时\n精力 ${game.player?.life.energy??100}/100`:`精力 ${game.player?.life.energy??100}/100\n选择休息时间`);}
    else if(storage){const entry=game.storageEntries().find(e=>e.id===game.storageItemId);info.setText(`${game.storageSide==='deposit'?'行囊 → 箱子':'箱子 → 行囊'}\n${entry?`${entry.name} ×${entry.count}　转移 ×${game.storageQuantity}`:'当前没有可转移物品'}`);}
    else info.setText(`精力 ${game.player?.life.energy??100}/100\n随身物品 ${Object.keys(game.player?.inventory??{}).length} 种\n已完成任务 ${game.quests.filter(q=>q.state==='completed').length} 件`);
    for(const item of [left,center,right])item.setVisible(bed&&!sleep);
    wake.setVisible(bed&&!!sleep);
    for(const item of [side,previous,next,minus,plus,transfer])item.setVisible(storage);
    close.setVisible(!sleep);
    side.setText(game.storageSide==='deposit'?'切换：取出':'切换：存入');
    transfer.setAlpha(game.storageItemId&&!game.busy?1:.5);
  };
  update();scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>{scene.events.off('postupdate',update);game.closeGuestFacility();});
}
