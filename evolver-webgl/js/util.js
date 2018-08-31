
function setRectangle(gl, x, y, width, height, options) {
    options = options || {};
    var x1 = x;
    var x2 = x + width;
    var y1 = y;
    var y2 = y + height;
    // Flip Y axis for texture coordinates...
    if (options.flipY) {
        y1 = y + height;
        y2 = y;
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        x1, y1,
        x2, y1,
        x1, y2,
        x1, y2,
        x2, y1,
        x2, y2,
    ]), options.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
}