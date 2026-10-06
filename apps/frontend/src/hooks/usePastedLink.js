import { useEffect, useState } from 'react';
import api from '../services/api';
import { getPlayable } from '../utils/videoEmbed';

// What a pasted link plays as — including SHARE links.
//
// Owner, 2026-10-06: the TikTok app's "Copy link" gives vm.tiktok.com/ZP9…,
// which carries no video id, so the Feed did not see a video at all. Those are
// sent to the backend (/api/media/resolve), which follows the redirect on
// TikTok's own hosts and hands back the canonical video — tracking stripped.
// Ordinary links are read locally, with no request.

const SHARE_LINK = /^https?:\/\/(?:(?:vm|vt)\.tiktok\.com\/[\w-]+\/?|(?:www\.|m\.)?tiktok\.com\/t\/[\w-]+\/?)(?:[?#].*)?$/i;
export const isShareLink = (text) => SHARE_LINK.test(String(text || '').trim());

/**
 * @param {string} text  what is in the search box
 * @returns {{ playable: object|null, resolving: boolean, failed: boolean }}
 *   playable is a player source ({ kind, src, vertical?, title?, pageUrl })
 */
export function usePastedLink(text) {
  const trimmed = String(text || '').trim();
  const direct = getPlayable(trimmed);
  const share = !direct && isShareLink(trimmed);
  const [resolved, setResolved] = useState({ for: '', source: null, failed: false });

  useEffect(() => {
    if (!share || resolved.for === trimmed) return undefined;
    let live = true;
    setResolved({ for: '', source: null, failed: false });
    api.get('/media/resolve', { params: { url: trimmed } })
      .then(({ data }) => {
        const m = data?.media;
        if (!live) return;
        setResolved({
          for: trimmed,
          source: m?.src ? { kind: m.kind, src: m.src, vertical: !!m.vertical, title: m.title || null, pageUrl: m.pageUrl || trimmed } : null,
          failed: !m?.src,
        });
      })
      .catch(() => { if (live) setResolved({ for: trimmed, source: null, failed: true }); });
    return () => { live = false; };
  }, [share, trimmed]);

  if (direct) return { playable: { ...direct, pageUrl: trimmed }, resolving: false, failed: false };
  if (!share) return { playable: null, resolving: false, failed: false };
  if (resolved.for !== trimmed) return { playable: null, resolving: true, failed: false };
  return { playable: resolved.source, resolving: false, failed: resolved.failed };
}

export default usePastedLink;
