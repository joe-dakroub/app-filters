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
${glsl.noise}
${glsl.sobel}

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
