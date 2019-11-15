import { Attribute } from "./webgl/attribute";
import { Texture } from "./webgl/texture";
import { Framebuffer } from "./webgl/framebuffer";
import { Uniform } from "./webgl/uniform";
import { BrushSet } from "./brushSet";
import { BrushStroke } from "./brushStroke";
import { rotatePoint, translatePoint } from "./util";
import { Point } from "./point";

export class Colorizer {

    private resolution: Uniform;
    private brushesLocation: Uniform;
    private srcLocation: Uniform;

    private positionData: Attribute;
    private brushTexCoordData: Attribute;

    private framebuffer: Framebuffer;
    private pixelData: Uint8Array;

    private brushShrinkage: number;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private brushSet: BrushSet,
        width: number,
        height: number,
        // Reused from renderer
        private renderTexture: Texture=null,
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
        this.srcLocation = new Uniform(gl, program, "u_src");
        // Create buffers

        // 2 triangles per brush stroke
        this.positionData = new Attribute(gl, program, "a_position", 6, 2);
        this.brushTexCoordData = new Attribute(gl, program, "a_brushTexcoord", 6, 2);

        if (!this.renderTexture) {
            this.renderTexture = new Texture(gl, 0, gl.canvas.width, gl.canvas.height);
        }

        // Create the framebuffer
        this.framebuffer = new Framebuffer(gl, this.renderTexture);

        // These uniform locations don't change over the lifespan of the renderer
        this.resolution.setVector2(gl.canvas.width, gl.canvas.height);

        // Textures are already populated from the renderer and ranker
        // brushes are texture #6
        this.brushesLocation.setInt(6);
        // src image is texture #1
        this.srcLocation.setInt(1);

        // Expand GPU buffers to max size
        this.positionData.initialize();
        this.brushTexCoordData.initialize();

        // TODO: optimize size of pixel data
        // // Get the largest brush and allocate pixel array to hold it
        // let largestArea = 0;
        // for (let i = 0; i < brushSet.getBrushCount(); i++) {
        //     const positionRect = brushSet.getPositionRect(i);
        //     const width = positionRect.right - positionRect.left;
        //     const height = positionRect.bottom - positionRect.top;
        //     const area = width * height;
        //     if (area > largestArea) {
        //         largestArea = area;
        //     }
        // }
        // // 4 bytes per pixel
        this.pixelData = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    }

    render(stroke: BrushStroke): Array<number> {
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
        let triangleCursor = 0;
        let brushTexCoordCursor = 0;
        
        // Render a single stroke
        let points = this.getTrianglePoints(stroke);

        for (let point of points) {
            this.positionData.data[triangleCursor++] = point.x;
            this.positionData.data[triangleCursor++] = point.y;
        }
        points = this.getTriangleTexCoords(stroke);
        for (let point of points) {
            this.brushTexCoordData.data[brushTexCoordCursor++] = point.x;
            this.brushTexCoordData.data[brushTexCoordCursor++] = point.y;
        }
            

        for (let attribute of [this.positionData, this.brushTexCoordData]) {
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
        this.framebuffer.unbind();
        
        // Read brush stroke data back from the GPU
        points = this.getTrianglePoints(stroke);
        let minX = this.gl.canvas.width;
        let minY = this.gl.canvas.height;
        let maxX = 0;
        let maxY = 0;
        for (let point of points) {
            minX = Math.max(0, Math.min(point.x, minX));
            minY = Math.max(0, Math.min(point.y, minY));
            maxX = Math.min(this.gl.canvas.width - 1, Math.max(point.x, maxX));
            maxY = Math.min(this.gl.canvas.height - 1, Math.max(point.y, maxY));
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const imageData = this.framebuffer.readImageData(
            minX,
            minY,
            width,
            height,
            this.pixelData,
        );

        // Average non-transparent pixels
        let pixelCount = 0;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        for (let c = 0; c < (width * height * 4); c += 4) {
            const r = imageData[c] / 255.0;
            const g = imageData[c + 1] / 255.0;
            const b = imageData[c + 2] / 255.0;
            const a = imageData[c + 3] / 255.0;
            if (a <= 0.01) {
                continue;
            }
            totalR += r;
            totalG += g;
            totalB += b;
            pixelCount++;
        }
        return [
            totalR / pixelCount,
            totalG / pixelCount,
            totalB / pixelCount,
            1
        ]
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

    dispose() {
        const gl = this.gl;
        this.positionData.dispose();
        gl.deleteFramebuffer(this.framebuffer);
    }
}
