export const GUEST_ROOM_LIFE_UNLOCKED='GUEST_ROOM_LIFE_UNLOCKED';

// V1 test values; keep sleep balance here until real-device playtesting.
export const sleepBalance={
  fullSleepHours:6,
  fullSleepCooldownHours:12,
  lowEnergyRecoveryCap:60,
  highEnergyBonusCap:10,
  highEnergyFinalCap:70,
  repeatedSleepModifier:.2,
  shortSleepRecovery:{1:4,3:10}
} as const;

export interface SleepSession {startedAt:string;intendedHours:1|3|6}
export interface SleepResult {before:number;after:number;recovered:number;repeated:boolean;hours:number;settledAt:string}
export interface LifeState {energy:number;sleep:SleepSession|null;lastEffectiveSleepAt:string|null;lastSleepResult:SleepResult|null}
export const initialLifeState=():LifeState=>({energy:100,sleep:null,lastEffectiveSleepAt:null,lastSleepResult:null});
export function normalizeLifeState(input:unknown):LifeState{
  const value=input&&typeof input==='object'?input as Partial<LifeState>:{};
  const energy=value.energy;
  return {energy:typeof energy==='number'&&Number.isInteger(energy)&&energy>=0&&energy<=100?energy:100,
    sleep:value.sleep&&typeof value.sleep.startedAt==='string'&&[1,3,6].includes(value.sleep.intendedHours)?value.sleep:null,
    lastEffectiveSleepAt:typeof value.lastEffectiveSleepAt==='string'?value.lastEffectiveSleepAt:null,
    lastSleepResult:value.lastSleepResult??null};
}
export function settleSleep(life:LifeState,now:Date,earlyWake=false):{life:LifeState;result:SleepResult}|null{
  const session=life.sleep;if(!session)return null;
  const started=Date.parse(session.startedAt),elapsed=(now.getTime()-started)/3600000;
  if(!Number.isFinite(elapsed)||elapsed<0||(!earlyWake&&elapsed<session.intendedHours))return null;
  const hours=earlyWake?Math.min(session.intendedHours,elapsed):session.intendedHours;
  const before=Math.max(0,Math.min(100,life.energy));
  const cap=before<sleepBalance.lowEnergyRecoveryCap?sleepBalance.lowEnergyRecoveryCap:sleepBalance.highEnergyFinalCap;
  const full=hours>=sleepBalance.fullSleepHours;
  const base=full?(before<60?60-before:before<70?Math.min(sleepBalance.highEnergyBonusCap,70-before):0):
    hours>=3?sleepBalance.shortSleepRecovery[3]:hours>=1?sleepBalance.shortSleepRecovery[1]:0;
  const effectiveAt=earlyWake?now.getTime():started+session.intendedHours*3600000;
  const last=life.lastEffectiveSleepAt?Date.parse(life.lastEffectiveSleepAt):NaN;
  const repeated=Number.isFinite(last)&&effectiveAt-last<sleepBalance.fullSleepCooldownHours*3600000;
  const reduced=repeated&&base>0?Math.max(1,Math.floor(base*sleepBalance.repeatedSleepModifier)):base;
  const after=Math.min(100,Math.max(before,cap),before+reduced);
  const result:SleepResult={before,after,recovered:after-before,repeated,hours,settledAt:new Date(effectiveAt).toISOString()};
  return {life:{energy:after,sleep:null,lastEffectiveSleepAt:result.recovered>0?result.settledAt:life.lastEffectiveSleepAt,lastSleepResult:result},result};
}
