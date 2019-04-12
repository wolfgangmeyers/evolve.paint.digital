import { PatchOperation, PatchOperationReplace, PatchOperationAppend } from "./patch";
import { Triangle, Point, NewTriangle } from "./triangle";
import { FocusMap } from "./focus";
import { getRandomSign, getRandomInt } from "./util";

export const MutationTypeAppend = "append";
export const MutationTypePosition = "position";
export const MutationTypeColor = "color";
export const MutationTypePoints = "points";
export const MutationTypeDelete = "delete";

export class Mutator {

    private minTriangleRadius: number;
    private maxTriangleRadius: number;

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private maxInstructions: number,
    ) {
        // TODO: these are arbitrary numbers that are relative
        // to image width. Allow these to be customizable
        this.minTriangleRadius = imageWidth / 1000;
        this.maxTriangleRadius = imageWidth / 20;
    }

    randomTriangle(focusMap: FocusMap=undefined): Triangle {
        const triangle = NewTriangle();
        let ok = false;
        const i = Math.random();
        while (!ok) {
            this.randomizeTriangle(triangle);
            if (focusMap) {
                let x = Math.floor((triangle.x / this.imageWidth) * focusMap.width);
                let y = Math.floor((triangle.y / this.imageHeight) * focusMap.height);
                if (x >= focusMap.width) {
                    x = focusMap.width - 1;
                }
                if (x < 0) {
                    x = 0;
                }
                if (y >= focusMap.height) {
                    y = focusMap.height - 1;
                }
                if (y < 0) {
                    y = 0;
                }
                const value = focusMap.getValue(x, y);
                if (value >= i) {
                    ok = true;
                }
            } else {
                ok = true;
            }
        }
        return triangle;
    }

    randomizeTriangle(triangle: Triangle): Triangle {
        triangle.x = Math.random() * this.imageWidth;
        triangle.y = Math.random() * this.imageHeight;
        triangle.color[0] = Math.random() * 1;
        triangle.color[1] = Math.random() * 1;
        triangle.color[2] = Math.random() * 1;
        triangle.color[3] = 1;
        for (let i = 0; i < 3; i++) {
            triangle.points[i].distance = Math.random() * (this.maxTriangleRadius - this.minTriangleRadius) + this.minTriangleRadius;
            triangle.points[i].angle = Math.random() * Math.PI * 2;
        }
        return triangle;
    }
}
