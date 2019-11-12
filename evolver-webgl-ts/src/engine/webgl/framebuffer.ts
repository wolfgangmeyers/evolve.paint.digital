import { Texture } from "./texture";

/**
 * Wraps a WebGL framebuffer.
 */
export class Framebuffer {

    private framebuffer: WebGLFramebuffer;

    constructor(
        private gl: WebGL2RenderingContext,
        private texture: Texture,
    ) {
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.texture, 0);
    }

    readImageData(x: number=0, y: number=0, width: number=null, height: number=null, array: Uint8Array=null): Uint8Array {
        width = width || this.texture.width;
        height = height || this.texture.height;
        const gl = this.gl;
        array = array || new Uint8Array(width * height * 4);
        this.bind();
        gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, array);
        this.unbind();
        return array;
    }

    bind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    }

    unbind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    dispose() {
        this.gl.deleteFramebuffer(this.framebuffer);
    }
}
