precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform vec3 uLightColor;
uniform float uIntensity;
uniform float uRotation;
uniform float uRefractiveIndex;

varying vec2 vUv;

// Ray marching constants optimized for performance
const MAX_STEPS = 60;
const MAX_DIST = 2.0;
const HIT_EPSILON = 0.001;
const STEP_MULTIPLIER = 0.8;

// Optimized 2D rotation
mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

// Optimized SDF for triangular prism
float prismSDF(vec2 p, float size) {
  p = abs(p);
  vec2 a = normalize(vec2(1.0, 1.732));
  float d1 = dot(p, a) - size;
  float d2 = p.x - size * 0.5;
  return max(d1, d2);
}

// Optimized refraction with dispersion
vec3 refractDispersion(vec3 viewDir, vec3 normal, float n1, vec3 n2) {
  float ratio = n1 / n2;
  float cosTheta1 = -dot(viewDir, normal);
  float sinTheta1Sq = 1.0 - cosTheta1 * cosTheta1;
  vec3 sinTheta2Sq = ratio * ratio * sinTheta1Sq;
  
  // Check for total internal reflection
  vec3 mask = vec3(lessThan(sinTheta2Sq, vec3(1.0)));
  
  vec3 cosTheta2 = sqrt(max(vec3(0.0), vec3(1.0) - sinTheta2Sq));
  vec3 refracted = ratio * viewDir + (ratio * cosTheta1 - cosTheta2) * normal;
  
  vec3 reflected = reflect(viewDir, normal);
  
  return mix(reflected, refracted, mask);
}

// Optimized normal calculation
vec2 getNormal(vec2 p, float size) {
  vec2 eps = vec2(0.0005, 0.0);
  float d = prismSDF(p, size);
  return normalize(vec2(
    d - prismSDF(p - eps.xy, size),
    d - prismSDF(p - eps.yx, size)
  ));
}

// Optimized ray marching
float rayMarch(vec2 ro, vec2 rd, float size, out vec2 hitPos, out vec2 hitNormal) {
  float t = 0.0;
  
  for(int i = 0; i < MAX_STEPS; i++) {
    vec2 pos = ro + rd * t;
    float d = prismSDF(pos, size);
    
    if(d < HIT_EPSILON) {
      hitPos = pos;
      hitNormal = getNormal(pos, size);
      return t;
    }
    
    if(t > MAX_DIST) break;
    t += d * STEP_MULTIPLIER;
  }
  
  return -1.0;
}

// Optimized caustic pattern
float causticPattern(vec2 p, float time) {
  vec2 rotated = rotate2D(time * 0.3) * p;
  
  float caustic = 0.0;
  const float lines = 5.0;
  
  for(float i = 0.0; i < lines; i++) {
    float angle = (i / lines) * 6.28318;
    vec2 lineDir = vec2(cos(angle), sin(angle));
    float lineDist = abs(dot(rotated, lineDir));
    
    float intensity = exp(-lineDist * 15.0) * sin(lineDist * 80.0 - time * 1.5);
    caustic += max(0.0, intensity);
  }
  
  return caustic * 0.8;
}

// Fresnel calculation for realistic glass
float fresnel(float cosTheta, float n1, float n2) {
  float r0 = pow((n1 - n2) / (n1 + n2), 2.0);
  return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;
  
  // Apply rotation
  p = rotate2D(uRotation + uTime * 0.1) * p;
  
  vec3 col = vec3(0.0);
  float prismSize = 0.25;
  
  // Setup camera rays
  vec2 ro = vec2(0.0, -1.2);
  vec2 rd = normalize(p - ro);
  
  // Ray march to find prism
  vec2 hitPos, hitNormal;
  float t = rayMarch(ro, rd, prismSize, hitPos, hitNormal);
  
  if(t > 0.0) {
    // Calculate lighting
    vec3 viewDir = normalize(vec3(rd, 0.0));
    vec3 normal = normalize(vec3(hitNormal, 0.0));
    
    // Fresnel effect
    float f = fresnel(-dot(viewDir, normal), 1.0, uRefractiveIndex);
    
    // Dispersion factors for RGB
    vec3 dispersion = vec3(0.98, 1.0, 1.02);
    vec3 n2 = uRefractiveIndex * dispersion;
    
    // Calculate refracted colors with dispersion
    vec3 refracted = refractDispersion(viewDir, normal, 1.0, n2);
    
    // Base glass material
    vec3 materialColor = uColor * 0.1; // Mostly transparent
    
    // Surface reflection
    vec3 reflection = reflect(viewDir, normal);
    vec3 surfaceColor = mix(materialColor, uLightColor, f);
    
    // Add caustic effects
    float caustic = causticPattern(hitPos * 2.0, uTime);
    surfaceColor += uLightColor * caustic * 0.4;
    
    // Dispersion coloring
    vec3 dispersedColor = surfaceColor;
    dispersedColor.r *= (1.0 + refracted.r * 0.2);
    dispersedColor.g *= (1.0 + refracted.g * 0.1);
    dispersedColor.b *= (1.0 + refracted.b * 0.15);
    
    col = dispersedColor;
    
    // Edge glow
    float edge = 1.0 - smoothstep(0.0, 0.02, prismSDF(hitPos, prismSize));
    col += uLightColor * edge * 0.6;
    
    // Add inner glow
    float innerGlow = causticPattern(hitPos * 3.0, uTime * 1.5);
    col += uLightColor * innerGlow * 0.2;
    
  } else {
    // Background with subtle effects
    float bgGradient = 1.0 - length(p) * 0.4;
    col = uColor * bgGradient * 0.05;
    
    // Ambient light rays
    float ambientRays = causticPattern(p * 0.3, uTime * 0.2);
    col += uLightColor * ambientRays * 0.03;
  }
  
  // Apply intensity
  col *= uIntensity;
  
  // Vignette for cinematic effect
  vec2 center = vUv - 0.5;
  float vignette = 1.0 - smoothstep(0.7, 1.4, length(center));
  col *= vignette;
  
  // Subtle color grading
  col = mix(col, col * vec3(1.1, 0.95, 1.05), 0.1);
  
  gl_FragColor = vec4(col, 1.0);
}