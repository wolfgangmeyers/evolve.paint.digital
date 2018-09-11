// https://stackoverflow.com/questions/3814231/loading-an-image-to-a-img-from-input-file


function Ranker(gl, program, srcImage) {
    this.gl = gl;
    this.program = program;

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
    // TODO: Multi-phase scale-down?
    var pixels = [];
    for (var i = 0; i < gl.canvas.width / 2; i++) {
        for (var j = 0; j < gl.canvas.height / 2; j++) {
            pixels.push(0, 0, 0, 255);
        }
    }
    var rawData = new Uint8Array(pixels);
    this.outputTexture = createAndSetupTexture(gl, 2);
    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width / 2, gl.canvas.height / 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Create the framebuffer
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTexture, 0);

    // Create array for extracting pixels from texture
    this.pixels = new Uint8Array((gl.canvas.width / 2) * (gl.canvas.height / 2) * 4);
}

Ranker.prototype.rank = function() {
    var gl = this.gl;
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, gl.canvas.width / 2, gl.canvas.height / 2);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enableVertexAttribArray(this.posLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.vertexAttribPointer(this.posLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // draw
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
    // Extract rendered image
    gl.readPixels(0, 0, gl.canvas.width / 2, gl.canvas.height / 2, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // average pixel values
    var total = 0.0;
    var min = 1000.0;
    var max = 0;
    for (var i = 0; i < this.pixels.length; i += 4) {
        total += this.pixels[i];
        if (this.pixels[i] < min) {
            min = this.pixels[i];
        }
        if (this.pixels[i] > max) {
            max = this.pixels[i];
        }
    }
    var avg = total / (this.pixels.length / 4);
    return 1.0 - avg / 255.0;
}

Ranker.prototype.dispose = function() {
    var gl = this.gl;
    gl.deleteTexture(this.srcTexture);
    gl.deleteBuffer(this.posBuffer);
    gl.deleteTexture(this.outputTexture);
    gl.deleteFramebuffer(this.framebuffer);
}
