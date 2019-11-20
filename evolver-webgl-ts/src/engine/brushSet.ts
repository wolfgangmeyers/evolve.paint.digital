export interface BrushSetData {

    brushDataUri: string;
    width: number;
    height: number;

    brushes: Array<Brush>;
}

export interface Brush extends Rect {
    tag: string;
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

    getBrushCount(): number {
        return this.data.brushes.length;
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

    addBrush(brush: Brush) {
        this.data.brushes.push(brush);
    }

    getPositionRect(brushIndex: number): Rect {
        return this.data.brushes[brushIndex];
    }

    getBrushTag(brushIndex: number): string {
        return this.data.brushes[brushIndex].tag;
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

    getTags(): Array<string> {
        // Assume that the brushes are not be grouped by tag
        const result: Array<string> = [];
        const set = {};
        let tag = null;
        for (let brush of this.data.brushes) {
            set[brush.tag] = true;
        }
        for (let tag of Object.keys(set)) {
            result.push(tag);
        }
        return result;
    }
}
