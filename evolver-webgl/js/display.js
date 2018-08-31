// A display renders a previously rendered image from a framebuffered
// texture.
function Display(gl, program, srcTexture) {
    this.gl = gl;
    this.program = program;
    this.srcTexture = srcTexture;
    gl.useProgram(this.program);
    // Set reference to render texture
    gl.uniform1i(gl.getUniformLocation(program, "u_src"), 0);
    // Buffer triangles and texture coordinates
    this.posLocation = gl.getAttribLocation(program, "a_position");
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    setRectangle(gl, -1, -1, 2, 2, {dynamic: true});
    this.texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    setRectangle(gl, 0, 0, 1, 1, {flipY: true, dynamic: true});
}

Display.prototype.render = function() {
    var gl = this.gl;
    gl.useProgram(this.program);
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
}
