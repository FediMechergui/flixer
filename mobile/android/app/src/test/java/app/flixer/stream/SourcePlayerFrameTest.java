package app.flixer.stream;

import org.junit.Test;
import static org.junit.Assert.*;

public class SourcePlayerFrameTest {
    @Test public void sourcePublishedNetuPlayersReceiveAGenuineIframeInAnIsolatedAppDocument() {
        for (String url : new String[]{"https://netu.frembed.bond/e/98REi4XoBV2S", "https://netu.frembed.bond/e/GjvwOiHOfeKj"}) {
            String html = SourcePlayerFrame.html(url);
            assertNotNull(html);
            assertTrue(html.contains("<iframe src=\"" + url + "\""));
            assertTrue(html.contains("allow=\"autoplay; fullscreen; picture-in-picture\""));
            assertTrue(html.contains("width:100%;height:100%"));
            assertFalse(html.contains("<script"));
            assertFalse(html.contains("Capacitor"));
            assertFalse(html.contains("self_top"));
        }
        assertEquals("https://player.flixer.invalid/", SourcePlayerFrame.ORIGIN);
    }

    @Test public void otherPlayersAndUnvalidatedDestinationsNeverReceiveTheSpecialWrapper() {
        for (String url : new String[]{
                "https://vidcore.io/movie/1234064", "https://netu.frembed.bond/account", "http://netu.frembed.bond/e/abc",
                "https://user@netu.frembed.bond/e/abc", "https://netu.frembed.bond:8443/e/abc",
                "https://netu.frembed.bond.evil.org/e/abc", "https://netu.frembed.bond/e/abc?target=elsewhere",
                "https://netu.frembed.bond/e/abc#other", "https://netu.frembed.bond/e/abc\"><script>bad</script>",
                "https://netu.frembed.bond/e/%22bad", "https://netu.frembed.bond/e/../account"}) assertNull(url, SourcePlayerFrame.html(url));
    }
}
