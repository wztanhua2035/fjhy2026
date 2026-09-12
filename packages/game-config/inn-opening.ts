export const GUEST_ROOM_SCENE_ID = 'INTERIOR_B_INN_GUEST_ROOM';
export const INN_LOBBY_SCENE_ID = 'INTERIOR_B_INN';
export const INTRO_INN_KEEPER_DONE = 'INTRO_INN_KEEPER_DONE';

export const innOpeningDialogue = [
  { speaker: '陈掌柜', text: '起来了？昨晚睡得还习惯吧？' },
  { speaker: '主角', text: '还好，已经住了几天，差不多习惯了。' },
  { speaker: '陈掌柜', text: '工作慢慢找，不急。这几天先安心住着。' },
  { speaker: '陈掌柜', text: '既然出来了，就顺便帮我看看店里有没有什么要搭把手的。' }
] as const;

export const guestRoomObjectDialogue: Record<string, string> = {
  GUEST_BED: '这张床不算宽敞，不过这阵子总算有个落脚的地方。',
  GUEST_CHEST: '这里可以放一些暂时用不到的东西。',
  GUEST_WARDROBE: '衣柜里只有几件随身衣物，日后再慢慢添置。',
  GUEST_DESK: '桌上还放着几本从家乡带来的书。'
};
