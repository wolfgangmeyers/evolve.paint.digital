// https://stackoverflow.com/questions/3814231/loading-an-image-to-a-img-from-input-file


function Ranker(gl, program, shrinkerProgram, srcImage) {
    this.gl = gl;
    this.program = program;
    this.shrinkerProgram = shrinkerProgram;

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
    this.outputTexture = this.createRenderTexture(gl, gl.canvas.width, gl.canvas.height);

    // Create the framebuffer
    this.framebuffer = this.createFramebuffer(gl, this.outputTexture);

    // Create array for extracting pixels from texture
    this.pixels = new Uint8Array((gl.canvas.width) * (gl.canvas.height) * 4);
}

Ranker.prototype.createFramebuffer = function(gl, texture) {
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return framebuffer;
}

Ranker.prototype.createRenderTexture = function(gl, width, height) {
    var pixels = [];
    for (var i = 0; i < width; i++) {
        for (var j = 0; j < height; j++) {
            pixels.push(0, 0, 0, 255);
        }
    }
    var rawData = new Uint8Array(pixels);
    var outputTexture = createAndSetupTexture(gl, 2);
    gl.bindTexture(gl.TEXTURE_2D, outputTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return outputTexture;
}

Ranker.prototype.rank = function() {
    var gl = this.gl;
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // TODO: make sure to set texture uniform to 0

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
    gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
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
