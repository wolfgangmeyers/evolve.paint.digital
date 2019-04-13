import { PatchOperation, PatchOperationReplace, PatchOperationAppend } from "./patch";
import { Triangle, Point, NewTriangle } from "./triangle";
import { FocusMap } from "./focus";
import { getRandomSign, getRandomInt } from "./util";
import { ColorHints, Color } from "./colors";

export const MutationTypeAppend = "append";
export const MutationTypePosition = "position";
export const MutationTypeColor = "color";
export const MutationTypePoints = "points";
export const MutationTypeDelete = "delete";

export class Mutator {

    private minTriangleRadius: number;
    private maxTriangleRadius: number;
    private minColorMutation: number;
    private maxColorMutation: number;

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private colorHints: ColorHints,
    ) {
        // TODO: these are arbitrary numbers that are relative
        // to image width. Allow these to be customizable
        this.minTriangleRadius = imageWidth / 1000;
        this.maxTriangleRadius = imageWidth / 20;
        this.minColorMutation = 0.001;
        this.maxColorMutation = 0.05;
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
        const colorHint = this.getColorHint(triangle);

        this.applyColorHint(triangle, colorHint);
        for (let i = 0; i < 3; i++) {
            triangle.points[i].distance = Math.random() * (this.maxTriangleRadius - this.minTriangleRadius) + this.minTriangleRadius;
            triangle.points[i].angle = Math.random() * Math.PI * 2;
        }
        return triangle;
    }

    applyColorHint(triangle: Triangle, colorHint: Color) {
        triangle.color[0] = colorHint.r;
        triangle.color[1] = colorHint.g;
        triangle.color[2] = colorHint.b;
        triangle.color[3] = 1;
        for (let i = 0; i < 3; i++) {
            if (getRandomInt(0, 2) == 0) {
                triangle.color[i] = this.mutateColorComponent(triangle.color[i]);
            }
        }
    }

    mutateColorComponent(component: number): number {
        return this.mutateValue(
            0,
            1,
            this.minColorMutation,
            this.maxColorMutation,
            component,
        );
    }

    mutateValue(
        min: number,
        max: number,
        minDelta: number,
        maxDelta: number,
        value: number,
    ): number {
        const amt = (Math.random() * (maxDelta - minDelta) + minDelta) * getRandomSign();
        value = value + amt;
        while (value < min) {
            value = value + (max - min);
        }
        while (value > max) {
            value = value - (max - min);
        }
        return value;
    }

    getColorHint(triangle: Triangle): Color {
        let x1 = triangle.x - this.maxTriangleRadius * 3;
        let x2 = triangle.x + this.maxTriangleRadius * 3;
        let y1 = triangle.y - this.maxTriangleRadius * 3;
        let y2 = triangle.y + this.maxTriangleRadius * 3;
        let x = Math.floor(Math.random() * (x2 - x1)) + Math.floor(x1);
        let y = Math.floor(Math.random() * (y2 - y1)) + Math.floor(y1);
        if (x < 0) {
            x = 0;
        }
        if (x >= this.imageWidth) {
            x = this.imageWidth - 1;
        }
        if (y < 0) {
            y = 0;
        }
        if (y >= this.imageHeight) {
            y = this.imageHeight - 1;
        }
        return this.colorHints.getColor(x, y);
    }
}
