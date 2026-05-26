export function latLonToAzimuthalXY(lat, lon, centerLat, centerLon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  const phiCenter = (90 - centerLat) * (Math.PI / 180);
  const thetaCenter = (centerLon + 180) * (Math.PI / 180);
  
  const d = Math.acos(
    Math.sin(phiCenter) * Math.sin(phi) +
    Math.cos(phiCenter) * Math.cos(phi) * Math.cos(theta - thetaCenter)
  );
  
  if (d === 0) {
    return { x: 0, y: 0 };
  }
  
  const k = d / Math.sin(d);
  
  const x = radius * k * Math.cos(phi) * Math.sin(theta - thetaCenter);
  const y = radius * k * (Math.cos(phiCenter) * Math.sin(phi) - Math.sin(phiCenter) * Math.cos(phi) * Math.cos(theta - thetaCenter));
  
  return { x, y };
}

export function azimuthalXYToLatLon(x, y, centerLat, centerLon, radius) {
  const phiCenter = (90 - centerLat) * (Math.PI / 180);
  const thetaCenter = (centerLon + 180) * (Math.PI / 180);
  
  const rho = Math.sqrt(x * x + y * y);
  const d = rho / radius;
  
  if (Math.abs(d) > Math.PI) {
    return null;
  }
  
  const phi = Math.asin(Math.cos(d) * Math.sin(phiCenter) + (y * Math.sin(d) * Math.cos(phiCenter)) / rho);
  const theta = thetaCenter + Math.atan2(x * Math.sin(d), rho * Math.cos(phiCenter) * Math.cos(d) - y * Math.sin(phiCenter) * Math.sin(d));
  
  const lat = 90 - (phi * 180 / Math.PI);
  const lon = ((theta * 180 / Math.PI) - 180) % 360 + 180;
  
  return { lat, lng: lon };
}

export function calculateGreatCirclePathFlat(startLat, startLon, endLat, endLon, centerLat, centerLon, segments = 100, radius = 250) {
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
  
  const dotProduct = x1 * x2 + y1 * y2 + z1 * z2;
  const crossX = y1 * z2 - z1 * y2;
  const crossY = z1 * x2 - x1 * z2;
  const crossZ = x1 * y2 - y1 * x2;
  const crossMagnitude = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  
  const angle = Math.atan2(crossMagnitude, dotProduct);
  
  const axisX = crossX / crossMagnitude;
  const axisY = crossY / crossMagnitude;
  const axisZ = crossZ / crossMagnitude;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const interpolatedAngle = angle * t;
    
    const cosAngle = Math.cos(interpolatedAngle);
    const sinAngle = Math.sin(interpolatedAngle);
    
    const rx = cosAngle * x1 + sinAngle * (axisY * z1 - axisZ * y1);
    const ry = cosAngle * y1 + sinAngle * (axisZ * x1 - axisX * z1);
    const rz = cosAngle * z1 + sinAngle * (axisX * y1 - axisY * x1);
    
    const phi = Math.acos(ry / radius);
    const theta = Math.atan2(rz, -rx);
    
    const lat = 90 - (phi * 180 / Math.PI);
    const lon = ((theta * 180 / Math.PI) + 180) % 360 - 180;
    
    const projected = latLonToAzimuthalXY(lat, lon, centerLat, centerLon, radius);
    if (projected) {
      path.push(projected);
    }
  }
  
  return path;
}
