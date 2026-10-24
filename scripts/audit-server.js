// Match the client data layer's YouTube conversion before mounting its player.
export function auditServer(server){
 const id=server.type==='youtube'&&/^[A-Za-z0-9_-]{11}$/.test(server.videoId||'')?server.videoId:null;
 return {...server,...(id?{embedUrl:`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`,sandbox:null}:{}),...(server.rawStreamUrl?{streamUrl:server.rawStreamUrl}:{})};
}
