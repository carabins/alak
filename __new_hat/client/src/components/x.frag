#version 300 es
precision mediump float;

uniform XBtnUniforms {
  vec4 uColor;
};

in vec2 vUvs;
out vec4 fragColor;

void main() {
    fragColor = uColor;
}