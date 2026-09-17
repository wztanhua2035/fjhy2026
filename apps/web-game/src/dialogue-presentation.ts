/** Auxiliary transport annotations are not spoken dialogue. */
export function dialogueContext(message: string): string {
  return message.split('\n').filter(line=>/^(初次结识|关系状态|身份说明)[：:]/.test(line)).join(' · ').replace(/。/g,'');
}
export function notificationDestination(dialogue: boolean, shopOpen: boolean): 'dialogue'|'shop'|'toast' {
  // Result cards live on the HUD layer and must remain visible above an open modal.
  return dialogue?'dialogue':'toast';
}
export function wrapDialogue(text:string,measure:(value:string)=>number,width:number,linesPerPage=3):string[] {
  const lines:string[]=[];
  const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
  for(const paragraph of text.split('\n')){
    const tokens:string[]=[];
    for(const {segment} of segmenter.segment(paragraph)){
      if(/^[，。！？、；：）】》”’…,.!?;:)]+$/.test(segment)&&tokens.length)tokens[tokens.length-1]+=segment;
      else tokens.push(segment);
    }
    let line='';
    for(const token of tokens){
      if(line&&measure(line+token)>width){
        // Prefer a spoken pause over filling the last few pixels of a line.
        const pauses=Array.from(line.matchAll(/[，。！？；：]/g));
        const pause=pauses.reverse().find(match=>measure(line.slice(0,match.index!+1))>=width*.35);
        if(pause){const split=pause.index!+1;lines.push(line.slice(0,split));line=line.slice(split);}
        else{lines.push(line.trimEnd());line='';}
      }
      if(measure(token)>width){for(const character of token){if(line&&measure(line+character)>width){lines.push(line);line='';}line+=character;}}
      else line+=token;
    }
    if(line.trim())lines.push(line.trimEnd());
  }
  const pages:string[]=[];for(let i=0;i<lines.length;i+=linesPerPage)pages.push(lines.slice(i,i+linesPerPage).join('\n'));
  return pages.length?pages:[''];
}
