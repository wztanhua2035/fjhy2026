/** Shared semantic presentation values for the Web DOM and WeChat canvas. */
export const uiTokens = {
  colors: {
    bgPrimary: '#edf1e8', bgSecondary: '#e2eadd', panel: '#fffaf0', panelElevated: '#fffdf7',
    textPrimary: '#34463b', textSecondary: '#5a6d60', textMuted: '#78877b',
    accent: '#527c69', accentSoft: '#dcebe1', accentWarm: '#ae7950',
    success: '#527b57', warning: '#a06f3b', danger: '#a35046',
    divider: '#d9e2d4', mask: '#17271fc2',
    dialoguePanel: '#253b36', dialogueBody: '#fff8e8',
    speakerPlayer: '#567e91', speakerNpc: '#a67b50', speakerNarrator: '#777b72',
    dialogueKeyword: '#d9dca0', dialogueMoney: '#efd092', dialoguePlace: '#a9d6c5'
  },
  typography: { titleXL: 28, titleL: 24, titleM: 20, bodyL: 20, bodyM: 17, bodyS: 15, caption: 13, number: 19, price: 19, dialogue: 27, speaker: 23 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 8, md: 12, lg: 18, pill: 999 },
  border: { width: 2 },
  shadow: { panel: '0 12px 32px #263b3033', card: '0 5px 16px #263b3029' },
  overlay: { modal: .72, dialogue: .38 },
  zIndex: { world: 0, hud: 30, panel: 40, portrait: 50, dialogue: 60, modal: 70, notification: 80 },
  uiLayer: { hud: 30, panel: 40, portrait: 50, dialogue: 60, modal: 70, notification: 80 },
  safeArea: { edge: 18, capsuleGap: 12 },
  animationDuration: { fast: 120, normal: 200, slow: 300 },
  disabledOpacity: .48,
  touch: { min: 44, primary: 52 }
} as const;

export type SpeakerKind = 'player' | 'npc' | 'narrator';
export function speakerKind(speaker: string): SpeakerKind {
  if (speaker === '主角' || speaker === '玩家') return 'player';
  if (!speaker || speaker === '旁白' || speaker === '系统') return 'narrator';
  return 'npc';
}
export function speakerName(speaker: string, formalName?: string): string {
  return speakerKind(speaker) === 'player' ? formalName || '主角' : speaker || '旁白';
}

export function compactQuestText(task: { name: string; currentObjective: string; completed: boolean }): string {
  return task.completed ? `${task.name}\n已完成` : `${task.name}\n${task.currentObjective}`;
}

export type UiNotice = { id: number; kind: 'toast' | 'result'; text: string };
export class UiNotificationQueue {
  private nextId = 1;
  private pending: UiNotice[] = [];
  private active: UiNotice | null = null;
  enqueue(kind: UiNotice['kind'], text: string): UiNotice {
    const notice = { id: this.nextId++, kind, text };
    this.pending.push(notice);
    this.active ??= this.pending.shift() ?? null;
    return notice;
  }
  current() { return this.active; }
  dismiss(id: number) {
    if (this.active?.id !== id) return this.active;
    this.active = this.pending.shift() ?? null;
    return this.active;
  }
  clear() { this.pending = []; this.active = null; }
}
