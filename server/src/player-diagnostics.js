// Diagnose document responses, not playback. A 200 player shell still needs a
// browser and an actual advancing video clock before playback can be confirmed.
export function diagnosePlayerResponse(status, {title='',text='',contentType='',challenge=false}={}) {
  if(status===404||status===410)return 'missing-video';
  if(challenge||/just a moment|attention required/i.test(title))return 'browser-verification-required';
  if(/sorry, you have been blocked|you are unable to access/i.test(text))return 'upstream-access-block';
  if(status===401||status===403)return 'upstream-access-block';
  if(status>=500)return 'upstream-server-error';
  if(/Enjoy Ad-Free Access[\s\S]*REDEEM YOUR CODE HERE/i.test(text))return 'source-access-gate';
  if(/please disable ad.?block|ad.?blocker detected/i.test(text))return 'source-adblock-gate';
  if(/file (?:not found|was deleted)|video (?:has been|was) (?:removed|deleted)|this video not found|video (?:is not|is no longer) available|we can.t find the video|we couldn.t find|404.*not found/i.test(text))return 'missing-video';
  if(status>=200&&status<300)return /text\/html/i.test(contentType)?'javascript-player-required':'http-reachable-playback-unverified';
  return 'unexpected-response';
}
