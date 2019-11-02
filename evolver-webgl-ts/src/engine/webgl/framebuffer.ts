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

    readImageData(): Uint8Array {
        const gl = this.gl;
        const array = new Uint8Array(this.texture.width * this.texture.height * 4);
        this.bind();
        gl.readPixels(0, 0, this.texture.width, this.texture.height, gl.RGBA, gl.UNSIGNED_BYTE, array);
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
