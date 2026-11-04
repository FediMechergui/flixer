// Bundled locally for the APK. Only the source's public guest request format is used.
import {createNativeCarateenSource} from '../shared/carateen-native.js';
const http=()=>{const capacitor=window.Capacitor;return capacitor?.isNativePlatform?.()?(capacitor.Plugins?.CapacitorHttp||capacitor.registerPlugin?.('CapacitorHttp')):null;};
window.FlixerCarateenSource=createNativeCarateenSource({http,agent:()=>window.navigator?.userAgent||'Mozilla/5.0'});
