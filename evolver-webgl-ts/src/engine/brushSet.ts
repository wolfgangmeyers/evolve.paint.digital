export interface BrushSetData {

    brushDataUri: string;
    width: number;
    height: number;

    brushes: Array<Rect>;
}

export interface Rect {
    top: number;
    left: number;
    right: number;
    bottom: number;
}

export class BrushSet {
    constructor(
        /** Serializable form of the brush definitions */
        private data: BrushSetData,
        /** RGBA data meant to be fed into the GPU */
        private pixels: Uint8Array,
    ) {
    }

    save(): string {
        return JSON.stringify(this.data);
    }

    getPixels(): Uint8Array {
        return this.pixels;
    }

    width(): number {
        return this.data.width;
    }

    height(): number {
        return this.data.height;
    }

    addBrush(brush: Rect) {
        this.data.brushes.push(brush);
    }

    getPositionRect(brushIndex: number): Rect {
        return this.data.brushes[brushIndex];
    }

    getTextureRect(brushIndex: number): Rect {
        const brush = this.data.brushes[brushIndex];
        // Y is flipped for texcoords
        return {
            top: brush.top / this.data.height,
            left: brush.left / this.data.width,
            right: brush.right / this.data.width,
            bottom: brush.bottom / this.data.height,
        }
    }
}
