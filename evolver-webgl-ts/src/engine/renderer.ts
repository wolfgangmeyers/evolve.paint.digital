import { createAndSetupTexture, setRectangle } from "./util";
import { Triangle } from "./triangle";
import { Attribute } from "./webgl/attribute";
import { Texture } from "./webgl/texture";
import { Framebuffer } from "./webgl/framebuffer";
import { Uniform } from "./webgl/uniform";
import { Framebuffer } from "./webgl/framebuffer";
import { Attribute } from "./webgl/attribute";

// Textures: 0=render

export class Renderer {

    // private resolutionLocation: WebGLUniformLocation;
    private resolution: Uniform;
    private positionData: Attribute;
    private colorData: Attribute;
    private brushesTexture: Texture;
    private renderTexture: Texture;
    private framebuffer: Framebuffer;
    private deleted: Uniform;
    private base: Uniform;

    // TODO: are these used?
    private texCoordData: Attribute;

    // Swap between textures on successful improvement
    private renderTexture2: Texture;
    private framebuffer2: Framebuffer;
    private phase: number;

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

        // Add resolution to convert from pixel space into clip space
        this.resolution = new Uniform(gl, program, "u_resolution");
        // Create buffers

        // single instruction updates
        this.positionData = new Attribute(gl, program, "a_position", 6, 1);
        this.colorData = new Attribute(gl, program, "a_color", 12, 1);
        this.texCoordData = new Attribute(gl, program, "a_texCoord", 6, 1);


        // initial phase = 0 - swap between 0 and 1
        this.phase = 0;
        // Deleted uniform will cause a triangle to be erased if set to 1
        this.deleted = new Uniform(gl, program, "u_deleted");
        // Base is the currently rendered state
        this.base = new Uniform(gl, program, "u_base");


        this.renderTexture = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);
        this.renderTexture2 = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);

        // Create the framebuffers
        this.framebuffer = new Framebuffer(gl, this.renderTexture);
        this.framebuffer2 = new Framebuffer(gl, this.renderTexture2);

        this.resolution.setVector2(gl.canvas.width, gl.canvas.height);

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.colorData.initialize();
    }

    render(triangle: Triangle) {
        const gl = this.gl;
        gl.useProgram(this.program);
        // pick texture and framebuffer alternating based on phase
        if (this.phase == 0) {
            this.renderTexture.bind();
            this.framebuffer2.bind();
            // gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
            // gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer2);
        } else {
            this.renderTexture2.bind();
            this.framebuffer.bind();
            // gl.bindTexture(gl.TEXTURE_2D, this.renderTexture2);
            // gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        }
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        this.deleted.set(triangle.deleted ? 1 : 0);
        // set the base texture
        this.base.set(0);

        // Turn on the attribute
        this.positionData.enable();

        // Bind the position buffer.
        this.positionData.bindBuffer();
        var triangleCursor = 0;
        var colorCursor = 0;
        
        // render a single instruction
        // calculate render points and texture coordinates for delete
        for (let point of triangle.points) {
            const pointX = triangle.x + Math.cos(point.angle) * point.distance;
            const pointY = triangle.y + Math.sin(point.angle) * point.distance;
            const texCoordX = pointX / gl.canvas.width;
            const texCoordY = (pointY / gl.canvas.height);

            // this.positionData.data[triangleCursor++]
            this.texCoordData.data[triangleCursor] = texCoordX;
            this.positionData.data[triangleCursor++] = pointX;
            this.texCoordData.data[triangleCursor] = texCoordY;
            this.positionData.data[triangleCursor++] = pointY;

            for (let component of triangle.color) {
                this.colorData[colorCursor++] = component;
            }
        }
        // Copy data to arrays
        for (let attribute of [this.positionData, this.colorData, this.texCoordData]) {
            attribute.bindBuffer();
            attribute.bufferData();
            attribute.attach();
        }

        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        var count = 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.framebuffer.unbind();
        this.lastInstruction = triangle;
    }

    getRenderedImageData(): Uint8Array {
        return this.framebuffer.readImageData();
    }

    getRenderedTexture(): Texture {
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
        // gl.deleteBuffer(this.colorBuffer);
        this.colorData.dispose();
        this.positionData.dispose();
        // gl.deleteBuffer(this.posBuffer);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.renderTexture);
        gl.deleteFramebuffer(this.framebuffer2);
        gl.deleteFramebuffer(this.renderTexture2);
    }
}
