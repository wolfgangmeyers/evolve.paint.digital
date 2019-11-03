import { BrushStroke } from "./brushStroke";
import { Position } from "./position";

export const PatchOperationAppend = "a";
export const PatchOperationDelete = "d";
export const PatchOperationReplace = "r";
export const PatchOperationSwap = "s";

export type ApplyFunction = (
    instructions: Array<BrushStroke>
) => void;

export class PatchOperation {
    public operationType: string;
    public mutationType: string;
    public instruction: BrushStroke;
    public index1: number;
    private index2: number;
    private applyFunctions: {[key: string]: ApplyFunction};
    private undoFunctions: {[key: string]: ApplyFunction};
    private position: Position;

    constructor() {
        this.applyFunctions = {};
        this.applyFunctions[PatchOperationAppend] = this.append.bind(this);
        this.applyFunctions[PatchOperationDelete] = this.delete.bind(this);
        this.applyFunctions[PatchOperationReplace] = this.replace.bind(this);
        this.undoFunctions = {};
        this.undoFunctions[PatchOperationAppend] = this.undoAppend.bind(this);
        this.undoFunctions[PatchOperationDelete] = this.undoDelete.bind(this);
        this.undoFunctions[PatchOperationReplace] = this.replace.bind(this);
        this.position = {
            x: 0,
            y: 0,
        };
    }

    apply(instructions: Array<BrushStroke>) {
        this.applyFunctions[this.operationType](instructions);
    }

    undo(instructions: Array<BrushStroke>) {
        this.undoFunctions[this.operationType](instructions);
    }

    append(instructions: Array<BrushStroke>) {
        instructions.push(this.instruction);
        this.position.x = this.instruction.x;
        this.position.y = this.instruction.y;
    }

    undoAppend(instructions: Array<BrushStroke>) {
        instructions.pop();
    }

    delete(instructions: Array<BrushStroke>) {
        const instruction = instructions[this.index1];
        this.instruction = JSON.parse(JSON.stringify(instructions[this.index1]));
        instruction.x = 10000;
        instruction.deleted = true;
    }

    undoDelete(instructions: Array<BrushStroke>) {
        instructions[this.index1] = this.instruction;
    }

    replace(instructions: Array<BrushStroke>) {
        const tmp = this.instruction;
        this.instruction = instructions[this.index1];
        instructions[this.index1] = tmp;
    }

    getPosition(instructions: Array<BrushStroke>): Position {
        if (this.operationType == PatchOperationAppend) {
            this.position.x = this.instruction.x;
            this.position.y = this.instruction.y;
        } else {
            const instruction = instructions[this.index1];
            this.position.x = instruction.x;
            this.position.y = instruction.y;
        }
        return this.position;
    }
}
