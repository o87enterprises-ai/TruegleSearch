import { Download } from 'lucide-react';
import { APK_URL, APK_RELEASES_URL, showApkLink } from '../../utils/apk';

// "Get the Android app": a direct download of the Truegle APK. Hidden inside the app itself and
// on non-Android devices. `compact` is a one-line link for tight spots.
export default function ApkDownload({ compact = false, className = '' }) {
  if (!showApkLink()) return null;
  if (compact) {
    return (
      <a href={APK_URL} download className={`inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 underline ${className}`}>
        <Download size={13} /> Get the Android app (APK)
      </a>
    );
  }
  return (
    <div data-apk-download="" className={`rounded-xl border border-emerald-400/30 bg-emerald-500/[0.07] p-3 ${className}`}>
      <p className="text-sm font-semibold text-white">Get the Truegle Android app</p>
      <p className="mt-0.5 text-[12px] text-white/60 leading-snug">
        Adds Nearby (Bluetooth chat and voice notes with phones around you) and keeps the offline tools in the app. About 24 MB.
      </p>
      <a href={APK_URL} download
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400">
        <Download size={16} /> Download the app (APK)
      </a>
      <p className="mt-1.5 text-[11px] text-white/40 leading-snug">
        Android will ask to allow installs from your browser — that’s normal for apps outside the Play Store.{' '}
        <a href={APK_RELEASES_URL} className="underline hover:text-white/70" target="_blank" rel="noopener noreferrer">All versions</a>
      </p>
    </div>
  );
}
