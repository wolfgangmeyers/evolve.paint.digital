import { createAndSetupTexture, setRectangle } from "./util";
import { Triangle } from "./triangle";

export class Renderer {
    private colorsLocation: number;
    private posLocation: number;
    private resolutionLocation: WebGLUniformLocation;
    private deletedLocation: WebGLUniformLocation;
    private baseLocation: WebGLUniformLocation;
    private posBuffer: WebGLBuffer;
    private colorBuffer: WebGLBuffer;
    private texCoordLocation: number;
    private texCoordBuffer: WebGLBuffer;

    // Swap between textures on successful improvement
    private renderTexture: WebGLTexture;
    private framebuffer: WebGLFramebuffer;
    private renderTexture2: WebGLTexture;
    private framebuffer2: WebGLFramebuffer;
    private phase: number;

    private pointData: Array<number>;
    private colorData: Array<number>;
    private texCoordData: Array<number>;
    private pointArray: Float32Array;
    private colorArray: Float32Array;
    private texCoordArray: Float32Array;

    /** Used for reading pixel data out of GPU */
    private imageDataArray: Uint8Array;

    // Keep track of last instruction for rendering after swap
    private lastInstruction: Triangle;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private maxTriangles: number,
    ) {
        gl.useProgram(program);
        this.imageDataArray = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
        // initial phase = 0 - swap between 0 and 1
        this.phase = 0;
        // Look up where colors need to go.
        this.colorsLocation = gl.getAttribLocation(program, "a_color");
        // look up where the vertex data needs to go.
        this.posLocation = gl.getAttribLocation(program, "a_position");
        // Add resolution to convert from pixel space into clip space
        this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        // Deleted uniform will cause a triangle to be erased if set to 1
        this.deletedLocation = gl.getUniformLocation(program, "u_deleted");
        // Base is the currently rendered state
        this.baseLocation = gl.getUniformLocation(program, "u_base");
        // Create buffers
        this.posBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();

        // Create textures for framebuffer. Renderer will render into these textures.
        var pixels = [];
        for (var i = 0; i < gl.canvas.width; i++) {
            for (var j = 0; j < gl.canvas.height; j++) {
                pixels.push(0, 0, 0, 0);
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
        this.texCoordData = [];
        this.pointArray = new Float32Array(6);
        this.colorArray = new Float32Array(12);
        this.texCoordArray = new Float32Array(6);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, maxTriangles * 6 * 4, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, maxTriangles * 12 * 4, gl.DYNAMIC_DRAW);
        // Set up texture coordinates
        this.texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        this.texCoordBuffer = gl.createBuffer();
        
    }

    render(triangle: Triangle) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.activeTexture(gl.TEXTURE0);
        // pick texture and framebuffer alternating based on phase
        if (this.phase == 0) {
            gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer2);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.renderTexture2);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        }
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Bind render texture
        
        // // Clear the canvas (we don't do this anymore)
        // gl.clearColor(0, 0, 0, 0);
        // gl.clear(gl.COLOR_BUFFER_BIT);

        // Set deleted flag
        gl.uniform1i(this.deletedLocation, triangle.deleted ? 1 : 0);
        
        // Set base texture
        gl.uniform1i(this.baseLocation, 0);

        // Turn on the attribute
        gl.enableVertexAttribArray(this.posLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        var triangleCursor = 0;
        var colorCursor = 0;
        
        // render a single instruction
        // calculate render points and texture coordinates for delete
        for (let point of triangle.points) {
            const pointX = triangle.x + Math.cos(point.angle) * point.distance;
            const pointY = triangle.y + Math.sin(point.angle) * point.distance;
            const texCoordX = pointX / gl.canvas.width;
            const texCoordY = (pointY / gl.canvas.height);
            this.texCoordData[triangleCursor] = texCoordX;
            this.pointData[triangleCursor++] = pointX;
            this.texCoordData[triangleCursor] = texCoordY;
            this.pointData[triangleCursor++] = pointY;
            for (let component of triangle.color) {
                this.colorData[colorCursor++] = component;
            }
        }
        // Copy data to arrays
        this.pointArray.set(this.pointData, 0);
        this.colorArray.set(this.colorData, 0);
        this.texCoordArray.set(this.texCoordData, 0);
        
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
        // Texture coordinates
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.texCoordArray, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        var count = 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.lastInstruction = triangle;
    }

    getRenderedImageData(): Uint8Array {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer2);
        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, this.imageDataArray);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return this.imageDataArray;
    }

    getRenderedTexture(): WebGLTexture {
        if (this.phase == 0) {
            return this.renderTexture2;
        } else {
            return this.renderTexture;
        }
    }

    /**
     * swap is called after a successful improvement
     */
    swap() {
        if (this.phase == 0) {
            this.phase = 1;
        } else {
            this.phase = 0;
        }
        // Efficient update to alternating texture
        this.render(this.lastInstruction);
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
