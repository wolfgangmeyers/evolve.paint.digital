import { Point } from "./point";

export interface SetRectangleOptions {
    flipY?: boolean;
    dynamic?: boolean;
}

export function setRectangle(
    gl: WebGL2RenderingContext,
    x: number,
    y: number,
    width: number,
    height: number,
    options: SetRectangleOptions = {},
) {
    let x1 = x;
    let x2 = x + width;
    let y1 = y;
    let y2 = y + height;
    // Flip Y axis for texture coordinates...
    if (options.flipY) {
        y1 = y + height;
        y2 = y;
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ]), options.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
}

export function createAndSetupTexture(
    gl: WebGL2RenderingContext,
    textureIndex: number,
): WebGLTexture {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

export function createProgram(
    gl: WebGL2RenderingContext,
    vertexShaderSource: string,
    fragmentShaderSource: string,
): WebGLProgram {
    // create GLSL shaders, upload the GLSL source, compile the shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error("Could not create program");
    }
    return program;
}

export function createShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        throw new Error("Could not create shader");
    }
    return shader;
}

export function getRandomInt(
    min: number, max: number,
): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    //The maximum is exclusive and the minimum is inclusive
    return Math.floor(Math.random() * (max - min)) + min;
}

export function getRandomSign(): number {
    if (getRandomInt(0, 2) == 0) {
        return 1;
    }
    return -1;
}

export function toHex(component: number): string {
    let hex = component.toString(16);
    if (hex.length == 1) {
        hex = "0" + hex;
    }
    return hex;
}

export function hexEncodeColor(color: Array<number>) {
    const r = parseInt(`${color[0] * 255}`);
    const g = parseInt(`${color[1] * 255}`);
    const b = parseInt(`${color[2] * 255}`);
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

export function color2float(
    r: number,
    g: number,
    b: number,
): number {
    return (r + g * 256.0 + b * 256.0 * 256.0) / (256.0 * 256.0 * 256.0);
}

export function normalizeAngle(angle: number): number {
    while (angle < 0) {
        angle += Math.PI * 2;
    }
    while (angle >= Math.PI * 2) {
        angle -= Math.PI * 2;
    }
    return angle;
}

export function rotatePoint(coords: Point, angle: number): Point {
    const magnitude = Math.sqrt(Math.pow(coords.x, 2) + Math.pow(coords.y, 2));
    let newAngle = normalizeAngle(Math.atan2(coords.y, coords.x) + angle);
    coords.x = Math.cos(newAngle) * magnitude;
    coords.y = Math.sin(newAngle) * magnitude;
    return coords;
}

export function translatePoint(coords: Point, by: Point): Point {
    coords.x += by.x;
    coords.y += by.y;
    return coords;
}

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
