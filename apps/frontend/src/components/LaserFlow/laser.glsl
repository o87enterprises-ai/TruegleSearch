precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uSpeed;

varying vec2 vUv;

// Optimized hash function for noise generation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Smooth noise function
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Multi-octave noise for better detail
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for(int i = 0; i < 4; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// Laser beam generation with soft edges
float laserBeam(vec2 p, vec2 pos, float width, float intensity) {
  float dist = distance(p, pos);
  float beam = 1.0 - smoothstep(0.0, width, dist);
  beam *= intensity;
  
  // Add glow
  float glow = 1.0 - smoothstep(width, width * 3.0, dist);
  glow *= intensity * 0.3;
  
  return beam + glow;
}

// Animated laser flow pattern
float laserFlow(vec2 p, float time) {
  float flow = 0.0;
  
  // Primary laser - main flow
  vec2 primaryPos = vec2(
    sin(time * 0.7) * 0.6, 
    cos(time * 0.5) * 0.8
  );
  flow += laserBeam(p, primaryPos, 0.03, 1.0);
  
  // Secondary laser - counter flow
  vec2 secondaryPos = vec2(
    cos(time * 1.1) * 0.7, 
    sin(time * 0.8) * 0.5
  );
  flow += laserBeam(p, secondaryPos, 0.02, 0.7);
  
  // Tertiary laser - fast flow
  vec2 tertiaryPos = vec2(
    sin(time * 1.5) * 0.4, 
    cos(time * 1.3) * 0.6
  );
  flow += laserBeam(p, tertiaryPos, 0.015, 0.5);
  
  // Orbital laser - circular motion
  float orbitAngle = time * 0.3;
  vec2 orbitPos = vec2(cos(orbitAngle), sin(orbitAngle)) * 0.5;
  flow += laserBeam(p, orbitPos, 0.025, 0.8);
  
  return flow;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;
  
  // Time-based animation
  float time = uTime * uSpeed;
  
  // Generate laser flow pattern
  float lasers = laserFlow(p, time);
  
  // Add flow field distortion
  vec2 flowField = vec2(
    fbm(p + time * 0.1),
    fbm(p - time * 0.15)
  ) * 0.2;
  
  p += flowField;
  
  // Add noise texture
  float noiseTexture = fbm(p * 2.0 + time * 0.2);
  lasers *= (1.0 + noiseTexture * 0.3);
  
  // Calculate final color
  float intensity = lasers * uIntensity;
  vec3 color = uColor * intensity;
  
  // Add chromatic aberration for sci-fi effect
  float aberration = lasers * 0.1;
  color.r = mix(color.r, color.r * 1.2, aberration);
  color.b = mix(color.b, color.b * 0.8, aberration);
  
  // Add scanline effect
  float scanline = sin(vUv.y * uResolution.y * 2.0 + time * 10.0) * 0.5 + 0.5;
  color *= 0.9 + scanline * 0.1;
  
  // Vignette effect
  float vignette = 1.0 - smoothstep(0.8, 1.5, length(vUv - 0.5));
  color *= vignette;
  
  // Output with premultiplied alpha
  gl_FragColor = vec4(color, intensity);
}