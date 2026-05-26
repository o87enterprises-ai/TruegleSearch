import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { getMarkerColor } from '../utils/helpers';

export function GlobeMarker({ marker, globeRadius = 5, onClick }) {
  const meshRef = useRef();
  const hoverRef = useRef(false);
  
  const { position, quaternion } = useMemo(() => {
    const phi = (90 - marker.lat) * (Math.PI / 180);
    const theta = (marker.lng + 180) * (Math.PI / 180);
    
    const x = -globeRadius * Math.sin(phi) * Math.cos(theta);
    const y = globeRadius * Math.cos(phi);
    const z = globeRadius * Math.sin(phi) * Math.sin(theta);
    
    const normal = new THREE.Vector3(x, y, z).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    
    return { 
      position: [x, y, z], 
      quaternion 
    };
  }, [marker.lat, marker.lng, globeRadius]);

  const markerColor = useMemo(() => {
    return getMarkerColor(marker.category || 'DEFAULT');
  }, [marker.category]);

  useEffect(() => {
    console.log('🎯 GlobeMarker rendered:', {
      id: marker.id,
      name: marker.name,
      lat: marker.lat,
      lng: marker.lng,
      category: marker.category,
      color: markerColor,
      position
    });
  }, [marker, markerColor, position]);

  const handleClick = (e) => {
    e.stopPropagation();
    console.log('Marker clicked:', marker);
    if (onClick) {
      onClick(e);
    }
  };

  const handlePointerOver = () => {
    hoverRef.current = true;
    if (meshRef.current) {
      meshRef.current.scale.set(1.3, 1.3, 1.3);
    }
  };

  const handlePointerOut = () => {
    hoverRef.current = false;
    if (meshRef.current) {
      meshRef.current.scale.set(1, 1, 1);
    }
  };

  if (marker.category === 'CURRENT_LOCATION') {
    return (
      <group>
        <mesh
          ref={meshRef}
          position={position}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color="#3B82F6" />
        </mesh>
        <mesh position={position}>
          <sphereGeometry args={[0.25, 32, 32]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.3} />
        </mesh>
        <mesh position={position}>
          <sphereGeometry args={[0.4, 32, 32]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.1} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        quaternion={quaternion}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <coneGeometry args={[0.3, 1.0, 4]} />
        <meshStandardMaterial 
          color={markerColor} 
          emissive={markerColor} 
          emissiveIntensity={2.0} 
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={markerColor} />
      </mesh>
      <pointLight
        position={position}
        color={markerColor}
        intensity={0.5}
        distance={2}
      />
    </group>
  );
}
