struct Uniforms {
  uColor : vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex
fn mainVertex(@location(0) aPosition : vec2<f32>, @location(1) aUV : vec2<f32>) -> @builtin(position) vec4<f32> {
    return vec4<f32>(aPosition, 0.0, 1.0);
}

@fragment
fn mainFragment() -> @location(0) vec4<f32> {
    // Debug: Force Green
    return vec4<f32>(0.0, 1.0, 0.0, 1.0);
    // return uniforms.uColor;
}