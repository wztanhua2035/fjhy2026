export const personalityChoices=[
  {tag:'开朗热情',quote:'这事算我一个，走，一起去看看！',tone:'主动、热情、愿意参与'},
  {tag:'审慎细致',quote:'先别急，查清细节、留好后路再说。',tone:'谨慎、强调细节、习惯留后路'},
  {tag:'沉稳内敛',quote:'不慌不忙，稳住步子，静观其变。',tone:'冷静、简洁、不急躁'},
  {tag:'孤傲冷峻',quote:'我不习惯结伴，都离我远一点。',tone:'独立、疏离、少言'},
  {tag:'活泼机灵',quote:'硬碰硬多笨呀，看我的，总有好办法！',tone:'灵活、俏皮、喜欢变通'},
  {tag:'温和豁达',quote:'算了各退一步，多大点事，犯不上计较。',tone:'包容、缓和冲突、不计较'},
  {tag:'随性自在',quote:'走到哪算哪呗，开开心心最重要。',tone:'松弛、自由、不拘小节'},
  {tag:'率真纯朴',quote:'我心里怎么想就怎么说，我相信你！',tone:'直接、真诚、容易信任'},
  {tag:'坚韧执着',quote:'认准了这条路，撞碎南墙也绝不回头！',tone:'坚定、持续、不轻易放弃'}
] as const;
export type PersonalityTag=(typeof personalityChoices)[number]['tag'];
export interface PlayerProfile {surname:string;givenName:string;nickname:string;personalityTag:PersonalityTag}
export const formalName=(profile:Pick<PlayerProfile,'surname'|'givenName'>)=>profile.surname+profile.givenName;
export class PlayerIdentityError extends Error {constructor(public code:'INVALID_SURNAME'|'INVALID_GIVEN_NAME'|'INVALID_NICKNAME'|'INVALID_PERSONALITY'|'PLAYER_IDENTITY_TAKEN',message:string){super(message);}}
const han=/^\p{Script=Han}{1,2}$/u,nicknameHan=/^\p{Script=Han}{2,3}$/u;
export function validatePlayerIdentity(input:unknown):PlayerProfile{
  const value=input&&typeof input==='object'?input as Record<string,unknown>:{};
  const normalize=(key:string)=>typeof value[key]==='string'?value[key].normalize('NFC').trim():'';
  const surname=normalize('surname'),givenName=normalize('givenName'),nickname=normalize('nickname'),personalityTag=normalize('personalityTag');
  if(!han.test(surname))throw new PlayerIdentityError('INVALID_SURNAME','姓氏须为 1～2 个中文汉字');
  if(!han.test(givenName))throw new PlayerIdentityError('INVALID_GIVEN_NAME','名字须为 1～2 个中文汉字');
  if(!nicknameHan.test(nickname))throw new PlayerIdentityError('INVALID_NICKNAME','外号须为 2～3 个中文汉字');
  if(!personalityChoices.some(choice=>choice.tag===personalityTag))throw new PlayerIdentityError('INVALID_PERSONALITY','请选择一句最符合你的话');
  return {surname,givenName,nickname,personalityTag:personalityTag as PersonalityTag};
}
export const namePools={
  singleSurnames:['林','陈','沈','叶','顾','周','许','温'],
  compoundSurnames:['欧阳','诸葛','司马'],
  maleGivenNames:['知远','景川','安','清和','明哲'],
  femaleGivenNames:['知夏','清宁','安','晚晴','若溪'],
  neutralGivenNames:['小满','明','青禾','予安'],
  nicknames:['阿远','小满','阿宁','木头','小石头','知知','小禾']
} as const;
export function randomIdentity(gender:'MALE'|'FEMALE',random=Math.random):Omit<PlayerProfile,'personalityTag'>{
  const pick=<T>(list:readonly T[])=>list[Math.floor(random()*list.length)%list.length];
  const surname=pick(random()<.2?namePools.compoundSurnames:namePools.singleSurnames);
  const givenName=pick(random()<.3?namePools.neutralGivenNames:gender==='MALE'?namePools.maleGivenNames:namePools.femaleGivenNames);
  return {surname,givenName,nickname:pick(namePools.nicknames)};
}
