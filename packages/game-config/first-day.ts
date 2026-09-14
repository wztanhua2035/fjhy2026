import type {PlayerState} from '../shared-types/index.js';
import {INTRO_INN_KEEPER_DONE} from './inn-opening.js';

export const firstDayFlags={started:'FIRST_DAY_FIRST_TRADE_STARTED',street:'FIRST_DAY_ENTERED_BAISHI',trade:'FIRST_DAY_FIRST_TRADE_COMPLETED',returned:'FIRST_DAY_RETURNED_TO_INN',complete:'FIRST_DAY_COMPLETE'} as const;
export const shopIntroductions:Record<string,string>={
  INTERIOR_B_GROCERY:'街坊杂货铺\n这里可以买食品和日常用品。',
  INTERIOR_B_TRADE:'白石商行\n这里可以买卖部分商品。',
  INTERIOR_B_SALON:'青丝美发室\n这里可以更换发型。',
  INTERIOR_B_CLOTH:'春衫衣坊\n这里可以看看成套服装。'
};
export const firstDayNpcIntroductions:Record<string,string>={
  NPC_001:'昨晚睡得还行就好。街上不大，慢慢走走，总会找到自己的路。',
  NPC_GROCERY_CLERK:'刚摆好的米放在柜台边。要是只买一点，我替你挑一份。',
  NPC_TRADE_CLERK:'这两天收些日常货。你带了东西来，放柜台上，我帮你看看。',
  NPC_SALON_HAIRDRESSER:'刚把镜台擦好。进来坐坐也行，不急着剪头发。',
  NPC_CLOTH_SHOPKEEPER:'这几套衣裳是新到的。先看看合不合眼缘，喜欢再说。'
};
export function firstDayStage(p:PlayerState){
  const flags=p.storyFlags??{};
  if(flags[firstDayFlags.complete])return 'FIRST_DAY_COMPLETE';
  if(flags[firstDayFlags.returned])return 'RETURN_TO_INN';
  if(flags[firstDayFlags.trade])return 'EXPLORE_BAISHI';
  if(flags[firstDayFlags.started])return 'FIRST_TRADE_STARTED';
  if(flags[firstDayFlags.street])return 'ENTERED_BAISHI';
  if(flags[INTRO_INN_KEEPER_DONE])return 'MET_INNKEEPER';
  return 'WAKE_UP';
}
export function firstDayQuestAvailable(p:PlayerState,id:string){
  if(p.ledger.some(l=>['QUEST_ACCEPTED','QUEST_REWARD'].includes(l.type)&&l.referenceId===id))return true;
  if(id==='Q_001')return !!p.storyFlags?.[firstDayFlags.street]&&p.sceneId==='INTERIOR_B_TRADE';
  if(id==='Q_002')return !!p.storyFlags?.[INTRO_INN_KEEPER_DONE];
  // 春衫衣坊属于白石街探索内容：玩家首次出客栈后即可并行接取，
  // 不应被“回房结束首日”的生活流程反向锁住。
  if(id==='Q_003')return !!(p.storyFlags?.[firstDayFlags.street]||p.storyFlags?.[firstDayFlags.complete]);
  return true;
}
