import { createAndSetupTexture, setRectangle } from "./util";

interface ShrinkLevel {
    outputTexture: WebGLTexture;
    framebuffer: WebGLFramebuffer;
    level: number;
}

export interface RankData {
    data: Uint8Array;
    width: number;
    height: number;
}

// Textures: 0=rendered, 1=src, 4,5=rank

export class Ranker {
    private srcTexture: WebGLTexture;
    private posLocation: number;
    private posBuffer: WebGLBuffer;
    private texCoordLocation: number;
    private texCoordBuffer: WebGLBuffer;
    private outputTexture: WebGLTexture;
    private framebuffer: WebGLFramebuffer;
    private posLocation2: number;
    private texCoordLocation2: number;
    private levels: Array<ShrinkLevel>;
    private rankData: RankData;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        private shrinkerProgram: WebGLProgram,
        srcImage: HTMLImageElement,
    ) {
        gl.useProgram(this.program);
        // Create textures for source image and output texture
        // Set to texture slots 1 and 2
        gl.uniform1i(gl.getUniformLocation(program, "u_rendered"), 0);
        gl.uniform1i(gl.getUniformLocation(program, "u_src"), 1);
        // load src image into texture
        this.srcTexture = createAndSetupTexture(gl, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcImage);

        // Buffer triangles and texture coordinates
        this.posLocation = gl.getAttribLocation(program, "a_position");
        this.posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        setRectangle(gl, -1, -1, 2, 2, { dynamic: true });
        this.texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        setRectangle(gl, 0, 0, 1, 1, { dynamic: true });

        // Create output texture for framebuffer. Ranker will render into this texture.
        this.outputTexture = this.createRenderTexture(gl.canvas.width, gl.canvas.height, 2);

        // Create the framebuffer
        this.framebuffer = this.createFramebuffer(this.outputTexture);

        // Set up shrink program
        gl.useProgram(this.shrinkerProgram);

        this.posLocation2 = gl.getAttribLocation(shrinkerProgram, "a_position");
        this.texCoordLocation2 = gl.getAttribLocation(shrinkerProgram, "a_texCoord");

        this.levels = [{
            outputTexture: this.outputTexture,
            framebuffer: this.framebuffer,
            level: 1,
        }];
        // The smallest texture will be 16x smaller than the input texture
        for (var i = 2; Math.floor(gl.canvas.width / i) > 100; i = i * 2) {
            var outputTexture = this.createRenderTexture(Math.floor(gl.canvas.width / i), Math.floor(gl.canvas.height / i), 4);
            this.levels.push({
                outputTexture: outputTexture,
                framebuffer: this.createFramebuffer(outputTexture),
                level: i,
            });
        }
        var maxLevel = this.levels[this.levels.length - 1];
        this.rankData = {
            width: Math.floor(gl.canvas.width / maxLevel.level),
            height: Math.floor(gl.canvas.height / maxLevel.level),
            data: new Uint8Array(Math.floor(gl.canvas.width / maxLevel.level) * Math.floor(gl.canvas.height / maxLevel.level) * 4),
        };
        // Initialize data with 100% difference
        for (let i = 0; i < this.rankData.data.length; i++) {
            this.rankData.data[i] = 255;
        }
    }

    createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
        const gl = this.gl;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return framebuffer;
    }

    createRenderTexture(
        width: number, height: number, textureIndex: number,
    ): WebGLTexture {
        const gl = this.gl;
        const pixels = [];
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                pixels.push(0, 0, 0, 255);
            }
        }
        const rawData = new Uint8Array(pixels);
        const outputTexture = createAndSetupTexture(gl, textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, outputTexture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return outputTexture;
    }

    setShrinkTextures(level: number) {
        const gl = this.gl;
        const levelData = this.levels[level];
        gl.activeTexture(gl.TEXTURE0 + 5);
        gl.bindTexture(gl.TEXTURE_2D, this.levels[level - 1].outputTexture);
        gl.uniform1i(gl.getUniformLocation(this.shrinkerProgram, "u_src"), 5);
        gl.uniform2f(
            gl.getUniformLocation(this.shrinkerProgram, "u_resolution"),
            Math.floor(gl.canvas.width / levelData.level),
            Math.floor(gl.canvas.height / levelData.level),
        );

        gl.activeTexture(gl.TEXTURE0 + 4);
        gl.bindTexture(gl.TEXTURE_2D, this.levels[level].outputTexture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.levels[level].framebuffer);

        gl.enableVertexAttribArray(this.posLocation2);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.posLocation2, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(this.texCoordLocation2);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.texCoordLocation2, 2, gl.FLOAT, false, 0, 0);

        // Bind render texture
        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    rank(rendered: WebGLTexture): number {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Rendered texture may change each time, make sure to update
        // it in the ranker
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, rendered);
        gl.uniform1i(gl.getUniformLocation(this.program, "u_rendered"), 0);

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

        // Shrink result
        gl.useProgram(this.shrinkerProgram);
        for (let i = 1; i < this.levels.length; i++) {
            const levelData = this.levels[i];
            gl.viewport(0, 0, Math.floor(gl.canvas.width / levelData.level), Math.floor(gl.canvas.height / levelData.level));
            this.setShrinkTextures(i);
            gl.drawArrays(primitiveType, offset, count);
        }

        // Extract rendered image
        const maxLevel = this.levels[this.levels.length - 1];
        gl.readPixels(0, 0, Math.floor(gl.canvas.width / maxLevel.level), Math.floor(gl.canvas.height / maxLevel.level), gl.RGBA, gl.UNSIGNED_BYTE, this.rankData.data);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // average pixel values
        let total = 0.0;
        let min = 1000.0;
        let max = 0;
        const pixels = this.rankData.data;
        for (let i = 0; i < pixels.length; i += 4) {
            total += pixels[i];
            if (pixels[i] < min) {
                min = pixels[i];
            }
            if (pixels[i] > max) {
                max = pixels[i];
            }
        }
        return total;
    }

    getRankData(): RankData {
        return this.rankData;
    }

    toPercentage(total: number): number {
        const avg = total / (this.rankData.data.length / 4);
        return 1.0 - avg / 255.0;
    }

    dispose() {
        const gl = this.gl;
        gl.deleteTexture(this.srcTexture);
        gl.deleteBuffer(this.posBuffer);
        gl.deleteTexture(this.outputTexture);
        gl.deleteFramebuffer(this.framebuffer);
    }
}
