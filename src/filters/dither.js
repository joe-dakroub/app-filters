import { glsl } from "./utils.js";

export const dither = {
  id: "dither",
  name: "Dither",
  order: 5,
  frag: `#version 300 es
precision highp float;
out vec4 o;
in vec2 vUV;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uThreshold;
uniform float uContrast;
uniform float uDitherAmt;
uniform float uPixelSize;
uniform float uDitherType;
uniform vec3 uForeground;
uniform vec3 uBackground;

${glsl.luma}
${glsl.adjustContrast}
${glsl.hash12}
${glsl.hash}

// Interleaved gradient noise for Atkinson approximation
float interleavedGradient(vec2 pos) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(pos, magic.xy)));
}

// Atkinson dithering approximation
// True Atkinson requires error diffusion multi-pass, this simulates the effect
float atkinsonDither(vec2 uv, float value, float threshold) {
  vec2 coord = uv * uRes;
  
  // Use interleaved gradient for base noise
  float noise = interleavedGradient(coord);
  
  // Sample neighboring pixels to simulate error diffusion pattern
  vec2 px = 1.0 / uRes;
  float right = luma(texture(uTex, uv + vec2(px.x, 0.0)).rgb);
  float downRight = luma(texture(uTex, uv + vec2(px.x, px.y)).rgb);
  float down = luma(texture(uTex, uv + vec2(0.0, px.y)).rgb);
  float downLeft = luma(texture(uTex, uv + vec2(-px.x, px.y)).rgb);
  
  // Atkinson spreads error to 6 pixels with 1/8 each (instead of Floyd-Steinberg's full diffusion)
  float localVariation = (right + downRight + down + downLeft) / 4.0;
  float error = (value - localVariation) * 0.75; // Atkinson uses less error propagation
  
  return noise + error * 0.3;
}

void main() {
  vec2 uv = vUV;
  
  // Pixelation
  vec2 px = 1.0 / uRes;
  vec2 block = px * max(1.0, uPixelSize);
  vec2 grid = floor(uv / block) * block + block * 0.5;
  vec2 suv = clamp(grid, 0.0, 1.0);
  
  vec3 c = texture(uTex, suv).rgb;
  c = adjustContrast(c, uContrast);
  float Y = luma(c);
  
  // Dither term based on algorithm type
  float d = 0.0;
  if (uDitherAmt > 0.0) {
    int ditherType = int(uDitherType + 0.5);
    
    if (ditherType == 0) {
      // Random
      d = (hash12(uv * uRes + fract(uTime * 0.1)) - 0.5) * uDitherAmt;
    } else if (ditherType == 1) {
      // Atkinson
      float atkinson = atkinsonDither(suv, Y, uThreshold);
      d = (atkinson - 0.5) * uDitherAmt;
    }
  }
  
  // Single-bit quantization
  float bw = step(uThreshold + d, Y);
  vec3 finalColor = mix(uBackground, uForeground, bw);
  
  o = vec4(finalColor, 1.0);
}`,
  uniforms: [
    {
      name: "DitherType",
      display: "Dither Type",
      type: "float",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: ["Random", "Atkinson"],
    },
    {
      name: "Threshold",
      display: "Threshold",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
    },
    {
      name: "Contrast",
      display: "Contrast",
      type: "float",
      min: 0.5,
      max: 2.5,
      step: 0.01,
      default: 1.2,
    },
    {
      name: "DitherAmt",
      display: "Dither Amount",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.45,
    },
    {
      name: "PixelSize",
      display: "Pixel Size",
      type: "float",
      min: 1,
      max: 128,
      step: 1,
      default: 1,
    },
    {
      name: "Foreground",
      display: "Foreground",
      type: "color",
      default: "#ffffff",
    },
    {
      name: "Background",
      display: "Background",
      type: "color",
      default: "#000000",
    },
  ],
};
