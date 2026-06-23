import { useEffect, useRef } from 'react';

// Loads each platform's embed script at most once per page, regardless of
// how many SocialEmbed instances mount/unmount.
const loadedScripts = new Set();

function loadScript(src) {
  if (loadedScripts.has(src)) return Promise.resolve();
  loadedScripts.add(src);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = resolve;
    document.body.appendChild(script);
  });
}

/**
 * Renders a single social post inline using each platform's official,
 * no-login-required embed widget (blockquote + widget script). Platforms
 * that gate oEmbed behind an app-review token (Facebook, Instagram) are not
 * handled here — callers should fall back to a plain link card for those.
 */
export default function SocialEmbed({ url, platform, title }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (platform === 'Twitter / X') {
        await loadScript('https://platform.twitter.com/widgets.js');
        if (!cancelled) window.twttr?.widgets?.load(containerRef.current);
      } else if (platform === 'Reddit') {
        await loadScript('https://embed.reddit.com/widgets.js');
      } else if (platform === 'TikTok') {
        await loadScript('https://www.tiktok.com/embed.js');
      }
    };

    render();
    return () => { cancelled = true; };
  }, [url, platform]);

  if (platform === 'Twitter / X') {
    return (
      <div ref={containerRef}>
        <blockquote className="twitter-tweet" data-theme="dark">
          <a href={url}>{title || url}</a>
        </blockquote>
      </div>
    );
  }

  if (platform === 'Reddit') {
    return (
      <div ref={containerRef}>
        <blockquote className="reddit-embed-bq" data-embed-height="316">
          <a href={url}>{title || url}</a>
        </blockquote>
      </div>
    );
  }

  if (platform === 'TikTok') {
    const videoId = url?.match(/\/video\/(\d+)/)?.[1] || '';
    return (
      <div ref={containerRef}>
        <blockquote className="tiktok-embed" cite={url} data-video-id={videoId}>
          <section><a href={url}>{title || url}</a></section>
        </blockquote>
      </div>
    );
  }

  return null;
}
