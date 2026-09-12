export const DIALOGUE_PORTRAIT_SCALE = 1.15;
export const DIALOGUE_ACTIVE_PORTRAIT_SCALE = 1.04;
export const DIALOGUE_INACTIVE_ALPHA = 0.76;
export const JOYSTICK_VISUAL_SCALE = 1.15;
export const JOYSTICK_HIT_SCALE = 1.24;

export function mobileDialogueBounds(width: number, height: number, insets: { left: number; right: number; bottom: number }) {
  const left = insets.left + 24;
  const right = width - insets.right - 24;
  const bottom = height - insets.bottom - 14;
  const boxHeight = Math.min(166, height * .30);
  return { left, right, bottom, top: bottom - boxHeight, width: right - left, height: boxHeight };
}

export function paginateDialogue(text: string, charsPerLine = 25, linesPerPage = 3): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const chars = Array.from(paragraph);
    if (!chars.length) { lines.push(''); continue; }
    for (let at = 0; at < chars.length; at += charsPerLine) lines.push(chars.slice(at, at + charsPerLine).join(''));
  }
  const pages: string[] = [];
  for (let at = 0; at < lines.length; at += linesPerPage) pages.push(lines.slice(at, at + linesPerPage).join('\n'));
  return pages.length ? pages : [''];
}
