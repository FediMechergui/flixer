export function matchesCollection(show,id){
  if(!id)return true;
  const collections=show.collections||[],tags=show.tags||[],lang=String(show.originalLanguage||show.contentLang||show.lang||show.tvm?.l||'').toLowerCase(),countries=[...(show.countries||[]),show.tvm?.c].filter(Boolean).map(c=>String(c).toUpperCase());
  const animation=tags.some(t=>/^(97|animation|anime)$/i.test(String(t))),japanese=countries.includes('JP')||['ja','japanese'].includes(lang),anime=animation&&(japanese||collections.includes('anime')||tags.includes('anime'));
  const french=collections.includes('french')||lang==='fr'||(show.audioLanguages||[]).includes('fr');
  if(id==='french')return french;
  if(id==='french-originals')return lang==='fr';
  if(id==='french-cartoons')return french&&animation;
  if(id==='french-entertainment')return french&&tags.some(tag=>['reality','talk','theatre','music'].includes(tag));
  if(id==='arabic')return collections.includes(id)||lang==='ar'||countries.some(c=>['TN','EG','MA','DZ','LB','SY','SA','JO','IQ','KW','AE','QA','BH','OM','YE','PS','SD','LY'].includes(c));
  if(id==='egyptian')return collections.includes(id)||countries.includes('EG');
  if(id==='tunisian')return collections.includes(id)||countries.includes('TN');
  if(id==='plays')return collections.includes(id)||tags.includes('theatre');
  if(id==='kdrama')return show.kind==='series'&&!animation&&(collections.includes(id)||countries.includes('KR')||['ko','korean'].includes(lang));
  if(id==='indian')return collections.includes(id)||countries.includes('IN')||['hi','hindi','ta','tamil','te','telugu','ml','malayalam','kn','kannada','bn','bengali','mr','marathi','pa','punjabi'].includes(lang);
  if(id==='turkish')return collections.includes(id)||countries.includes('TR')||['tr','turkish'].includes(lang);
  if(id==='anime')return anime;
  if(id==='anime-sub'||id==='anime-dub')return anime&&([...(show.audioModes||[]),show.audioMode].includes(id==='anime-sub'?'sub':'dub'));
  if(id==='cartoons')return animation&&!anime;
  if(id==='classic-cartoons')return animation&&!anime&&show.year&&Number(show.year)<2000;
  return false;
}
