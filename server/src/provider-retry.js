export function nextProviderRetry(previous,error,now=Date.now()){
 const failures=Math.min(6,(previous?.failures||0)+1),blocked=/HTTP (?:401|403|429)|verification required/i.test(error||''),delay=Math.min(blocked?3600000:1800000,900000*2**(failures-1));
 return {failures,retryAt:new Date(now+delay).toISOString(),error:String(error||'Source unavailable').slice(0,500)};
}
export function providerCoolingDown(state,now=Date.now()){return Date.parse(state?.retryAt||'')>now;}
