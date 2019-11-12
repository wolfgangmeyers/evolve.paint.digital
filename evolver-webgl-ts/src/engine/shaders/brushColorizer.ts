export function vert(): string {
    return `
    // an attribute will receive data from a buffer
    attribute vec2 a_position;
    attribute vec2 a_brushTexcoord;

    uniform vec2 u_resolution;
    varying vec2 v_brushTexcoord;
    // This is calculated by the shader based on position
    varying vec2 v_imgTexcoord;
   
    // all shaders have a main function
    void main() {
        // convert the position from pixels to 0.0 to 1.0
        vec2 zeroToOne = a_position / u_resolution;
        // TODO: does the Y need to be inverted?
        v_imgTexcoord = zeroToOne;
     
        // convert from 0->1 to 0->2
        vec2 zeroToTwo = zeroToOne * 2.0;
     
        // convert from 0->2 to -1->+1 (clipspace)
        vec2 clipSpace = zeroToTwo - 1.0;
     
        gl_Position = vec4(clipSpace, 0, 1);
        v_brushTexcoord = a_brushTexcoord;
    }`;
}

export function frag(): string {
    return `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision mediump float;

    varying vec2 v_brushTexcoord;
    varying vec2 v_imgTexcoord;

    uniform sampler2D u_brushes;
    uniform sampler2D u_src;
   
    void main() {
      vec4 brushColor = texture2D(u_brushes, v_brushTexcoord);
      vec4 srcColor = texture2D(u_src, v_imgTexcoord);
        gl_FragColor = vec4(srcColor.r, srcColor.g, srcColor.b, brushColor.a);
    }`;
}
