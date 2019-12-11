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

export async function loadBrushSet(brushData: string, brushes: Array<Brush>): Promise<BrushSet> {
    return new Promise(resolve => {
        const img = new Image();
        img.src = brushData;
        img.onload = () => {
            const c2 = document.createElement("canvas");
            c2.width = img.width;
            c2.height = img.height;

            const ctx = c2.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

            // If there are no transparent pixels, assume that there is a white
            // background
            let isTransparentBackground = false;

            // convert shades of white to levels of transparent
            let maxValue = 0;
            let minValue = 10000;
            for (let c = 0; c < imageData.length; c += 4) {
                const r = imageData[c];
                if (r > maxValue) {
                    maxValue = r;
                }
                if (r < minValue) {
                    minValue = r;
                }
                const alpha = imageData[c + 3];
                // alpha of less than 10 is as good as fully transparent
                isTransparentBackground = isTransparentBackground || alpha <= 10;
            }
            // Only make the background transparent
            if (!isTransparentBackground) {
                // Based on min/max values in the image, normalize
                // the values and then assign to alpha.
                const alphaMultiplier = (maxValue - minValue) / 255.0;
                for (let c = 0; c < imageData.length; c += 4) {
                    const r = imageData[c];
                    // calculate alpha
                    // darker value is higher alpha, because of
                    // the assumed white background
                    const alpha = Math.floor(255.0 - (r - minValue) * alphaMultiplier);
                    // set alpha
                    imageData[c + 3] = alpha;
                }
            }

            // Build brush set from image data
            const brushSetData: BrushSetData = {
                brushDataUri: brushData,
                height: img.height,
                width: img.width,
                brushes: brushes,
            };
            const brushSet: BrushSet = new BrushSet(brushSetData, (imageData as any));
            resolve(brushSet);
        }
    });
}
