/**
 * Fixed-size webgl attribute buffer. Encapsulates all logic
 * to push data to webgl attribute arrays.
 */
export class Attribute {

    public data: Array<number>;
    private array: Float32Array;
    private attributeLocation: number;

    constructor(
        private gl: WebGL2RenderingContext,
        private program: WebGLProgram,
        public name: string,
        public unitSize: number,
        public unitCount: number,
        public buffer: WebGLBuffer = null,
    ) {
        this.data = [];
        // populate data with zeros
        const arrayLen = unitSize * unitCount;
        for (let i = 0; i < arrayLen; i++) {
            this.data.push(0);
        }
        this.array = new Float32Array(arrayLen);
        if (this.buffer == null) {
            this.buffer = gl.createBuffer();
        }
        this.attributeLocation = gl.getAttribLocation(this.program, this.name);
    }

    enable() {
        this.gl.enableVertexAttribArray(this.attributeLocation);
    }

    /**
     * Writes zeroes to the buffer based on unit size and count.
     */
    initialize() {
        this.bindBuffer();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.unitCount * this.unitSize * 4, this.gl.DYNAMIC_DRAW);
    }

    bindBuffer() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }

    bufferData() {
        
        // Copy data to GPU
        this.bindBuffer();
        // Sync data to array
        this.array.set(this.data, 0);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.array, this.gl.DYNAMIC_DRAW);
    }

    /**
     * 
     * @param desetOffset Offset (in units) in the buffer to start writing
     * @param srcOffset Offset (in units) to start in the data
     * @param srcCount Count of units to copy
     */
    bufferSubData(destOffset: number, srcOffset: number, srcCount: number) {
        // console.log(`destOffset=${destOffset}, srcOffset=${srcOffset}, srcCount=${srcCount} (1)`);
        // convert offsets from units into respective numbers for webgl
        // Destination offset in bytes
        destOffset = destOffset * (this.unitSize * 4);
        // Source offset in floats
        srcOffset = srcOffset * this.unitSize;
        // length in floats
        srcCount = srcCount * this.unitSize;
        // console.log(`destOffset=${destOffset}, srcOffset=${srcOffset}, srcCount=${srcCount} (2)`);
        
        // Copy data to GPU
        this.bindBuffer();
        // Sync data to array
        this.array.set(this.data, 0);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, destOffset, this.array, srcOffset, srcCount);
    }

    /**
     * Attaches the attribute to the buffer
     */
    attach() {
        // components per vertex (triangles have three vertices)
        const size = this.unitSize / 3;
        const type = this.gl.FLOAT; // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0; // start at the beginning of the buffer
        this.gl.vertexAttribPointer(this.attributeLocation, size, type, normalize, stride, offset);
    }

    dispose() {
        this.gl.deleteBuffer(this.buffer);
    }
}
