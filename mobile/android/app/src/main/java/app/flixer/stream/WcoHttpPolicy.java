package app.flixer.stream;

import java.net.URI;

/** A denial of the publisher player document is distinct from a failed ad. */
final class WcoHttpPolicy {
    private WcoHttpPolicy() {}
    static boolean deniedPlayer(String value,int status) {
        if(status!=403)return false;
        try {
            URI uri=new URI(value);
            return "https".equals(uri.getScheme())&&"embed.wcostream.com".equals(uri.getHost())
                &&uri.getPort()==-1&&uri.getUserInfo()==null
                &&uri.getPath().matches("/inc/embed/(?:index|video-js(?:-old)?)\\.php");
        } catch(Exception ignored){return false;}
    }
}
