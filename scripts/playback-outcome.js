export function blockingPlayerMessage(result){
 const messages=[result.playerError,...(result.nativeResults||[]).map(r=>r.error||r.result?.error||''),...(result.observations||[]).map(s=>s.text)];
 return messages.find(text=>/not.{0,45}available in your country|geo.?block|region.restricted|embedding.{0,15}disabled|playback on other websites.{0,15}disabled|Remove sandboxing to enable playback|verify.{0,40}human|captcha|checking your browser|i.?m not a robot|file.{0,20}not found|video.{0,20}(?:not found|removed|deleted)|404[\s—–-]*Page Not Found|404\s+The page you were looking for is not here|couldn.t find this content|Forbidden|Access denied|subscription required|redeem your code|Видеофайл не найден|author.s rights|no playable sources found|Video source is unavailable|File is no longer available/i.test(text||''))||'';
}
export function classifyPlayback(result){
 if(result.playbackConfirmed)return 'playback_confirmed';
 if(result.infrastructureError)return 'infrastructure_error';
 const text=[result.playerError,...(result.nativeResults||[]).map(r=>r.error||r.result?.error||''),...(result.observations||[]).map(s=>s.text)].join(' ');
 if(/not.{0,45}available in your country|geo.?block|region.restricted/i.test(text))return 'region_restricted';
 if(/embedding.{0,15}disabled|playback on other websites.{0,15}disabled|Remove sandboxing to enable playback/i.test(text))return 'embedding_restricted';
 if(/verify.{0,40}human|captcha|checking your browser|verification required|i.?m not a robot/i.test(text))return 'verification_required';
 if(/(?:file|video).{0,20}(?:not found|deleted|removed)|no video was found|video.{0,10}not available|error 404|404[\s—–-]*Page Not Found|404\s+The page you were looking for is not here|couldn.t find this content|Видеофайл не найден|File is no longer available as it expired or has been deleted/i.test(text))return 'missing_video';
 if(/premium.{0,12}(?:only|required)|members.only|redeem your code|subscription required|blocked due to author.s rights/i.test(text))return 'restricted';
 if(/no playable sources found|Video source is unavailable/i.test(text))return 'source_unavailable';
 if((result.network||[]).some(n=>['Document','Media'].includes(n.type)&&[401,403,451].includes(n.status))||/HTTP (?:401|403|451)|Forbidden|Access denied/i.test(text))return 'access_denied';
 if(result.playerError||(result.nativeResults||[]).some(r=>r.error||r.result?.error||r.result?.reason==='failed'))return 'player_error';
 return 'no_advancing_video';
}
