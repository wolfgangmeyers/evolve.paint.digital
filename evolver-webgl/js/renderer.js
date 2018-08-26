function Renderer(gl, program, posAttrName, colorsAttrName) {
    this.gl = gl;
    this.program = program;
    gl.useProgram(this.program);
    // Look up where colors need to go.
    this.colorsLocation = gl.getAttribLocation(program, colorsAttrName);
    // look up where the vertex data needs to go.
    this.posLocation = gl.getAttribLocation(program, posAttrName);
    this.posBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
}

Renderer.prototype.render = function(triangles) {
    var gl = this.gl;
    // Clear the canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the attribute
    gl.enableVertexAttribArray(this.posLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset)

    // draw
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 3;
    gl.drawArrays(primitiveType, offset, count);
}