'use client'

import React from 'react'
import { getMusicEmbedUrl, isDirectAudioUrl } from '@/lib/utils/url-utils'

interface MusicPlayerProps {
    url: string
}

export default function MusicPlayer({ url }: MusicPlayerProps) {
    if (!url) return null;

    const embedUrl = getMusicEmbedUrl(url);
    const isDirect = isDirectAudioUrl(url);

    // 1. Platform Embed (Spotify, YT, Apple)
    if (embedUrl) {
        // Different heights for different platforms for optimal grid look
        let height = "152"; // default for spotify/apple
        if (embedUrl.includes('youtube.com')) height = "200";

        return (
            <div className="music-embed-container" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
                <iframe
                    src={embedUrl}
                    width="100%"
                    height={height}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    style={{ borderRadius: '12px', border: 'none' }}
                />
            </div>
        );
    }

    // 2. Direct Audio Link (.mp3 etc)
    if (isDirect) {
        return (
            <div className="direct-audio-container" style={{ marginTop: '8px' }}>
                <audio controls src={url} style={{ width: '100%', height: '36px' }} />
            </div>
        );
    }

    // 3. Unknown Platform - Link Only Fallback
    return (
        <div className="music-link-fallback" style={{ 
            marginTop: '8px', 
            padding: '12px', 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            <span>🎵</span>
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'var(--brand-primary)', textDecoration: 'underline', fontSize: '0.9rem', wordBreak: 'break-all' }}
            >
                View Sound of the Week
            </a>
        </div>
    );
}
