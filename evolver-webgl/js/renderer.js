
function Renderer(gl, program) {
    this.gl = gl;
    this.program = program;
    gl.useProgram(this.program);
    // Look up where colors need to go.
    this.colorsLocation = gl.getAttribLocation(program, "a_color");
    // look up where the vertex data needs to go.
    this.posLocation = gl.getAttribLocation(program, "a_position");
    // Add resolution to convert from pixel space into clip space
    this.resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    // Create buffers
    this.posBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
    // Create texture for framebuffer. Renderer will render into this texture.
    var pixels = [];
    for (var i = 0; i < gl.canvas.width; i++) {
        for (var j = 0; j < gl.canvas.height; j++) {
            pixels.push(0, 0, 0, 255);
        }
    }
    var rawData = new Uint8Array(pixels);
    this.renderTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rawData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Create the framebuffer
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTexture, 0);

    gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);
}

Renderer.prototype.render = function(triangles) {
    var gl = this.gl;
    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    // Bind render texture
    // Clear the canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Turn on the attribute
    gl.enableVertexAttribArray(this.posLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);

    // Buffer the triangle data
    var triangleData = [];
    // grab the colors as well
    var colorData = [];
    for (let triangle of triangles) {
        for (let point of triangle.points) {
            var x = triangle.x + Math.cos(point.angle) * point.distance;
            var y = triangle.y + Math.sin(point.angle) * point.distance;
            triangleData.push(x, y);
            for (let component of triangle.color) {
                colorData.push(component);
            }
        }
        
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleData), gl.DYNAMIC_DRAW);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        this.posLocation, size, type, normalize, stride, offset);
    
    // Load colors into color buffer
    gl.enableVertexAttribArray(this.colorsLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.DYNAMIC_DRAW);

    size = 4;
    gl.vertexAttribPointer(
        this.colorsLocation, size, type, normalize, stride, offset);

    // draw
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = triangles.length * 3;
    gl.drawArrays(primitiveType, offset, count);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}