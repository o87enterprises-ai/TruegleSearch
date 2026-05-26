import { useMemo } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export function GlobeTraffic({ globeRadius = 5 }) {
  const trafficPoints = useMemo(() => {
    const points = [];
    const regions = [
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

    regions.forEach(region => {
      const phi = (90 - region.lat) * (Math.PI / 180);
      const theta = (region.lng + 180) * (Math.PI / 180);
      
      const x = -globeRadius * Math.sin(phi) * Math.cos(theta);
      const y = globeRadius * Math.cos(phi);
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);
      
      const color = getTrafficColor(region.congestion);
      
      points.push({
        position: new THREE.Vector3(x, y, z),
        color,
        congestion: region.congestion,
      });
    });

    return points;
  }, [globeRadius]);

  return (
    <group>
      {trafficPoints.map((point, index) => (
        <mesh key={index} position={point.position}>
          <Sphere args={[0.03, 8, 8]} />
          <meshBasicMaterial color={point.color} />
        </mesh>
      ))}
    </group>
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
