import { Triangle } from "./triangle";
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
        private maxStrokes: number,
        private brushSet: BrushSet,
    ) {
        gl.useProgram(program);

        // Add resolution to convert from pixel space into clip space
        this.resolution = new Uniform(gl, program, "u_resolution");
        this.brushesLocation = new Uniform(gl, program, "u_brushes");
        // Create buffers

        // 2 triangles per brush stroke
        this.positionData = new Attribute(gl, program, "a_position", 6, maxStrokes * 2);
        this.brushTexCoordData = new Attribute(gl, program, "a_brushTexcoord", 6, maxStrokes * 2);
        this.colorData = new Attribute(gl, program, "a_color", 12, maxStrokes * 2);

        // The renderer uses this texture at index 0 to render the painting
        this.renderTexture = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);

        // Brush data is stored on index 6
        this.brushesTexture = new Texture(gl, 6, brushSet.width(), brushSet.height(), brushSet.getPixels());

        // Create the framebuffer
        this.framebuffer = new Framebuffer(gl, this.renderTexture);

        // These uniform locations don't change over the lifespan of the renderer
        this.resolution.setVector2(gl.canvas.width, gl.canvas.height);
        this.brushesLocation.setInt(6);

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.brushTexCoordData.initialize();
        this.colorData.initialize();
    }

    render(strokes: Array<BrushStroke>, affectedIndex: number=undefined) {
        const gl = this.gl;
        gl.useProgram(this.program);
        this.renderTexture.activate();
        this.renderTexture.bind();
        this.framebuffer.bind();
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // Bind render texture
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 2 triangles per brush stroke
        let triangleCursor = (affectedIndex || 0) * this.positionData.unitSize * 2;
        let colorCursor = (affectedIndex || 0) * this.colorData.unitSize * 2;
        let brushTexCoordCursor = (affectedIndex || 0) * this.brushTexCoordData.unitSize * 2;
        // affectedIndex indicates that only one triangle should be pushed to the gpu
        // otherwise, write the entire list of triangles.
        if (affectedIndex === undefined) {
            for (let stroke of strokes) {
                let points = this.getTrianglePoints(stroke);

                for (let point of points) {
                    this.positionData.data[triangleCursor++] = point.x;
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
            }
        } else if (affectedIndex < strokes.length) {
            // Optimized to one update
            const stroke = strokes[affectedIndex];
            let points = this.getTrianglePoints(stroke);

            for (let point of points) {
                this.positionData.data[triangleCursor++] = point.x;
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
        }

        for (let attribute of [this.positionData, this.brushTexCoordData, this.colorData]) {
            // Turn on the attribute
            attribute.enable();
            attribute.bindBuffer();
            if (affectedIndex === undefined) {
                attribute.bufferData();
            } else if (affectedIndex < strokes.length) {
                attribute.bufferSubData(affectedIndex * 2, affectedIndex * 2, 2);
            }
            attribute.attach();
        }

    
        // draw
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        // var count = triangleCursor / 2;
        // var count = 3;

        // Two triangles per stroke, three points per triangle
        var count = strokes.length * 2 * 3;
        var offset = 0;
        gl.drawArrays(primitiveType, offset, count);
        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.framebuffer.unbind();
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

            const strokeWidth = positionRect.right - positionRect.left;
            const strokeHeight = positionRect.bottom - positionRect.top;

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

    dispose() {
        const gl = this.gl;
        // gl.deleteBuffer(this.colorBuffer);
        this.colorData.dispose();
        this.positionData.dispose();
        this.brushesTexture.dispose();
        // gl.deleteBuffer(this.posBuffer);
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.renderTexture);
    }
}
