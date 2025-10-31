// Shared GLSL utility functions for filters
export const glsl = {
  // Luminance/Luma calculation (converts RGB to grayscale)
  luma: `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}`,

  // Hash function for pseudo-random values
  hash: `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}`,

  // 2D hash to 2D
  hash12: `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`,

  // Contrast adjustment
  adjustContrast: `
vec3 adjustContrast(vec3 c, float k) {
  return clamp(0.5 + (c - 0.5) * k, 0.0, 1.0);
}`,

  // Alternative contrast function
  contrast: `
vec3 contrast(vec3 c, float k) {
  return pow(c, vec3(1.0 / k));
}`,

  // 2D rotation matrix
  rot: `
mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}`,

  // Noise
  noise: `
float organicNoise(vec2 uv) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  f = f * f * (3.0 - 2.0 * f); // Smoothstep
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
  `,

  // Sobel edge detection
  sobel: `
float sobelEdge(sampler2D tex, vec2 uv, vec2 pixelSize, float threshold) {
  float tl = luma(texture(tex, uv + vec2(-1.0, -1.0) * pixelSize).rgb);
  float t  = luma(texture(tex, uv + vec2( 0.0, -1.0) * pixelSize).rgb);
  float tr = luma(texture(tex, uv + vec2( 1.0, -1.0) * pixelSize).rgb);
  float l  = luma(texture(tex, uv + vec2(-1.0,  0.0) * pixelSize).rgb);
  float r  = luma(texture(tex, uv + vec2( 1.0,  0.0) * pixelSize).rgb);
  float bl = luma(texture(tex, uv + vec2(-1.0,  1.0) * pixelSize).rgb);
  float b  = luma(texture(tex, uv + vec2( 0.0,  1.0) * pixelSize).rgb);
  float br = luma(texture(tex, uv + vec2( 1.0,  1.0) * pixelSize).rgb);
  
  float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  
  return length(vec2(gx, gy));
}
  `,

  // Bayer matrix dithering (4x4)
  bayer4: `
float bayer4(vec2 p) {
  ivec2 ip = ivec2(mod(p, 4.0));
  int index = ip.y * 4 + ip.x;
  float bayerMatrix[16] = float[16](
    0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
    12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
    3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
    15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0
  );
  return bayerMatrix[index];
}`,

  skinMask: `
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
  `,
};
