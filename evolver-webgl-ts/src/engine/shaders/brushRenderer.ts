export function vert(): string {
    return `
    // an attribute will receive data from a buffer
    attribute vec2 a_position;
    attribute vec4 a_color;
    attribute vec2 a_brushTexcoord;

    uniform vec2 u_resolution;
    varying vec4 v_color;
    varying vec2 v_brushTexcoord;
   
    // all shaders have a main function
    void main() {
        // convert the position from pixels to 0.0 to 1.0
        vec2 zeroToOne = a_position / u_resolution;
     
        // convert from 0->1 to 0->2
        vec2 zeroToTwo = zeroToOne * 2.0;
     
        // convert from 0->2 to -1->+1 (clipspace)
        vec2 clipSpace = zeroToTwo - 1.0;
     
        gl_Position = vec4(clipSpace, 0, 1);
        v_color = a_color;
        v_brushTexcoord = a_brushTexcoord;
    }`;
}

export function frag(): string {
    return `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision mediump float;

    varying vec4 v_color;
    varying vec2 v_brushTexcoord;

    uniform sampler2D u_brushes;
   
    void main() {
      vec4 brushColor = texture2D(u_brushes, v_brushTexcoord);
      if (brushColor.a < 0.5) {
          gl_FragColor = vec4(0, 0, 0, 0);
      } else {
        gl_FragColor = vec4(v_color.r, v_color.g, v_color.b, 1);
      }
    }`;
}
