export function vert(): string {
    return `
    // an attribute will receive data from a buffer
    attribute vec2 a_position;
    attribute vec4 a_color;
    uniform vec2 u_resolution;
    varying vec4 v_color;
   
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
    }`;
}

export function frag(): string {
    return `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision mediump float;

    varying vec4 v_color;
   
    void main() {
      // gl_FragColor is a special variable a fragment shader
      // is responsible for setting
      gl_FragColor = v_color;
    }`;
}