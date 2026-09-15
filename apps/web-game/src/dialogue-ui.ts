import { wrapDialogue } from './dialogue-presentation';
import { speakerKind, speakerName } from '../../../packages/client-runtime/ui-design-tokens.js';

export function createWebDialogueUi(root: HTMLElement, advanceStory: () => Promise<void>) {
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
  const context=document.createElement('aside');context.id='dialogue-context';context.className='hidden';context.setAttribute('role','status');
  root.append(panel,context);
  const measureContext=document.createElement('canvas').getContext('2d')!;
  let source = '', text = '', pages: string[] = [], page = 0, advancing=false;
  const showPage = () => {
    body.textContent = pages[page] ?? '';
    next.textContent = page + 1 < pages.length ? '▼ 继续' : '▼';
    next.dataset.more = String(page + 1 < pages.length);
  };
  const layout=()=>{
    if(panel.classList.contains('hidden'))return;
    const style=getComputedStyle(body);measureContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const spacing=parseFloat(style.letterSpacing)||0;
    pages=wrapDialogue(text,value=>measureContext.measureText(value).width+Array.from(value).length*spacing,Math.max(120,body.clientWidth-4));
    page=Math.min(page,pages.length-1);showPage();
  };
  new ResizeObserver(layout).observe(body);
  panel.onclick=async()=>{
    if(advancing)return;
    if(page+1<pages.length){page++;showPage();return;}
    advancing=true;panel.setAttribute('aria-busy','true');
    try{await advanceStory();}finally{advancing=false;panel.setAttribute('aria-busy','false');}
  };
  return {
    sync(speaker: string, spokenText: string, visible: boolean, formalName?: string, auxiliary='') {
      panel.classList.toggle('hidden', !visible);context.classList.toggle('hidden',!visible||!auxiliary);context.textContent=auxiliary;
      if (!visible) { source = ''; page = 0; return; }
      const key = `${speaker}\0${spokenText}`;
      if (key !== source) { source = key; text=spokenText; page = 0; layout(); }
      name.textContent = speakerName(speaker, formalName);
      name.dataset.speaker = speakerKind(speaker);
      showPage();
    }
  };
}
