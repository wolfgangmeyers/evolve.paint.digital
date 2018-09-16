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
    this.outputTexture = this.createRenderTexture(gl, gl.canvas.width, gl.canvas.height, 2);

    // Create the framebuffer
    this.framebuffer = this.createFramebuffer(gl, this.outputTexture);

    // TESTING SHRINK
    gl.useProgram(this.shrinkerProgram);

    this.posLocation2 = gl.getAttribLocation(shrinkerProgram, "a_position");
    this.texCoordLocation2 = gl.getAttribLocation(shrinkerProgram, "a_texCoord");

    this.levels = [{
        outputTexture: this.outputTexture,
        framebuffer: this.framebuffer,
        level: 1,
    }];
    // The smallest texture will be 16x smaller than the input texture
    for (var i = 2; Math.floor(gl.canvas.width / i) > 200; i = i * 2) {
        var outputTexture = this.createRenderTexture(gl, Math.floor(gl.canvas.width / i), Math.floor(gl.canvas.height / i), 4);
        this.levels.push({
            outputTexture: outputTexture,
            framebuffer: this.createFramebuffer(gl, outputTexture),
            level: i,
        });
    }
    var maxLevel = this.levels[this.levels.length - 1];
    this.pixels = new Uint8Array(Math.floor(gl.canvas.width / maxLevel.level) * Math.floor(gl.canvas.height / maxLevel.level) * 4);
}

Ranker.prototype.createFramebuffer = function (gl, texture) {
    var framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return framebuffer;
}

Ranker.prototype.createRenderTexture = function (gl, width, height, textureIndex) {
    console.log("Create render texture: width=" + width + ", height=" + height);
    var pixels = [];
    for (var i = 0; i < width; i++) {
        for (var j = 0; j < height; j++) {
            pixels.push(0, 0, 0, 255);
        }
    }
    var rawData = new Uint8Array(pixels);
    var outputTexture = createAndSetupTexture(gl, textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, outputTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return outputTexture;
}

Ranker.prototype.setShrinkTextures = function (gl, level) {
    var levelData = this.levels[level];
    gl.activeTexture(gl.TEXTURE0 + 5);
    gl.bindTexture(gl.TEXTURE_2D, this.levels[level - 1].outputTexture);
    gl.uniform1i(gl.getUniformLocation(this.shrinkerProgram, "u_src"), 5);
    gl.uniform2f(gl.getUniformLocation(this.shrinkerProgram, "u_resolution"), Math.floor(gl.canvas.width / levelData.level), Math.floor(gl.canvas.height / levelData.level));

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

Ranker.prototype.rank = function () {
    var gl = this.gl;
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1i(gl.getUniformLocation(this.program, "u_rendered"), 0);

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

    // Shrink result
    gl.useProgram(this.shrinkerProgram);
    for (var i = 1; i < this.levels.length; i++) {
        var levelData = this.levels[i];
        gl.viewport(0, 0, Math.floor(gl.canvas.width / levelData.level), Math.floor(gl.canvas.height / levelData.level));
        this.setShrinkTextures(gl, i);
        gl.drawArrays(primitiveType, offset, count);
    }

    // Extract rendered image
    var maxLevel = this.levels[this.levels.length - 1];
    gl.readPixels(0, 0, Math.floor(gl.canvas.width / maxLevel.level), Math.floor(gl.canvas.height / maxLevel.level), gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
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
    return total;
    // var avg = total / (this.pixels.length / 4);
    // return 1.0 - avg / 255.0;
}

Ranker.prototype.toPercentage = function(total) {
    var avg = total / (this.pixels.length / 4);
    return 1.0 - avg / 255.0;
}

Ranker.prototype.dispose = function () {
    var gl = this.gl;
    gl.deleteTexture(this.srcTexture);
    gl.deleteBuffer(this.posBuffer);
    gl.deleteTexture(this.outputTexture);
    gl.deleteFramebuffer(this.framebuffer);
}
