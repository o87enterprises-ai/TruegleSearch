import { useEffect, useState } from 'react';
import { HardDrive, FolderDown } from 'lucide-react';
import { storageBudget, offlineUsage, canSaveToFolder, saveToFolder } from '../../utils/localMedia';
import { formatBytes } from '../../utils/offlineBudget';

/** Re-renders whenever the on-device copy of something is added or removed. */
export function useOfflineVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((n) => n + 1);
    window.addEventListener('truegle-offline-index', bump);
    window.addEventListener('truegle-local-media', bump);
    return () => {
      window.removeEventListener('truegle-offline-index', bump);
      window.removeEventListener('truegle-local-media', bump);
    };
  }, []);
  return v;
}

/**
 * How much of this device's storage offline songs use, and how much is left to save more.
 * Shown above the lists so "Save list offline" never surprises anyone.
 */
export default function OfflineMeter({ say }) {
  const version = useOfflineVersion();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [b, u] = await Promise.all([storageBudget(), offlineUsage()]);
      if (live) setInfo({ b, u });
    })();
    return () => { live = false; };
  }, [version]);

  if (!info) return null;
  const { b, u } = info;
  const pct = b.known && b.quota ? Math.min(100, Math.round((b.usage / b.quota) * 100)) : null;

  const folder = async () => {
    const n = await saveToFolder('Truegle offline');
    say?.(n === false ? 'No folder chosen.' : `Wrote ${n} file${n === 1 ? '' : 's'} and an index.html to that folder.`);
  };

  return (
    <div className="px-2 py-1.5 border-b border-white/10" data-offline-meter="">
      <div className="flex items-center gap-2 text-[10px] text-white/50">
        <HardDrive size={11} className="shrink-0" />
        <span className="truncate">
          {u.count} saved · {formatBytes(u.bytes)}
          {b.known ? ` · ${formatBytes(b.usable)} free to save` : ''}
        </span>
        {canSaveToFolder() && u.count > 0 && (
          <button type="button" onClick={folder} title="Also copy saved songs into a folder you choose, with an offline page"
            className="ml-auto flex items-center gap-1 px-1.5 h-5 rounded border border-white/15 text-[9px] uppercase tracking-wider hover:text-white hover:bg-white/10">
            <FolderDown size={10} /> Folder
          </button>
        )}
      </div>
      {pct !== null && (
        <div className="mt-1 h-1 rounded bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Device storage used">
          <div className="h-full bg-cyan-300/60" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
    </div>
  );
}
