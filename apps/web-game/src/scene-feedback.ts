export type NoticePriority='immediate'|'sequential'|'low';
type Notice={id:number;kind:'toast'|'result';text:string;priority:NoticePriority;sceneId?:string;transitionId?:number};
/** Presentation-only queue: never controls quest or transaction state. */
export class WebFeedbackQueue {
  private id=0;private entries:Notice[]=[];
  enqueue(kind:Notice['kind'],text:string,priority:NoticePriority='sequential',context:Pick<Notice,'sceneId'|'transitionId'>={}){
    const notice={id:++this.id,kind,text,priority,...context};
    if(priority==='immediate')this.entries.unshift(notice);else this.entries.push(notice);
    return notice;
  }
  current(sceneId?:string,transitionId?:number){
    this.entries=this.entries.filter(n=>(!n.sceneId||n.sceneId===sceneId)&&(n.transitionId===undefined||n.transitionId===transitionId));
    return this.entries[0]??null;
  }
  dismiss(id:number){this.entries=this.entries.filter(n=>n.id!==id);}
  clear(){this.entries=[];}
}
export function isTransientSceneMessage(text:string){return /^(正在确认位置|正在进入|进入建筑|已到达)/.test(text);}
export function transitionLoading(pending:boolean,startedAt:number,now:number){return pending&&now-startedAt>=300;}
