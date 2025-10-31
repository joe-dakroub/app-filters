import { glsl } from "./utils.js";

export const ascii = {
  id: "ascii",
  name: "ASCII",
  order: 3,
  frag: `#version 300 es
precision highp float;
out vec4 o;
in vec2 vUV;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uCell;
uniform float uContrast;
uniform bool uInvert;
uniform vec3 uForeground;
uniform vec3 uBackground;

${glsl.luma}

const int GW = 5;
const int GH = 7;
const int GCOUNT = 12;

// Character Set: Blocks only
const int glyphs[GCOUNT * GH] = int[](
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  10, 0, 10, 0, 10, 0, 10,
  10, 0, 10, 0, 10, 0, 10,
  21, 10, 21, 10, 21, 10, 21,
  21, 10, 21, 10, 21, 10, 21,
  31, 21, 31, 21, 31, 21, 31,
  31, 21, 31, 21, 31, 21, 31,
  31, 31, 31, 31, 31, 31, 31,
  31, 31, 31, 31, 31, 31, 31,
  31, 31, 31, 31, 31, 31, 31
);

int glyphRow(int gi, int gy) {
  gi = clamp(gi, 0, GCOUNT - 1);
  gy = clamp(gy, 0, GH - 1);
  int idx = gi * GH + gy;
  return glyphs[idx];
}

float glyphSample(int gi, int gx, int gy) {
  gx = clamp(gx, 0, GW - 1);
  gy = clamp(gy, 0, GH - 1);
  int row = glyphRow(gi, gy);
  int bit = (row >> (GW - 1 - gx)) & 1;
  return float(bit);
}

void main() {
  float cellPx = max(uCell, 2.0);
  vec2 gridDim = uRes / cellPx;
  vec2 cellIndexF = floor(vUV * gridDim);
  vec2 cellUV = fract(vUV * gridDim);
  
  vec2 baseUV = (cellIndexF + 0.5) / gridDim;
  vec3 s0 = texture(uTex, baseUV).rgb;
  vec3 s1 = texture(uTex, baseUV + vec2(0.15 / gridDim.x, 0.0)).rgb;
  vec3 s2 = texture(uTex, baseUV + vec2(-0.15 / gridDim.x, 0.0)).rgb;
  vec3 s3 = texture(uTex, baseUV + vec2(0.0, 0.15 / gridDim.y)).rgb;
  vec3 avg = (s0 + s1 + s2 + s3) * 0.25;
  float lum = luma(avg);
  lum = pow(lum, 1.0 / max(uContrast, 0.0001));
  float t = uInvert ? 1.0 - lum : lum;
  int gi = clamp(int(floor(t * float(GCOUNT))), 0, GCOUNT - 1);
  
  int gx = int(floor(cellUV.x * float(GW)));
  int gy = int(floor(cellUV.y * float(GH)));
  float mask = glyphSample(gi, gx, gy);
  
  vec3 fg = uForeground;
  vec3 bg = uBackground;
  vec3 outc = mix(bg, fg, mask);
  
  o = vec4(outc, 1.0);
}`,
  uniforms: [
    {
      name: "Cell",
      display: "Cell Size",
      type: "float",
      min: 4,
      max: 128,
      step: 1,
      default: 16,
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
      name: "Invert",
      display: "Invert",
      type: "bool",
      default: false,
    },
    {
      name: "Foreground",
      display: "Foreground",
      type: "color",
      default: "#00FF88",
    },
    {
      name: "Background",
      display: "Background",
      type: "color",
      default: "#000000",
    },
  ],
};
