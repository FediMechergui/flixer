export function artworkUrl(value,origin){
  if(typeof value!=='string'||!value.trim()||/^(?:undefined|null|none|false)$/i.test(value.trim()))return null;
  try{const u=new URL(value,origin);if(u.protocol!=='https:'||u.username||u.password||/(?:^|\/)(?:undefined|null|none)(?:\.[a-z]+)?$/i.test(u.pathname))return null;return u.href;}catch{return null;}
}
