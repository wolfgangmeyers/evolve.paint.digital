
function FocusEditor(gl, focusMapProgram, displayProgram, srcImage, focusMap) {
    this.gl = gl;
    this.focusMapProgram = focusMapProgram;
    this.displayProgram = displayProgram;
    this.srcImage = srcImage;
    if (!focusMap) {
        var width = 100;
        var height = (srcImage.height / srcImage.width) * width;
        focusMap = new FocusMap(width, height);
    }
    this.mouseDown = 0;
    this.mousePosition = {
        x: 0,
        y: 0,
    };

    // Set up webgl stuff
    gl.useProgram(this.focusMapProgram);
    // Get attribute/uniform locations
    this.focusPosLocation = gl.getAttributeLocation(this.focusMapProgram, "a_position");
    this.focusTexCoordLocation = gl.getAttributeLocation(this.focusMapProgram, "a_texCoord");
    this.focusMapLocation = gl.getAttributeLocation(this.focusMapProgram, "u_focus");
    this.focusMouseDownLocation = gl.getAttributeLocation(this.focusMapProgram, "u_mouseDown");
    this.focusMousePosLocation = gl.getAttributeLocation(this.focusMapLocation, "u_mousePos");
    
    this.displayPosLocation = gl.getAttributeLocation(this.displayProgram, "a_position");
    this.displayTexCoordLocation = gl.getAttributeLocation(this.displayProgram, "a_texCoord");
    this.displaySrcLocation = gl.getAttributeLocation(this.displayProgram, "u_src");
    this.displayFocusLocation = gl.getAttributeLocation(this.displayProgram, "u_focus");
    this.displayMousePosLocation = gl.getAttributeLocation(this.displayProgram, "u_mousePos");

    // Create attribute buffers
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    setRectangle(gl, -1, -1, 2, 2, {dynamic: true});
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    setRectangle(gl, 0, 0, 1, 1, {flipY: true, dynamic: true});

    // Create textures

    // Create framebuffers

}

function FocusMap(width, height) {
    this.width = width;
    this.height = height;
    this.cells = [];
    this.maxValue = 0.5;
    this.minValue = 0.5;
    // Cells are indexed so that an individual cell can
    // be referenced as this.cells[x][y]
    for (var x = 0; x < this.width; x++) {
        var column = [];
        for (var y = 0; y < this.height; y++) {
            column.push(0.5);
        }
        this.cells.push(column);
    }
    // Reusable image data array, for synchronizing state with GPU
    this.imageData = new Uint8Array(this.width * this.height * 4);
    this.updatePixels();
}

FocusMap.prototype.updatePixels = function() {
    for (var x = 0; x < this.width; x++) {
        for (var y = 0; y < this.height; y++) {
            var focusValue = this.cells[x][y];
            var pixelValue = Math.floor(255 * focusValue);
            var c = x * y * 4;
            this.imageData[c] = pixelValue;
            this.imageData[c + 1] = pixelValue;
            this.imageData[c + 2] = pixelValue;
            this.imageData[c + 3] = 255;
        }
    }
}

FocusMap.prototype.updateFromPixels = function() {
    this.minValue = 1;
    this.maxValue = 0;
    for (var x = 0; x < this.width; x++) {
        for (var y = 0; y < this.height; y++) {
            var pixelValue = this.imageData[x * y * 4];
            var focusValue = pixelValue / 255.0;
            this.minValue = Math.min(this.minValue, focusValue);
            this.maxValue = Math.max(this.maxValue, focusValue);
            this.cells[x][y] = focusValue;
        }
    }
}
