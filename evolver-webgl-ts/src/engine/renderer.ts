import { Attribute } from "./webgl/attribute";
import { Texture } from "./webgl/texture";
import { Framebuffer } from "./webgl/framebuffer";
import { Uniform } from "./webgl/uniform";
import { BrushSet } from "./brushSet";
import { BrushStroke } from "./brushStroke";
import { rotatePoint, translatePoint } from "./util";
import { Point } from "./point";

export class Renderer {

    // private resolutionLocation: WebGLUniformLocation;
    private resolution: Uniform;
    private brushesLocation: Uniform;
    private positionData: Attribute;
    private brushTexCoordData: Attribute;
    private colorData: Attribute;
    private texCoordData: Attribute;
    private brushesTexture: Texture;
    private renderTexture: Texture;
    private framebuffer: Framebuffer;
    private deleted: Uniform;
    private base: Uniform;

    // Swap between textures on successful improvement
    private renderTexture2: Texture;
    private framebuffer2: Framebuffer;
    private phase: number;

    // Keep track of last instruction for rendering after swap
    private lastInstruction: BrushStroke;

    private brushShrinkage: number;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private brushSet: BrushSet,
        width: number,
        height: number,
    ) {
        gl.useProgram(program);

        // Calculate how much to shrink brushes due to small images, if any
        // The brush set image should effectively be scaled to be no larger
        // than the source image (width/height)
        // If the source image is larger than the brush set image, just set the shrinkage
        // to 1 (no shrinkage)
        this.brushShrinkage = width / brushSet.width();
        this.brushShrinkage = Math.min(this.brushShrinkage, height / brushSet.height());
        this.brushShrinkage = Math.min(this.brushShrinkage, 1);

        // Add resolution to convert from pixel space into clip space
        this.resolution = new Uniform(gl, program, "u_resolution");
        this.brushesLocation = new Uniform(gl, program, "u_brushes");
        // Create buffers

        // 2 triangles per brush stroke
        this.positionData = new Attribute(gl, program, "a_position", 6, 2);
        this.brushTexCoordData = new Attribute(gl, program, "a_brushTexcoord", 6, 2);
        this.colorData = new Attribute(gl, program, "a_color", 12, 2);
        this.texCoordData = new Attribute(gl, program, "a_texCoord", 6, 2);


        // initial phase = 0 - swap between 0 and 1
        this.phase = 0;
        // Deleted uniform will cause a triangle to be erased if set to 1
        this.deleted = new Uniform(gl, program, "u_deleted");
        // Base is the currently rendered state
        this.base = new Uniform(gl, program, "u_base");

        // The renderer uses this texture at index 0 to render the painting
        this.renderTexture = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);
        this.framebuffer = new Framebuffer(gl, this.renderTexture);

        this.renderTexture2 = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);
        this.framebuffer2 = new Framebuffer(gl, this.renderTexture2);

        // Brush data is stored on index 6
        this.brushesTexture = new Texture(gl, 6, brushSet.width(), brushSet.height(), brushSet.getPixels());


        // These uniform locations don't change over the lifespan of the renderer
        this.resolution.setVector2(gl.canvas.width, gl.canvas.height);
        this.brushesLocation.setInt(6);

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.brushTexCoordData.initialize();
        this.colorData.initialize();
    }

    render(stroke: BrushStroke) {
        const gl = this.gl;
        gl.useProgram(this.program);
        this.renderTexture.activate();

        // pick texture and framebuffer alternating based on phase
        if (this.phase == 0) {
            this.renderTexture.bind();
            this.framebuffer2.bind();
        } else {
            this.renderTexture2.bind();
            this.framebuffer.bind();
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        this.deleted.setInt(stroke.deleted ? 1 : 0);
        // set the base texture
        this.base.setInt(0);
        
        // Turn on the attribute
        this.positionData.enable();

        // Bind the position buffer.
        this.positionData.bindBuffer();
        let triangleCursor = 0;
        let colorCursor = 0;
        let brushTexCoordCursor = 0;
        // render a single instruction
        // calculate render points and texture coordinates for delete
        let points = this.getTrianglePoints(stroke);

        for (let point of points) {
            const texCoordX = point.x / gl.canvas.width;
            const texCoordY = point.y / gl.canvas.height;
            this.texCoordData.data[triangleCursor] = texCoordX;
            this.positionData.data[triangleCursor++] = point.x;
            this.texCoordData.data[triangleCursor] = texCoordY;
            this.positionData.data[triangleCursor++] = point.y;
            // Set color data as well
            for (let component of stroke.color) {
                this.colorData.data[colorCursor++] = component;
            }
        }
        points = this.getTriangleTexCoords(stroke);
        for (let point of points) {
            this.brushTexCoordData.data[brushTexCoordCursor++] = point.x;
            this.brushTexCoordData.data[brushTexCoordCursor++] = point.y;
        }

        for (let attribute of [this.positionData, this.brushTexCoordData, this.colorData, this.texCoordData]) {
            // Turn on the attribute
            attribute.enable();
            attribute.bindBuffer();
            attribute.bufferData();
            attribute.attach();
        }

    
        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        // var count = 3;

        // Two triangles per stroke, three points per triangle
        var count = 2 * 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.framebuffer.unbind();
        this.lastInstruction = stroke;
    }

    private getTriangleTexCoords(stroke: BrushStroke): Array<Point> {
        const textureRect = this.brushSet.getTextureRect(stroke.brushIndex);
        return [
            // First triangle: down, right, up+left
            {x: textureRect.left, y: textureRect.top},
            {x: textureRect.left, y: textureRect.bottom},
            {x: textureRect.right, y: textureRect.bottom},
            // Second triangle: right, down, up+left
            {x: textureRect.left, y: textureRect.top},
            {x: textureRect.right, y: textureRect.top},
            {x: textureRect.right, y: textureRect.bottom},
        ];
        
    }

    private getTrianglePoints(stroke: BrushStroke): Array<Point> {
        // Calculate rect position+orientation, then convert to triangles
            // Matrices would be a more elegant solution to this
            const positionRect = this.brushSet.getPositionRect(stroke.brushIndex);
            // TODO: copy this to the other one...
            // const textureRect = this.brushSet.getTextureRect(stroke.brushIndex);

            const strokeWidth = (positionRect.right - positionRect.left) * this.brushShrinkage;
            const strokeHeight = (positionRect.bottom - positionRect.top) * this.brushShrinkage;

            const x2 = strokeWidth / 2;
            const x1 = -x2;
            const y2 = strokeHeight / 2;
            const y1 = -y2;

            const translation = [stroke.x, stroke.y];

            const points = [
                // First triangle: down, right, up+left
                {x: x1, y: y1},
                {x: x1, y: y2},
                {x: x2, y: y2},
                // Second triangle: right, down, up+left
                {x: x1, y: y1},
                {x: x2, y: y1},
                {x: x2, y: y2},
            ];
            for (let i = 0; i < points.length; i++) {
                points[i] = translatePoint(rotatePoint(points[i], stroke.rotation), stroke);
            }
            return points;
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
        this.brushTexCoordData.dispose();
        this.texCoordData.dispose();
        this.brushesTexture.dispose();
        // gl.deleteBuffer(this.posBuffer);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.renderTexture);
    }
}
