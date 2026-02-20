/**
 * Utility to convert various music platform URLs into embed-friendly formats.
 * Supported: Spotify, YouTube, Apple Music.
 */

export function getMusicEmbedUrl(url: string): string | null {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname.toLowerCase();

        // 1. Spotify
        // Link: https://open.spotify.com/track/4cOdzh0s2UDvY9vy9id97s?si=...
        // Embed: https://open.spotify.com/embed/track/4cOdzh0s2UDvY9vy9id97s
        if (host.includes('spotify.com')) {
            const path = urlObj.pathname;
            if (path.includes('/track/')) {
                const trackId = path.split('/track/')[1].split('/')[0];
                return `https://open.spotify.com/embed/track/${trackId}`;
            }
            if (path.includes('/album//')) {
                 const albumId = path.split('/album/')[1].split('/')[0];
                 return `https://open.spotify.com/embed/album/${albumId}`;
            }
            if (path.includes('/playlist/')) {
                const playlistId = path.split('/playlist/')[1].split('/')[0];
                return `https://open.spotify.com/embed/playlist/${playlistId}`;
            }
        }

        // 2. YouTube
        // Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ
        // Embed: https://www.youtube.com/embed/dQw4w9WgXcQ
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            let videoId = '';
            if (host.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            } else {
                videoId = urlObj.searchParams.get('v') || '';
            }
            
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }

        // 3. Apple Music
        // Link: https://music.apple.com/us/album/song-name/id12345
        // Embed: https://embed.music.apple.com/us/album/song-name/id12345
        if (host.includes('music.apple.com')) {
            return url.replace('music.apple.com', 'embed.music.apple.com');
        }

    } catch (e) {
        console.warn('Invalid URL passed to getMusicEmbedUrl:', url);
    }

    return null;
}

export function isDirectAudioUrl(url: string): boolean {
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];
    return audioExtensions.some(ext => url.toLowerCase().includes(ext));
}
