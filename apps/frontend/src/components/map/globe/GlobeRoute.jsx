import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export function GlobeRoute({ route, globeRadius = 5 }) {
  const points = useMemo(() => {
    if (!route.coordinates || route.coordinates.length === 0) {
      return [];
    }

    return route.coordinates.map(coord => {
      const phi = (90 - coord.lat) * (Math.PI / 180);
      const theta = (coord.lng + 180) * (Math.PI / 180);
      
      const x = -globeRadius * Math.sin(phi) * Math.cos(theta);
      const y = globeRadius * Math.cos(phi);
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);
      
      return new THREE.Vector3(x, y, z);
    });
  }, [route.coordinates, globeRadius]);

  const routeColor = useMemo(() => {
    return route.color || '#00bcdd';
  }, [route.color]);

  if (points.length < 2) {
    return null;
  }

  return (
    <Line
      points={points}
      color={routeColor}
      lineWidth={2}
      dashed={route.dashed || false}
    />
  );
}
