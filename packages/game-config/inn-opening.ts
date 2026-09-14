export const GUEST_ROOM_SCENE_ID = 'INTERIOR_B_INN_GUEST_ROOM';
export const INN_LOBBY_SCENE_ID = 'INTERIOR_B_INN';
export const INTRO_INN_KEEPER_DONE = 'INTRO_INN_KEEPER_DONE';

export const guestRoomOpeningDialogue = [
  { speaker: '主角', text: '昨晚睡得还行。' },
  { speaker: '主角', text: '大学毕业后在杭州干了两年，真是越干越卷，开销还一天比一天大。' },
  { speaker: '主角', text: '爸妈劝我回来，我就辞了。可在家待了几天，总不能一直闲着。' },
  { speaker: '主角', text: '既然都到横阳了，今天先出去看看，有没有合适的工作和机会。' }
] as const;

export const innOpeningDialogue = [
  { speaker: '陈掌柜', text: '起来了？昨晚睡得还习惯吧？' },
  { speaker: '主角', text: '还行，睡得挺踏实的。' },
  { speaker: '陈掌柜', text: '听你说，你前两年一直在杭州工作？' },
  { speaker: '主角', text: '嗯，干了两年。那边太卷了，生活开销也高，爸妈一直劝我回来。' },
  { speaker: '主角', text: '回来以后在家待了几天，还是觉得不能一直闲着，就到横阳来找找工作。' },
  { speaker: '陈掌柜', text: '年轻人肯出来走走就好，工作慢慢找，不用太急。' },
  { speaker: '陈掌柜', text: '正好我这里有件小事，你要是愿意，就帮我跑一趟，也顺便熟悉熟悉白石街。' },
  { speaker: '主角', text: '行啊，您说吧。我正好也想出去转转。' },
  { speaker: '陈掌柜', text: '街坊杂货铺有鸣山大米。你先去买一份，再拿到白石商行问问收价。' },
  { speaker: '陈掌柜', text: '别想着一上来赚多少钱，先把这一趟跑明白。' },
  { speaker: '主角', text: '好，我去试试。' }
] as const;

export const guestRoomObjectDialogue: Record<string, string> = {
  GUEST_BED: '这张床不算宽敞，不过昨晚睡得还算踏实。',
  GUEST_CHEST: '这里可以放一些暂时用不到的东西。',
  GUEST_WARDROBE: '衣柜里只有几件随身衣物，日后再慢慢添置。',
  GUEST_DESK: '桌上还放着几本从家乡带来的书。'
};
