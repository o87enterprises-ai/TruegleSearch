import { useState, useEffect, useRef, useCallback } from 'react';
// MapLibre, not Mapbox — see config/basemap.js for why (no token exists, and
// borrowing Mapbox's SDK for someone else's tiles would breach its licence).
// The stylesheet import is load-bearing — it positions the canvas and the
// controls — and it belongs here rather than as a CDN <link> in index.html,
// which is where the old one lived: that made every page on the site fetch a
// map stylesheet before it could paint.
import { Map as BaseMap, Marker, Popup, NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// TrafficCone for traffic, Navigation for directions. Both buttons used to
// import the SAME lucide glyph — `Navigation` once plainly and once as
// `Navigation as NavigationIcon` — so Traffic and Directions were pixel
// identical and the alias made it look deliberate.
import {
  X, Minimize2, Layers, TrafficCone, Camera, MapPin, Navigation as DirectionsIcon,
  Globe, Map as MapIcon, Target, Minus, Maximize2, Search, PictureInPicture2,
  Share2, Check, Copy, LocateFixed,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './context/MapContext';
import { getMarkerColor, formatAddress, generateMarkerId } from './utils/helpers';
import { MAP_CONTROLS, MAP_VIEW_MODES, AZIMUTHAL_FLAT_CONFIG, USER_LOCATION_ZOOM, GEOLOCATION_OPTIONS } from './config/constants';
import { getBasemapStyle, BASEMAP_ORDER, MAPBOX_TOKEN, TRAFFIC_AVAILABLE } from './config/basemap';
import { defaultLogoConfig, getLogoPosition, getLogoSize } from './config/logoConfig';
import MapPlayerTransport from './MapPlayerTransport';
import TrafficCameras from './TrafficCameras';
import useOsirisLayers from '../../hooks/useOsirisLayers';
import {
  OsirisSources, OsirisLayerSwitcher, OsirisFeaturePopup, osirisLayerIds, isOsirisFeature,
} from './OsirisLayers';
import DirectionsPanel from './DirectionsPanel';
import { useViewportIncidents, IncidentMarkers, IncidentDetails, useLiveHere } from './TrafficIncidents';
import BeforeYouGo from './BeforeYouGo';
import MapListings from './MapListings';
import LocationPermissionModal from './LocationPermissionModal';
import Globe3D from './Globe3D';
import AzimuthalFlat from './AzimuthalFlat';
import WebGLErrorBoundary from '../ui/WebGLErrorBoundary';
import EnhancedCameraSearch from './EnhancedCameraSearch';
import CameraView from './CameraView';
import { searchMapQuery, formatDistance } from './utils/mapSearch';
import MapApiService from './services/mapApi';
import backgroundImage from '../../assets/images/Azimuthal-satellite-view.png';
import './styles/TruegleMap.css';

export default function TruegleMap({
  provider = 'mapbox',
  // SATELLITE IS THE DEFAULT. Asked for directly, and it is also the view that
  // makes an unlabelled map legible: the keyless raster styles carry no place
  // labels at low zoom, so a road map of an unfamiliar area opens as grey
  // shapes. Imagery reads as somewhere real immediately. The style toggle
  // still walks the full BASEMAP_ORDER from here.
  style = 'satellite',
  center = [-98.5795, 39.8283],
  zoom = 4,
  showTraffic = false,
  showRoutes = false,
  showEmergencies = false,
  onMapLoad = null,
  onMapClick = null,
  onMarkerClick = null,
  onClose = null,
  // The search that opened the map ("walmart near me" typed in the top bar).
  // Shown in the in-map box so the map says what it is showing.
  initialQuery = '',
  // The business listings for this query, when there are any — see
  // MapListings and MapViewWrapper's fetchListings.
  listings = null,
  userLocation: initialUserLocation = null,
  // Why the wrapper has no position, when it has none — see utils/geolocation.
  // null means "no attempt has failed", which is not the same as "denied".
  locationProblem = null,
  // Whether the map is currently floating over the page, and how to switch.
  // Owned by MapViewWrapper — the map draws the control, the wrapper decides
  // where the map lives, the same split the player uses.
  poppedOut = false,
  onTogglePopOut = null,
  // What the nearby lookup did. See MapViewWrapper — the map reports it so an
  // empty map can say WHY it is empty.
  nearbyStatus = null,
  children,
  className = '',
}) {
  const { state, actions } = useMap();
  const mapRef = useRef(null);
  // Live intelligence layers (aircraft, satellites, quakes, fires, vessels,
  // weather, cameras, conflict). Mounted here rather than on one page, so
  // every surface that renders a map gets them — the map is one component and
  // this is where "all of the maps" actually is.
  const osiris = useOsirisLayers();
  const [osirisFeature, setOsirisFeature] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom,
  });
  const [mapStyle, setMapStyleLocal] = useState(() => getBasemapStyle(style));
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMapStyle, setFullscreenMapStyle] = useState('satellite');
  const [showTrafficFS, setShowTrafficFS] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  // The place whose "Before you go" card is open — see BeforeYouGo.jsx.
  const [beforeYouGo, setBeforeYouGo] = useState(null);
  const [showCamerasFS, setShowCamerasFS] = useState(false);
  const [showEnhancedCameraSearch, setShowEnhancedCameraSearch] = useState(false);
  // Which camera pin the pointer is over, and which one is open full size.
  // Hover state lives HERE rather than inside each marker because only one
  // preview may be mounted at a time — see the CAMERA branch of MarkerElement.
  const [hoveredCameraId, setHoveredCameraId] = useState(null);
  const [openCamera, setOpenCamera] = useState(null);

  // Escape closes the open camera. Registered only while one is open so this
  // never competes with the other Escape handlers on the page.
  useEffect(() => {
    if (!openCamera) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpenCamera(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openCamera]);
  // Escape closes a pin's card too — the card had only its tiny ✕.
  useEffect(() => {
    if (!selectedMarker) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setSelectedMarker(null); setSelectedIncident(null); actions.setSelectedMarker(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedMarker, actions]);
  const [showDirectionsFS, setShowDirectionsFS] = useState(false);
  // Where the Directions button on a pin's card asked to go.
  const [directionsTo, setDirectionsTo] = useState(null);
  const [showLocationModalFS, setShowLocationModalFS] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Destination search (Google-Earth-style): lives INSIDE the fullscreen
  // container so it stays visible when the map goes native-fullscreen (mobile
  // always does). The wrapper-level search bar disappears in that mode.
  const [placeQuery, setPlaceQuery] = useState(initialQuery || '');
  // The seeded query was already searched by the wrapper (its pins are on the
  // map), so the box shows it without searching it a second time or dropping
  // a results list over the map. Typing clears this and searches as normal.
  const seededQueryRef = useRef(initialQuery || '');
  useEffect(() => {
    if (!initialQuery) return;
    seededQueryRef.current = initialQuery;
    setPlaceQuery(initialQuery);
  }, [initialQuery]);
  const [placeResults, setPlaceResults] = useState([]);
  const [isPlaceSearching, setIsPlaceSearching] = useState(false);
  const [showPlaceResults, setShowPlaceResults] = useState(false);
  // "near me", asked before we know where "me" is.
  const [placeNeedsLocation, setPlaceNeedsLocation] = useState(false);

  // ── the map knows how much room it has ──────────────────────────────────
  //
  // Every responsive decision here used to be a VIEWPORT breakpoint
  // (`hidden lg:inline`), which says nothing useful once the map can be a
  // 320px floating window on a 2560px monitor — the labels stayed on and the
  // row ran off the end of its own frame. These are measured against the BAR.
  // Is a full-height panel covering the map? The floating controls step aside
  // when one is, instead of hovering on top of it — the zoom stack sitting
  // over the open Directions panel is exactly what "not screen-element aware"
  // looked like. Declared before the measuring effect below, which depends
  // on it: the layout changes when a panel opens.
  const panelOpen = showCamerasFS || showEnhancedCameraSearch || showDirectionsFS;

  const functionBarRef = useRef(null);
  const mapAreaRef = useRef(null);
  // AVAILABLE width, not the bar's own. Measuring the bar is circular — its
  // width depends on whether the labels are showing, and whether the labels
  // show depends on its width — so it settles wherever it started and the row
  // still runs off the end. The map area is the fixed quantity.
  const [areaWidth, setAreaWidth] = useState(9999);
  const [barHeight, setBarHeight] = useState(44);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observers = [];
    const area = mapAreaRef.current;
    if (area) {
      const ro = new ResizeObserver(([e]) => setAreaWidth(e.contentRect.width));
      ro.observe(area);
      setAreaWidth(area.getBoundingClientRect().width);
      observers.push(ro);
    }
    const bar = functionBarRef.current;
    if (bar) {
      const ro = new ResizeObserver(([e]) => setBarHeight(e.contentRect.height));
      ro.observe(bar);
      setBarHeight(bar.getBoundingClientRect().height);
      observers.push(ro);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [isFullscreen, poppedOut, panelOpen]);
  const showBarLabels = areaWidth >= 900;
  const labelClass = showBarLabels ? '' : 'hidden';
  // THE VIEW MODES KEEP THEIR LABELS LONGER THAN EVERYTHING ELSE.
  //
  // Layers, Traffic, Cameras and the rest are toggles: their icon plus their
  // lit/unlit state says what they do. Map / Azimuthal / Globe are a MODE
  // SELECTOR — three near-identical circles in a row — and stripped of text
  // there is no way to tell which is which except by pressing one and seeing
  // what happens. They are the last labels to go.
  const showModeLabels = areaWidth >= 560;
  const modeLabelClass = showModeLabels ? '' : 'hidden';
  // A SMALL MAP GETS A SMALL BAR.
  //
  // Eleven controls wrap onto three rows in a 420px pop-out, which is a third
  // of the window spent on chrome — the map it is chrome for ends up smaller
  // than the toolbar. Below the threshold the bar keeps what a quick look
  // actually needs (where am I, how do I get there, put it back, close it) and
  // drops the exploratory controls: the projection trio, the basemap style,
  // traffic and the camera panels. None of those are lost — they are all there
  // the moment the map is docked or the window is widened.
  const compactBar = areaWidth < 520;
  // How much room the bottom edge owes the function bar. The renderer pins its
  // attribution and scale to that edge, and attribution is a licence condition
  // of OSM, CARTO and Esri — it cannot sit under our chrome. Derived from the
  // bar's measured height so a wrapped two-row bar pushes it further up rather
  // than hiding behind a guessed constant.
  const bottomClearance = `${Math.round(barHeight) + 26}px`;

  // The user's own position: is it currently in view? The Location button
  // lights up only when it is (and only when we actually have a position),
  // so the button reports a state instead of just offering an action.
  const [locationOnScreen, setLocationOnScreen] = useState(false);
  // Their address, looked up once, for the hover label on the blue dot.
  const [userAddress, setUserAddress] = useState('');

  // WHAT JUST CHANGED, said out loud for a moment.
  //
  // The controls are icons that light up, which tells you a toggle is ON but
  // not WHICH toggle you hit — and on a narrow map, with the labels gone, a
  // press produces a change somewhere in a ten-icon strip and you are left
  // reading the map to work out what happened. This is the receipt: it names
  // the state, sits over the map for a moment, and leaves.
  const [stateToast, setStateToast] = useState(null);
  const toastTimerRef = useRef(null);
  const announce = useCallback((label) => {
    setStateToast({ label, at: Date.now() });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setStateToast(null), 1800);
  }, []);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // Right-click / long-press menu: { lng, lat, x, y, address }.
  const [locationMenu, setLocationMenu] = useState(null);
  const [shareState, setShareState] = useState('idle');
  const longPressRef = useRef(null);

  useEffect(() => {
    setMapStyleLocal(getBasemapStyle(style));
    setFullscreenMapStyle(style);
  }, [style]);

  // Add traffic layer when showTraffic or showTrafficFS is true.
  //
  // Mapbox's traffic tiles are the only source here, and they are a
  // `mapbox://` vector source — so without a token there is nothing to add and
  // trying would throw on every toggle. TRAFFIC_AVAILABLE says so once.
  useEffect(() => {
    if (!TRAFFIC_AVAILABLE) return;
    if (!mapLoaded || !mapRef.current) return;

    // Get the underlying Mapbox GL JS map instance
    let map = mapRef.current;

    // If ref has getMap method, use it to get the actual map instance
    if (typeof map.getMap === 'function') {
      map = map.getMap();
    }

    if (!map || typeof map.getLayer !== 'function') return;

    const shouldShowTraffic = showTraffic || showTrafficFS;

    if (shouldShowTraffic) {
      // Add Mapbox traffic layer
      if (!map.getLayer('traffic')) {
        try {
          map.addLayer({
            id: 'traffic',
            type: 'line',
            // The TileJSON URL, not the `mapbox://` shorthand: that shorthand
            // is a Mapbox-SDK-only convention and MapLibre cannot resolve it.
            source: {
              type: 'vector',
              url: `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1.json?secure&access_token=${MAPBOX_TOKEN}`,
            },
            'source-layer': 'traffic',
            paint: {
              'line-width': 2,
              'line-color': [
                'case',
                ['==', ['get', 'congestion'], 'low'], '#00FF00',
                ['==', ['get', 'congestion'], 'moderate'], '#FFFF00',
                ['==', ['get', 'congestion'], 'heavy'], '#FF9900',
                ['==', ['get', 'congestion'], 'severe'], '#FF0000',
                '#888888'
              ]
            }
          });
        } catch (error) {
          console.error('Error adding traffic layer:', error);
        }
      }
    } else {
      // Remove traffic layer if it exists
      try {
        if (map.getLayer('traffic')) {
          map.removeLayer('traffic');
        }
        if (map.getSource('traffic')) {
          map.removeSource('traffic');
        }
      } catch (error) {
        console.error('Error removing traffic layer:', error);
      }
    }
  }, [showTraffic, showTrafficFS, mapLoaded]);

  useEffect(() => {
    if (state.center) {
      // Validate coordinates before updating viewState
      const lat = state.center.lat;
      const lng = state.center.lng;

      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        // Only when it is actually somewhere else. handleMoveEnd now writes the
        // centre back into shared state, so without this guard every pan
        // bounces straight back through here and re-sets viewState to the
        // values it already has — a new object, a re-render, every time.
        setViewState(prev => (
          prev.latitude === lat && prev.longitude === lng
            ? prev
            : { ...prev, longitude: lng, latitude: lat }
        ));
      } else {
        console.error('❌ Invalid center coordinates from state:', state.center);
        console.warn('⚠️ Ignoring invalid center update to prevent Mapbox errors');
      }
    }
  }, [state.center]);

  useEffect(() => {
    if (state.zoom !== undefined) {
      setViewState(prev => ({ ...prev, zoom: state.zoom }));
    }
  }, [state.zoom]);

  useEffect(() => {
    if (state.markers) {
      setMarkers(state.markers);
    }
  }, [state.markers]);

  // Mirror externally-set selected marker (e.g. a geocoded search result) into the popup.
  useEffect(() => {
    if (state.selectedMarker) {
      setSelectedMarker(state.selectedMarker);
    }
  }, [state.selectedMarker]);

  // Detect mobile device (layout only — fullscreen is always user-initiated).
  // The old version force-set isFullscreen(true) for phones here, and because
  // this effect runs with [] deps its stale closure re-forced fullscreen on
  // every resize/orientationchange — exiting or rotating the phone snapped the
  // map back into fullscreen, making it nearly impossible to close.
  useEffect(() => {
    const checkMobile = () => {
      // Check if device is a phone (not tablet or desktop)
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(userAgent);
      const isTablet = /ipad|android(?!.*mobile)|tablet|kindle/i.test(userAgent);
      const isPhone = isMobileDevice && !isTablet;

      // Additional check for screen size
      const isSmallScreen = window.innerWidth <= 768 && window.innerHeight <= 1024;

      setIsMobile(isPhone || (isMobileDevice && isSmallScreen));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  useEffect(() => {
    const fullscreenElement = document.getElementById('truegle-map-container');
    if (isFullscreen && fullscreenElement) {
      if (fullscreenElement.requestFullscreen) {
        fullscreenElement.requestFullscreen();
      } else if (fullscreenElement.webkitRequestFullscreen) {
        fullscreenElement.webkitRequestFullscreen();
      } else if (fullscreenElement.msRequestFullscreen) {
        fullscreenElement.msRequestFullscreen();
      }
    }
    return () => {
      if (document.fullscreenElement && !isMobile) {
        document.exitFullscreen();
      }
    };
  }, [isFullscreen, isMobile]);

  const handleMapLoad = useCallback((evt) => {
    // In react-map-gl, the onLoad event gives us evt.target which is the map instance
    const map = evt.target || evt;
    setMapLoaded(true);
    actions.setIsLoaded(true);

    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [actions, onMapLoad]);

  // THE WHOLE viewState, every frame. This is the scroll-zoom hiccup.
  //
  // The map is a CONTROLLED component: what it draws is whatever `viewState`
  // says. This handler used to write back only the zoom —
  // `setViewState(prev => ({ ...prev, zoom }))` — and drop the longitude and
  // latitude the renderer had just computed. A wheel zoom is anchored to the
  // POINTER, so every notch moves the centre as well as the zoom; keeping the
  // old centre shoved the map back to where it had been a frame earlier. Zoom,
  // snap, zoom, snap. Same for a pinch, and for any zoom not aimed at the
  // exact middle of the map.
  const handleMove = useCallback((evt) => {
    setViewState(evt.viewState);
  }, []);

  // Shared state is updated at the END of a gesture, not during it.
  //
  // The old handler pushed a zoom into MapContext on every frame of the
  // gesture, so every consumer of that context re-rendered dozens of times per
  // scroll — the other half of the stutter. Nothing outside this component
  // needs to watch a zoom mid-flick; it needs to know where it landed.
  const handleMoveEnd = useCallback((evt) => {
    const { zoom, latitude, longitude } = evt.viewState;
    actions.setZoom(zoom);
    // AND THE CENTRE. This is why the map "reset" when you changed view:
    // panning only ever updated the LOCAL viewState, so shared state still
    // held wherever the map was last flown to. Switch to Globe or Azimuthal
    // and they were handed that stale centre — the other side of the country
    // from what you were looking at — and switching back re-applied it to the
    // flat map through the state.center effect. Nothing was resetting; the two
    // halves had simply never been told where you had gone.
    actions.setCenter({ lat: latitude, lng: longitude });

    // Tell the live layers where we are looking, so they fetch what is on
    // screen rather than the whole planet. Debounced inside the hook; this
    // already only fires at the end of a gesture.
    const bounds = mapRef.current?.getMap?.().getBounds?.();
    if (bounds) {
      osiris.setViewport([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    }

    // Zoomed all the way out: offer the azimuthal projection.
    //
    // This used to run inside the per-frame handler, so scrolling out past
    // zoom 3 swapped the projection MID-GESTURE — the map you were still
    // scrolling on was replaced under your finger. At the end of the gesture
    // it is a result rather than an interruption.
    if (state.mapViewMode === MAP_VIEW_MODES.STANDARD && zoom <= 3) {
      actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT);
      actions.setAzimuthalFlatCenter({ lat: latitude, lng: longitude });
      actions.setAzimuthalFlatZoom(2);
    }
  }, [actions, state.mapViewMode, osiris]);

  const handleMapClick = useCallback((e) => {
    // A long press ends in a click event too. Without this, lifting your
    // finger off a long press would fly the map to zoom 15 underneath the
    // menu that press had just opened.
    if (longPressRef.current?.fired) {
      longPressRef.current = null;
      return;
    }
    // An open menu is dismissed by the click, not acted on by it.
    if (locationMenu) {
      setLocationMenu(null);
      return;
    }

    // A CLICK ON A LIVE FEATURE INSPECTS IT; IT DOES NOT FLY THE MAP.
    // Falling through to the zoom-to-15 below would throw away the view the
    // feature was found in, which on a layer of ten thousand aircraft is the
    // whole context of the click. Only ours are claimed — anything else is
    // still empty map and still behaves exactly as it did.
    const hit = (e.features || []).find(isOsirisFeature);
    if (hit) {
      setOsirisFeature({ geometry: hit.geometry, properties: hit.properties });
      return;
    }
    setOsirisFeature(null);

    // Always center and zoom to clicked location
    const clickedLocation = {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    };

    // Center map on clicked location with zoom level 15
    setViewState(prev => ({
      ...prev,
      longitude: clickedLocation.lng,
      latitude: clickedLocation.lat,
      zoom: 15
    }));

    actions.flyTo(clickedLocation, 15);

    if (onMapClick) {
      onMapClick(clickedLocation);
    }

    if (selectedMarker) {
      setSelectedMarker(null);
      actions.setSelectedMarker(null);
    }
  }, [actions, onMapClick, selectedMarker, locationMenu]);

  const handleMarkerClick = useCallback((marker, e) => {
    // Pins are React elements inside <Marker>, so this is a React DOM event,
    // not a MapLibre one: it has no originalEvent. Reading it threw on every
    // pin tap, which the global handler turned into the "something went
    // wrong" bar — and the popup never opened.
    (e?.originalEvent || e)?.stopPropagation?.();

    setSelectedMarker(marker);
    actions.setSelectedMarker(marker);

    // Center and zoom to the marker location
    setViewState(prev => ({
      ...prev,
      longitude: marker.lng,
      latitude: marker.lat,
      zoom: 15
    }));

    actions.flyTo({ lat: marker.lat, lng: marker.lng }, 15);

    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  }, [actions, onMarkerClick]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const minimizeFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else if (onClose) {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen, onClose]);

  const toggleFullscreenMapStyle = useCallback(() => {
    const currentIndex = BASEMAP_ORDER.indexOf(fullscreenMapStyle);
    const nextStyle = BASEMAP_ORDER[(currentIndex + 1) % BASEMAP_ORDER.length];
    setFullscreenMapStyle(nextStyle);
    setMapStyleLocal(getBasemapStyle(nextStyle));
    announce(`${nextStyle.charAt(0).toUpperCase()}${nextStyle.slice(1)} basemap`);
  }, [fullscreenMapStyle, announce]);

  const toggleGlobeView = useCallback(() => {
    actions.toggleMapViewMode();
    setShowGlobe(prev => !prev);
  }, [actions]);

  const handleLocationGranted = useCallback((location) => {
    setUserLocation(location);
    setViewState(prev => ({
      ...prev,
      longitude: location.lng,
      latitude: location.lat,
      zoom: USER_LOCATION_ZOOM
    }));

    // Add current location marker
    actions.addMarker({
      id: 'current-location',
      lat: location.lat,
      lng: location.lng,
      name: 'Your Location',
      category: 'CURRENT_LOCATION',
      address: 'Current Location'
    });

    // Ensure the map centers and zooms to the user's location
    actions.flyTo(location, USER_LOCATION_ZOOM);
  }, [actions]);

  const handleLocationDenied = useCallback((error) => {
    console.log('Location denied:', error);
  }, []);

  // ── is your position on screen? ─────────────────────────────────────────
  //
  // What makes the Location button light up. Asked of the map's real bounds
  // rather than guessed from the centre, because a viewport is a rectangle
  // and "near the centre" is not the same question. Recomputed on move, so
  // the light goes out as you pan away from yourself and comes back when you
  // pan home — which is the whole point of it being a state and not a label.
  useEffect(() => {
    let map = mapRef.current;
    if (map && typeof map.getMap === 'function') map = map.getMap();
    if (!map || !userLocation || typeof map.getBounds !== 'function') {
      setLocationOnScreen(false);
      return undefined;
    }
    const check = () => {
      try {
        setLocationOnScreen(map.getBounds().contains([userLocation.lng, userLocation.lat]));
      } catch {
        setLocationOnScreen(false);   // between styles the bounds can be unset
      }
    };
    check();
    map.on('move', check);
    return () => { map.off('move', check); };
  }, [userLocation, mapLoaded, state.mapViewMode]);

  // The address behind the blue dot, resolved once per position.
  //
  // A dot that says nothing is just a dot; hovering it should answer "where
  // does the map think I am?", which is also the fastest way to notice that
  // the answer is wrong.
  useEffect(() => {
    if (!userLocation) { setUserAddress(''); return undefined; }
    let cancelled = false;
    MapApiService.reverseGeocode(userLocation.lat, userLocation.lng)
      .then((r) => { if (!cancelled) setUserAddress(r?.data?.address || ''); })
      .catch(() => { /* offline, or every provider down — the dot still works */ });
    return () => { cancelled = true; };
  }, [userLocation?.lat, userLocation?.lng]);

  // ── share a place ───────────────────────────────────────────────────────
  //
  // Right-click on a desktop, long-press on a touch screen. Both land here.
  const openLocationMenu = useCallback((lngLat, point) => {
    setShareState('idle');
    setLocationMenu({ lng: lngLat.lng, lat: lngLat.lat, x: point.x, y: point.y, address: '' });
    // The address arrives after the menu does. Waiting for a round trip
    // before showing anything would make a right-click feel broken.
    MapApiService.reverseGeocode(lngLat.lat, lngLat.lng)
      .then((r) => {
        const address = r?.data?.address || '';
        setLocationMenu((m) => (m && m.lat === lngLat.lat && m.lng === lngLat.lng ? { ...m, address } : m));
      })
      .catch(() => { /* a place can still be shared as coordinates */ });
  }, []);

  const handleContextMenu = useCallback((e) => {
    e.originalEvent?.preventDefault();
    openLocationMenu(e.lngLat, e.point);
  }, [openLocationMenu]);

  // A long press is a press that STAYS PUT. Tracking movement matters: without
  // it, dragging the map for half a second opens a menu on the spot you
  // started panning from.
  const handleTouchStart = useCallback((e) => {
    const { lngLat, point } = e;
    longPressRef.current = {
      fired: false,
      timer: setTimeout(() => {
        if (longPressRef.current) longPressRef.current.fired = true;
        openLocationMenu(lngLat, point);
      }, 550),
    };
  }, [openLocationMenu]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current?.timer) clearTimeout(longPressRef.current.timer);
  }, []);

  /** The link that reopens this exact spot. Coordinates are a query Truegle
   *  understands (see parseLocalQuery), so the shared URL lands on the map
   *  rather than on a search for a string of digits. */
  const locationUrl = useCallback((lat, lng) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/search?q=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`;
  }, []);

  const shareLocation = useCallback(async () => {
    if (!locationMenu) return;
    const { lat, lng, address } = locationMenu;
    const url = locationUrl(lat, lng);
    const title = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      // The OS sheet where there is one — that is what "share" means on a
      // phone. The clipboard is the desktop fallback, not the first choice.
      if (navigator.share) {
        await navigator.share({ title: 'Location on Truegle', text: title, url });
        setShareState('done');
      } else {
        await navigator.clipboard.writeText(url);
        setShareState('copied');
      }
    } catch (err) {
      // AbortError = the user dismissed the sheet. That is not a failure and
      // must not be reported as one.
      if (err?.name !== 'AbortError') setShareState('failed');
    }
  }, [locationMenu, locationUrl]);

  const copyCoordinates = useCallback(async () => {
    if (!locationMenu) return;
    try {
      await navigator.clipboard.writeText(`${locationMenu.lat.toFixed(6)}, ${locationMenu.lng.toFixed(6)}`);
      setShareState('copied');
    } catch {
      setShareState('failed');
    }
  }, [locationMenu]);

  // Any press elsewhere, any pan, any Escape closes the menu.
  useEffect(() => {
    if (!locationMenu) return undefined;
    const close = () => setLocationMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); };
  }, [locationMenu]);

  // Draw the calculated route on the map and frame it Google-Earth-style.
  const handleRouteCalculated = useCallback((route) => {
    // Geometry arrives as GeoJSON ({type, coordinates}) from Mapbox/OSRM or a
    // bare [[lng,lat],...] array from Radar — normalize to a coordinate array.
    const geom = route?.geometry;
    const coords = Array.isArray(geom) ? geom : geom?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;

    actions.clearRoutes();
    actions.addRoute({
      id: 'active-route',
      geometry: { type: 'LineString', coordinates: coords },
      distance: route.distance,
      duration: route.duration,
    });

    // Fit the viewport to the route bounds
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    let map = mapRef.current;
    if (map && typeof map.getMap === 'function') map = map.getMap();
    if (map && typeof map.fitBounds === 'function') {
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 1500 });
    }
  }, [actions]);

  // Debounced search for the in-map bar.
  //
  // It used to call MapApiService.geocode() and nothing else, so the bar
  // understood addresses and only addresses — "coffee near me" and a business
  // by name both came back empty. searchMapQuery reads the intent first; see
  // utils/mapSearch.js.
  useEffect(() => {
    if (placeQuery && placeQuery === seededQueryRef.current) return undefined;
    seededQueryRef.current = '';
    if (!placeQuery || placeQuery.trim().length < 3) {
      setPlaceResults([]);
      setPlaceNeedsLocation(false);
      return undefined;
    }
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsPlaceSearching(true);
      try {
        const { rows, needsLocation } = await searchMapQuery(placeQuery, { near: userLocation });
        if (cancelled) return;
        setPlaceResults(rows);
        setPlaceNeedsLocation(needsLocation);
      } catch (err) {
        if (cancelled) return;
        console.error('Map place search error:', err);
        setPlaceResults([]);
        setPlaceNeedsLocation(false);
      } finally {
        if (!cancelled) setIsPlaceSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [placeQuery, userLocation]);

  // A "near me" search with no position is not a failed search — it is a
  // question we can't ask yet. Offer the one thing that fixes it.
  const requestLocationForSearch = useCallback(() => {
    setShowLocationModalFS(true);
  }, []);

  const handlePlaceResultClick = useCallback((result) => {
    const lat = result.position?.lat;
    const lng = result.position?.lng ?? result.position?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom: 15 }));
    actions.flyTo({ lat, lng }, 15);

    const marker = {
      id: `search-result-${lat}-${lng}`,
      lat,
      lng,
      // The NAME, with the address as the subtitle. Both were set to the
      // address, so a pin for a cafe was labelled with its street.
      name: result.name || result.address,
      address: result.address,
      category: 'SEARCH_RESULT',
      // Carried so the pin's card can offer Call / Website without a lookup.
      phone: result.phone || result.raw?.phone || result.raw?.poi?.phone || null,
      website: result.website || result.raw?.url || result.raw?.poi?.url || null,
    };
    actions.addMarker(marker);
    actions.setSelectedMarker(marker);

    // Keep what was picked in the box, the way a maps app does — seeded so it
    // is shown, not searched again.
    seededQueryRef.current = result.name || '';
    setPlaceQuery(result.name || '');
    setPlaceResults([]);
    setShowPlaceResults(false);
  }, [actions]);

  // Pressing Enter drops EVERY result on the map, rather than making the user
  // pick one at a time — "coffee near me" means show me the coffee, plural.
  const handlePlaceSubmit = useCallback((e) => {
    e.preventDefault();
    if (!placeResults.length) return;
    for (const row of placeResults) {
      const { lat, lng } = row.position || {};
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      actions.addMarker({
        id: `search-result-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        lat,
        lng,
        name: row.name,
        address: row.address,
        category: 'SEARCH_RESULT',
        phone: row.phone || row.raw?.phone || row.raw?.poi?.phone || null,
        website: row.website || row.raw?.url || row.raw?.poi?.url || null,
      });
    }
    const first = placeResults[0].position;
    setViewState(prev => ({ ...prev, longitude: first.lng, latitude: first.lat, zoom: 14 }));
    actions.flyTo(first, 14);
    setShowPlaceResults(false);
  }, [placeResults, actions]);

  // Get user location for traffic cameras (whenever the map is mounted, not
  // just fullscreen — the cameras/directions panels work in windowed mode too).
  //
  // `initialUserLocation` is the wrapper's fix, handed down. Without it this
  // fired a SECOND permission request for a position the parent had already
  // obtained, and it passed no options at all — the browser's default timeout
  // is Infinity, so a prompt the user ignored left this callback pending for
  // the life of the page.
  useEffect(() => {
    if (initialUserLocation) { setUserLocation(initialUserLocation); return; }
    if (userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.warn('Geolocation unavailable:', error.message);
      },
      GEOLOCATION_OPTIONS
    );
  }, [userLocation, initialUserLocation]);

  // The Location button's four honest states.
  //
  //   lit      — we have your position AND it is inside the current viewport
  //   located  — we have it, but you have panned away from yourself
  //   blocked  — an attempt already failed, and we know why
  //   unknown  — nothing has been tried yet
  //
  // BLOCKED IS THE ONE THAT WAS MISSING, and its absence is what read as the
  // permission state being lost. Whether the browser had refused, the device
  // had location switched off, or nothing had ever been asked, the button
  // looked identical and offered "Find my location" — so pressing it after a
  // refusal did nothing visible, over and over.
  const locationState = userLocation
    ? (locationOnScreen ? 'lit' : 'located')
    : (locationProblem ? 'blocked' : 'unknown');
  const locationBtnClass = {
    lit: 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-400/70 shadow-lg shadow-blue-500/40',
    located: 'bg-neutral-800 text-blue-400/70 hover:bg-neutral-700',
    blocked: 'bg-amber-500/15 text-amber-300/80 hover:bg-amber-500/25',
    unknown: 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-blue-400',
  }[locationState];
  const locationBtnTitle = {
    lit: userAddress ? `Your location — ${userAddress}` : 'Your location is on screen',
    located: 'Your location is off screen — press to go back to it',
    // The title carries the real reason, so hovering answers "why is there no
    // blue dot?" without opening anything.
    blocked: locationProblem?.title || 'Location unavailable — press for details',
    unknown: 'Find my location',
  }[locationState];

  // Pressing it when we already know where you are should GO there, not ask
  // again. The permission modal is only for the case where we do not know.
  const handleLocationButton = useCallback(() => {
    if (userLocation) {
      setViewState((prev) => ({
        ...prev, longitude: userLocation.lng, latitude: userLocation.lat, zoom: USER_LOCATION_ZOOM,
      }));
      actions.flyTo(userLocation, USER_LOCATION_ZOOM);
      return;
    }
    setShowLocationModalFS(true);
  }, [userLocation, actions]);

  const MarkerElement = ({ marker }) => {
    // Special rendering for current location
    if (marker.category === 'CURRENT_LOCATION') {
      // The dot, and what it is standing on. Hovering (or tabbing to) it
      // shows the reverse-geocoded address — the fastest way to check the map
      // has actually found you, and to read off where "here" is without
      // clicking anything. Until the lookup returns it falls back to the
      // coordinates, which is still an answer.
      const here = userAddress || `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
      return (
        <div
          className="current-location-marker group"
          tabIndex={0}
          role="img"
          aria-label={`Your location: ${here}`}
          style={{
            transform: `translate(-50%, -50%)`,
          }}
        >
          {/* Pulsing outer ring */}
          <div
            style={{
              position: 'absolute',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.3)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
          {/* Middle ring */}
          <div
            style={{
              position: 'absolute',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.5)',
              border: '2px solid white',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
          {/* Inner dot */}
          <div
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#3B82F6',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
          {/* The address label. Hidden until hover or keyboard focus, and
              pointer-events-none so it can never intercept a map drag that
              happens to pass over it. */}
          <div
            data-location-address=""
            className="pointer-events-none absolute left-1/2 bottom-full mb-3 -translate-x-1/2 opacity-0
                       group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150"
          >
            <div className="whitespace-nowrap max-w-[16rem] truncate rounded-lg px-2.5 py-1.5
                            bg-neutral-900/95 backdrop-blur-md border border-blue-400/40
                            text-[11px] font-medium text-white shadow-lg shadow-blue-500/20">
              {here}
            </div>
          </div>
        </div>
      );
    }

    // ── A CAMERA PIN SHOWS WHAT THE CAMERA SEES ──────────────────────────
    //
    // Cameras used to render as the same anonymous teardrop as everything
    // else, so finding out whether one was pointed at your route meant
    // tapping it, reading a panel, and closing it again — for each of them.
    //
    // The pin is a camera glyph, hovering it plays the live frame, and a click
    // opens it full size. The preview is deliberately SMALL and only mounted
    // on hover: these are real streams, and mounting one per pin would have
    // twenty cameras polling at once behind a map nobody is looking at.
    if (marker.category === 'CAMERA') {
      const hovered = hoveredCameraId === marker.id;
      return (
        <div
          className="truegle-camera-marker group"
          style={{ transform: 'translate(-50%, -50%)', position: 'relative' }}
          tabIndex={0}
          role="button"
          aria-label={`Traffic camera: ${marker.name || 'unnamed'}`}
          onMouseEnter={() => setHoveredCameraId(marker.id)}
          onMouseLeave={() => setHoveredCameraId((id) => (id === marker.id ? null : id))}
          onFocus={() => setHoveredCameraId(marker.id)}
          onBlur={() => setHoveredCameraId((id) => (id === marker.id ? null : id))}
          onClick={(e) => { e.stopPropagation(); setOpenCamera(marker); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenCamera(marker); }
          }}
        >
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer ${
              hovered
                ? 'bg-amber-500/90 border-amber-300 scale-110 shadow-lg shadow-amber-500/40'
                : 'bg-neutral-900/90 border-amber-400/60 hover:border-amber-300'
            }`}
          >
            <Camera size={15} className={hovered ? 'text-neutral-900' : 'text-amber-400'} />
          </div>

          {/* The live frame. Mounted ONLY while hovered — see above. */}
          {hovered && (marker.imageUrl || marker.streamUrl) && (
            <div className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-20">
              <div className="w-52 rounded-lg overflow-hidden border border-amber-400/50 bg-neutral-900 shadow-2xl">
                <div className="aspect-video bg-black">
                  <CameraView camera={marker} className="w-full h-full object-cover" />
                </div>
                <div className="px-2 py-1 text-[10px] text-white/80 truncate">
                  {marker.name || 'Traffic camera'}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    const color = getMarkerColor(marker.category);
    // WHAT THE PIN IS. Four identical teardrops told the reader that four
    // things exist and nothing about which is which — every one had to be
    // tapped to find out, and tapping closed the last one. The name rides
    // under the pin; the distance joins it when the lookup knew it.
    //
    // Labels are only drawn for RESULTS. Putting one under every marker would
    // paper the map over the moment a category sweep returns twenty.
    const labelled = marker.category === 'BUSINESS' || marker.category === 'SEARCH_RESULT';
    const label = labelled ? (marker.name || '').trim() : '';

    return (
      <div
        className="truegle-marker"
        style={{
          color: color,
          transform: `translate(-50%, -100%)`,
        }}
        onClick={(e) => handleMarkerClick(marker, e)}
      >
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        {label && (
          <div
            data-marker-label=""
            // Centred under the pin and NOT clickable — the pin is the target,
            // and a label that eats the press would make the pin harder to
            // hit than it was without one.
            className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-0.5
                       max-w-[9rem] truncate rounded px-1.5 py-0.5
                       bg-neutral-900/85 backdrop-blur-[2px] border border-white/10
                       text-[10px] font-medium text-white leading-tight text-center"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
          >
            {label}
            {typeof marker.distance === 'number' && (
              <span className="text-white/50"> · {formatDistance(marker.distance)}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // The custom zoom buttons are gone, and with them stepZoom and the effect
  // that mirrored every zoom change into shared state.
  //
  // There were TWO zoom controls on one map: a hand-rolled +/- stack pinned to
  // the top-left, and the renderer's own NavigationControl with +/- AND a
  // compass at the top-right. Only one of them could ever have been the one to
  // press. The hand-rolled stack was also 3 buttons tall in the same band as
  // the search field, and at z-index 150 it floated on top of the Directions
  // and Location panels when either was open.
  //
  // NavigationControl is now the only zoom, and shared state is updated in
  // handleMoveEnd — which covers the buttons, the wheel, and pinch alike,
  // rather than the buttons only.

  // FIT THE LISTINGS. The map opened zoomed in on the reader, so the stores
  // it had just pinned — half a mile and seventeen miles away — were all
  // off-screen. Frame the nearest four and the reader, leaving room for the
  // listings panel (bottom on a phone, left on desktop).
  const fittedFor = useRef(null);
  useEffect(() => {
    if (!listings?.places?.length || !mapLoaded) return;
    const key = listings.places.map((p) => `${p.lat},${p.lng}`).join('|');
    if (fittedFor.current === key) return;
    const map = typeof mapRef.current?.getMap === 'function' ? mapRef.current.getMap() : mapRef.current;
    if (!map?.fitBounds) return;
    const pts = listings.places.slice(0, 4).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lng, p.lat]);
    if (userLocation && Number.isFinite(userLocation.lat)) pts.push([userLocation.lng, userLocation.lat]);
    if (!pts.length) return;
    fittedFor.current = key;
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const phone = typeof window !== 'undefined' && window.innerWidth < 640;
    try {
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
        padding: phone ? { top: 90, bottom: 230, left: 30, right: 30 } : { top: 90, bottom: 40, left: 360, right: 60 },
        maxZoom: 15,
        duration: 800,
      });
    } catch { /* the map is mid-teardown; the next listings change retries */ }
  }, [listings, mapLoaded, userLocation]);

  // LIVE CONDITIONS: incident pins while the traffic layer is on, and the
  // "Live here" line on a selected place. See TrafficIncidents.jsx.
  const trafficOn = TRAFFIC_AVAILABLE && (showTraffic || showTrafficFS);
  const { incidents, note: incidentNote } = useViewportIncidents(mapRef, { enabled: trafficOn, mapLoaded });
  const liveHere = useLiveHere(mapRef, selectedMarker, trafficOn);

  return (
    <div
      id="truegle-map-container"
      className={`truegle-map-container ${className}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* No ad banner here. MapViewWrapper — which is the only thing that
          mounts this component in the app — renders its own top and bottom
          banners, so having them in both put FOUR ad slots around a single
          map, two stacked at each end, and pushed the map itself below the
          fold. The wrapper owns the chrome; this owns the map. */}

      {/* Map Content */}
      <div
        ref={mapAreaRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          // Read by the stylesheet to lift the renderer's attribution and
          // scale bar clear of the function bar. See TruegleMap.css.
          '--truegle-map-bottom-clearance': bottomClearance,
        }}
      >
      {state.mapViewMode === MAP_VIEW_MODES.STANDARD ? (
        <BaseMap
          ref={mapRef}
          {...viewState}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
          // Only OUR layers are interactive. Handing maplibre every layer id
          // would make the basemap's own labels and roads swallow clicks that
          // are meant to place a pin.
          interactiveLayerIds={osirisLayerIds(osiris.active)}
          // Right-click on a desktop; press-and-hold on a touch screen. Both
          // open the same menu — see openLocationMenu.
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={cancelLongPress}
          onTouchEnd={cancelLongPress}
          onTouchCancel={cancelLongPress}
          onDragStart={cancelLongPress}
          attributionControl={true}
          navigationControl={false}
          scaleControl={false}
        >
        {/* The renderer's own controls, out of the bottom-right corner.
            That corner is a stack of three already — the function bar across
            the bottom, Reset View above it, the watermark above that — and the
            compass landed straight on the function bar. It was invisible
            before only because the map itself never drew. Top-right is empty;
            the scale bar sits bottom-left, under the mini player transport. */}
        <NavigationControl
          position="top-right"
          showCompass={true}
          showZoom={true}
        />
        <ScaleControl
          position="bottom-left"
          maxWidth={200}
          unit="imperial"
        />

        {/* Live intelligence layers, under the route lines and markers so a
            pin is never lost behind ten thousand aircraft. */}
        <OsirisSources layers={osiris.layers} />
        <OsirisFeaturePopup feature={osirisFeature} onClose={() => setOsirisFeature(null)} />

        {/* Calculated route lines (from DirectionsPanel via MapContext) */}
        {(state.routes || []).map(route => (
          route?.geometry?.coordinates?.length >= 2 && (
            <Source
              key={route.id}
              id={`route-${route.id}`}
              type="geojson"
              data={{ type: 'Feature', properties: {}, geometry: route.geometry }}
            >
              <Layer
                id={`route-line-casing-${route.id}`}
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#1d4ed8', 'line-width': 8, 'line-opacity': 0.4 }}
              />
              <Layer
                id={`route-line-${route.id}`}
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#38bdf8', 'line-width': 4 }}
              />
            </Source>
          )
        ))}

        {markers.map(marker => (
          <Marker
            key={marker.id}
            longitude={marker.lng}
            latitude={marker.lat}
            anchor="bottom"
          >
            <MarkerElement marker={marker} />
          </Marker>
        ))}

        <IncidentMarkers
          incidents={incidents}
          onSelect={(inc) => { setSelectedIncident(inc); setSelectedMarker(null); actions.setSelectedMarker(null); }}
        />

        {selectedIncident && (
          <Popup
            longitude={selectedIncident.lng}
            latitude={selectedIncident.lat}
            onClose={() => setSelectedIncident(null)}
            closeOnClick={false}
            offset={14}
            maxWidth="260px"
            className="truegle-popup-shell"
          >
            <IncidentDetails incident={selectedIncident} />
          </Popup>
        )}

        {selectedMarker && (
          <Popup
            longitude={selectedMarker.lng}
            latitude={selectedMarker.lat}
            onClose={() => {
              setSelectedMarker(null);
              actions.setSelectedMarker(null);
            }}
            closeOnClick={false}
            // NO FIXED ANCHOR. `anchor="top"` forced the card to open BELOW
            // the pin every time, so a pin anywhere near the bottom edge —
            // which is most of them, since "near me" centres on you and the
            // function bar occupies the floor — opened its card half outside
            // the map, clipped by overflow-hidden. Letting the renderer pick
            // the anchor is what makes it flip above or beside the pin
            // instead. The offset keeps it clear of the 32px marker.
            offset={16}
            maxWidth="260px"
            // The SHELL class, not the card's: putting "truegle-popup" on both
            // drew the card inside the renderer's own white box — two frames,
            // twice the size. See .truegle-popup-shell in TruegleMap.css.
            className="truegle-popup-shell"
          >
            <div className="truegle-popup">
              <div className="name">{selectedMarker.name}</div>
              <div className="address">{formatAddress(selectedMarker.address)}</div>
              {/* Only a category a person would say. Internal tags
                  (SEARCH_RESULT, BUSINESS) are ALL_CAPS_WITH_UNDERSCORES and
                  were being printed as if they meant something. */}
              {selectedMarker.category && /[a-z]/.test(selectedMarker.category) && (
                <div className="category">{selectedMarker.category}</div>
              )}
              {liveHere && <div className="live-here">Live here: {liveHere}</div>}
              <div className="actions">
                {selectedMarker.phone && (
                  <a
                    className="truegle-popup-action primary"
                    href={`tel:${String(selectedMarker.phone).replace(/[^\d+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Call
                  </a>
                )}
                <button
                  className={`truegle-popup-action${selectedMarker.phone ? '' : ' primary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Truegle's own directions, not Google's: sending the
                    // destination to google.com was the one place the map
                    // handed a user's trip to a tracker.
                    setDirectionsTo({ name: selectedMarker.name, lat: selectedMarker.lat, lng: selectedMarker.lng });
                    setShowDirectionsFS(true);
                    // Going somewhere is when traffic matters — show it.
                    if (TRAFFIC_AVAILABLE) setShowTrafficFS(true);
                    setSelectedMarker(null);
                    actions.setSelectedMarker(null);
                  }}
                >
                  Directions
                </button>
                <button
                  className="truegle-popup-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.flyTo(
                      { lat: selectedMarker.lat, lng: selectedMarker.lng },
                      15
                    );
                  }}
                >
                  Zoom
                </button>
              </div>
              <button
                type="button"
                className="truegle-popup-byg"
                onClick={(e) => {
                  e.stopPropagation();
                  setBeforeYouGo({ name: selectedMarker.name, lat: selectedMarker.lat, lng: selectedMarker.lng, address: formatAddress(selectedMarker.address) });
                  setSelectedMarker(null);
                  actions.setSelectedMarker(null);
                }}
              >
                Before you go →
              </button>
            </div>
          </Popup>
        )}

        {children}
      </BaseMap>
      ) : state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D ? (
        <WebGLErrorBoundary componentName="Globe3D" fallback={<p className="text-white text-center p-4">3D Globe requires WebGL. Switching to standard map.</p>}>
          <Globe3D
            center={state.center || { lat: center[1], lng: center[0] }}
            zoom={viewState.zoom}
            onMapClick={onMapClick}
            onMarkerClick={onMarkerClick}
            showTraffic={showTraffic || showTrafficFS}
            markers={markers}
            routes={state.routes}
          />
        </WebGLErrorBoundary>
      ) : state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT ? (
        <WebGLErrorBoundary componentName="AzimuthalFlat" fallback={<p className="text-white text-center p-4">Azimuthal view requires WebGL. Switching to standard map.</p>}>
          <AzimuthalFlat
            center={state.center || { lat: center[1], lng: center[0] }}
            zoom={viewState.zoom}
            onMapClick={onMapClick}
            onMarkerClick={onMarkerClick}
            showTraffic={showTraffic || showTrafficFS}
            markers={markers}
            routes={state.routes}
            backgroundImage={backgroundImage}
            showGraticule={AZIMUTHAL_FLAT_CONFIG.showGraticule}
            userLocation={userLocation}
          />
        </WebGLErrorBoundary>
      ) : null}

      {/* Destination search bar — inside the fullscreen container so it
          survives native fullscreen (mobile forces fullscreen). */}
      {/* Hidden while a side panel (directions, cameras) is open: it
          floated over the panel's own first field. */}
      <div
        className="absolute z-50 w-72 max-w-[calc(100%-88px)]"
        style={{ ...(isFullscreen ? { top: 72, left: 12 } : { top: 16, left: 64 }), ...(panelOpen ? { display: 'none' } : {}) }}
      >
        <form onSubmit={handlePlaceSubmit} className="flex items-center gap-2 bg-white rounded-full shadow-lg px-4 py-2.5">
          <Search size={16} className="text-gray-500 shrink-0" />
          <input
            type="text"
            value={placeQuery}
            onChange={(e) => {
              setPlaceQuery(e.target.value);
              setShowPlaceResults(true);
            }}
            onFocus={() => setShowPlaceResults(true)}
            // The placeholder is the documentation. A bar that accepts three
            // kinds of question should say so, or people only ever try one.
            placeholder="coffee near me, a place, an address"
            aria-label="Search the map for a place, a category near you, or an address"
            className="flex-1 text-sm text-gray-800 outline-none bg-transparent min-w-0"
          />
        </form>
        {showPlaceResults && (placeResults.length > 0 || isPlaceSearching || placeNeedsLocation) && (
          <div className="mt-1 bg-white rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {isPlaceSearching && (
              <div className="px-4 py-2 text-xs text-gray-500">Searching...</div>
            )}
            {placeNeedsLocation && !isPlaceSearching && (
              <button
                type="button"
                onClick={requestLocationForSearch}
                className="w-full text-left px-4 py-3 text-sm text-gray-800 hover:bg-gray-100"
              >
                <span className="font-medium">Share your location to search near you</span>
                <span className="block text-xs text-gray-500">
                  Truegle needs a position before &ldquo;near me&rdquo; means anything.
                </span>
              </button>
            )}
            {placeResults.map((result, index) => (
              <button
                key={`${result.position.lat},${result.position.lng},${index}`}
                type="button"
                onClick={() => handlePlaceResultClick(result)}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 border-t border-gray-100 first:border-t-0"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{result.name}</span>
                  {result.distance !== null && (
                    <span className="shrink-0 text-xs text-gray-500">{formatDistance(result.distance)}</span>
                  )}
                </span>
                {result.address && (
                  <span className="block truncate text-xs text-gray-500">{result.address}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Non-Fullscreen Controls */}
      {!isFullscreen && (
        <>
          {/* One button, not a stack of three. Zoom lives in the renderer's
              own control at the top-right; this corner is the search field's
              band and a 3-button column crowded it. Hidden while a panel is
              open — see panelOpen. */}
          {!panelOpen && (
          <div className="truegle-traditional-controls">
            {/* Fullscreen Toggle */}
            <button
              className="truegle-control-btn truegle-control-fullscreen"
              onClick={toggleFullscreen}
              title="Enter Fullscreen"
            >
              <Maximize2 size={18} />
            </button>
          </div>
          )}

          {/* Function Bar — BOTTOM centre, not top.
              It was `absolute top-4 left-1/2` with no width bound and no
              wrapping: eight buttons in one rigid row, wider than the map, so
              the container's overflow-hidden sliced "Map" off the left edge
              and "Close" off the right. It also shared the top band with the
              search field and the zoom stack, so all three overlapped.
              The top band is now search only; modes and layers sit along the
              bottom the way every other map app arranges them.

              IT WRAPS. Bounding it and letting it scroll horizontally stopped
              the row being CLIPPED, but it still ended mid-word — the live
              screenshot shows "✕ Clos" against the right edge, which reads as
              broken however scrollable it is. A control you have to discover
              by dragging is barely better than one you cannot see. Below the
              measured threshold the row wraps onto a second line and the
              labels drop, so every button stays whole and reachable. Same
              idiom, and the same reason, as PlayerTransport's row. */}
          <div
            ref={functionBarRef}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100%-24px)]"
          >
            <div className="bg-gradient-to-r from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl rounded-xl border border-neutral-700/50 shadow-2xl">
              {/* Compact never wraps: four controls always fit, and a wrap
                  there costs a whole extra row of a 340px window for nothing.
                  Wide still wraps, which is what stops "Close" being clipped. */}
              <div className={`flex items-center justify-center gap-1.5 px-3 py-2 ${compactBar ? 'flex-nowrap' : 'flex-wrap'}`}>
                {/* Exploratory controls — hidden on a small map. See compactBar. */}
                {!compactBar && (<>
                {/* View Mode Selector */}
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.STANDARD
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.STANDARD); announce('Street map'); }}
                  title="Standard Map View"
                >
                  <MapIcon size={14} />
                  <span className={modeLabelClass}>Map</span>
                </button>
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT); announce('Azimuthal projection'); }}
                  title="Azimuthal Flat View"
                >
                  <Target size={14} />
                  <span className={modeLabelClass}>Azimuthal</span>
                </button>
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.GLOBE_3D); announce('3D globe'); }}
                  title="3D Globe View"
                >
                  <Globe size={14} />
                  <span className={modeLabelClass}>Globe</span>
                </button>

                <div className="w-px h-6 bg-neutral-700 mx-1"></div>

                {/* Map Style Toggle */}
                <button
                  onClick={toggleFullscreenMapStyle}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    fullscreenMapStyle === 'satellite'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={fullscreenMapStyle === 'satellite' ? 'Satellite View' : 'Street View'}
                >
                  <Layers size={14} />
                  <span className={labelClass}>{fullscreenMapStyle === 'satellite' ? 'Satellite' : 'Street'}</span>
                </button>

                {/* Traffic Toggle — only when there is a traffic source to
                    show. A button that provably cannot do anything is worse
                    than no button: it reads as a broken feature. */}
                {TRAFFIC_AVAILABLE && (
                <button
                  onClick={() => setShowTrafficFS(prev => { announce(prev ? 'Traffic off' : 'Traffic on'); return !prev; })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showTrafficFS
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Toggle Traffic"
                >
                  <TrafficCone size={14} />
                  <span className={labelClass}>Traffic</span>
                </button>
                )}

                {/* Cameras Toggle */}
                <button
                  onClick={() => setShowCamerasFS(prev => { announce(prev ? 'Cameras closed' : 'Traffic cameras'); return !prev; })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showCamerasFS
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Traffic Cameras"
                >
                  <Camera size={14} />
                  <span className={labelClass}>Cameras</span>
                </button>

                {/* Live intelligence layers. Rendered from the server's own
                    catalogue, so a feed added on the backend appears here
                    without a change in this file. */}
                <OsirisLayerSwitcher
                  catalogue={osiris.catalogue}
                  active={osiris.active}
                  layers={osiris.layers}
                  onToggle={osiris.toggle}
                  labelClass={labelClass}
                />

                {/* Search Cameras Toggle */}
                <button
                  onClick={() => setShowEnhancedCameraSearch(prev => { announce(prev ? 'Camera search closed' : 'Camera search'); return !prev; })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showEnhancedCameraSearch
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Search Cameras"
                >
                  <Search size={14} />
                  <span className={labelClass}>Search</span>
                </button>

                </>)}

                {/* Directions Toggle */}
                <button
                  onClick={() => setShowDirectionsFS(prev => { announce(prev ? 'Directions closed' : 'Directions'); return !prev; })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showDirectionsFS
                      ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Directions"
                >
                  <DirectionsIcon size={14} />
                  <span className={labelClass}>Directions</span>
                </button>

                {/* My Location — lit when your position is on screen. */}
                <button
                  onClick={handleLocationButton}
                  data-location-state={locationState}
                  aria-pressed={locationState === 'lit'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${locationBtnClass}`}
                  title={locationBtnTitle}
                >
                  {locationState === 'unknown' ? <MapPin size={14} /> : <LocateFixed size={14} />}
                  <span className={labelClass}>Location</span>
                </button>

                {/* Pop out / dock back. The map was a mode you got stuck in:
                    open on a phone it goes native-fullscreen and there is
                    nothing else you can do until you close it. This is the
                    player's pop-out, for the map. */}
                {onTogglePopOut && (
                  <button
                    onClick={() => { onTogglePopOut(); announce(poppedOut ? 'Map docked' : 'Map popped out'); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-cyan-400"
                    title={poppedOut ? 'Put the map back in the page' : 'Pop the map out so you can keep browsing'}
                  >
                    {poppedOut ? <Minimize2 size={14} /> : <PictureInPicture2 size={14} />}
                    <span className={labelClass}>{poppedOut ? 'Dock' : 'Pop out'}</span>
                  </button>
                )}

                {/* Close Map */}
                {onClose && (
                  <>
                    {!compactBar && <div className="w-px h-6 bg-neutral-700 mx-1"></div>}
                    <button
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-neutral-800 text-red-400 hover:bg-red-600 hover:text-white"
                      title="Close Map"
                    >
                      <X size={14} />
                      <span className={labelClass}>Close</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unified Top Bar - Fullscreen Mode */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-50"
          >
            <div className="bg-gradient-to-r from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl border-b border-neutral-700/50 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                {/* Left: macOS Window Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={exitFullscreen}
                    className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors group relative"
                    title="Close"
                  >
                    <X size={8} className="absolute inset-0 m-auto text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={minimizeFullscreen}
                    className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors group relative"
                    title="Minimize"
                  >
                    <Minus size={8} className="absolute inset-0 m-auto text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                    title="Fullscreen"
                  >
                  </button>
                </div>

                {/* Center: View Mode Selector */}
                <div className="flex items-center gap-2">
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.STANDARD
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.STANDARD); announce('Street map'); }}
                    title="Standard Map View"
                  >
                    <MapIcon size={14} />
                    <span className="hidden sm:inline">Map</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT); announce('Azimuthal projection'); }}
                    title="Azimuthal Flat View"
                  >
                    <Target size={14} />
                    <span className="hidden sm:inline">Azimuthal</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => { actions.setMapViewMode(MAP_VIEW_MODES.GLOBE_3D); announce('3D globe'); }}
                    title="3D Globe View"
                  >
                    <Globe size={14} />
                    <span className="hidden sm:inline">Globe</span>
                  </button>

                  <div className="w-px h-6 bg-neutral-700 mx-1"></div>

                  {/* Map Style Toggle */}
                  <button
                    onClick={toggleFullscreenMapStyle}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      fullscreenMapStyle === 'satellite'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title={fullscreenMapStyle === 'satellite' ? 'Satellite View' : 'Street View'}
                  >
                    <Layers size={14} />
                    <span className="hidden md:inline">{fullscreenMapStyle === 'satellite' ? 'Satellite' : 'Street'}</span>
                  </button>

                  {/* Traffic Toggle — see the windowed bar above. */}
                  {TRAFFIC_AVAILABLE && (
                  <button
                    onClick={() => setShowTrafficFS(prev => { announce(prev ? 'Traffic off' : 'Traffic on'); return !prev; })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showTrafficFS
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Traffic"
                  >
                    <TrafficCone size={14} />
                    <span className="hidden md:inline">Traffic</span>
                  </button>
                  )}

                  {/* Cameras Toggle */}
                  <button
                    onClick={() => setShowCamerasFS(prev => { announce(prev ? 'Cameras closed' : 'Traffic cameras'); return !prev; })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showCamerasFS
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Traffic Cameras"
                  >
                    <Camera size={14} />
                    <span className="hidden lg:inline">Cameras</span>
                  </button>

                  {/* Same live layers as the fullscreen bar — one control, two
                      places it is drawn, never two behaviours. */}
                  <OsirisLayerSwitcher
                    catalogue={osiris.catalogue}
                    active={osiris.active}
                    layers={osiris.layers}
                    onToggle={osiris.toggle}
                    labelClass="hidden lg:inline"
                  />

                  {/* Search Cameras Toggle */}
                  <button
                    onClick={() => setShowEnhancedCameraSearch(prev => { announce(prev ? 'Camera search closed' : 'Camera search'); return !prev; })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showEnhancedCameraSearch
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Search Cameras"
                  >
                    <Search size={14} />
                    <span className="hidden lg:inline">Search</span>
                  </button>

                  {/* Directions Toggle */}
                  <button
                    onClick={() => setShowDirectionsFS(prev => { announce(prev ? 'Directions closed' : 'Directions'); return !prev; })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showDirectionsFS
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Directions"
                  >
                    <DirectionsIcon size={14} />
                    <span className="hidden lg:inline">Directions</span>
                  </button>

                  {/* My Location — same three states as the windowed bar. */}
                  <button
                    onClick={handleLocationButton}
                    data-location-state={locationState}
                    aria-pressed={locationState === 'lit'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${locationBtnClass}`}
                    title={locationBtnTitle}
                  >
                    {locationState === 'unknown' ? <MapPin size={14} /> : <LocateFixed size={14} />}
                    <span className="hidden lg:inline">Location</span>
                  </button>
                </div>

                {/* Right: Status Info */}
                <div className="flex items-center gap-2 text-xs text-cyan-400">
                  <span className="hidden md:inline">
                    {fullscreenMapStyle === 'satellite' ? 'Satellite' : fullscreenMapStyle.charAt(0).toUpperCase() + fullscreenMapStyle.slice(1)}
                    {showTrafficFS && ' • Traffic'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Traffic Legend (when traffic is enabled in fullscreen) */}
      <AnimatePresence>
        {isFullscreen && showTrafficFS && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            // Beside the directions panel (w-96), not on top of its buttons;
            // on a phone the panel is the whole width, so the key steps aside.
            className={`absolute bottom-4 bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-700/50 p-3 shadow-lg z-40 ${showDirectionsFS ? 'hidden sm:block sm:left-[25rem]' : 'left-4'}`}
          >
            <h4 className="text-xs font-semibold text-white mb-2">Traffic Conditions</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-green-500 rounded"></div>
                <span className="text-white/70">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-yellow-500 rounded"></div>
                <span className="text-white/70">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-orange-500 rounded"></div>
                <span className="text-white/70">Heavy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-red-500 rounded"></div>
                <span className="text-white/70">Severe</span>
              </div>
            </div>
            {(incidents.length > 0 || incidentNote) && (
              <p className="mt-2 text-[11px] text-white/60">
                {incidentNote || `${incidents.length} incident${incidents.length > 1 ? 's' : ''} in view — tap an icon`}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Traffic Cameras Panel - works in windowed and fullscreen mode */}
      <AnimatePresence>
        {showCamerasFS && (
          <div className="absolute top-16 left-0 right-0 bottom-20 z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <TrafficCameras
                userLocation={userLocation}
                isOpen={showCamerasFS}
                onClose={() => setShowCamerasFS(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ONE CAMERA, FULL SIZE ────────────────────────────────────────────
          Click a pin and it opens here. Deliberately a plain overlay rather
          than a portal: it belongs to the map, and closing the map should take
          it with it — a portalled dialog would outlive the thing it describes.

          Escape and a click on the backdrop both close it. The frame itself
          stops propagation, so clicking the picture you are watching does not
          dismiss it. */}
      <AnimatePresence>
        {listings && !panelOpen && !beforeYouGo && (
          <MapListings
            listings={listings}
            onFocus={(p) => {
              const marker = { id: `listing-focus-${p.lat}-${p.lng}`, lat: p.lat, lng: p.lng, name: p.name, address: p.address, category: p.category || 'BUSINESS', phone: p.phone, website: p.website };
              actions.flyTo({ lat: p.lat, lng: p.lng }, 16);
              setSelectedMarker(marker);
              actions.setSelectedMarker(marker);
            }}
            onDirections={(p) => {
              setDirectionsTo({ name: p.name, lat: p.lat, lng: p.lng });
              setShowDirectionsFS(true);
              if (TRAFFIC_AVAILABLE) setShowTrafficFS(true);
              setSelectedMarker(null);
              actions.setSelectedMarker(null);
            }}
          />
        )}

        {beforeYouGo && (
          <BeforeYouGo
            place={beforeYouGo}
            from={userLocation}
            onClose={() => setBeforeYouGo(null)}
            onDirections={() => {
              setDirectionsTo({ name: beforeYouGo.name, lat: beforeYouGo.lat, lng: beforeYouGo.lng });
              setShowDirectionsFS(true);
              if (TRAFFIC_AVAILABLE) setShowTrafficFS(true);
              setBeforeYouGo(null);
            }}
          />
        )}

        {openCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpenCamera(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label={openCamera.name || 'Traffic camera'}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-xl overflow-hidden border border-amber-400/40 bg-neutral-900 shadow-2xl"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <Camera size={14} className="text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{openCamera.name || 'Traffic camera'}</p>
                    {openCamera.address && (
                      <p className="text-[11px] text-white/45 truncate">{openCamera.address}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenCamera(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                  title="Close camera"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
              <div className="aspect-video bg-black">
                <CameraView camera={openCamera} className="w-full h-full object-contain" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Camera Search Modal - Positioned below top bar */}
      <AnimatePresence>
        {showEnhancedCameraSearch && (
          <div className="absolute top-16 left-0 right-0 bottom-20 z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <EnhancedCameraSearch
                userLocation={userLocation}
                onCameraSelect={(camera) => {
                  // Add marker for the camera
                  actions.addMarker({
                    id: `camera-${camera.id}`,
                    lat: camera.location.lat,
                    lng: camera.location.lng,
                    name: camera.name,
                    category: 'CAMERA',
                    address: `${camera.roadName || ''} - ${camera.city}, ${camera.state}`,
                    // THE PICTURE HAS TO TRAVEL WITH THE PIN. Without these the
                    // marker knows a camera exists and nothing about what it
                    // sees, so the pin could only ever be a dot — there is
                    // nothing to preview and nothing to open. addMarker spreads
                    // the whole object, so extra fields survive.
                    imageUrl: camera.imageUrl || null,
                    streamUrl: camera.streamUrl || null,
                  });

                  // Fly to camera location
                  actions.flyTo({ lat: camera.location.lat, lng: camera.location.lng }, 15);

                  // Close the search modal
                  setShowEnhancedCameraSearch(false);
                }}
                onClose={() => setShowEnhancedCameraSearch(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Directions Panel - works in windowed and fullscreen mode */}
      <AnimatePresence>
        {showDirectionsFS && (
          <div className="absolute top-16 left-0 right-0 bottom-20 z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <DirectionsPanel
                isOpen={showDirectionsFS}
                initialDestination={directionsTo}
                onClose={() => { setShowDirectionsFS(false); setDirectionsTo(null); }}
                userLocation={userLocation}
                onRouteCalculated={handleRouteCalculated}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Permission Modal (Fullscreen) */}
      <LocationPermissionModal
        isOpen={showLocationModalFS}
        onClose={() => setShowLocationModalFS(false)}
        onLocationGranted={handleLocationGranted}
        onLocationDenied={handleLocationDenied}
      />

      {/* The state receipt. Centred, brief, and pointer-events-none so it can
          never intercept the next press. */}
      {stateToast && (
        <div
          data-state-toast=""
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                     px-4 py-2 rounded-xl border border-cyan-400/30 bg-neutral-900/90 backdrop-blur-md
                     shadow-2xl text-sm font-medium text-white/90 whitespace-nowrap
                     animate-[fadeIn_120ms_ease-out]"
        >
          {stateToast.label}
        </div>
      )}

      {/* WHY THE MAP HAS NO PINS ON IT.
          A search that found nothing and a search that was refused look
          identical — an empty map — and only one of them is something anyone
          can act on. The ladder's failures ride along in `reason`, so a CSP
          block or a provider outage names itself instead of presenting as
          "no results". Nothing renders while it is working or once it has
          found something. */}
      {nearbyStatus && (nearbyStatus.state === 'empty' || nearbyStatus.state === 'failed') && (
        <div
          data-nearby-status={nearbyStatus.state}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-32px)]
                     px-3 py-2 rounded-lg border shadow-lg backdrop-blur-md
                     border-amber-500/30 bg-amber-950/70 text-amber-100/90"
        >
          <p className="text-[11px] leading-snug">
            {nearbyStatus.state === 'empty'
              ? `Nothing found for “${nearbyStatus.query || 'places'}” within 5 km.`
              : 'Couldn\u2019t reach any place provider.'}
          </p>
          {nearbyStatus.reason && (
            <p className="mt-0.5 text-[10px] text-amber-200/60 break-words line-clamp-2">
              {nearbyStatus.reason}
            </p>
          )}
        </div>
      )}

      {/* Share this spot. Opened by a right-click or a long press; positioned
          at the point that was pressed, then nudged back inside the container
          so a press near an edge does not open a menu that is half off it. */}
      {locationMenu && (
        <div
          data-location-menu=""
          className="absolute z-50 w-60 max-w-[calc(100%-16px)] rounded-xl overflow-hidden
                     border border-neutral-700/60 shadow-2xl backdrop-blur-xl
                     bg-gradient-to-b from-neutral-900/97 to-neutral-800/97"
          style={{
            left: Math.max(8, Math.min(locationMenu.x, (mapRef.current?.getMap?.()?.getContainer?.()?.clientWidth || 9999) - 248)),
            top: Math.max(8, locationMenu.y),
          }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <div className="px-3 py-2 border-b border-neutral-700/50">
            <div className="text-xs font-medium text-white truncate">
              {locationMenu.address || 'Dropped pin'}
            </div>
            <div className="text-[10px] text-neutral-400 tabular-nums">
              {locationMenu.lat.toFixed(5)}, {locationMenu.lng.toFixed(5)}
            </div>
          </div>
          <button
            type="button"
            onClick={shareLocation}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 transition-colors"
          >
            {shareState === 'done' || shareState === 'copied'
              ? <Check size={14} className="text-green-400 shrink-0" />
              : <Share2 size={14} className="shrink-0" />}
            <span>
              {shareState === 'copied' ? 'Link copied'
                : shareState === 'done' ? 'Shared'
                  : shareState === 'failed' ? "Couldn't share — try again"
                    : 'Share this location'}
            </span>
          </button>
          <button
            type="button"
            onClick={copyCoordinates}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 border-t border-neutral-700/50 transition-colors"
          >
            <Copy size={14} className="shrink-0" />
            <span>Copy coordinates</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDirectionsFS(true);
              setLocationMenu(null);
            }}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 border-t border-neutral-700/50 transition-colors"
          >
            <DirectionsIcon size={14} className="shrink-0" />
            <span>Directions</span>
          </button>
        </div>
      )}

      {/* What's playing, reachable without leaving the map. Renders nothing
          when the player is empty. See MapPlayerTransport. */}
      <MapPlayerTransport />

      {/* RECENTRE ON ME. Top-right, directly under the zoom controls, which is
          where every map app puts it and therefore where a hand goes looking.
          The Location button in the function bar does the same thing, but it
          is one of ten icons on a bar that hides its labels when the map is
          narrow — a control you have to hunt for is not a quick way back.
          Hidden when we have no position: a button that cannot do its one job
          is worse than no button (see utils/embeddable.js for the same call). */}
      {userLocation && !panelOpen && (
        <button
          type="button"
          data-recenter=""
          onClick={handleLocationButton}
          title={locationOnScreen ? 'Centre on your location' : 'Back to your location'}
          aria-label="Centre the map on your location"
          className={`absolute right-2.5 z-40 flex items-center justify-center w-[29px] h-[29px]
                      rounded border shadow-md transition-colors ${
            locationOnScreen
              ? 'bg-blue-500/25 border-blue-400/60 text-blue-300'
              : 'bg-neutral-900/90 border-neutral-600/60 text-white/70 hover:text-white hover:bg-neutral-800'
          }`}
          // Under the renderer's own zoom/compass stack, which sits at top 8.
          style={{ top: 108 }}
        >
          <LocateFixed size={15} />
        </button>
      )}

      {/* Reset View Button - Bottom Right.
          Not in the popped-out frame: that window is 340px tall by default and
          this button, the function bar and the watermark all want the same
          corner. Reset is a convenience; the other two are the controls and
          the brand. */}
      {!poppedOut && (
      <button
        onClick={() => {
          setViewState({
            longitude: center[0],
            latitude: center[1],
            zoom: 4,
          });
          actions.flyTo({ lat: center[1], lng: center[0] }, 4);
        }}
        className="absolute bottom-24 right-4 z-40 bg-neutral-800/90 hover:bg-neutral-700/90 text-white rounded-lg px-3 py-2 text-sm font-medium transition-all border border-neutral-600/50 shadow-lg backdrop-blur-sm"
        title="Reset View"
      >
        Reset View
      </button>
      )}

      {/* The map's ONE watermark — the legacy Truegle mark, drawn here and
          nowhere else. It lives inside #truegle-map-container so it survives
          native fullscreen, which targets that element.

          The bottom-right corner is a single column, read from the floor up:
          the function bar at bottom-4, Reset View at bottom-24, the mark above
          both. It used to sit at bottom 72px / right 80px, which put it
          straight through the Reset View button. */}
      <img
        data-truegle-watermark=""
        src={defaultLogoConfig.src}
        alt={defaultLogoConfig.alt}
        style={{
          ...getLogoPosition('bottomRight'),
          ...defaultLogoConfig.style,
          ...getLogoSize(poppedOut ? 'small' : defaultLogoConfig.size),
          // Read from the floor up: function bar at bottom-4, Reset View at
          // bottom-24, the mark above both. The popped-out frame has no Reset
          // View, so the mark moves down into the space that leaves.
          bottom: poppedOut ? '56px' : '144px',
        }}
      />
      </div>

      {/* Bottom banner likewise belongs to the wrapper — see above. */}
    </div>
  );
}