import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMap } from './context/MapContext';
import { TRUEGLE_BRAND_COLORS } from './config/truegleTheme';
import { AZIMUTHAL_FLAT_CONFIG } from './config/constants';
import { latLonToAzimuthalXY } from './utils/azimuthalFlatHelpers';
import { getMarkerColor } from './utils/helpers';
import './styles/AzimuthalGlobe.css';

export default function AzimuthalFlat({
  center = { lat: 0, lng: 0 },
  zoom = 2,
  onMapClick = null,
  onMarkerClick = null,
  showTraffic = false,
  markers = [],
  routes = [],
  backgroundImage = null,
  showGraticule = true,
  userLocation = null,
}) {
  const { state, actions } = useMap();
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const [scale, setScale] = useState(zoom || 2);
  const [azimuthalCenter, setAzimuthalCenter] = useState(state.azimuthalFlatCenter || center || { lat: 39.8283, lng: -98.5795 });
  const [zoomPoint, setZoomPoint] = useState(() => {
    if (userLocation) return userLocation;
    return state.azimuthalFlatCenter || center || { lat: 39.8283, lng: -98.5795 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePositionRef = useRef({ x: 0, y: 0 });
  
  const baseRadius = AZIMUTHAL_FLAT_CONFIG.defaultRadius;
  const scaledRadius = baseRadius * scale;
  const svgWidth = scaledRadius * 2 + 50;
  const svgHeight = scaledRadius * 2 + 50;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;

  const graticuleLines = useMemo(() => {
    if (!showGraticule) return [];
    
    const lines = [];
    const step = 30;
    
    for (let lat = -90; lat <= 90; lat += step) {
      const projected = latLonToAzimuthalXY(lat, 0, azimuthalCenter.lat, azimuthalCenter.lng, scaledRadius);
      if (projected && Math.sqrt(projected.x * projected.x + projected.y * projected.y) <= scaledRadius) {
        lines.push({ x1: projected.x, y1: projected.y, x2: 0, y2: 0, type: 'latitude', value: lat });
      }
    }
    
    for (let lng = -180; lng <= 180; lng += step) {
      const projected = latLonToAzimuthalXY(0, lng, azimuthalCenter.lat, azimuthalCenter.lng, scaledRadius);
      if (projected && Math.sqrt(projected.x * projected.x + projected.y * projected.y) <= scaledRadius) {
        lines.push({ x1: projected.x, y1: projected.y, x2: 0, y2: 0, type: 'longitude', value: lng });
      }
    }
    
    return lines;
  }, [showGraticule, azimuthalCenter, scaledRadius]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const rect = containerRef.current.getBoundingClientRect();
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;
    const mouseX = e.clientX - rect.left - containerCenterX;
    const mouseY = e.clientY - rect.top - containerCenterY;
    
    const oldScale = scale;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(AZIMUTHAL_FLAT_CONFIG.minZoom, Math.min(AZIMUTHAL_FLAT_CONFIG.maxZoom, scale * delta));
    
    const clickLat = azimuthalCenter.lat + (mouseY / scaledRadius) * (180 / scale);
    const clickLng = azimuthalCenter.lng - (mouseX / scaledRadius) * (180 / scale);
    
    setScale(newScale);
    
    if (newScale > oldScale) {
      setAzimuthalCenter({ lat: clickLat, lng: clickLng });
    }
  }, [scale, scaledRadius, azimuthalCenter]);

  const handleMouseDown = useCallback((e) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const radiusDegrees = 180 / scale;
    const newLat = Math.max(-90, Math.min(90, azimuthalCenter.lat + (dy / scaledRadius) * radiusDegrees));
    const newLng = ((azimuthalCenter.lng - (dx / scaledRadius) * radiusDegrees + 180) % 360) - 180;
    
    setAzimuthalCenter({ lat: newLat, lng: newLng });
    setZoomPoint({ lat: newLat, lng: newLng });
    
    lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [azimuthalCenter, scale, scaledRadius]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMapClick = useCallback((e) => {
    if (isDragging) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    
    const distance = Math.sqrt(x * x + y * y);
    
    if (distance > scaledRadius && onMapClick) {
      onMapClick({ lat: null, lng: null });
      return;
    }
    
    const clickLat = azimuthalCenter.lat + (y / scaledRadius) * (180 / scale);
    const clickLng = azimuthalCenter.lng - (x / scaledRadius) * (180 / scale);
    
    setZoomPoint({ lat: clickLat, lng: clickLng });
    
    if (onMapClick) {
      onMapClick({ lat: clickLat, lng: clickLng });
    }
  }, [isDragging, azimuthalCenter, scaledRadius, scale, onMapClick]);

  const handleMarkerClick = useCallback((marker, e) => {
    e.stopPropagation();
    
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
    
    actions.setSelectedMarker(marker);
  }, [actions, onMarkerClick]);

  const handleResetView = useCallback(() => {
    setScale(2);
    setAzimuthalCenter(center);
    actions.setAzimuthalFlatZoom(2);
    actions.setAzimuthalFlatCenter(center);
  }, [center, actions]);

  useEffect(() => {
    actions.setAzimuthalFlatZoom(scale);
    
    if (scale >= AZIMUTHAL_FLAT_CONFIG.transitionToMapZoom) {
      actions.setMapViewMode('standard');
      actions.setCenter(azimuthalCenter);
      actions.setZoom(4);
    }
  }, [actions, scale, azimuthalCenter]);

  useEffect(() => {
    actions.setAzimuthalFlatCenter(azimuthalCenter);
  }, [actions, azimuthalCenter]);

  useEffect(() => {
    if (state.azimuthalFlatCenter && !zoomPoint) {
      setZoomPoint(state.azimuthalFlatCenter);
    }
  }, [state.azimuthalFlatCenter, zoomPoint]);

  useEffect(() => {
    if (userLocation && !zoomPoint) {
      setZoomPoint(userLocation);
    }
  }, [userLocation, zoomPoint]);

  const projectedMarkers = useMemo(() => {
    return markers.map(marker => {
      const projected = latLonToAzimuthalXY(
        marker.lat, 
        marker.lng, 
        azimuthalCenter.lat, 
        azimuthalCenter.lng, 
        scaledRadius
      );
      return { ...marker, ...projected };
    }).filter(m => {
      const distance = Math.sqrt(m.x * m.x + m.y * m.y);
      return distance <= scaledRadius;
    });
  }, [markers, azimuthalCenter, scaledRadius]);

  const projectedRoutes = useMemo(() => {
    return routes.map(route => {
      if (!route.coordinates || route.coordinates.length < 2) {
        return null;
      }
      
      const points = route.coordinates.map(coord => {
        return latLonToAzimuthalXY(
          coord.lat,
          coord.lng,
          azimuthalCenter.lat,
          azimuthalCenter.lng,
          scaledRadius
        );
      }).filter(p => {
        const distance = Math.sqrt(p.x * p.x + p.y * p.y);
        return distance <= scaledRadius;
      });
      
      return { ...route, points };
    }).filter(Boolean);
  }, [routes, azimuthalCenter, scaledRadius]);

  return (
    <div 
      className="azimuthal-globe-container"
      style={{ width: '100%', height: '100%' }}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleMapClick}
    >
      <svg 
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%" 
        height="100%" 
        style={{ display: 'block' }}
      >
        <defs>
          <clipPath id="circle-clip">
            <circle
              cx={0}
              cy={0}
              r={scaledRadius}
            />
          </clipPath>
        </defs>
        <g 
          transform={`translate(${centerX}, ${centerY})`}
        >
          <circle
            cx={0}
            cy={0}
            r={scaledRadius}
            fill="#1a1a2e"
            stroke={TRUEGLE_BRAND_COLORS.blue}
            strokeWidth={2}
          />

          {backgroundImage && (
            <g clipPath="url(#circle-clip)">
              <image
                href={backgroundImage}
                x={-scaledRadius}
                y={-scaledRadius}
                width={scaledRadius * 2}
                height={scaledRadius * 2}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.7}
              />
            </g>
          )}

          {showGraticule && graticuleLines.map((line, index) => (
            <line
              key={`${line.type}-${line.value}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.type === 'latitude' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)'}
              strokeWidth={line.type === 'latitude' ? 1 : 0.5}
              strokeDasharray={line.type === 'equator' ? '0' : '2,2'}
            />
          ))}

          {projectedRoutes.map((route) => (
            <g key={route.id}>
              <polyline
                points={route.points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={route.color || TRUEGLE_BRAND_COLORS.blue}
                strokeWidth={2}
                strokeDasharray={route.dashed ? '5,5' : '0'}
              />
            </g>
          ))}

          {projectedMarkers.map((marker) => {
            const markerColor = getMarkerColor(marker.category || 'DEFAULT');
            
            return (
              <g 
                key={marker.id}
                transform={`translate(${marker.x}, ${marker.y})`}
                onClick={(e) => handleMarkerClick(marker, e)}
                style={{ cursor: 'pointer' }}
              >
                {marker.category === 'CURRENT_LOCATION' ? (
                  <>
                    <circle
                      r={8}
                      fill={TRUEGLE_BRAND_COLORS.blue}
                      fillOpacity={0.3}
                    />
                    <circle
                      r={5}
                      fill={TRUEGLE_BRAND_COLORS.blue}
                      fillOpacity={0.5}
                      stroke="white"
                      strokeWidth={1}
                    />
                    <circle
                      r={2}
                      fill={TRUEGLE_BRAND_COLORS.blue}
                    />
                  </>
                ) : (
                  <polygon
                    points="0,-10 -8,5 8,5"
                    fill={markerColor}
                    stroke="white"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}

          {showTraffic && (
            <TrafficLayer
              azimuthalCenter={azimuthalCenter}
              scaledRadius={scaledRadius}
            />
          )}
        </g>
       </svg>
 
      <div className="azimuthal-controls-bottom-left">
        <button
          onClick={handleResetView}
          className="azimuthal-control-btn"
          title="Reset View"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </button>
        <div className="azimuthal-zoom-indicator">
          {scale.toFixed(1)}x
        </div>
      </div>
    </div>
  );
}

function TrafficLayer({ azimuthalCenter, scaledRadius }) {
  const trafficPoints = [
    { lat: 40.7128, lng: -74.0060, congestion: 'heavy' },
    { lat: 34.0522, lng: -118.2437, congestion: 'moderate' },
    { lat: 41.8781, lng: -87.6298, congestion: 'heavy' },
    { lat: 29.7604, lng: -95.3698, congestion: 'moderate' },
    { lat: 33.4484, lng: -112.0740, congestion: 'low' },
    { lat: 32.7767, lng: -96.7970, congestion: 'heavy' },
    { lat: 37.7749, lng: -122.4194, congestion: 'severe' },
    { lat: 39.9526, lng: -75.1652, congestion: 'moderate' },
    { lat: 25.7617, lng: -80.1918, congestion: 'low' },
    { lat: 47.6062, lng: -122.3321, congestion: 'low' },
  ];

  return (
    <>
      {trafficPoints.map((point, index) => {
        const projected = latLonToAzimuthalXY(
          point.lat,
          point.lng,
          azimuthalCenter.lat,
          azimuthalCenter.lng,
          scaledRadius
        );
        
        const distance = Math.sqrt(projected.x * projected.x + projected.y * projected.y);
        if (distance > scaledRadius) return null;
        
        const color = getTrafficColor(point.congestion);
        
        return (
          <circle
            key={index}
            cx={projected.x}
            cy={projected.y}
            r={4}
            fill={color}
            opacity={0.8}
          />
        );
      })}
    </>
  );
}

function getTrafficColor(congestion) {
  switch (congestion) {
    case 'low':
      return '#39ff14';
    case 'moderate':
      return '#fcce00';
    case 'heavy':
      return '#ff0033';
    case 'severe':
      return '#ef0700';
    default:
      return '#888888';
  }
}
