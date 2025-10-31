import { glsl } from "./utils.js";

export const linocut = {
  id: "linocut",
  name: "Linocut",
  order: 1,
  frag: `#version 300 es
precision highp float;
out vec4 o;
in vec2 vUV;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uThreshold;
uniform vec3 uInkColor;
uniform vec3 uPaper;

${glsl.luma}
${glsl.hash}

// Noise function
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

// Sobel edge detection
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

void main() {
  vec2 uv = vUV;
  vec2 pixelSize = 1.0 / uRes;
  
  // Sample the image
  vec3 col = texture(uTex, uv).rgb;
  float brightness = luma(col);
  
  // Edge detection for detail preservation
  float edge = sobelEdge(uTex, uv, pixelSize, uThreshold);
  
  // Hard threshold with slight edge influence for detail
  float cutValue = step(uThreshold, brightness + edge * 0.1);
  
  // Pure high-contrast output
  vec3 finalCol = mix(uInkColor, uPaper, cutValue);
  
  o = vec4(finalCol, 1.0);
}`,
  uniforms: [
    {
      name: "Threshold",
      display: "Cut Threshold",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
    },
    {
      name: "InkColor",
      display: "Ink",
      type: "color",
      default: "#0B0B0B",
    },
    {
      name: "Paper",
      display: "Paper",
      type: "color",
      default: "#F3E9DA",
    },
  ],
};
