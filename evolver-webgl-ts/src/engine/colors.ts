import { getRandomInt } from "./util";
import * as d3 from "d3-color";

function getAllColors(): Array<Color> {
    const colors: Array<Color> = [];
    // Build up the array of colors
    for (let r = 0; r <= 1; r += 1.0 / 16) {
        for (let g = 0; g <= 1; g += 1.0 / 16) {
            for (let b = 0; b <= 1; b += 1.0 / 16) {
                const rgb = d3.rgb(r, g, b, 1);
                const lab = d3.lab(rgb);
                colors.push({
                    rgb: {
                        r: rgb.r,
                        g: rgb.g,
                        b: rgb.b,
                    },
                    lab: {
                        l: lab.l,
                        a: lab.a,
                        b: lab.b,
                    },
                    neighbors: [],
                    hexCode: rgb.hex(),
                });
            }
        }
    }
    // n squared algorithm for pairing up colors
    // with their nearest neighbors in the lab color space
    // get the 10 closest neighbors for each color and
    // order them in ascending order of distance.
    // This is really expensive in the CPU, but only needs to be
    // done once. This keeps us from needing to convert back and
    // forth in the GPU, which would be much more expensive in
    // the long run.
    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        for (let j = 0; j < colors.length; j++) {
            // Don't compare a color to itself
            if (j == i) {
                continue;
            }
            const otherColor = colors[j];
            // Calculate euclidian distance between colors in lab space
            const distance = measureDistance(color.lab, otherColor.lab);
            color.neighbors.push({
                index: j,
                distance: distance,
            });
        }
        // Sort by distance ascending
        color.neighbors.sort(neighbor => neighbor.distance);
        // Keep only the 10 closest neighbors
        color.neighbors = color.neighbors.slice(0, 10);
    }
    return colors;
}

function measureDistance(lab1: LAB, lab2: LAB): number {
    return Math.sqrt(
        Math.pow(lab2.l - lab1.l, 2) +
        Math.pow(lab2.a - lab1.a, 2) +
        Math.pow(lab2.b - lab1.b, 2)
    );
}

function indexColorsByHex(colors: Array<Color>): { [key: string]: Color } {
    const colorsByHex: { [key: string]: Color } = {};
    for (let color of colors) {
        colorsByHex[color.hexCode] = color;
    }
    return colorsByHex;
}

const allColors = getAllColors();
const colorsByHex = indexColorsByHex(allColors);

export function getColorByIndex(index: number): Color {
    return allColors[index];
}

export function getColorByHexCode(hexCode: string): Color {
    // attempt to get the color by an existing indexed hex code
    // floating point math may skew a color slightly, so if the
    // lookup fails, find the nearest match and index it by this
    // hex code so that the lookup is cached.
    let color = colorsByHex[hexCode];
    if (!color) {
        let closest = 100000;
        let match: Color = null;
        for (let c of allColors) {
            const distance = measureDistance(color.lab, c.lab);
            if (distance < closest) {
                closest = distance;
                match = c;
            }
        }
        color = match;
        colorsByHex[hexCode] = color;
    }
    return color;
}

export interface Neighbor {
    index: number;
    distance: number;
}

export interface Color {
    rgb: RGB;
    lab: LAB;
    hexCode: string;
    // indexes of closest neighbors in global list of colors.
    // can be used to traverse the color space
    neighbors: Array<Neighbor>;
}

export interface LAB {
    l: number;
    a: number;
    b: number;
}

export interface RGB {
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
                // Map the color from the image data to the
                // global color by matching based on hex code.
                const r = imageData[ptr++] / 255.0;
                const g = imageData[ptr++] / 255.0;
                const b = imageData[ptr++] / 255.0;
                const a = imageData[ptr++] / 255.0;

                if (a == 0) {
                    this.matrix[x][y] = randomColor();
                } else {
                    const rgb = d3.rgb(r, g, b);
                    const color = getColorByHexCode(rgb.hex());
                    this.matrix[x][y] = color;
                }
            }
        }
    }
}

function randomColor(): Color {
    const i = getRandomInt(0, allColors.length);
    return allColors[i];
}
