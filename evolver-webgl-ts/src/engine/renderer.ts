import { createAndSetupTexture } from "./util";
import { Triangle } from "./triangle";
import { Attribute } from "./webgl/attribute";
import { Texture } from "./webgl/texture";
import { Framebuffer } from "./webgl/framebuffer";
import { Uniform } from "./webgl/uniform";

// Textures: 0=render

export class Renderer {

    // private resolutionLocation: WebGLUniformLocation;
    private resolution: Uniform;
    private positionData: Attribute;

    private colorData: Attribute;

    private brushesTexture: Texture;

    // TODO: phase 1 to get new rendering engine functional:

    // TODO: get brush texture coordinates
    // TODO: push brush texture coordinates into attribute
    // TODO: translate brush strokes to triangles with texture coords
    // TODO: convert translation+rotation into point data for the shader
    // TODO: incremental (one item) updates to all attrib arrays
    // TODO: full flush of updates to all attrib arrays
    // TODO: update renderer shader to deal with all this
    // TODO: create a test brush texture and coordinates

    // TODO: consider higher-level attribute wrappers that subclass the current one...
    private renderTexture: Texture;

    private framebuffer: Framebuffer;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private maxTriangles: number,
    ) {
        gl.useProgram(program);

        // Add resolution to convert from pixel space into clip space
        this.resolution = new Uniform(gl, program, "u_resolution");
        // Create buffers

        this.positionData = new Attribute(gl, program, "a_position", 6, maxTriangles);
        this.colorData = new Attribute(gl, program, "a_color", 12, maxTriangles);

        this.renderTexture = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);

        // Create the framebuffer
        this.framebuffer = new Framebuffer(gl, this.renderTexture);

        this.resolution.setVector2(gl.canvas.width, gl.canvas.height);

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.colorData.initialize();
    }

    render(triangles: Array<Triangle>, affectedIndex: number=undefined) {
        const gl = this.gl;
        gl.useProgram(this.program);
        this.renderTexture.activate();
        this.renderTexture.bind();
        this.framebuffer.bind();
        // gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Bind render texture
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Turn on the attribute
        this.positionData.enable();

        // Bind the position buffer.
        this.positionData.bindBuffer();
        var triangleCursor = (affectedIndex || 0) * this.positionData.unitSize;
        var colorCursor = (affectedIndex || 0) * this.colorData.unitSize;
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
                this.positionData.data[triangleCursor++] = updatedTriangle.x + Math.cos(point.angle) * point.distance;
                this.positionData.data[triangleCursor++] = updatedTriangle.y + Math.sin(point.angle) * point.distance;

                for (let component of updatedTriangle.color) {
                    this.colorData.data[colorCursor++] = component;
                }
            }
            // Push data into the gpu
            this.positionData.bufferSubData(affectedIndex, affectedIndex, 1);
        }


        // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        this.positionData.attach();

        // Load colors into color buffer
        this.colorData.enable();

        this.colorData.bindBuffer();

        if (affectedIndex === undefined) {
            this.colorData.bufferData();
        } else if (affectedIndex < triangles.length) {
            this.colorData.bufferSubData(affectedIndex, affectedIndex, 1);
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
        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.framebuffer.unbind();
    }

    getRenderedImageData(): Uint8Array {
        return this.framebuffer.readImageData();
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
