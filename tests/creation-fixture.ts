let nextIdentity=0;
const glyphs='一二三四五六七八九十甲乙丙丁戊己庚辛壬癸';
export function testProfile(){
  const number=nextIdentity++;
  return {surname:'林',givenName:glyphs[number%glyphs.length]+glyphs[Math.floor(number/glyphs.length)%glyphs.length],nickname:'阿'+glyphs[Math.floor(number/(glyphs.length*glyphs.length))%glyphs.length]+glyphs[number%glyphs.length],personalityTag:'审慎细致' as const};
}
