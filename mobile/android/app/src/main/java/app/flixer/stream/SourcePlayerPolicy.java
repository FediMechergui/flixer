package app.flixer.stream;

import java.net.URI;
import java.util.HashSet;
import java.util.Set;

/** Additional public player routes emitted by the source adapters. */
final class SourcePlayerPolicy {
    private SourcePlayerPolicy() {}

    static boolean approved(String value) {
        if (value == null || value.length() > 3000) return false;
        try {
            URI url = new URI(value);
            if (!"https".equals(url.getScheme()) || url.getUserInfo() != null || url.getPort() != -1
                    || url.getHost() == null || url.getFragment() != null) return false;
            String host = url.getHost(), path = url.getRawPath(), query = url.getRawQuery();
            if ("emmmmbed.com".equals(host)) return path.matches("/embed/[A-Za-z0-9_-]+") && query == null;
            if (host.matches("lecteur[0-9]*\\.xtremestream\\.(co|com|net|xyz)")) {
                return "/player/index.php".equals(path) && query != null && query.matches("data=[A-Za-z0-9]+");
            }
            if ("frembed.uno".equals(host)) {
                if (path.matches("/embed/movie/[1-9][0-9]{0,9}")) return query == null;
                if (path.matches("/embed/serie/[1-9][0-9]{0,9}")) return query != null && query.matches("sa=[0-9]{1,3}&epi=[1-9][0-9]{0,4}");
                if ("/films".equals(path)) return query != null && query.matches("id=[1-9][0-9]{0,9}&idType=tmdb");
                if ("/series".equals(path)) return query != null && query.matches("id=[1-9][0-9]{0,9}&sa=[0-9]{1,3}&epi=[1-9][0-9]{0,4}&idType=tmdb");
            }
            if ("uqload.co".equals(host)) return path.matches("/embed-[A-Za-z0-9]+\\.html") && query == null;
            if ("ss.hd-vk.com".equals(host)) return path.matches("/embed-[A-Za-z0-9]+\\.html") && query == null;
            if ("netu.frembed.bond".equals(host)) return path.matches("/e/[A-Za-z0-9]+") && query == null;
            if ("dood.to".equals(host) || "dood.watch".equals(host) || "shanelocaldog.com".equals(host)) {
                return path.matches("/e/[A-Za-z0-9]+/?") && query == null;
            }
        } catch (Exception ignored) {}
        return false;
    }

    static Set<String> originsFor(String value) {
        Set<String> origins = new HashSet<>();
        for (String host : new String[]{"emmmmbed.com", "frembed.uno", "uqload.co", "dood.to", "dood.watch", "shanelocaldog.com", "ss.hd-vk.com", "netu.frembed.bond"}) origins.add("https://" + host);
        // Only the actual approved Xtremestream origin receives health/progress
        // messages. No wildcard origin or Capacitor bridge is exposed to players.
        if (approved(value)) try { origins.add("https://" + new URI(value).getHost()); } catch (Exception ignored) {}
        return origins;
    }
}
