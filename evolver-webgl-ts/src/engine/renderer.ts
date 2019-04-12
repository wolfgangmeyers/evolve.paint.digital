import { createAndSetupTexture } from "./util";
import { Triangle } from "./triangle";

export class Renderer {
    private colorsLocation: number;
    private posLocation: number;
    private resolutionLocation: WebGLUniformLocation;
    private posBuffer: WebGLBuffer;
    private colorBuffer: WebGLBuffer;

    // Swap between textures on successful improvement
    private renderTexture: WebGLTexture;
    private framebuffer: WebGLFramebuffer;
    private renderTexture2: WebGLTexture;
    private framebuffer2: WebGLFramebuffer;
    private phase: number;

    private pointData: Array<number>;
    private colorData: Array<number>;
    private pointArray: Float32Array;
    private colorArray: Float32Array;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private maxTriangles: number,
    ) {
        gl.useProgram(program);
        // initial phase = 0 - swap between 0 and 1
        this.phase = 0;
        // Look up where colors need to go.
        this.colorsLocation = gl.getAttribLocation(program, "a_color");
        // look up where the vertex data needs to go.
        this.posLocation = gl.getAttribLocation(program, "a_position");
        // Add resolution to convert from pixel space into clip space
        this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        // Create buffers
        this.posBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();

        // Create textures for framebuffer. Renderer will render into these textures.
        var pixels = [];
        for (var i = 0; i < gl.canvas.width; i++) {
            for (var j = 0; j < gl.canvas.height; j++) {
                pixels.push(0, 0, 0, 255);
            }
        }
        var rawData = new Uint8Array(pixels);
        // texture 0
        this.renderTexture = createAndSetupTexture(gl, 0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
        // texture 1
        this.renderTexture2 = createAndSetupTexture(gl, 0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTexture2);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);

        // Framebuffer 0
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTexture, 0);
        // Framebuffer 1
        this.framebuffer2 = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer2);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTexture2, 0);

        gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);
        // Create reusable arrays for buffering data

        // Single triangle updates
        this.pointData = [];
        this.colorData = [];
        this.pointArray = new Float32Array(6);
        this.colorArray = new Float32Array(12);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, maxTriangles * 6 * 4, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, maxTriangles * 12 * 4, gl.DYNAMIC_DRAW);
    }

    render(triangle: Triangle, imageDataCallback: (pixels: Uint8Array) => void=undefined) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Bind render texture
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Turn on the attribute
        gl.enableVertexAttribArray(this.posLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        var triangleCursor = 0;
        var colorCursor = 0;
        
        // render a single instruction
        for (let point of triangle.points) {
            this.pointData[triangleCursor++] = triangle.x + Math.cos(point.angle) * point.distance;
            this.pointData[triangleCursor++] = triangle.y + Math.sin(point.angle) * point.distance;
            for (let component of triangle.color) {
                this.colorData[colorCursor++] = component;
            }
        }
        // Copy data to arrays
        this.pointArray.set(this.pointData, 0);
        this.colorArray.set(this.colorData, 0);
        
        // Push point data into the gpu
        gl.bufferData(gl.ARRAY_BUFFER, this.pointArray, gl.DYNAMIC_DRAW);

        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            this.posLocation, size, type, normalize, stride, offset);

        // Load colors into color buffer
        gl.enableVertexAttribArray(this.colorsLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        
        gl.bufferData(gl.ARRAY_BUFFER, this.colorArray, gl.DYNAMIC_DRAW);

        size = 4;
        gl.vertexAttribPointer(
            this.colorsLocation, size, type, normalize, stride, offset);

        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        var count = 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        // Send rendered image data to callback, if set
        if (imageDataCallback) {
            // TODO: reusable pixels array to conserve memory
            const pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
            gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            imageDataCallback(pixels);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    dispose() {
        const gl = this.gl;
        gl.deleteBuffer(this.colorBuffer);
        gl.deleteBuffer(this.posBuffer);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.renderTexture);
        gl.deleteFramebuffer(this.framebuffer2);
        gl.deleteFramebuffer(this.renderTexture2);
    }
}
