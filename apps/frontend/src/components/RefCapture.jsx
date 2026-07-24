import { useEffect } from 'react';
import { recordRef } from '../utils/creatorRef';

/*
 * Global side-effect component (like AdScriptLoader): if the current URL carries
 * a ?ref=<creatorCode>, attribute this visit to that creator. Renders nothing.
 */
export default function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) recordRef(ref);
  }, []);
  return null;
}
