var PatchOperationAppend = "a";
var PatchOperationDelete = "d";
var PatchOperationReplace = "r";
var PatchOperationSwap = "s";

// // A PatchOperation represents a single element of a patch.
// type PatchOperation struct {
// 	InstructionHash1 string `json:"hash1,omitempty"`
// 	InstructionHash2 string `json:"hash2,omitempty"`
// 	InstructionData  []byte `json:"data,omitempty"`
// 	InstructionType  string `json:"type,omitempty"`
// 	OperationType    string `json:"op"`
// }

function PatchOperation() {
    // TODO: make this more portable if inter-PC
    // collaboration becomes a thing again.
    this.operationType = null;
    this.mutationType = null;
    this.instruction = null;
    this.index1 = null;
    this.index2 = null;
    this.applyFunctions = {};
    this.applyFunctions[PatchOperationAppend] = this.append.bind(this);
    this.applyFunctions[PatchOperationDelete] = this.delete.bind(this);
    this.applyFunctions[PatchOperationReplace] = this.replace.bind(this);
    this.applyFunctions[PatchOperationSwap] = this.swap.bind(this);
    this.undoFunctions = {};
    this.undoFunctions[PatchOperationAppend] = this.undoAppend.bind(this);
    this.undoFunctions[PatchOperationDelete] = this.undoDelete.bind(this);
    this.undoFunctions[PatchOperationReplace] = this.replace.bind(this);
    this.undoFunctions[PatchOperationSwap] = this.swap.bind(this);
}

PatchOperation.prototype.apply = function(instructions) {
    this.applyFunctions[this.operationType](instructions);
}

PatchOperation.prototype.undo = function(instructions) {
    this.undoFunctions[this.operationType](instructions);
}

PatchOperation.prototype.append = function(instructions) {
    instructions.push(this.instruction);
}

PatchOperation.prototype.undoAppend = function(instructions) {
    instructions.pop();
}

// PatchOperation.prototype.delete = function(instructions) {
//     this.instruction = instructions.splice(this.index1, 1)[0];
// }

// PatchOperation.prototype.undoDelete = function(instructions) {
//     instructions.splice(this.index1, 0, this.instruction);
// }

PatchOperation.prototype.delete = function(instructions) {
    var instruction = instructions[this.index1];
    this.instruction = JSON.parse(JSON.stringify(instructions[this.index1]));
    for (let point of instruction.points) {
        point.distance = 0;
    }
    instruction.deleted = true;
}

PatchOperation.prototype.undoDelete = function(instructions) {
    instructions[this.index1] = this.instruction;
}

PatchOperation.prototype.replace = function(instructions) {
    var tmp = this.instruction;
    this.instruction = instructions[this.index1];
    instructions[this.index1] = tmp;
}

PatchOperation.prototype.swap = function(instructions) {
    var instruction1 = instructions[this.index1];
    var instruction2 = instructions[this.index2];
    instructions[this.index1] = instruction2;
    instructions[this.index2] = instruction1;
}