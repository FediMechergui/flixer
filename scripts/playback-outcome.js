const sourceErrors=new Set(['HTTP_ERROR','NETWORK_ERROR','BROWSER_VERIFICATION','SOURCE_UNAVAILABLE','STARTUP_TIMEOUT']);
export function nativePlaybackDiagnostics(result){
 return (result.nativeResults||[]).map(row=>row?.result||row).filter(row=>row&&sourceErrors.has(row.sourceError)).map(row=>({sourceError:row.sourceError,httpStatus:Number.isInteger(row.httpStatus)&&row.httpStatus>=400&&row.httpStatus<=599?row.httpStatus:0,networkErrorCode:Number.isInteger(row.networkErrorCode)&&row.networkErrorCode<0&&row.networkErrorCode>=-1000?row.networkErrorCode:0}));
}
function nativeFailureMessage(result){
 const failure=nativePlaybackDiagnostics(result).at(-1);if(!failure)return '';
 if(failure.sourceError==='BROWSER_VERIFICATION')return 'Browser verification required'+(failure.httpStatus?` (HTTP ${failure.httpStatus})`:'');
 if(failure.httpStatus)return `Player document HTTP ${failure.httpStatus}`;
 if(failure.sourceError==='NETWORK_ERROR')return 'Player network error'+(failure.networkErrorCode?` ${failure.networkErrorCode}`:'');
 return failure.sourceError==='STARTUP_TIMEOUT'?'Player startup timed out':'Player source unavailable';
}
export function sourceRefusesDebugger(text){return /you don['’]t have permission to use devtools?\b/i.test(text||'');}
function debuggerRestricted(result){return (result.auditDiagnostics||[]).includes('SOURCE_DEVTOOLS_RESTRICTED')||[...(result.observations||[]),...(result.console||[])].some(row=>sourceRefusesDebugger(row.text));}
export function isPreviewPlayback(result){
 // Only identify an explicitly labelled source video. A short duration or a
 // mention of a trailer elsewhere in the document does not prove a preview.
 if(result?.type&&result.type!=='youtube')return false;
 return (result?.observations||[]).some(row=>{
  if(!/^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{11}(?:[/?#]|$)/.test(row.url||''))return false;
  // Older audit records lack videoTitle. Their embedded YouTube document puts
  // the current title on its first nonempty line; never scan recommendations.
  const title=typeof row.videoTitle==='string'?row.videoTitle:String(row.text||'').split(/\r?\n/).find(line=>line.trim())||'';
  return /\bofficial\s+(?:trailer|teaser)\b|\b(?:trailer|teaser)\s+official\b|\bbande[- ]annonce\s+officielle\b/i.test(title.trim().slice(0,240));
 });
}
export function blockingPlayerMessage(result){
 if(isPreviewPlayback(result))return 'The source video is labelled as an official trailer or teaser; full-title playback is not confirmed';
 if(debuggerRestricted(result))return 'Source refuses DevTools inspection; retest without an attached player debugger';
 const messages=[result.playerError,...(result.nativeResults||[]).map(r=>r.error||r.result?.error||''),...(result.observations||[]).map(s=>s.text)];
 return messages.find(text=>/not.{0,45}available in your country|geo.?block|region.restricted|embedding.{0,15}disabled|Embeds disabled\d*|playback on other websites.{0,15}disabled|Remove sandboxing to enable playback|verify.{0,40}human|captcha|checking your browser|i.?m not a robot|file.{0,20}not found|we can['\u2019]t find the video you are looking for|video.{0,20}(?:not found|removed|deleted)|404[\s—–-]*Page Not Found|404\s+The page you were looking for is not here|couldn.t find this content|Forbidden|Access denied|subscription required|The author of this video has not been found or is blocked|redeem your code|Видеофайл не найден|author.s rights|no playable sources found|Video source is unavailable|File is no longer available/i.test(String(text||'').replace(/\bprotected by reCAPTCHA\b/gi,'')))||nativeFailureMessage(result);
}
export function classifyPlayback(result){
 if(isPreviewPlayback(result))return 'preview_only';
 if(result.playbackConfirmed)return 'playback_confirmed';
 if(debuggerRestricted(result))return 'debugger_restricted';
 if(result.infrastructureError)return 'infrastructure_error';
 const native=nativePlaybackDiagnostics(result);
 const text=[result.playerError,...(result.nativeResults||[]).map(r=>r.error||r.result?.error||''),...(result.observations||[]).map(s=>s.text)].join(' ').replace(/\bprotected by reCAPTCHA\b/gi,'');
 if(/not.{0,45}available in your country|geo.?block|region.restricted/i.test(text))return 'region_restricted';
 if(/embedding.{0,15}disabled|Embeds disabled\d*|playback on other websites.{0,15}disabled|Remove sandboxing to enable playback/i.test(text))return 'embedding_restricted';
 if(native.some(row=>row.sourceError==='BROWSER_VERIFICATION')||/verify.{0,40}human|captcha|checking your browser|verification required|i.?m not a robot/i.test(text))return 'verification_required';
 if(native.some(row=>[401,403,451].includes(row.httpStatus)))return 'access_denied';
 if(native.some(row=>row.sourceError==='NETWORK_ERROR'))return 'network_error';
 if(native.some(row=>[404,410].includes(row.httpStatus)))return 'missing_video';
 if(/(?:file|video).{0,20}(?:not found|deleted|removed)|no video was found|we can['\u2019]t find the video you are looking for|video.{0,10}not available|error 404|404[\s—–-]*Page Not Found|404\s+The page you were looking for is not here|couldn.t find this content|Видеофайл не найден|File is no longer available as it expired or has been deleted/i.test(text))return 'missing_video';
 if(/premium.{0,12}(?:only|required)|members.only|The author of this video has not been found or is blocked|redeem your code|subscription required|blocked due to author.s rights/i.test(text))return 'restricted';
 if(native.some(row=>row.sourceError==='SOURCE_UNAVAILABLE'||row.httpStatus>=500)||/no playable sources found|Video source is unavailable/i.test(text))return 'source_unavailable';
 if((result.network||[]).some(n=>['Document','Media'].includes(n.type)&&[401,403,451].includes(n.status))||/HTTP (?:401|403|451)|Forbidden|Access denied/i.test(text))return 'access_denied';
 if(result.playerError||(result.nativeResults||[]).some(r=>r.error||r.result?.error||r.result?.reason==='failed'))return 'player_error';
 return 'no_advancing_video';
}
