import { Position } from "./position";
import { setRectangle, createAndSetupTexture } from "./util";

export class FocusMap {

    private cells: Array<Array<number>>;
    private maxValue: number;
    private minValue: number;
    public imageData: Uint8Array;

    constructor(
        public width: number,
        public height: number,
    ) {
        this.cells = [];
        this.maxValue = 0.5;
        this.minValue = 0.5;
        // Cells are indexed so that an individual cell can
        // be referenced as this.cells[x][y]
        for (let x = 0; x < this.width; x++) {
            let column = [];
            for (let y = 0; y < this.height; y++) {
                column.push(0.5);
            }
            this.cells.push(column);
        }
        // Reusable image data array, for synchronizing state with GPU
        this.imageData = new Uint8Array(this.width * this.height * 4);
        this.updatePixels();
    }

    getValue(x: number, y: number): number {
        return this.cells[x][y];
    }

    clear() {
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                this.cells[x][y] = 0.5;
            }
        }
    }

    updateFromImageData(imageData: Uint8Array) {
        if (imageData.length != this.imageData.length) {
            throw new Error(
                `Image data length mismatch: expected=${this.imageData.length} but was ${imageData.length}`
            );
        }
        // skip alpha bits
        for (let i = 0; i < imageData.length; i+= 4) {
            this.imageData[i] = imageData[i];
            this.imageData[i + 1] = imageData[i + 1];
            this.imageData[i + 2] = imageData[i + 2];
        }
        this.updateFromPixels();
    }

    updatePixels() {
        let c = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const focusValue = this.cells[x][y];
                const pixelValue = Math.floor(255 * focusValue);
                this.imageData[c] = pixelValue;
                this.imageData[c + 1] = pixelValue;
                this.imageData[c + 2] = pixelValue;
                this.imageData[c + 3] = 255;
                c += 4;
            }
        }
    }

    updateFromPixels() {
        this.minValue = 1;
        this.maxValue = 0;
        var c = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const pixelValue = this.imageData[c];
                const focusValue = pixelValue / 255.0;
                this.minValue = Math.min(this.minValue, focusValue);
                this.maxValue = Math.max(this.maxValue, focusValue);
                this.cells[x][y] = focusValue;
                c += 4;
            }
        }
    }
}

export class FocusEditor {

    private mouseDown: number;
    private mousePosition: Position;
    private brushFocus: number;
    private brushSize: number;
    private focusOpacity: number;

    private focusPosLocation: number;
    private focusTexCoordLocation: number;
    private focusMapLocation: WebGLUniformLocation;
    private focusMouseDownLocation: WebGLUniformLocation;
    private focusMousePosLocation: WebGLUniformLocation;
    private focusBrushLocation: WebGLUniformLocation;
    private focusBrushSizeLocation: WebGLUniformLocation;
    private focusTexcoordBuffer: WebGLBuffer;


    private displayPosLocation: number;
    private displayTexCoordLocation: number;
    private displaySrcLocation: WebGLUniformLocation;
    private displayFocusLocation: WebGLUniformLocation;
    private displayMousePosLocation: WebGLUniformLocation;
    private displayBrushSizeLocation: WebGLUniformLocation;
    private displayFocusOpacityLocation: WebGLUniformLocation;
    private displayTexcoordBuffer: WebGLBuffer;

    private posBuffer: WebGLBuffer;

    private focusTextures: Array<WebGLTexture>;
    private srcTexture: WebGLTexture;
    private framebuffers: Array<WebGLFramebuffer>;
    private phase: number;

    constructor(
        private gl: WebGL2RenderingContext,
        private focusMapProgram: WebGLProgram,
        private displayProgram: WebGLProgram,
        private srcImage: HTMLImageElement,
        public focusMap: FocusMap = null,
    ) {
        if (!this.focusMap) {
            const width = 100;
            const height = (srcImage.height / srcImage.width) * width;
            this.focusMap = new FocusMap(width, height);
        }
        this.mouseDown = 0;
        this.mousePosition = {
            x: 0,
            y: 0,
        };
        this.brushFocus = 0.5;
        this.brushSize = 0.01;
        this.focusOpacity = 0.5;

        // Set up webgl stuff
        gl.useProgram(this.focusMapProgram);
        // Get attribute/uniform locations
        this.focusPosLocation = gl.getAttribLocation(this.focusMapProgram, "a_position");
        this.focusTexCoordLocation = gl.getAttribLocation(this.focusMapProgram, "a_texCoord");
        this.focusMapLocation = gl.getUniformLocation(this.focusMapProgram, "u_focus");
        this.focusMouseDownLocation = gl.getUniformLocation(this.focusMapProgram, "u_mouseDown");
        this.focusMousePosLocation = gl.getUniformLocation(this.focusMapProgram, "u_mousePos");
        this.focusBrushLocation = gl.getUniformLocation(this.focusMapProgram, "u_brushFocus");
        this.focusBrushSizeLocation = gl.getUniformLocation(this.focusMapProgram, "u_brushSize");

        this.displayPosLocation = gl.getAttribLocation(this.displayProgram, "a_position");
        this.displayTexCoordLocation = gl.getAttribLocation(this.displayProgram, "a_texCoord");
        this.displaySrcLocation = gl.getUniformLocation(this.displayProgram, "u_src");
        this.displayFocusLocation = gl.getUniformLocation(this.displayProgram, "u_focus");
        this.displayMousePosLocation = gl.getUniformLocation(this.displayProgram, "u_mousePos");
        this.displayBrushSizeLocation = gl.getUniformLocation(this.displayProgram, "u_brushSize");
        this.displayFocusOpacityLocation = gl.getUniformLocation(this.displayProgram, "u_focusOpacity");

        // Create attribute buffers
        this.posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        setRectangle(gl, -1, -1, 2, 2, { dynamic: true });
        this.focusTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.focusTexcoordBuffer);
        setRectangle(gl, 0, 0, 1, 1, { flipY: false, dynamic: true });
        this.displayTexcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.displayTexcoordBuffer);
        setRectangle(gl, 0, 0, 1, 1, { flipY: true, dynamic: true });

        // Create textures
        this.focusTextures = [
            this.createFocusTexture(this.focusMap.imageData),
            this.createFocusTexture(this.focusMap.imageData),
        ];
        this.srcTexture = createAndSetupTexture(gl, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.srcImage);

        // Create framebuffers
        this.framebuffers = [
            this.createFramebuffer(this.focusTextures[0]),
            this.createFramebuffer(this.focusTextures[1]),
        ];
        // Phase indicates which framebuffer to use - 0 or 1
        this.phase = 0;
    }

    setMousePosition(x: number, y: number) {
        this.mousePosition.x = x;
        this.mousePosition.y = y;
    }

    setMouseDown(mouseDown: number) {
        this.mouseDown = mouseDown;
    }

    setBrushFocus(brush: number) {
        this.brushFocus = brush;
    }

    render() {
        this.renderFocusMap();

        const gl = this.gl;
        // Free framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Second, render focusmap + src image + brush position
        gl.useProgram(this.displayProgram);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // gl.viewport(0, 0, this.srcImage.width, this.srcImage.height);
        gl.uniform1i(this.displayFocusLocation, 0);
        gl.uniform1i(this.displaySrcLocation, 1);
        gl.uniform2f(this.displayMousePosLocation, this.mousePosition.x, this.mousePosition.y);
        gl.uniform1f(this.displayBrushSizeLocation, this.brushSize);
        gl.uniform1f(this.displayFocusOpacityLocation, this.focusOpacity);

        // Set up attributes for display render
        gl.enableVertexAttribArray(this.displayPosLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.displayPosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.displayTexCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.displayTexcoordBuffer);
        gl.vertexAttribPointer(this.displayTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Bind textures
        gl.activeTexture(gl.TEXTURE0);
        if (this.phase == 0) {
            gl.bindTexture(gl.TEXTURE_2D, this.focusTextures[1]);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.focusTextures[0]);
        }
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.srcTexture);

        // draw!
        const primitiveType = gl.TRIANGLES;
        const offset = 0;
        const count = 6;
        gl.drawArrays(primitiveType, offset, count);
        if (this.phase == 0) {
            this.phase = 1;
        } else {
            this.phase = 0;
        }
    }

    renderFocusMap() {
        const gl = this.gl;
        // First, render focusmap
        // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.viewport(0, 0, this.focusMap.width, this.focusMap.height);
        gl.useProgram(this.focusMapProgram);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1i(this.focusMapLocation, 0);
        gl.uniform1i(this.focusMouseDownLocation, this.mouseDown);
        gl.uniform2f(this.focusMousePosLocation, this.mousePosition.x, this.mousePosition.y);
        gl.uniform1f(this.focusBrushLocation, this.brushFocus);
        gl.uniform1f(this.focusBrushSizeLocation, this.brushSize);

        // Set up attributes for focus map render
        gl.enableVertexAttribArray(this.focusPosLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.vertexAttribPointer(this.focusPosLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.focusTexCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.focusTexcoordBuffer);
        gl.vertexAttribPointer(this.focusTexCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        if (this.phase == 0) {
            gl.bindTexture(gl.TEXTURE_2D, this.focusTextures[0]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[1]);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.focusTextures[1]);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[0]);
        }
        // draw
        const primitiveType = gl.TRIANGLES;
        const offset = 0;
        const count = 6;
        gl.drawArrays(primitiveType, offset, count);
    }

    pushToGPU() {
        const gl = this.gl;
        this.focusMap.updatePixels();
        for (let texture of this.focusTextures) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.focusMap.width, this.focusMap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.focusMap.imageData);
        }
    }

    pullFromGPU() {
        const gl = this.gl;
        this.renderFocusMap();
        gl.readPixels(0, 0, this.focusMap.width, this.focusMap.height, gl.RGBA, gl.UNSIGNED_BYTE, this.focusMap.imageData);
        this.focusMap.updateFromPixels();
    }

    createFocusTexture(pixelData: Uint8Array): WebGLTexture {
        const gl = this.gl;
        const texture = createAndSetupTexture(gl, 0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.focusMap.width, this.focusMap.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return texture;
    }

    createFramebuffer(texture: WebGLTexture) {
        const gl = this.gl;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return framebuffer;
    }

    clearFocusMap() {
        this.focusMap.clear();
    }
}
