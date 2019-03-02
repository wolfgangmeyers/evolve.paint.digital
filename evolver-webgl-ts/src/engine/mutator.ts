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
    private minPositionMutation: number;
    private maxPositionMutation: number;
    private minPointDistanceMutation: number;
    private maxPointDistanceMutation: number;
    private minPointAngleMutation: number;
    private maxPointAngleMutation: number;
    private minColorMutation: number;
    private maxColorMutation: number;
    private patchOperation: PatchOperation;

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private maxInstructions: number,
    ) {
        // TODO: these are arbitrary numbers that are relative
        // to image width. Allow these to be customizable
        this.minTriangleRadius = imageWidth / 1000;
        this.maxTriangleRadius = imageWidth / 20;
        this.minPositionMutation = imageWidth / 1000;
        this.maxPositionMutation = imageWidth / 100;
        this.minPointDistanceMutation = imageWidth / 1000;
        this.maxPointDistanceMutation = imageWidth / 100;
        this.minPointAngleMutation = 0.01;
        this.maxPointAngleMutation = 0.1;
        this.minColorMutation = 0.001;
        this.maxColorMutation = 0.05;
        this.patchOperation = new PatchOperation();
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

    mutate(
        instructions: Array<Triangle>,
        focusMap: FocusMap = undefined,
    ) {
        let patchOperation: PatchOperation;
        while (!patchOperation) {
            var i = getRandomInt(0, 2);
            switch (i) {
                case 0:
                    patchOperation = this.appendRandomInstruction(instructions);
                    break;
                case 1:
                    patchOperation = this.mutateRandomInstruction(instructions);
                    break;
            }
            if (focusMap) {
                const i = Math.random();
                const position = patchOperation.getPosition(instructions);
                let x = Math.floor((position.x / this.imageWidth) * focusMap.width);
                let y = Math.floor((position.y / this.imageHeight) * focusMap.height);
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
                if (value < i) {
                    patchOperation = null;
                }
            }
        }
        return patchOperation;
    }

    appendRandomInstruction(instructions: Array<Triangle>) {
        if (instructions.length >= this.maxInstructions) {
            return null;
        }
        this.patchOperation.operationType = PatchOperationAppend;
        this.patchOperation.mutationType = MutationTypeAppend;
        this.patchOperation.instruction = NewTriangle();
        this.patchOperation.index1 = instructions.length;
        this.randomizeTriangle(this.patchOperation.instruction);
        return this.patchOperation;
    }

    mutateRandomInstruction(instructions: Array<Triangle>) {
        if (instructions.length == 0) {
            return null;
        }
        this.patchOperation.operationType = PatchOperationReplace;
        this.patchOperation.index1 = getRandomInt(0, instructions.length);
        this.patchOperation.instruction = JSON.parse(JSON.stringify(
            instructions[this.patchOperation.index1]));
        return this.mutateInstruction(this.patchOperation.instruction);
    }

    mutateInstruction(instruction: Triangle) {
        switch (getRandomInt(0, 3)) {
            case 0:
                this.patchOperation.mutationType = MutationTypePosition;
                this.mutatePosition(this.patchOperation.instruction);
                break;
            case 1:
                this.patchOperation.mutationType = MutationTypeColor;
                this.mutateColor(this.patchOperation.instruction);
                break;
            case 2:
                this.patchOperation.mutationType = MutationTypePoints;
                this.mutatePoints(this.patchOperation.instruction);
        }
        return this.patchOperation;
    }

    mutatePoints(instruction: Triangle) {
        // Select a random point
        const point = instruction.points[getRandomInt(0, instruction.points.length)];
        this.mutatePoint(point);
    }

    mutatePoint(point: Point) {
        if (getRandomInt(0, 2) == 0) {
            point.distance = this.mutateValue(
                this.minTriangleRadius,
                this.maxTriangleRadius,
                this.minPointDistanceMutation,
                this.maxPointDistanceMutation,
                point.distance,
            );
        } else {
            point.angle = this.mutateValue(
                0,
                Math.PI * 2,
                this.minPointAngleMutation,
                this.maxPointAngleMutation,
                point.angle,
            );
        }
    }

    mutateColor(instruction: Triangle) {
        for (let i = 0; i < 3; i++) {
            if (getRandomInt(0, 2) == 0) {
                instruction.color[i] = this.mutateValue(
                    0,
                    1,
                    this.minColorMutation,
                    this.maxColorMutation,
                    instruction.color[i],
                );
            }
        }
    }

    mutatePosition(instruction: Triangle) {
        instruction.x = this.mutateValue(
            0,
            this.imageWidth,
            this.minPositionMutation,
            this.maxPositionMutation,
            instruction.x,
        );
        instruction.y = this.mutateValue(
            0,
            this.imageHeight,
            this.minPositionMutation,
            this.maxPositionMutation,
            instruction.y,
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
}