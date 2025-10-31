export const passthrough = {
  id: "passthrough",
  name: "Passthrough",
  order: -1,
  frag: `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 fragColor;

// Hard-coded values (previously uniforms with defaults)
const float SKIN_SMOOTH = 0.35;
const float BRIGHTNESS = 0.5;
const float SATURATION = 0.0;
const float SHARPNESS = 0.5;

// Luminance calculation
float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// Detect skin tones
float skinMask(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  
  // Skin tone detection
  float skinness = 0.0;
  if (r > 0.35 && g > 0.2 && b > 0.1) {
    float rg = r - g;
    float rb = r - b;
    if (rg > 0.0 && rg < 0.4 && rb > 0.0 && rb < 0.4) {
      skinness = smoothstep(0.0, 0.3, rg) * smoothstep(0.0, 0.3, rb);
    }
  }
  return skinness;
}

void main() {
  vec2 uv = vUV;
  vec2 texelSize = 1.0 / vec2(textureSize(uTex, 0));
  
  vec3 color = texture(uTex, uv).rgb;
  
  // Skin Smoothing
  vec3 smoothed = vec3(0.0);
  float totalWeight = 0.0;
  
  // 5x5 bilateral blur
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize * 2.0;
      vec3 sampleColor = texture(uTex, uv + offset).rgb;
      
      // Spatial weight
      float spatialWeight = exp(-float(x*x + y*y) / 8.0);
      
      // Range weight (preserve edges)
      float colorDiff = length(sampleColor - color);
      float rangeWeight = exp(-colorDiff * colorDiff / 0.02);
      
      float weight = spatialWeight * rangeWeight;
      smoothed += sampleColor * weight;
      totalWeight += weight;
    }
  }
  smoothed /= totalWeight;
  
  // Apply smoothing only to skin
  float skinAmount = skinMask(color);
  vec3 result = mix(color, smoothed, skinAmount * SKIN_SMOOTH);
  
  // Sharpening
  vec3 blurred = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize;
      blurred += texture(uTex, uv + offset).rgb;
    }
  }
  blurred /= 9.0;
  
  // Sharpen non-skin areas
  vec3 sharpened = result + (result - blurred) * SHARPNESS * (1.0 - skinAmount * 0.7);
  result = sharpened;
  
  // Brightness
  result = result * (1.0 + BRIGHTNESS * 0.3);
  
  // Saturation
  float l = luma(result);
  result = mix(vec3(l), result, 1.0 + SATURATION * 0.3);
  
  // Soft Contrast
  result = result * result * (3.0 - 2.0 * result);
  
  // Subtle vignette
  vec2 vigUV = uv * 2.0 - 1.0;
  float vignette = 1.0 - dot(vigUV, vigUV) * 0.15;
  result *= vignette;
  
  result = clamp(result, 0.0, 1.0);
  
  fragColor = vec4(result, 1.0);
}`,
};
