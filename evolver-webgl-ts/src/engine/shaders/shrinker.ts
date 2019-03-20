
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
    precision highp float;

    varying vec2 v_texCoord;
    uniform sampler2D u_src;
    uniform vec2 u_resolution;
    
    vec4 max2(vec4 one, vec4 two) {
        if (one.x > two.x) {
            return one;
        }
        return two;
    }

    vec4 max4(vec4 one, vec4 two, vec4 three, vec4 four) {
        return max2(max2(one, two), max2(three, four));
    }

    void main() {
        // This assumes that the source texture is twice the size of
        // the destination texture.
        vec2 halfPixelSize = (vec2(1.,1.) / u_resolution) / 2.;
        vec4 avg = (
            texture2D(u_src, v_texCoord + vec2(halfPixelSize.x, halfPixelSize.y)) +
            texture2D(u_src, v_texCoord + vec2(-halfPixelSize.x, halfPixelSize.y)) +
            texture2D(u_src, v_texCoord + vec2(halfPixelSize.x, -halfPixelSize.y)) +
            texture2D(u_src, v_texCoord + vec2(-halfPixelSize.x, -halfPixelSize.y)) +
            texture2D(u_src, v_texCoord)
        ) / 5.;
        vec4 maxClr = max2(max4(
            texture2D(u_src, v_texCoord + vec2(halfPixelSize.x, halfPixelSize.y)),
            texture2D(u_src, v_texCoord + vec2(-halfPixelSize.x, halfPixelSize.y)),
            texture2D(u_src, v_texCoord + vec2(halfPixelSize.x, -halfPixelSize.y)),
            texture2D(u_src, v_texCoord + vec2(-halfPixelSize.x, -halfPixelSize.y))),
            texture2D(u_src, v_texCoord)
        );
        vec4 clr = (avg + maxClr) / 2.0;
        //vec4 clr = texture2D(u_src, v_texCoord);
        gl_FragColor = vec4(maxClr.rgb, 1.);
    }`;
}