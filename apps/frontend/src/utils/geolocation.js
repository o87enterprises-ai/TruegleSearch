/* Telling apart the four different ways "we don't know where you are".
 *
 * THE BUG. Every geolocation failure in the map was reported as a denied
 * permission. Turn the location toggle OFF on an Android phone and the site
 * said "Location permission denied. Please enable location access in your
 * browser settings" — advice that sends you to a setting that is already
 * correct, for a problem that is somewhere else entirely. The modal also set
 * its state to `denied` for timeouts, so a slow GPS fix looked like a refusal.
 *
 * WHY THE ERROR CODE ALONE IS NOT ENOUGH. The browser reports
 * POSITION_UNAVAILABLE for two unrelated situations: the operating system's
 * location services are switched off, and the device simply cannot get a fix
 * right now (indoors, no GPS, airplane mode). Same code, different fix.
 *
 * The Permissions API is what separates them. If the SITE permission is
 * `granted` and we still get POSITION_UNAVAILABLE, the browser is not the
 * obstacle — something below it is, and on a phone that is almost always the
 * OS location toggle. If the permission is `prompt`, the user has not decided
 * yet and nothing has been denied at all.
 *
 * NOTHING IS STORED. No coordinates, no permission state, no timestamps —
 * navigator.permissions is asked fresh each time, which is both more accurate
 * than a cached copy and consistent with a project that sets no cookies. It
 * also fixes the "state loss" symptom by construction: there is no state to
 * lose, only a question to re-ask.
 */

export const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

/**
 * What the browser says about our geolocation permission, without prompting.
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 *   'unknown' when the Permissions API is missing (Safari for a long time) or
 *   refuses the query — treated as "we cannot tell", never as a denial.
 */
export async function permissionState() {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Turn a GeolocationPositionError into something a person can act on.
 *
 * @param {GeolocationPositionError|null} error
 * @param {string} permission  the result of permissionState(), when known
 * @returns {{kind: string, title: string, message: string, canRetry: boolean}}
 *   `kind` is for the UI to branch on; do not show it to anyone.
 */
export function describeGeolocationError(error, permission = 'unknown') {
  if (!navigator.geolocation) {
    return {
      kind: 'unsupported',
      title: 'Location is not available',
      message: 'This browser does not support location. You can still search by typing a place name.',
      canRetry: false,
    };
  }

  const code = error?.code;

  // 1 — the site permission itself. The only case where "check your browser
  // settings" is the right advice.
  if (code === 1) {
    return {
      kind: 'browser-denied',
      title: 'Location is blocked for this site',
      message: 'Truegle is not allowed to see your location. Turn it on in your browser’s site settings — usually the icon at the left of the address bar — then try again.',
      canRetry: true,
    };
  }

  // 2 — no position available. WHICH of the two causes it is depends on
  // whether the browser would have allowed it.
  if (code === 2) {
    if (permission === 'granted') {
      return {
        kind: 'device-off',
        title: 'Your device’s location is turned off',
        message: 'Truegle is allowed to see your location, but the device isn’t sharing one. Switch Location on in your phone or computer settings, then try again. (Nothing to change in your browser — that part is already correct.)',
        canRetry: true,
      };
    }
    return {
      kind: 'no-fix',
      title: 'Couldn’t get a location',
      message: 'Your device couldn’t work out where it is. This is common indoors or with Location switched off in your device settings.',
      canRetry: true,
    };
  }

  // 3 — timed out. Emphatically NOT a refusal, which is how it used to read.
  if (code === 3) {
    return {
      kind: 'timeout',
      title: 'Location took too long',
      message: 'Your device didn’t answer in time. This usually means a weak GPS signal — moving near a window often helps.',
      canRetry: true,
    };
  }

  // No error object, but the browser already knows the answer is no.
  if (permission === 'denied') {
    return {
      kind: 'browser-denied',
      title: 'Location is blocked for this site',
      message: 'Truegle is not allowed to see your location. Turn it on in your browser’s site settings, then try again.',
      canRetry: true,
    };
  }

  return {
    kind: 'unknown',
    title: 'Couldn’t get a location',
    message: 'Something went wrong finding your location. Trying again often works.',
    canRetry: true,
  };
}

/**
 * Ask for a position, and describe the failure properly if it comes.
 *
 * Resolves `{ ok: true, position }` or `{ ok: false, ...description }` — it
 * does not reject, because every caller here wants to render the reason rather
 * than treat it as an exception.
 */
export async function requestPosition(options = GEO_OPTIONS) {
  if (!navigator.geolocation) {
    return { ok: false, ...describeGeolocationError(null, 'unknown') };
  }
  // Read the permission BEFORE prompting. Afterwards it reflects the answer
  // just given, which is not what the POSITION_UNAVAILABLE branch needs to
  // know — that branch is asking "would the browser have allowed this?", and
  // only the prior state answers it.
  const permission = await permissionState();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        ok: true,
        position: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
      }),
      (error) => resolve({ ok: false, ...describeGeolocationError(error, permission) }),
      options,
    );
  });
}

export default requestPosition;
