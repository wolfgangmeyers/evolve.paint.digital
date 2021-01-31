export function vert(): string {
    return `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0, 1.);
        v_texCoord = a_texCoord;
    }`;
}

export function frag(): string {
    return `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision highp float;

    varying vec2 v_texCoord;
    uniform sampler2D u_src;
    uniform float u_zoom;
    uniform vec2 u_offset;

    void main() {

        vec4 clr = texture2D(u_src, vec2(v_texCoord.x / u_zoom + u_offset.x, v_texCoord.y / u_zoom + u_offset.y));
        gl_FragColor = vec4(clr.rgb, 1.);
    }`;
}