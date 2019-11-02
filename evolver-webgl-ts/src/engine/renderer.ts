import { createAndSetupTexture } from "./util";
import { Triangle } from "./triangle";
import { Attribute } from "./attribute";

export class Renderer {

    private resolutionLocation: WebGLUniformLocation;

    private positionData: Attribute;
    private positionSubData: Attribute;

    private colorData: Attribute;
    private colorSubData: Attribute;

    private renderTexture: WebGLTexture;

    private framebuffer: WebGLFramebuffer;

    /** Used for reading pixel data out of GPU */
    private imageDataArray: Uint8Array;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private maxTriangles: number,
    ) {
        gl.useProgram(program);
        this.imageDataArray = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);

        // Add resolution to convert from pixel space into clip space
        this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
        // Create buffers

        // These share the same buffer but different data arrays. "subData" attributes
        // are a temporary hack to make one-element updates. I may combine them into a single object.
        this.positionData = new Attribute(gl, program, "a_position", 6, maxTriangles);
        this.positionSubData = new Attribute(gl, program, "a_position", 6, 1, this.positionData.buffer);
        this.colorData = new Attribute(gl, program, "a_color", 12, maxTriangles);
        this.colorSubData = new Attribute(gl, program, "a_color", 12, 1, this.colorData.buffer);
        
        // Create texture for framebuffer. Renderer will render into this texture.
        var pixels = [];
        for (var i = 0; i < gl.canvas.width; i++) {
            for (var j = 0; j < gl.canvas.height; j++) {
                pixels.push(0, 0, 0, 255);
            }
        }
        var rawData = new Uint8Array(pixels);
        this.renderTexture = createAndSetupTexture(gl, 0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);

        // Create the framebuffer
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTexture, 0);

        gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);
        // Create reusable arrays for buffering data

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.colorData.initialize();
    }

    render(triangles: Array<Triangle>, affectedIndex: number=undefined) {
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
        this.positionData.enable();

        // Bind the position buffer.
        this.positionData.bindBuffer();
        var triangleCursor = 0;
        var colorCursor = 0;
        // affectedIndex indicates that only one triangle should be pushed to the gpu
        // otherwise, write the entire list of triangles.
        if (affectedIndex === undefined) {
            for (let triangle of triangles) {
                for (let point of triangle.points) {
                    var x = triangle.x + Math.cos(point.angle) * point.distance;
                    var y = triangle.y + Math.sin(point.angle) * point.distance;
                    this.positionData.data[triangleCursor++] = x;
                    this.positionData.data[triangleCursor++] = y;
                    for (let component of triangle.color) {
                        this.colorData.data[colorCursor++] = component;
                    }
                }
            }
            // Push data into the gpu
            this.positionData.bufferData();
        } else if (affectedIndex < triangles.length) {
            // Optimized to one update
            var updatedTriangle = triangles[affectedIndex];
            for (let point of updatedTriangle.points) {
                this.positionSubData.data[triangleCursor++] = updatedTriangle.x + Math.cos(point.angle) * point.distance;
                this.positionSubData.data[triangleCursor++] = updatedTriangle.y + Math.sin(point.angle) * point.distance;

                for (let component of updatedTriangle.color) {
                    this.colorSubData.data[colorCursor++] = component;
                }
            }
            // Push data into the gpu
            this.positionSubData.bufferSubData(affectedIndex, 0, 1);
        }


        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        this.positionData.attach();

        // Load colors into color buffer
        this.colorData.enable();

        this.colorData.bindBuffer();

        if (affectedIndex === undefined) {
            this.colorData.bufferData();
        } else if (affectedIndex < triangles.length) {
            this.colorSubData.bufferSubData(affectedIndex, 0, 1);
        }

        this.colorData.attach();

        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        // var count = 3;
        var count = triangles.length * 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    getRenderedImageData(): Uint8Array {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, this.imageDataArray);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return this.imageDataArray;
    }

    dispose() {
        const gl = this.gl;
        // gl.deleteBuffer(this.colorBuffer);
        this.colorData.dispose();
        this.positionData.dispose();
        // gl.deleteBuffer(this.posBuffer);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.renderTexture);
    }
}
