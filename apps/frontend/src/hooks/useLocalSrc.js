import { useEffect, useState } from 'react';
import { isLocalSrc, resolveLocal } from '../utils/localMedia';

/**
 * Turns a `tglocal:<id>` source into a playable object URL read from this device's
 * storage. Anything else passes through untouched.
 *
 * @returns {{ local: boolean, src: string|null, pending: boolean, failed: boolean }}
 *   failed = the file is no longer on this device.
 */
export function useLocalSrc(src) {
  const [state, setState] = useState({ src: null, url: null });
  const local = isLocalSrc(src);

  useEffect(() => {
    if (!local) return undefined;
    let live = true;
    resolveLocal(src).then((url) => { if (live) setState({ src, url }); });
    return () => { live = false; };
  }, [src, local]);

  if (!local) return { local: false, src, pending: false, failed: false };
  if (state.src !== src) return { local: true, src: null, pending: true, failed: false };
  return { local: true, src: state.url, pending: false, failed: !state.url };
}

export default useLocalSrc;
