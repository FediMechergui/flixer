// Serialized into the debug page. Instrument only the audit harness; leave the
// production callbacks and their session checks intact.
export function installNativeAuditBridge() {
  if (window.__auditWrapped === 2) return;
  window.__auditNativeSequence ||= 0;
  for (const name of ['openPlayer', 'openMedia']) {
    const original = window.FlixerBrowser[name];
    window.FlixerBrowser[name] = async (...args) => {
      const attempt = window.__auditAttempt;
      const invocation = String(attempt) + ':' + (++window.__auditNativeSequence);
      const transport = name === 'openMedia' ? 'media3' : 'webview';
      const options = args[1] || {}, onProgress = options.onProgress;
      args[1] = {...options, onProgress: state => {
        if (attempt === window.__auditAttempt && window.__auditNativeProgress.length < 2000) {
          window.__auditNativeProgress.push({invocation, transport, position: state.position,
            duration: state.duration, playing: state.playing === true});
        }
        onProgress?.(state);
      }};
      try {
        const result = await original(...args);
        if (attempt === window.__auditAttempt) {
          // An already-open debug page may retain the old audit wrapper. Its
          // identical result lacks invocation metadata; replace that one entry.
          window.__auditNativeResults = window.__auditNativeResults.filter(row => row.result !== result);
          window.__auditNativeResults.push({surface: name, invocation, transport, result});
        }
        return result;
      } catch (error) {
        if (attempt === window.__auditAttempt) {
          window.__auditNativeResults = window.__auditNativeResults.filter(row => row.invocation || row.surface !== name || row.error !== error.message);
          window.__auditNativeResults.push({surface: name, invocation, transport, error: error.message});
        }
        throw error;
      }
    };
  }
  window.__auditWrapped = 2;
}
