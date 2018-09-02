var MutationTypeAppend = "append";
var MutationTypePosition = "position";
var MutationTypeColor = "color";
var MutationTypePoints = "points";

function Mutator(imageWidth, imageHeight, maxTriangles) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.minTriangleRadius = 5.0;
    this.maxTriangleRadius = 50.0;
    this.maxInstructions = maxTriangles;
    this.minPositionMutation = 1;
    this.maxPositionMutation = 10;
    this.minPointDistanceMutation = 0.1;
    this.maxPointDistanceMutation = 5;
    this.minPointAngleMutation = 0.1;
    this.maxPointAngleMutation = 1;
    this.minColorMutation = 0.01;
    this.maxColorMutation = 0.1;
    this.patchOperation = new PatchOperation();
}

Mutator.prototype.randomizeTriangle = function(triangle) {
    triangle.x = Math.random() * this.imageWidth;
    triangle.y = Math.random() * this.imageHeight;
    triangle.color[0] = Math.random() * 1;
    triangle.color[1] = Math.random() * 1;
    triangle.color[2] = Math.random() * 1;
    triangle.color[3] = 1;
    for (var i = 0; i < 3; i++) {
        triangle.points[i].distance = Math.random() * (this.maxTriangleRadius - this.minTriangleRadius) + this.minTriangleRadius;
        triangle.points[i].angle = Math.random() * Math.PI * 2;
    }
    return triangle;
}

Mutator.prototype.mutate = function(instructions) {
    var patchOperation = null;
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
    }
    return patchOperation;
}

Mutator.prototype.appendRandomInstruction = function(instructions) {
    if (instructions.length >= this.maxInstructions) {
        return null;
    }
    this.patchOperation.operationType = PatchOperationAppend;
    this.patchOperation.mutationType = MutationTypeAppend;
    this.patchOperation.instruction = new Triangle();
    this.randomizeTriangle(this.patchOperation.instruction);
    return this.patchOperation;
}

Mutator.prototype.mutateRandomInstruction = function(instructions) {
    if (instructions.length == 0) {
        return null;
    }
    this.patchOperation.operationType = PatchOperationReplace;
    this.patchOperation.index1 = getRandomInt(0, instructions.length);
    this.patchOperation.instruction = JSON.parse(JSON.stringify(
        instructions[this.patchOperation.index1]));
    return this.mutateInstruction(this.patchOperation.instruction);
}

Mutator.prototype.mutateInstruction = function(instruction) {
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

Mutator.prototype.mutatePoints = function(instruction) {
    // Select a random point
    var point = instruction.points[getRandomInt(0, instruction.points.length)];
    this.mutatePoint(point);
}

Mutator.prototype.mutatePoint = function(point) {
    if (getRandomInt(0, 2) == 0) {
        point.distance = this.mutateValue(this.minTriangleRadius, this.maxTriangleRadius, this.minPointDistanceMutation, this.maxPointDistanceMutation, point.distance);
    } else {
        point.angle = this.mutateValue(0, Math.PI * 2, this.minPointAngleMutation, this.maxPointAngleMutation, point.angle);
    }
}

Mutator.prototype.mutateColor = function(instruction) {
    for (var i = 0; i < 3; i++) {
        if (getRandomInt(0, 2) == 0) {
            instruction.color[i] = this.mutateValue(0, 1, this.minColorMutation, this.maxColorMutation, instruction.color[i]);
        }
    }
}

Mutator.prototype.mutatePosition = function(instruction) {
    instruction.x = this.mutateValue(0, this.imageWidth, this.minPositionMutation, this.maxPositionMutation, instruction.x);
    instruction.y = this.mutateValue(0, this.imageHeight, this.minPositionMutation, this.maxPositionMutation, instruction.y);
}

Mutator.prototype.mutateValue = function(min, max, minDelta, maxDelta, value) {
    var amt = (Math.random() * (maxDelta - minDelta) + minDelta) * getRandomSign();
    value = value + amt;
    while (value < min) {
        value = value + (max - min);
    }
    while (value > max) {
        value = value - (max - min);
    }
    return value;
}

