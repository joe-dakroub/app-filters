import { glsl } from "./utils.js";

export const sketch = {
  id: "sketch",
  name: "Sketch",
  order: 6,
  frag: `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uStrokeWeight;
uniform float uMaskThreshold;
uniform vec3 uOutlineColor;
uniform vec3 uBackgroundColor;
uniform vec3 uPaperColor;

${glsl.luma}
${glsl.hash}
${glsl.rot}

void main() {
  vec2 uv = vUV;
  vec2 texelSize = 1.0 / vec2(textureSize(uTex, 0));
  
  vec3 col = texture(uTex, uv).rgb;
  float lumaVal = luma(col);
  
  float maskValue = smoothstep(uMaskThreshold, uMaskThreshold, lumaVal);
  
  float smoothedLuma = 0.0;
  float totalWeight = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize * 2.5;
      float weight = 1.0 - length(vec2(x, y)) / 2.0;
      smoothedLuma += luma(texture(uTex, uv + offset).rgb) * weight;
      totalWeight += weight;
    }
  }
  smoothedLuma /= totalWeight;
  
  float highFreqDetail = abs(lumaVal - smoothedLuma);
  
  // Enhanced skin detection
  float skinSmooth = smoothstep(0.01, 0.05, highFreqDetail);
  bool isSmoothSkin = highFreqDetail < 0.03 && lumaVal > 0.2 && lumaVal < 0.8;
  
  vec2 gradDir = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.785;
    vec2 dir = vec2(cos(angle), sin(angle));
    float samp = luma(texture(uTex, uv + dir * texelSize * 2.0).rgb);
    gradDir += dir * (samp - lumaVal);
  }
  float gradAngle = atan(gradDir.y, gradDir.x);
  float gradMag = length(gradDir);
  
  float edge = 0.0;
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.785;
    vec2 dir = vec2(cos(angle), sin(angle));
    float samp = luma(texture(uTex, uv + dir * texelSize * uStrokeWeight * 1.5).rgb);
    edge += abs(samp - lumaVal);
  }
  edge = smoothstep(0.15, 0.6, edge);
  edge *= (0.7 + gradMag * 2.5);
  
  float isTexture = smoothstep(0.02, 0.08, highFreqDetail);
  // Don't reduce edges on smooth skin - we want to preserve outlines
  edge *= (1.0 - isTexture * 0.8);
  
  // Fixed stroke angle and density
  const float STROKE_ANGLE = 2.3;
  const float DENSITY = 1.2;
  
  float strokeAngle = STROKE_ANGLE + gradAngle * 0.5;
  mat2 strokeRot = rot(strokeAngle);
  vec2 strokeUv = strokeRot * (uv - 0.5) + 0.5;
  
  float primaryFreq = DENSITY * 60.0;
  float primaryStroke = strokeUv.x * primaryFreq;
  float strokeId = floor(primaryStroke);
  
  float angleVariation = (hash(vec2(strokeId, 1.0)) - 0.5) * 0.25;
  float posJitter = (hash(vec2(strokeId, 2.0)) - 0.5) * 0.5;
  
  vec2 variedUv = rot(strokeAngle + angleVariation) * (uv - 0.5) + 0.5;
  
  float waviness = sin(variedUv.y * 15.0 + strokeId * 0.3) * 0.015;
  waviness += sin(variedUv.y * 8.0 + strokeId * 0.5) * 0.025;
  variedUv.x += waviness;
  
  float adjustedStroke = variedUv.x * primaryFreq + posJitter;
  float strokeFract = fract(adjustedStroke);
  
  float pressureVar = 0.3 + hash(vec2(strokeId, 3.0)) * 0.6;
  float alongY = variedUv.y * 12.0;
  float segmentId = floor(alongY);
  float hasBreak = step(0.88, hash(vec2(strokeId, segmentId + 4.0)));
  
  float strokeWidth = 0.35 + (1.0 - lumaVal) * 0.3;
  float stroke1 = 0.0;
  // Allow light strokes on smooth skin if there's an edge nearby
  bool allowStroke = !isSmoothSkin || gradMag > 0.15;
  if (lumaVal < 0.6 && allowStroke) {
    float intensity = isSmoothSkin ? 0.3 : 1.0; // Lighter on smooth skin
    stroke1 = smoothstep(strokeWidth, strokeWidth * 0.3, strokeFract) * pressureVar * (1.0 - hasBreak) * intensity;
  }
  
  float crossAngle = strokeAngle + 1.3 + gradAngle * 0.4;
  vec2 crossUv = rot(crossAngle) * (uv - 0.5) + 0.5;
  float crossFreq = primaryFreq * 0.9;
  
  float crossId = floor(crossUv.x * crossFreq);
  float crossAngleVar = (hash(vec2(crossId, 5.0)) - 0.5) * 0.3;
  vec2 crossVarUv = rot(crossAngle + crossAngleVar) * (uv - 0.5) + 0.5;
  
  float crossWave = sin(crossVarUv.y * 12.0 + crossId * 0.4) * 0.02;
  crossVarUv.x += crossWave;
  
  float crossStroke = fract(crossVarUv.x * crossFreq);
  float crossPressure = 0.3 + hash(vec2(crossId, 6.0)) * 0.5;
  float crossSegment = floor(crossVarUv.y * 10.0);
  float crossBreak = step(0.86, hash(vec2(crossId, crossSegment + 7.0)));
  
  float crossWidth = 0.4 + (1.0 - lumaVal) * 0.25;
  float stroke2 = 0.0;
  if (lumaVal < 0.35 && !isSmoothSkin) {
    stroke2 = smoothstep(crossWidth, crossWidth * 0.3, crossStroke) * crossPressure * (1.0 - crossBreak);
  }
  
  float diagonalAngle = strokeAngle - 0.6 + gradAngle * 0.3;
  vec2 diagUv = rot(diagonalAngle) * (uv - 0.5) + 0.5;
  float diagId = floor(diagUv.x * crossFreq * 0.85);
  vec2 diagVarUv = rot(diagonalAngle + (hash(vec2(diagId, 8.0)) - 0.5) * 0.25) * (uv - 0.5) + 0.5;
  diagVarUv.x += sin(diagVarUv.y * 10.0 + diagId * 0.6) * 0.018;
  
  float diagStroke = fract(diagVarUv.x * crossFreq * 0.85);
  float diagPressure = 0.25 + hash(vec2(diagId, 9.0)) * 0.45;
  float diagSegment = floor(diagVarUv.y * 9.0);
  float diagBreak = step(0.84, hash(vec2(diagId, diagSegment + 10.0)));
  
  float diagWidth = 0.45 + (1.0 - lumaVal) * 0.2;
  float stroke3 = 0.0;
  if (lumaVal < 0.25 && !isSmoothSkin) {
    stroke3 = smoothstep(diagWidth, diagWidth * 0.3, diagStroke) * diagPressure * (1.0 - diagBreak);
  }
  
  // Reduce smudge noise on smooth skin
  float smudgeNoise = 0.0;
  if (lumaVal < 0.12 && !isSmoothSkin) {
    smudgeNoise = hash(uv * 200.0) * 0.15;
  }
  
  // Significantly reduce grain noise on smooth skin
  float grainNoise = 0.0;
  if (lumaVal < 0.65 && !isSmoothSkin) {
    grainNoise = hash(uv * 400.0) * 0.05;
  }
  
  float shading = 1.0;
  
  float textureReduction = smoothstep(0.02, 0.12, highFreqDetail);
  
  float edgeRegion = 0.0;
  float edgeRadius = 8.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      if (x == 0 && y == 0) continue;
      vec2 offset = vec2(float(x), float(y)) * texelSize * edgeRadius;
      float sampLuma = luma(texture(uTex, uv + offset).rgb);
      float sampGrad = 0.0;
      for (int i = 0; i < 4; i++) {
        float angle = float(i) * 1.57;
        vec2 dir = vec2(cos(angle), sin(angle));
        float s = luma(texture(uTex, uv + offset + dir * texelSize * 2.0).rgb);
        sampGrad += abs(s - sampLuma);
      }
      if (sampGrad > 0.3) {
        edgeRegion = 1.0;
      }
    }
  }
  
  // Smooth skin gets very light shading, but respect edges
  if (isSmoothSkin && gradMag < 0.15) {
    shading = 0.95 + lumaVal * 0.05;
  } else if (lumaVal < 0.08) {
    if (isTexture > 0.5) {
      shading = 1.0 - max(stroke1 * 0.4, stroke2 * 0.3);
    } else {
      shading = 1.0 - min(1.0, max(stroke1, max(stroke2, stroke3)) + smudgeNoise);
    }
  } else if (lumaVal < 0.15) {
    shading = 1.0 - max(stroke1, max(stroke2 * 0.85, stroke3 * 0.75));
    shading = mix(shading, 1.0, textureReduction * 0.75);
  } else if (lumaVal < 0.28) {
    shading = 1.0 - max(stroke1, stroke2 * 0.7);
    shading = mix(shading, 1.0, textureReduction * 0.7);
  } else if (lumaVal < 0.4) {
    shading = 1.0 - stroke1 * 0.75;
    shading = mix(shading, 1.0, textureReduction * 0.65);
  } else if (lumaVal < 0.55) {
    shading = 1.0 - stroke1 * 0.25;
    shading = mix(shading, 1.0, textureReduction * 0.5);
  }
  
  if (edgeRegion > 0.5 && lumaVal > 0.3) {
    shading = mix(shading, 1.0, 0.85);
  }
  
  // Only apply grain to non-smooth areas
  if (lumaVal < 0.65 && grainNoise > 0.0 && !isSmoothSkin) {
    float grainAmount = smoothstep(0.65, 0.3, lumaVal);
    shading = mix(shading, shading - grainNoise, grainAmount * 0.15);
  }
  
  float edgeShadow = 0.0;
  if (edge > 0.1) {
    for (int i = 0; i < 4; i++) {
      float angle = float(i) * 1.57;
      vec2 dir = vec2(cos(angle), sin(angle));
      float sampLuma = luma(texture(uTex, uv + dir * texelSize * 3.0).rgb);
      if (sampLuma > lumaVal) {
        edgeShadow += 0.3;
      }
    }
    edgeShadow = min(1.0, edgeShadow);
  }
  
  // Stronger edge shadow to preserve outlines
  shading = shading * (1.0 - edgeShadow * 2.2);
  
  // Emphasize edges more and clamp to 0-1 range
  float sketch = clamp(min(1.0 - edge * 1.1, shading), 0.0, 1.0);
  
  // Two color system:
  // - Outline color: sketch lines/edges
  // - Paper color: light/background areas
  
  // Edge represents the sketch lines
  float edgeAmount = edge * 1.1;
  
  // Mix outline and paper based on sketch brightness
  vec3 final = mix(uOutlineColor, uPaperColor, sketch);
  
  // Always use luminance mask for alpha
  float alpha = maskValue;
  if (maskValue > 0.01 && maskValue < 0.99) {
    float edgeFade = smoothstep(0.2, 0.8, maskValue);
    alpha = mix(0.0, 1.0, edgeFade);
  }
  
  // Blend with background color based on alpha (for transparent areas)
  final = mix(uBackgroundColor, final, alpha);
  
  fragColor = vec4(final, 1.0);
}`,
  uniforms: [
    {
      name: "StrokeWeight",
      display: "Stroke Weight",
      type: "float",
      min: 0.5,
      max: 2.0,
      step: 0.1,
      default: 0.5,
    },
    {
      name: "MaskThreshold",
      display: "Mask Brightness Cutoff",
      type: "float",
      min: 0.0,
      max: 1.0,
      step: 0.01,
      default: 0.4,
    },
    {
      name: "OutlineColor",
      display: "Outline",
      type: "color",
      default: "#000000",
    },
    {
      name: "BackgroundColor",
      display: "Shadow",
      type: "color",
      default: "#444444",
    },
    {
      name: "PaperColor",
      display: "Paper",
      type: "color",
      default: "#fefefe",
    },
  ],
};
