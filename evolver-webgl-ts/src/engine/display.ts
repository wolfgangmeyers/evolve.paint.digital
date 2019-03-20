import { setRectangle } from "./util";

export class Display {

    public displayTexture: number;
    private posLocation: number;
    private posBuffer: WebGLBuffer;
    private texCoordLocation: number;
    private texCoordBuffer: WebGLBuffer;
    private srcLocation: WebGLUniformLocation;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
    ) {
        this.displayTexture = 0;
        gl.useProgram(this.program);

        // Buffer triangles and texture coordinates
        this.posLocation = gl.getAttribLocation(program, "a_position");
        this.posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        setRectangle(gl, -1, -1, 2, 2, { dynamic: true });
        this.texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        setRectangle(gl, 0, 0, 1, 1, { flipY: true, dynamic: true });
        this.srcLocation = gl.getUniformLocation(this.program, "u_src");
    }

    render() {
        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.useProgram(this.program);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Set reference to render texture
        gl.uniform1i(this.srcLocation, this.displayTexture);

        gl.enableVertexAttribArray(this.posLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.posLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // draw
        const primitiveType = gl.TRIANGLES;
        const offset = 0;
        const count = 6;
        gl.drawArrays(primitiveType, offset, count);
    }
}