import type Phaser from 'phaser';
import {uiTokens} from './ui-design-tokens.js';

export type UiButtonVariant='primary'|'secondary'|'ghost'|'danger';
export function addUiButton(scene:Phaser.Scene,x:number,y:number,label:string,depth:number,action:()=>void,variant:UiButtonVariant='secondary'){
  const background=variant==='primary'?uiTokens.colors.accent:variant==='danger'?uiTokens.colors.danger:variant==='ghost'?uiTokens.colors.panelElevated:uiTokens.colors.accentSoft;
  const foreground=variant==='primary'||variant==='danger'?uiTokens.colors.dialogueBody:uiTokens.colors.textPrimary;
  const button=scene.add.text(x,y,label,{fontFamily:'Microsoft YaHei, Arial',fontSize:`${uiTokens.typography.bodyM}px`,color:foreground,backgroundColor:background,align:'center',padding:{left:18,right:18,top:14,bottom:14}})
    .setOrigin(.5).setDepth(depth).setInteractive({useHandCursor:true});
  button.on('pointerdown',action);
  return button;
}

export function addUiPanel(scene:Phaser.Scene,x:number,y:number,width:number,height:number,depth:number){
  return scene.add.rectangle(x,y,width,height,Number.parseInt(uiTokens.colors.panel.slice(1),16),.98).setDepth(depth).setInteractive();
}
