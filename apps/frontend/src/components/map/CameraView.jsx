import { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, Loader2 } from 'lucide-react';

// One traffic camera, playing.
//
// ── THE BUG THIS EXISTS TO FIX ──────────────────────────────────────────────
//
// OpenTrafficCamMap's USA feed carries 7,029 cameras. 4,103 are JPEG stills
// (format IMAGE_STREAM) and 2,926 are live HLS video (format M3U8). The camera
// list rendered every one of them as `<img src={camera.imageUrl}>`, and for an
// HLS camera imageUrl is null — so the <img> error handler fired and swapped in
// a "Camera Offline" placeholder. Two thousand nine hundred and twenty-six
// working live cameras, all reporting themselves offline. Nothing was broken
// upstream; the UI simply had no way to show video.
//
// ── HOW THE VIDEO IS PLAYED ─────────────────────────────────────────────────
//
// Safari and iOS play HLS natively, so there they get a plain <video> and not
// one byte is downloaded to make it work. Everywhere else needs a demuxer, and
// hls.js is imported DYNAMICALLY — it becomes its own chunk that is fetched the
// first time somebody opens a video camera and never enters the main bundle.
// Somebody who never opens a camera never pays for it.
//
// A still image is polled rather than played. The URL gets a cache-busting
// parameter because these endpoints serve the same path forever and a browser
// will happily show a frame from ten minutes ago.

const STILL_REFRESH_MS = 20000;

/** Does this browser play HLS on its own? Safari and iOS do; Chrome does not. */
function playsHlsNatively(video) {
  return !!video?.canPlayType('application/vnd.apple.mpegurl');
}

/** image | video | none — decided from the data, not guessed from a null. */
export function cameraKind(camera) {
  if (camera?.imageUrl) return 'image';
  if (camera?.streamUrl) return 'video';
  return 'none';
}

export default function CameraView({ camera, className = '', autoPlay = true, refreshToken }) {
  const kind = cameraKind(camera);
  // The branch taken, stated in the DOM. Which one this is used to be
  // guessable only from whether a broken image appeared, and the browser test
  // needs to assert it directly: the sandbox's Chromium ships without an H.264
  // decoder, so it can prove the video path was CHOSEN but never that a real
  // stream decodes.
  return (
    <div data-camera-kind={kind} className="contents">
      {kind === 'video'
        ? <CameraStream camera={camera} className={className} autoPlay={autoPlay} />
        : <CameraStill camera={camera} className={className} refreshToken={refreshToken} />}
    </div>
  );
}

function CameraStill({ camera, className, refreshToken }) {
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);

  // Poll for a fresh frame. These are stills, not streams: without this the
  // "live" camera is whatever the browser cached on first paint.
  useEffect(() => {
    if (!camera?.imageUrl) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), STILL_REFRESH_MS);
    return () => clearInterval(id);
  }, [camera?.imageUrl]);

  useEffect(() => { setFailed(false); }, [camera?.imageUrl]);

  if (!camera?.imageUrl) return <Unavailable className={className} reason="This camera is not publishing a feed." />;
  if (failed) return <Unavailable className={className} reason="This camera is not responding." />;

  const bust = `${camera.imageUrl}${camera.imageUrl.includes('?') ? '&' : '?'}t=${refreshToken ?? tick}`;

  return (
    <img
      src={bust}
      alt={camera.name}
      className={className || 'w-full h-full object-cover'}
      onError={() => setFailed(true)}
    />
  );
}

function CameraStream({ camera, className, autoPlay }) {
  const ref = useRef(null);
  const [state, setState] = useState('loading');   // loading | playing | failed

  useEffect(() => {
    const video = ref.current;
    const url = camera?.streamUrl;
    if (!video || !url) return undefined;

    let hls = null;
    let cancelled = false;
    setState('loading');

    if (playsHlsNatively(video)) {
      video.src = url;
      const onReady = () => !cancelled && setState('playing');
      const onFail = () => !cancelled && setState('failed');
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onFail);
      return () => {
        cancelled = true;
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onFail);
        video.removeAttribute('src');
        video.load();
      };
    }

    // Its own chunk, fetched only now.
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) { setState('failed'); return; }
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!cancelled) setState('playing'); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        // Only a FATAL error means this camera is not watchable. hls.js emits
        // recoverable warnings constantly on public traffic feeds, and treating
        // those as failure blanks a stream that is playing perfectly well.
        if (data?.fatal && !cancelled) setState('failed');
      });
    }).catch(() => { if (!cancelled) setState('failed'); });

    return () => {
      cancelled = true;
      // Destroy tears down the worker and the network requests. Without it
      // every camera you glance at keeps pulling segments in the background.
      hls?.destroy();
    };
  }, [camera?.streamUrl]);

  if (state === 'failed') return <Unavailable className={className} reason="This stream is not responding." />;

  return (
    <div className={`relative ${className || 'w-full h-full'}`}>
      <video
        ref={ref}
        className="w-full h-full object-cover"
        autoPlay={autoPlay}
        muted            /* traffic cameras have no audio, and autoplay needs it */
        playsInline
        controls={false}
      />
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60">
          <Loader2 size={18} className="animate-spin text-white/50" />
        </div>
      )}
    </div>
  );
}

/** Says what is actually wrong. The old placeholder said "Camera Offline" for
 *  every camera that was not a still image, which was untrue for 2,926 of them. */
function Unavailable({ className, reason }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 bg-neutral-900 ${className || 'w-full h-full'}`}>
      <CameraIcon size={20} className="text-white/25" />
      <p className="text-white/40 text-[11px] px-3 text-center">{reason}</p>
    </div>
  );
}
