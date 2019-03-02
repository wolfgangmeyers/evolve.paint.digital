import { Triangle } from "./triangle";
import { Position } from "./position";

export const PatchOperationAppend = "a";
export const PatchOperationDelete = "d";
export const PatchOperationReplace = "r";
export const PatchOperationSwap = "s";

export type ApplyFunction = (
    instructions: Array<Triangle>
) => void;

export class PatchOperation {
    public operationType: string;
    public mutationType: string;
    public instruction: Triangle;
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

    append(instructions: Array<Triangle>) {
        instructions.push(this.instruction);
        this.position.x = this.instruction.x;
        this.position.y = this.instruction.y;
    }

    undoAppend(instructions: Array<Triangle>) {
        instructions.pop();
    }

    delete(instructions: Array<Triangle>) {
        const instruction = instructions[this.index1];
        this.instruction = JSON.parse(JSON.stringify(instructions[this.index1]));
        for (let point of instruction.points) {
            point.distance = 0;
        }
        instruction.deleted = true;
    }

    undoDelete(instructions: Array<Triangle>) {
        instructions[this.index1] = this.instruction;
    }

    replace(instructions: Array<Triangle>) {
        const tmp = this.instruction;
        this.instruction = instructions[this.index1];
        instructions[this.index1] = tmp;
    }

    getPosition(instructions: Array<Triangle>): Position {
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