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
    uniform sampler2D u_focus;
    uniform int u_mouseDown;
    uniform vec2 u_mousePos;
    uniform float u_brushFocus;
    uniform float u_brushSize;
    
    void main() {
        vec4 clr = texture2D(u_focus, v_texCoord);
        if (u_mouseDown == 1) {
            // Check proximity to mouse position
            vec2 mdiff = v_texCoord - u_mousePos;
            if (sqrt(mdiff.x * mdiff.x + mdiff.y * mdiff.y) < u_brushSize) {
                clr = vec4(u_brushFocus, u_brushFocus, u_brushFocus, 1.);
            }
        }
        
        // TODO: apply brush if mouse down
        gl_FragColor = vec4(clr.rgb, 1.);
    }`;
}

export function displayVert(): string {
    return `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0, 1.);
        v_texCoord = a_texCoord;
    }`;
}

export function displayFrag(): string {
    return `
    precision highp float;

    varying vec2 v_texCoord;
    uniform sampler2D u_focus;
    uniform sampler2D u_src;
    uniform vec2 u_mousePos;
    uniform float u_brushSize;
    uniform float u_focusOpacity;

    void main() {
        vec4 srcColor = texture2D(u_src, v_texCoord);
        vec4 focusColor = texture2D(u_focus, v_texCoord);

        // Check proximity to mouse position
        vec2 mdiff = v_texCoord - u_mousePos;
        if (sqrt(mdiff.x * mdiff.x + mdiff.y * mdiff.y) < u_brushSize) {
            focusColor = vec4(0.8, 1., 1., 1.);
        }

        vec4 clr = (srcColor * (1. - u_focusOpacity) + focusColor * u_focusOpacity);
        gl_FragColor = vec4(clr.rgb, 1.);
    }`;
}