function Evolver(canvas, config) {
    this.canvas = canvas;
    // Some day config will be useful. For now it is ignored.
    this.config = config;
    var gl = canvas.getContext("webgl");
    if (!gl) {
        throw new Error("Could not initialize webgl context");
    }
    this.gl = gl;

    this.rendererProgram = createProgram(gl, "renderer");
    this.rankerProgram = createProgram(gl, "ranker");
    this.shrinkerProgram = createProgram(gl, "shrinker");

    // focus map
    this.focusMapProgram = createProgram(gl, "focus");
    this.focusDisplayProgram = createProgram(gl, "focus-display");

    this.mutator = null;
    this.renderer = null;
    this.ranker = null;
    this.focusEditor = null;

    // Display
    var displayProgram = createProgram(gl, "display");
    this.display = new Display(gl, displayProgram);

    this.running = false;
    this.renderHandle = null;
    this.displayHandle = null;
    // srcImage must be populated before the evolver can start
    this.srcImage = null;

    // Flag to show focus map editor
    this.editingFocusMap = false;

    this.triangles = [];
    var mutatorstats = {};
    mutatorstats[MutationTypeAppend] = 0;
    mutatorstats[MutationTypePosition] = 0;
    mutatorstats[MutationTypeColor] = 0;
    mutatorstats[MutationTypePoints] = 0;
    mutatorstats[MutationTypeDelete] = 0;
    this.mutatorstats = mutatorstats;
    this.frames = 0;
    this.similarity = 0;
    this.totalDiff = 255 * 20000 * 20000;

    // For bulk cleanup of not-so-great instructions
    this.optimizing = false;
    this.optimizeCursor = 0;
    this.optimizeOperation = new PatchOperation();
    this.optimizeOperation.operationType = PatchOperationDelete;
    this.optimizeOperation.mutationType = MutationTypeDelete;
}

Evolver.prototype.setSrcImage = function (srcImage) {
    var gl = this.gl;
    this.srcImage = srcImage;
    $(this.canvas).attr("width", srcImage.width);
    $(this.canvas).attr("height", srcImage.height);
    if (this.renderer) {
        this.renderer.dispose();
    }
    if (this.ranker) {
        this.ranker.dispose();
    }

    this.mutator = new Mutator(gl.canvas.width, gl.canvas.height, 10000);
    this.renderer = new Renderer(gl, this.rendererProgram, 10000);
    this.ranker = new Ranker(gl, this.rankerProgram, this.shrinkerProgram, srcImage);
    this.focusEditor = new FocusEditor(gl, this.focusMapProgram, this.focusDisplayProgram, srcImage);
    this.focusMapEnabled = false;
};

Evolver.prototype.deleteFocusMap = function() {
    this.editingFocusMap = false;
    this.focusMapEnabled = false;
    this.focusEditor.focusMap.clear();
}

Evolver.prototype.editFocusMap = function() {
    this.editingFocusMap = true;
    this.focusMapEnabled = true;
    this.focusEditor.pushToGPU();
};

Evolver.prototype.saveFocusMap = function() {
    this.editingFocusMap = false;
    this.focusEditor.pullFromGPU();
};

Evolver.prototype.cancelFocusMap = function() {
    this.editingFocusMap = false;
};

Evolver.prototype.start = function () {
    if (!this.srcImage) {
        return false;
    }
    if (this.running) {
        return false;
    }
    this.running = true;
    this.renderHandle = window.setInterval(this.iterate.bind(this), 1);
    this.displayHandle = window.setInterval(this.render.bind(this), 10);
    return true;
};

Evolver.prototype.stop = function () {
    if (!this.running) {
        return false;
    }
    this.running = false;
    window.clearInterval(this.renderHandle);
    return true;
};

Evolver.prototype.optimize = function() {
    this.optimizing = true;
    this.optimizeCursor = 0;
}

Evolver.prototype.render = function() {
    if (this.editingFocusMap) {
        this.focusEditor.render();
    } else {
        this.display.render();
    }
}

Evolver.prototype.iterate = function () {
    if (this.editingFocusMap) {
        return;
    }
    for (var i = 0; i < 10; i++) {
        var patchOperation;
        if (this.optimizing && this.optimizeCursor < this.triangles.length) {
            patchOperation = this.optimizeOperation;
            patchOperation.index1 = this.optimizeCursor++;
        } else if (this.optimizing) {
            this.optimizing = false;
            var newTriangles = [];
            for (let triangle of this.triangles) {
                if (!triangle.deleted) {
                    newTriangles.push(triangle);
                }
            }
            this.triangles = newTriangles;
            this.renderer.render(this.triangles);
            continue;
        } else {
            if (this.focusMapEnabled) {
                patchOperation = this.mutator.mutate(this.triangles, this.focusEditor.focusMap);
            } else {
                patchOperation = this.mutator.mutate(this.triangles);
            }
        }
        patchOperation.apply(this.triangles);
        this.renderer.render(this.triangles, patchOperation.index1);
        
        var newDiff = this.ranker.rank();
        if (newDiff == 0) {
            console.log("Something went wrong, so the simulation has been stopped");
            this.stop();
        }
        if (newDiff < this.totalDiff || (newDiff == this.totalDiff && patchOperation.operationType == PatchOperationDelete)) {
        // if (newSimilarity > this.similarity || (newSimilarity == this.similarity && patchOperation.operationType == PatchOperationDelete)) {
            this.totalDiff = newDiff;
            this.similarity = this.ranker.toPercentage(this.totalDiff);
            this.mutatorstats[patchOperation.mutationType]++;
        } else {
            patchOperation.undo(this.triangles);
            this.renderer.render(this.triangles, patchOperation.index1);
        }
        this.frames++;
    }
};

Evolver.prototype.exportSVG = function () {
    var lines = [];
    lines.push("<svg height=\"" + this.canvas.height + "\" width=\"" + this.canvas.width + "\">");
    // Use a black background
    lines.push(
        "<polygon points=\"0,0 " +
        this.canvas.width + ",0 " +
        this.canvas.width + "," + this.canvas.height + " " +
        "0," + this.canvas.height +
        "\" style=\"fill:black\" />");
    // <svg height="210" width="500">
    //     <polygon points="200,10 250,190 160,210" style="fill:lime;stroke:purple;stroke-width:1" />
    // </svg>
    // Similar to render code
    for (let triangle of this.triangles) {
        var pointData = [];
        for (let point of triangle.points) {
            var x = triangle.x + Math.cos(point.angle) * point.distance;
            var y = triangle.y + Math.sin(point.angle) * point.distance;
            pointData.push(x + "," + y);
        }
        var fill = hexEncodeColor(triangle.color);
        lines.push("<polygon points=\"" + pointData.join(" ") + "\" style=\"fill:" + fill + "\" />");
    }

    lines.push("</svg>");
    return lines.join("\n");
}
