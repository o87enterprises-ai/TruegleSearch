import { useEffect, useState } from 'react';

/**
 * True while the browser reports a network connection.
 *
 * `navigator.onLine` only means "there is a network interface" — connected to
 * a Wi-Fi with no real internet still reads true. That is a known limit, not
 * a bug: catching THAT case needs an actual reachability probe (a fetch with
 * a timeout, retried), which is a bigger feature than this hook is. What this
 * catches reliably is the common, sharp-edged case — airplane mode, no signal,
 * the OS reporting no connection at all — which is also the case the 404
 * page's offline routing (see App.jsx) is built for.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
