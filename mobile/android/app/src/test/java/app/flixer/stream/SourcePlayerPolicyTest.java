package app.flixer.stream;

import org.junit.Test;
import static org.junit.Assert.*;

public class SourcePlayerPolicyTest {
    @Test public void acceptsActualSourcePlayerDescriptorsAndTheirInternalPlayerPages() {
        for (String url : new String[]{
                "https://emmmmbed.com/embed/21laX8xe",
                "https://lecteur1.xtremestream.xyz/player/index.php?data=0e01938fc48a2cfb5f2217fbfb00722d",
                "https://lecteur.xtremestream.co/player/index.php?data=actual123",
                "https://frembed.uno/embed/movie/309809",
                "https://frembed.uno/embed/serie/246?sa=1&epi=1",
                "https://frembed.uno/films?id=309809&idType=tmdb",
                "https://frembed.uno/series?id=246&sa=1&epi=1&idType=tmdb",
                "https://uqload.co/embed-u330rs2rktmh.html",
                "https://dood.to/e/mllbbbivrazw",
                "https://dood.watch/e/mllbbbivrazw",
                "https://shanelocaldog.com/e/wmg8hrklsbcl",
                "https://ss.hd-vk.com/embed-lbycxnbhuk16.html",
                "https://netu.frembed.bond/e/98REi4XoBV2S",
                "https://netu.frembed.bond/e/GjvwOiHOfeKj"}) assertTrue(url, SourcePlayerPolicy.approved(url));
    }

    @Test public void sourceAdmissionIsRestrictedToRealHttpsPlayerPaths() {
        for (String url : new String[]{
                "http://emmmmbed.com/embed/21laX8xe", "https://user@emmmmbed.com/embed/21laX8xe",
                "https://emmmmbed.com:444/embed/21laX8xe", "https://emmmmbed.com.evil.org/embed/21laX8xe",
                "https://emmmmbed.com/login", "https://emmmmbed.com/embed/21laX8xe?next=https://evil.org",
                "https://lecteur1.xtremestream.xyz.evil.org/player/index.php?data=123",
                "https://lecteur1.xtremestream.xyz/player/index.php?data=123&data=456",
                "https://lecteur1.xtremestream.xyz/player/index.php?data=123#bad", "https://xtremestream.xyz/player/index.php?data=123",
                "https://frembed.uno/premium", "https://frembed.uno/embed/serie/246?sa=1&epi=1&redirect=https://evil.org",
                "https://frembed.uno/embed/movie/../admin", "https://frembed.uno/embed/movie/%2e%2e",
                "https://uqload.co/account", "https://dood.to/login", "https://shanelocaldog.com/advertising",
                "https://ss.hd-vk.com/account", "https://ss.hd-vk.com.evil.org/embed-lbycxnbhuk16.html",
                "https://netu.frembed.bond/e/98REi4XoBV2S?redirect=https://evil.org",
                "https://netu.frembed.bond/e/98REi4XoBV2S#redirect", "https://netu.frembed.bond/account",
                "https://user@netu.frembed.bond/e/98REi4XoBV2S", "https://netu.frembed.bond:444/e/98REi4XoBV2S",
                "https://netu.frembed.bond.evil.org/e/98REi4XoBV2S"}) assertFalse(url, SourcePlayerPolicy.approved(url));
    }

    @Test public void healthOriginsIncludeOnlyTheApprovedXtremestreamHost() {
        String player = "https://lecteur1.xtremestream.xyz/player/index.php?data=actual123";
        assertTrue(SourcePlayerPolicy.originsFor(player).contains("https://lecteur1.xtremestream.xyz"));
        assertFalse(SourcePlayerPolicy.originsFor(player).contains("https://*.xtremestream.xyz"));
        assertFalse(SourcePlayerPolicy.originsFor("https://evil.org/player").contains("https://evil.org"));
    }
    @Test public void theObservedStreamtapeChildReceivesTelemetryWithoutNavigationAdmission() {
        assertTrue(SourcePlayerPolicy.telemetryOrigins().contains("https://streamtape.com"));
        assertEquals(1, SourcePlayerPolicy.telemetryOrigins().size());
        assertFalse(SourcePlayerPolicy.originsFor(null).contains("https://streamtape.com"));
        assertFalse(SourcePlayerPolicy.approved("https://streamtape.com/e/meXKdepG2WIXO6"));
        assertFalse(SourcePlayerPolicy.approved("https://streamtape.com/account"));
    }
}
