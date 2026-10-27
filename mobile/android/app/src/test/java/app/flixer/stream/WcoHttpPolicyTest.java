package app.flixer.stream;

import org.junit.Test;
import static org.junit.Assert.*;

public class WcoHttpPolicyTest {
    @Test public void recognizesOnlyTheObservedPublisherDocumentDenials() {
        assertTrue(WcoHttpPolicy.deniedPlayer("https://embed.wcostream.com/inc/embed/video-js-old.php?pid=1",403));
        assertTrue(WcoHttpPolicy.deniedPlayer("https://embed.wcostream.com/inc/embed/index.php",403));
        assertFalse(WcoHttpPolicy.deniedPlayer("https://embed.wcostream.com/inc/embed/video-js-old.php",200));
        assertFalse(WcoHttpPolicy.deniedPlayer("https://embed.wcostream.com/inc/embed/pre-init.js",403));
        assertFalse(WcoHttpPolicy.deniedPlayer("https://ads.example/inc/embed/video-js-old.php",403));
        assertFalse(WcoHttpPolicy.deniedPlayer("https://embed.wcostream.com:444/inc/embed/index.php",403));
    }
}
