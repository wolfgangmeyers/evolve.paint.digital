import { createAndSetupTexture } from "../util";

/**
 * WebGL Texture helper functionality.
 */
export class Texture {

    public texture: WebGLTexture;

    constructor(
        private gl: WebGL2RenderingContext,
        public textureIndex: number,
        public width: number,
        public height: number,
        private minFilter: number = null,
        private magFilter: number = null,
    ) {
        this.minFilter = this.minFilter || gl.LINEAR;
        this.magFilter = this.magFilter || gl.LINEAR;
        const imageData = [];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                imageData.push(0, 0, 0, 255);
            }
        }
        const imageDataArray = new Uint8Array(imageData);
        this.texture = createAndSetupTexture(gl, this.textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageDataArray);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
    }

    activate() {
        this.gl.activeTexture(this.gl.TEXTURE0 + this.textureIndex);
    }

    bind() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    }

    dispose() {
        this.gl.deleteTexture(this.texture);
    }
}
