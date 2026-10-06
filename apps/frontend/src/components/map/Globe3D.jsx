import { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useMap } from './context/MapContext';
import { TRUEGLE_BRAND_COLORS, GLOBE_3D_CONFIG } from './config/constants';
import { GlobeMarker } from './globe/GlobeMarker';
import { GlobeRoute } from './globe/GlobeRoute';
import { getNASAEarthTextureUrl, GIBS_ATTRIBUTION } from './utils/nasaGibsHelper';
import { buildEquirectangularEarth, EARTH_ATTRIBUTION } from './utils/earthTexture';
import { onMapZoomRequest } from './utils/mapZoomBus';
import { MAP_VIEW_MODES } from './config/constants';
import './styles/AzimuthalGlobe.css';

const globeRadius = GLOBE_3D_CONFIG.globeRadius;
// Camera distance (in globe radii) at which the street map takes over.
const HANDOVER_DISTANCE = 1.45;

/**
 * EarthSphere Component
 *
 * Renders a 3D sphere with satellite imagery texture using a multi-tier fallback system:
 * 1. Primary: Local satellite image (Azimuthal-satellite-view.png)
 * 2. Fallback 1: NASA GIBS Blue Marble (free, no API key required)
 * 3. Fallback 2: Solid earth color
 *
 * This ensures the globe always displays imagery even if local assets fail.
 *
 * Future Enhancement: For dynamic zoom levels, integrate TomTom satellite tile API
 * using getTomTomSatelliteTileUrl() from utils/tomtomTileHelper.js to fetch
 * real-time satellite tiles based on user's zoom level and position.
 */
function EarthSphere({ radius, onTextureSourceChange }) {
  const [texture, setTexture] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (tex, source) => {
      if (cancelled) return;
      // ClampToEdge on S leaves a seam where longitude wraps; the texture IS
      // the whole world, so the horizontal axis has to repeat.
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      setTexture(tex);
      onTextureSourceChange?.(source);
    };

    // ORDER MATTERS, and it is the opposite of what it was.
    //
    // Esri first: it is the same host the flat satellite basemap already
    // draws, so if the 2D map works the globe works. NASA GIBS second — it is
    // genuinely better imagery, but it is a public science service with no
    // uptime promise, and depending on it FIRST is what left users looking at
    // a blank sphere.
    //
    // The bundled Azimuthal-satellite-view.png is no longer in this chain at
    // all. It is an azimuthal projection; wrapping a polar disc onto a lat/lon
    // sphere is what produced the featureless pale ball people reported as
    // "the globe doesn't render". A plain ocean sphere is a more honest Earth
    // than a misprojected photograph of one.
    buildEquirectangularEarth()
      .then((canvas) => {
        if (cancelled) return;
        apply(new THREE.CanvasTexture(canvas), 'esri');
      })
      .catch((esriError) => {
        if (cancelled) return;
        console.warn('Esri imagery unavailable, trying NASA:', esriError?.message || esriError);
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(
          getNASAEarthTextureUrl('BLUE_MARBLE'),
          (tex) => apply(tex, 'nasa'),
          undefined,
          () => {
            if (cancelled) return;
            console.warn('NASA Blue Marble unavailable too; using a plain ocean sphere.');
            setLoadError(true);
            onTextureSourceChange?.('fallback');
          },
        );
      });

    return () => { cancelled = true; };
  }, [onTextureSourceChange]);

  return (
    <group>
      {/* No wrapping <mesh>: drei's <Sphere> IS a mesh, and the outer one had
          neither geometry nor material of its own — an empty object in the
          scene graph that only made the tree harder to read. */}
      <Sphere args={[radius, 64, 64]}>
        {texture && !loadError ? (
          // SATELLITE IMAGERY IS ALREADY LIT. It is a photograph of a sunlit
          // Earth, so the scene lights are a SECOND sun on top of the one in
          // the picture. At the old intensities that pushed every pixel past
          // 1.0 and the globe rendered pure white with the texture bound and
          // sampling correctly — which is why this looked like a texture
          // failure for so long. Roughness 1 and no metalness keep the
          // remaining light purely diffuse, so shading adds depth to the
          // imagery instead of a specular sheen that is not on the real Earth.
          <meshStandardMaterial
            // KEYED, and this is load-bearing rather than tidiness.
            //
            // The texture arrives asynchronously, so React updates `map` on a
            // material three.js has ALREADY compiled a shader program for —
            // and that program has no texture sampling in it. Without a
            // recompile the map is simply not read, so the sphere rendered
            // `color` alone: pure white, with the texture bound, uploaded and
            // sampling correctly. It looked exactly like a failed download and
            // sent the search off in the wrong direction twice.
            //
            // Changing the key makes React mount a NEW material once the
            // texture exists, which compiles the right program by
            // construction — no needsUpdate flag to remember on a future edit.
            key={texture ? 'earth-textured' : 'earth-pending'}
            map={texture}
            color="#ffffff"
            emissive="#000000"
            metalness={0}
            roughness={1}
          />
        ) : (
          // Ocean blue, not a washed-out grey: when every source has failed
          // this should look like a deliberate plain Earth rather than like a
          // texture that half-loaded.
          <meshStandardMaterial
            color="#12385c"
            emissive="#04101c"
            metalness={0.1}
            roughness={0.8}
          />
        )}
      </Sphere>

      <mesh>
        <Sphere args={[radius + 0.01, 32, 32]}>
          <meshBasicMaterial
            color="#2a2a4e"
            wireframe={true}
            transparent={true}
            opacity={0.2}
          />
        </Sphere>
      </mesh>
    </group>
  );
}

export default function Globe3D({
  center = { lat: 39.8283, lng: -98.5795 },
  zoom = 4,
  onMapClick = null,
  onMarkerClick = null,
  showTraffic = false,
  markers = [],
  routes = [],
}) {
  const { state, actions } = useMap();
  const controlsRef = useRef();
  const groupRef = useRef();
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [textureSource, setTextureSource] = useState('loading');


  // NO PLACEHOLDER PINS. This used to substitute five hardcoded markers — New
  // York, London, Tokyo, Sydney, Beijing — whenever the real list was empty.
  // They were scaffolding that shipped: a user who opened the globe before
  // searching saw five pins on cities they had never asked about, which reads
  // as results rather than as a demo. An empty globe is the correct answer to
  // "nothing has been searched yet".
  const displayMarkers = markers;

  const handleMapClick = useCallback((event) => {
    if (!isDragging && onMapClick) {
      const point = event.point;
      const { lat, lng } = pointToLatLon(point, globeRadius);
      onMapClick({ lat, lng });
    }
  }, [isDragging, onMapClick, globeRadius]);

  const handleMarkerClick = useCallback((marker, event) => {
    event.stopPropagation();
    
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
    
    actions.setSelectedMarker(marker);
  }, [actions, onMarkerClick]);

  const canvasRef = useRef(null);

  useEffect(() => {
    const handleContextLost = (event) => {
      console.warn('⚠️ WebGL context lost in Globe3D');
      event.preventDefault(); // Prevent default behavior
      setContextLost(true);
    };

    const handleContextRestored = () => {
      console.log('✅ WebGL context restored in Globe3D');
      setContextLost(false);
    };

    // Find the canvas element created by react-three/fiber
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvasRef.current = canvas;
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      console.log('🎨 Globe3D WebGL context initialized');

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);

        // Try to force context disposal on unmount
        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
          if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
              loseContext.loseContext();
              console.log('🧹 Manually disposed WebGL context');
            }
          }
        } catch (error) {
          console.warn('⚠️ Error disposing WebGL context:', error);
        }
      };
    }
  }, []);

  // TURN THE GLOBE SO `center` FACES YOU. The camera sits on +z; a point at
  // colatitude φ and θ = lng+180° is brought onto that axis by turning
  // π/2 − θ about Y and then lat about X (three applies Y before X in its
  // default 'XYZ' order). The old {x: φ, y: −θ} pointed somewhere else.
  useEffect(() => {
    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      const theta = (center.lng + 180) * (Math.PI / 180);
      setRotation({ x: center.lat * (Math.PI / 180), y: Math.PI / 2 - theta });
    }
  }, [center?.lat, center?.lng]);

  // ── ZOOM IN FAR ENOUGH AND IT BECOMES THE STREET MAP ─────────────────────
  // Owner, 2026-10-06: no Map button — "when any of the views are zoomed in to
  // navigable altitude, it automatically switches to map view mode". The spot
  // under the middle of the screen is where the street map opens.
  const handedOver = useRef(false);
  const facing = useCallback((camera) => {
    const g = groupRef.current;
    if (!g || !camera) return null;
    const v = camera.position.clone().normalize().multiplyScalar(globeRadius);
    const p = g.worldToLocal(v);
    const phi = Math.acos(Math.max(-1, Math.min(1, p.y / globeRadius)));
    const theta = Math.atan2(p.z, -p.x);                 // inverse of latLonToPoint
    let lng = (theta * 180) / Math.PI - 180;
    lng = ((((lng + 180) % 360) + 360) % 360) - 180;
    return { lat: 90 - (phi * 180) / Math.PI, lng };
  }, []);
  const onControlsChange = useCallback(() => {
    const c = controlsRef.current;
    if (!c || handedOver.current) return;
    const d = c.object.position.length();
    if (d <= globeRadius * HANDOVER_DISTANCE) {
      const at = facing(c.object);
      if (!at) return;
      handedOver.current = true;
      actions.setCenter(at);
      actions.setZoom(4.5);
      actions.setMapViewMode(MAP_VIEW_MODES.STANDARD);
    }
  }, [actions, facing]);

  // The rail's +/− — see utils/mapZoomBus.
  useEffect(() => onMapZoomRequest((dir) => {
    const c = controlsRef.current;
    if (!c) return;
    const cam = c.object;
    const next = cam.position.length() * (dir > 0 ? 0.7 : 1 / 0.7);
    cam.position.setLength(Math.max(c.minDistance, Math.min(c.maxDistance, next)));
    c.update();
    onControlsChange();
  }), [onControlsChange]);

  const latLonToPoint = (lat, lon, radius) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return { x, y, z };
  };

  const pointToLatLon = (point, radius) => {
    const { x, y, z } = point;
    
    const lat = 90 - (Math.acos(y / radius) * 180 / Math.PI);
    const lon = ((Math.atan2(z, x) * 180 / Math.PI) + 180) % 360 - 180;
    
    return { lat, lng: lon };
  };

  return (
    <div className="azimuthal-globe-container" style={{ width: '100%', height: '100%' }}>
      {contextLost ? (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
          fontSize: '14px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div>WebGL context was lost</div>
            <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
              Please refresh the page to restore the 3D globe view
            </div>
          </div>
        </div>
      ) : (
        <Canvas
          // Far enough back to see a whole planet. At z=10 with a radius-5
          // globe the sphere overflows the frame — and the map area is short
          // and wide, so it was cropped top and bottom into a featureless
          // wall. This frames the globe with room around it.
          camera={{ position: [0, 0, 16], fov: 45 }}
          gl={{
            antialias: false, // Reduce WebGL resource usage
            alpha: true,
            powerPreference: 'low-power', // Use low-power GPU mode
            preserveDrawingBuffer: false, // Don't preserve buffer (saves memory)
            failIfMajorPerformanceCaveat: false, // Don't fail on slow GPUs
          }}
          onClick={handleMapClick}
          onCreated={({ gl }) => {
            console.log('🎨 WebGL renderer created for Globe3D');
            // Set pixel ratio to improve performance
            gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          }}
        >
          {/* Satellite imagery is already a photograph of a LIT Earth, so the
              scene lights are a second sun on top of the one in the picture.
              Kept modest so shading adds relief rather than blowing the
              imagery towards white. */}
          <ambientLight intensity={0.55} />
          <directionalLight position={[10, 10, 5]} intensity={0.8} />

          <group ref={groupRef} rotation={[rotation.x, rotation.y, 0]}>
            <EarthSphere
              radius={globeRadius}
              onTextureSourceChange={setTextureSource}
            />

            {/* Two half-metre debug spheres — one red at the north pole, one
                green on the prime meridian — used to check the orientation
                maths and never removed. They are the brightest objects on the
                globe. */}

            {displayMarkers.map((marker) => (
              <GlobeMarker
                key={marker.id}
                marker={marker}
                globeRadius={globeRadius}
                onClick={(e) => handleMarkerClick(marker, e)}
              />
            ))}

            {routes.map((route) => (
              <GlobeRoute
                key={route.id}
                route={route}
                globeRadius={globeRadius}
              />
            ))}

            {/* No traffic here: GlobeTraffic drew ten hardcoded "congestion"
                dots over US cities — not data. Live traffic is a street-map
                layer. */}
          </group>

          <Stars
            radius={100}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />

          <OrbitControls
            ref={controlsRef}
            // NO PAN. On a touch screen a two-finger pinch is also a pan, so
            // every zoom dragged the globe off-centre until it left the screen
            // — the "can't zoom or navigate on mobile" report. Rotate + zoom
            // around the middle is all a globe needs.
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI * 0.75}
  minDistance={globeRadius + 0.5}
  // Fix potential maxDistance typo – ensure the max distance is larger than minDistance
  // (previously maxDistance was set to globeRadius + 30 which may be too low)
  // We'll bump it to globeRadius + 200 for smoother zoom out.
  maxDistance={globeRadius + 200}
            rotateSpeed={-0.5}
            zoomSpeed={0.6}
            panSpeed={0.5}
            onStart={() => setIsDragging(true)}
            onEnd={() => setIsDragging(false)}
            onChange={onControlsChange}
          />
      </Canvas>
      )}

      {/* Its own Reset button is gone — every control lives on the map's
          one rail now (owner, 2026-10-06). */}

      {/* Credit follows the imagery ACTUALLY on the sphere. Both providers
          require attribution, and crediting the one that failed is worse than
          crediting nobody — it tells the reader the picture came from a source
          it did not come from. */}
      {(textureSource === 'nasa' || textureSource === 'esri') && (
        <div
          className="absolute bottom-2 left-2 text-xs text-white/60 bg-black/40 px-2 py-1 rounded"
          style={{ maxWidth: '300px', fontSize: '9px' }}
        >
          {textureSource === 'nasa' ? GIBS_ATTRIBUTION : EARTH_ATTRIBUTION}
        </div>
      )}
    </div>
  );
}
