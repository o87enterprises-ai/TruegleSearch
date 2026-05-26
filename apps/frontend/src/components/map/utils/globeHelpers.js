import * as THREE from 'three';

export function latLonToVector3(lat, lon, radius = 5) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

export function vector3ToLatLon(vector, radius = 5) {
  const { x, y, z } = vector;
  
  const lat = 90 - (Math.acos(y / radius) * 180 / Math.PI);
  const lon = ((Math.atan2(z, x) * 180 / Math.PI) + 180) % 360 - 180;
  
  return { lat, lng: lon };
}

export function calculateGreatCirclePath(startLat, startLon, endLat, endLon, segments = 100, radius = 5) {
  const path = [];
  
  const phi1 = (90 - startLat) * (Math.PI / 180);
  const theta1 = (startLon + 180) * (Math.PI / 180);
  const phi2 = (90 - endLat) * (Math.PI / 180);
  const theta2 = (endLon + 180) * (Math.PI / 180);
  
  const x1 = radius * Math.sin(phi1) * Math.cos(theta1);
  const y1 = radius * Math.cos(phi1);
  const z1 = radius * Math.sin(phi1) * Math.sin(theta1);
  
  const x2 = radius * Math.sin(phi2) * Math.cos(theta2);
  const y2 = radius * Math.cos(phi2);
  const z2 = radius * Math.sin(phi2) * Math.sin(theta2);
  
  const v1 = new THREE.Vector3(x1, y1, z1);
  const v2 = new THREE.Vector3(x2, y2, z2);
  
  const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const angle = v1.angleTo(v2);
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const interpolatedAngle = angle * t;
    
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationAxis(axis, interpolatedAngle);
    
    const rotatedVector = v1.clone().applyMatrix4(rotationMatrix);
    path.push(rotatedVector);
  }
  
  return path;
}

export function getDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
