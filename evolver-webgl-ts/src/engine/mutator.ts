import { PatchOperation, PatchOperationReplace, PatchOperationAppend } from "./patch";
import { Triangle, Point, NewTriangle } from "./triangle";
import { FocusMap } from "./focus";
import { getRandomSign, getRandomInt } from "./util";
import { ColorHints, Color } from "./colors";
import { Config } from "./config";


export class Mutator {

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private colorHints: ColorHints,
        private config: Config,
    ) {}

    randomTriangle(focusMap: FocusMap = undefined): Triangle {
        const triangle = NewTriangle();
        let ok = false;

        while (!ok) {
            this.randomizeTriangle(triangle);
            if (focusMap && this.config.focusExponent > 0) {
                // Cubic distribution favoring higher values
                let r = Math.random();
                for (let i = 1; i < this.config.focusExponent; i++) {
                    r = r * Math.random();
                }
                const i = 1 - r;
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
            triangle.points[i].distance = Math.random() * (
                this.config.maxTriangleRadius - this.config.minTriangleRadius) + this.config.minTriangleRadius;
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
            this.config.minColorMutation,
            this.config.maxColorMutation,
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
        if (value < min) {
            value = min;
        }
        if (value > max) {
            value = max;
        }
        return value;
    }

    getColorHint(triangle: Triangle): Color {
        const radius = this.getTriangleRadius(triangle);
        let x1 = triangle.x - radius;
        let x2 = triangle.x + radius;
        let y1 = triangle.y - radius;
        let y2 = triangle.y + radius;
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

    private getTriangleRadius(triangle: Triangle): number {
        let maxRadius = 0;
        for (let point of triangle.points) {
            if (point.distance > maxRadius) {
                maxRadius = point.distance;
            }
        }
        return maxRadius;
    }
}
