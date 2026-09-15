/** One surface per modal: the HUD supplies a single shared dim layer. */
export function adoptRpgModal(panel:HTMLElement,label:string){
  panel.classList.add('rpg-modal');panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',label);
}
export function rpgButton(label:string,action:()=>void,className=''){
  const button=document.createElement('button');button.type='button';button.className=`rpg-button ${className}`;
  button.textContent=label;button.onclick=action;return button;
}
export function createRpgModal(parent:HTMLElement,id:string,onClose:()=>void){
  const panel=document.createElement('section');panel.id=id;panel.className='hidden';adoptRpgModal(panel,'');
  const header=document.createElement('header'),title=document.createElement('h2'),body=document.createElement('div'),footer=document.createElement('footer');
  header.className='rpg-modal-header';body.className='rpg-modal-body';footer.className='rpg-modal-footer';
  const close=rpgButton('关闭',onClose,'rpg-close');header.append(title,close);panel.append(header,body,footer);parent.append(panel);
  return {panel,body,footer,close,show(label:string){title.textContent=label;panel.setAttribute('aria-label',label);panel.classList.remove('hidden');},hide(){panel.classList.add('hidden');}};
}
