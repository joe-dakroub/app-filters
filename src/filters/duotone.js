import { glsl } from "./utils.js";

export const duotone = {
  id: "duotone",
  name: "Duotone",
  order: 2,
  frag: `#version 300 es
precision highp float;
out vec4 o;
in vec2 vUV;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uContrast;
uniform float uGamma;

${glsl.luma}

void main() {
  vec3 c = texture(uTex, vUV).rgb;
  c = pow(c, vec3(uGamma));
  
  float l = luma(c);
  l = clamp((l - 0.5) * max(uContrast, 0.0) + 0.5, 0.0, 1.0);
  vec3 mixc = mix(uColorA, uColorB, smoothstep(0.0, 1.0, l));
  
  o = vec4(mixc, 1.0);
}`,
  uniforms: [
    {
      name: "Contrast",
      display: "Contrast",
      type: "float",
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.75,
    },
    {
      name: "Gamma",
      display: "Gamma",
      type: "float",
      min: 0.5,
      max: 2,
      step: 0.01,
      default: 0.75,
    },
    {
      name: "ColorA",
      display: "Shadow",
      type: "color",
      default: "#0D0D0D",
    },
    {
      name: "ColorB",
      display: "Highlight",
      type: "color",
      default: "#00a3d7",
    },
  ],
};
