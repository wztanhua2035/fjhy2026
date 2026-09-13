import { paginateDialogue } from '../../../packages/client-runtime/dialogue-layout.js';
import { speakerKind, speakerName } from '../../../packages/client-runtime/ui-design-tokens.js';

export function createWebDialogueUi(root: HTMLElement, advanceStory: () => void) {
  const panel = document.createElement('section');
  panel.id = 'dialogue-panel';
  panel.className = 'hidden';
  panel.setAttribute('role', 'dialog');
  const name = document.createElement('strong');
  name.className = 'dialogue-name';
  const body = document.createElement('p');
  body.className = 'dialogue-body';
  const next = document.createElement('span');
  next.className = 'dialogue-next';
  next.textContent = '▼';
  panel.append(name, body, next);
  root.append(panel);
  let source = '', pages: string[] = [], page = 0;
  panel.onclick = () => { if (page + 1 < pages.length) { page++; body.textContent = pages[page]; } else advanceStory(); };
  return {
    sync(speaker: string, text: string, visible: boolean, formalName?: string) {
      panel.classList.toggle('hidden', !visible);
      if (!visible) { source = ''; page = 0; return; }
      const key = `${speaker}\0${text}`;
      if (key !== source) { source = key; pages = paginateDialogue(text, 25, 3); page = 0; }
      name.textContent = speakerName(speaker, formalName);
      name.dataset.speaker = speakerKind(speaker);
      body.textContent = pages[page] ?? '';
    }
  };
}
