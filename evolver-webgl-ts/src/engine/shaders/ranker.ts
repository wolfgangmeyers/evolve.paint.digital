export function vert(): string {
    return `
    
    // an attribute will receive data from a buffer
    attribute vec4 a_position;

    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;
   
    // all shaders have a main function
    void main() {
   
      // gl_Position is a special variable a vertex shader
      // is responsible for setting
      gl_Position = a_position;
      // pass the texCoord to the fragment shader
      // The GPU will interpolate this value between points
      v_texCoord = a_texCoord;
    }
    `;
}

export function frag(): string {
    return `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision highp float;

    // textures to compare
    uniform sampler2D u_rendered;
    uniform sampler2D u_src;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;
   
    void main() {
      vec4 input1 = texture2D(u_src, v_texCoord);
      vec4 input2 = texture2D(u_rendered, v_texCoord);
      // Less than 100% opacity means the pixel is not covered by the
      // painting, and should be considered 100% different.
      if (input2.a < 0.9) {
        gl_FragColor = vec4(1., 1., 1., 1.);
      } else {
        vec4 diff = input1 - input2;
        vec4 diffSq = diff * diff;
        //vec4 diffSq = vec4(diff.r * diff.r, diff.g * diff.g, diff.b * diff.b, 0.);
        float result = sqrt(diffSq.r + diffSq.g + diffSq.b);
        if (result > 1.) {
            result = 1.;
        }
        if (result < 0.) {
            result = 0.;
        }
        gl_FragColor = vec4(result, result, result, 1.);
      }
    }`;
}
