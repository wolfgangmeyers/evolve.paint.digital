/**
 * Wraps a WebGL uniform
 */
export class Uniform {

    private uniformLocation: WebGLUniformLocation;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private name: string,
    ) {
        this.uniformLocation = gl.getUniformLocation(program, name);
    }

    setVector2(a: number, b: number) {
        const gl = this.gl;
        gl.uniform2f(this.uniformLocation, a, b);
    }
}
