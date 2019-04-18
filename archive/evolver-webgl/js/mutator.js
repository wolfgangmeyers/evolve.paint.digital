var MutationTypeAppend = "append";
var MutationTypePosition = "position";
var MutationTypeColor = "color";
var MutationTypePoints = "points";
var MutationTypeDelete = "delete";

function Mutator(imageWidth, imageHeight, maxTriangles) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.minTriangleRadius = imageWidth / 1000;
    this.maxTriangleRadius = imageWidth / 20;
    this.maxInstructions = maxTriangles;
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

Mutator.prototype.mutate = function(instructions, focusMap) {
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
        if (focusMap) {
            var i = Math.random();
            var position = patchOperation.getPosition(instructions);
            var x = Math.floor((position.x / this.imageWidth) * focusMap.width);
            var y = Math.floor((position.y / this.imageHeight) * focusMap.height);
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
            var value = focusMap.getValue(x, y);
            if (value < i) {
                patchOperation = null;
            }
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
    this.patchOperation.index1 = instructions.length;
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

