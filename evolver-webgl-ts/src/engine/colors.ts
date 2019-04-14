import { getRandomInt } from "./util";

export interface Color {
    r: number;
    g: number;
    b: number;
}

/**
 * ColorHints helps select colors for new paint instructions
 * by getting the colors of already rendered pixels.
 */
export class ColorHints {

    // constructed to fetch color by matrix[x][y]
    private matrix: Array<Array<Color>>;

    constructor(private width: number, private height: number) {
        this.matrix = [];
        for (let x = 0; x < width; x++) {
            const col = [];
            for (let y = 0; y < height; y++) {
                col.push(randomColor());
            }
            this.matrix.push(col);
        }
    }

    getColor(x: number, y: number): Color {
        return this.matrix[x][y];
    }

    setImageData(imageData: Uint8Array) {
        let ptr = 0;
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const r = imageData[ptr++] / 255.0;
                const g = imageData[ptr++] / 255.0;
                const b = imageData[ptr++] / 255.0;
                const a = imageData[ptr++] / 255.0;
                if (a == 0) {
                    this.matrix[x][y] = randomColor();
                } else {
                    this.matrix[x][y].r = r;
                    this.matrix[x][y].g = g;
                    this.matrix[x][y].b = b;
                }
            }
        }
    }
}

function randomColor(): Color {
    return {
        r: Math.random(),
        g: Math.random(),
        b: Math.random(),
    }
}
