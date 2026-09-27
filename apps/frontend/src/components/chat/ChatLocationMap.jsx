import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { MapViewWrapper } from '../map';
import { useLocationDetection } from '../../hooks/useLocationDetection';

// "Coffee near me", asked in Chat.
//
// ── WHY CHAT NEEDS THIS AT ALL ──────────────────────────────────────────────
//
// A local question has an answer that is a PLACE, and prose cannot be a place.
// Ask Chat for coffee near you and the best it can do unaided is describe
// coffee in the abstract, or name a chain it has no reason to think is nearby —
// it has no position, no radius and no map. The search page already reads that
// intent and answers it properly; Chat was the one surface where typing the
// same words got a worse answer for no reason other than which box it was
// typed into.
//
// ── ALL OF THE LOGIC IS BORROWED, DELIBERATELY ──────────────────────────────
//
// This component owns almost nothing. useLocationDetection decides whether a
// query is local and resolves the where; MapViewWrapper does the geolocation,
// the nearby-places lookup through the Overpass/Nominatim ladder, and the
// markers. That is the same code path the search page runs, so "coffee near
// me" cannot mean one thing on /search and another in Chat — which is the
// exact drift that left five dead copies of the search page in this tree.
//
// ── IT FLOATS ───────────────────────────────────────────────────────────────
//
// Chat has no results column to open a map inside; a 600px card wedged into
// the middle of a conversation would push the reply off screen and break the
// thread in half. So it opens in the pop-out frame the map already has — over
// the conversation, movable, resizable, closable — and the dock control still
// works if the reader would rather have it in the thread.
//
// ── AND IT IS DISMISSIBLE, PER QUESTION ─────────────────────────────────────
//
// Closing it must mean closed. It reopens only when a NEW local question is
// asked, never for the one that was just dismissed: a map that springs back
// after being closed is the behaviour people describe as fighting the page.
// `forcedTarget` = {name, lat, lng}: "Directions" tapped on a listing card in
// the thread. That answer may not have read as a local QUESTION at all (it
// could be a plain "call this place" reply), so it cannot rely on the same
// isLocationQuery gate — the map has to open on this place regardless of
// what the last message looked like.
export default function ChatLocationMap({ query, accent, forcedTarget, onForcedTargetHandled }) {
  const { isLocationQuery, detectedLocation } = useLocationDetection(query || '');
  // Keyed by the query, so dismissing one map does not suppress the next.
  const [dismissedFor, setDismissedFor] = useState(null);

  // A new local question is a new map. Clearing this on every query change is
  // what makes the dismissal per-question rather than permanent.
  useEffect(() => { setDismissedFor(null); }, [query]);
  // A forced target un-dismisses too — tapping Directions after closing the
  // map for an earlier question must still open it.
  useEffect(() => { if (forcedTarget) setDismissedFor(null); }, [forcedTarget]);

  const effectiveLocation = forcedTarget
    ? { subject: forcedTarget.name, locationName: forcedTarget.name, coordinates: { lat: forcedTarget.lat, lng: forcedTarget.lng } }
    : detectedLocation;
  const shouldShow = (forcedTarget || isLocationQuery) && !!effectiveLocation?.coordinates;
  const dismissed = !forcedTarget && dismissedFor === query;

  if (!shouldShow) return null;

  // Closed: leave a way back. The reader dismissed the map, not the fact that
  // they asked a local question, and hunting for a re-open is worse than a
  // single quiet line.
  if (dismissed) {
    return (
      <div className="w-full max-w-2xl mx-auto -mt-1 mb-2">
        <button
          type="button"
          onClick={() => setDismissedFor(null)}
          className={`inline-flex items-center gap-1.5 text-[11px] ${accent?.link || 'text-cyan-400'} hover:underline`}
        >
          <MapPin size={12} />
          Show the map for &ldquo;{query}&rdquo;
        </button>
      </div>
    );
  }

  return (
    <>
      {/* A line in the thread saying why a map appeared. Without it the window
          arrives unexplained, which reads as the page doing something at you
          rather than answering what you asked. */}
      <div className="w-full max-w-2xl mx-auto -mt-1 mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-white/40">
          <MapPin size={12} className={accent?.link || 'text-cyan-400'} />
          {forcedTarget
            ? `Directions to ${forcedTarget.name}`
            : (effectiveLocation.subject ? `Looking for ${effectiveLocation.subject}` : 'A place')}
          {!forcedTarget && (effectiveLocation.locationName ? ` · ${effectiveLocation.locationName}` : ' · near you')}
        </span>
        <button
          type="button"
          onClick={() => { setDismissedFor(query); onForcedTargetHandled?.(); }}
          title="Close the map"
          aria-label="Close the map"
          className="p-0.5 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <MapViewWrapper
        isOpen
        detectedLocation={effectiveLocation}
        directionsTo={forcedTarget}
        onClose={() => { setDismissedFor(query); onForcedTargetHandled?.(); }}
        // Floating by default here, and remembered separately from the search
        // page's copy — see MapViewWrapper.
        defaultPoppedOut
        popOutStorageKey="truegle_chat_map_popped"
      />
    </>
  );
}
