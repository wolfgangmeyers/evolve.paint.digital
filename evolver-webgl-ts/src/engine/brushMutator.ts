import { PatchOperation, PatchOperationReplace, PatchOperationAppend } from "./brushPatch";
import { BrushStroke, NewBrushStroke } from "./brushStroke";
import { FocusMap } from "./focus";
import { getRandomSign, getRandomInt, normalizeAngle } from "./util";
import { Config } from "./brushConfig";
import { Point } from "./point";

export const MutationTypeAppend = "append";
export const MutationTypePosition = "position";
export const MutationTypeColor = "color";
export const MutationTypeRotation = "rotation";
export const MutationTypeDelete = "delete";

export class Mutator {

    private minPositionMutation: number;
    private maxPositionMutation: number;
    private minAngleMutation: number;
    private maxAngleMutation: number;
    private patchOperation: PatchOperation;

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private config: Config,
        private brushCount: number,
    ) {
        // TODO: these are arbitrary numbers that are relative
        // to image width. Allow these to be customizable
        this.minPositionMutation = imageWidth / 1000;
        this.maxPositionMutation = imageWidth / 100;
        this.minAngleMutation = 0.01;
        this.maxAngleMutation = 0.1;
        this.patchOperation = new PatchOperation();
    }

    randomizeBrushStroke(stroke: BrushStroke): BrushStroke {
        stroke.x = Math.random() * this.imageWidth;
        stroke.y = Math.random() * this.imageHeight;
        stroke.color[0] = Math.random() * 1;
        stroke.color[1] = Math.random() * 1;
        stroke.color[2] = Math.random() * 1;
        stroke.color[3] = 1;
        stroke.rotation = normalizeAngle(Math.random() * Math.PI * 2);
        stroke.brushIndex = Math.floor(Math.random() * this.brushCount);
        return stroke;
    }

    mutate(
        instructions: Array<BrushStroke>,
        focusMap: FocusMap = undefined,
        focusPin: Point = null,
    ) {
        let patchOperation: PatchOperation;
        while (!patchOperation) {
            var i = getRandomInt(0, 2);
            // Focus pin overrides the map
            if (focusPin) {
                patchOperation = this.appendRandomInstruction(instructions);
                // move instruction closer to the pin
                const xDiff = patchOperation.instruction.x - focusPin.x;
                const yDiff = patchOperation.instruction.y - focusPin.y;
                patchOperation.instruction.x = focusPin.x + (xDiff / 10);
                patchOperation.instruction.y = focusPin.y + (yDiff / 10);
            } else {
                switch (i) {
                    case 0:
                        patchOperation = this.appendRandomInstruction(instructions);
                        break;
                    case 1:
                        patchOperation = this.mutateRandomInstruction(instructions);
                        break;
                }
                if (patchOperation && !this.config.enabledMutations[patchOperation.mutationType]) {
                    patchOperation = null;
                    continue;
                }
                if (patchOperation && focusMap && this.config.focusExponent > 0) {
                    // Cubic distribution favoring higher values
                    let r = Math.random();
                    for (let i = 1; i < this.config.focusExponent; i++) {
                        r = r * Math.random();
                    }
                    const i = 1 - r;
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

        }
        return patchOperation;
    }

    appendRandomInstruction(instructions: Array<BrushStroke>) {
        this.patchOperation.operationType = PatchOperationAppend;
        this.patchOperation.mutationType = MutationTypeAppend;
        this.patchOperation.instruction = NewBrushStroke();
        this.patchOperation.index1 = instructions.length;
        this.randomizeBrushStroke(this.patchOperation.instruction);
        return this.patchOperation;
    }

    mutateRandomInstruction(instructions: Array<BrushStroke>) {
        if (instructions.length == 0) {
            return null;
        }
        this.patchOperation.operationType = PatchOperationReplace;
        this.patchOperation.index1 = getRandomInt(0, instructions.length);
        this.patchOperation.instruction = JSON.parse(JSON.stringify(
            instructions[this.patchOperation.index1]));
        return this.mutateInstruction(this.patchOperation.instruction);
    }

    mutateInstruction(instruction: BrushStroke) {
        switch (getRandomInt(0, 2)) {
            case 0:
                this.patchOperation.mutationType = MutationTypePosition;
                this.mutatePosition(this.patchOperation.instruction);
                break;
            case 1:
                this.patchOperation.mutationType = MutationTypeRotation;
                this.mutateRotation(this.patchOperation.instruction);
                break;
            // this.patchOperation.mutationType = MutationTypeColor;
            // this.mutateColor(this.patchOperation.instruction);
            // break;
            case 2:
                this.patchOperation.mutationType = MutationTypeRotation;
                this.mutateRotation(this.patchOperation.instruction);
        }
        return this.patchOperation;
    }

    mutateRotation(instruction: BrushStroke) {
        instruction.rotation = normalizeAngle(this.mutateValue(
            0,
            Math.PI * 2,
            this.minAngleMutation,
            this.maxAngleMutation,
            instruction.rotation,
        ))
    }

    mutateColor(instruction: BrushStroke) {
        for (let i = 0; i < 3; i++) {
            if (getRandomInt(0, 2) == 0) {
                instruction.color[i] = this.mutateValue(
                    0,
                    1,
                    this.config.minColorMutation,
                    this.config.maxColorMutation,
                    instruction.color[i],
                );
            }
        }
    }

    mutatePosition(instruction: BrushStroke) {
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
        if (value < min) {
            value = min
        }
        if (value > max) {
            value = max;
        }
        return value;
    }
}
