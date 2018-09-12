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
    console.log("Ranker program:");
    console.log(this.rankerProgram);
    this.mutator = null;
    this.renderer = null;
    this.ranker = null;

    // Display
    var displayProgram = createProgram(gl, "display");
    this.display = new Display(gl, displayProgram);

    this.running = false;
    this.renderHandle = null;
    this.displayHandle = null;
    // srcImage must be populated before the evolver can start
    this.srcImage = null;

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
    console.log("renderer program:");
    console.log(this.rendererProgram);
    this.renderer = new Renderer(gl, this.rendererProgram, 10000);
    console.log("ranker program:");
    console.log(this.rankerProgram);
    this.ranker = new Ranker(gl, this.rankerProgram, srcImage);
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
    this.displayHandle = window.setInterval(this.display.render.bind(this.display), 10);
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

Evolver.prototype.iterate = function () {
    for (var i = 0; i < 10; i++) {
        var patchOperation;
        if (this.optimizing && this.optimizeCursor < this.triangles.length) {
            patchOperation = this.optimizeOperation;
            patchOperation.index1 = this.optimizeCursor++;
        } else if (this.optimizing) {
            this.optimizing = false;
            continue;
        } else {
            patchOperation = this.mutator.mutate(this.triangles);
        }
        patchOperation.apply(this.triangles);
        if (patchOperation.operationType == PatchOperationDelete) {
            this.renderer.render(this.triangles);
        } else {
            this.renderer.render(this.triangles, patchOperation.index1);
        }
        
        var newSimilarity = this.ranker.rank();
        if (newSimilarity == 1) {
            alert("Something went wrong, so the simulation has been stopped");
            this.stop();
        }
        if (newSimilarity > this.similarity || (newSimilarity == this.similarity && patchOperation.operationType == PatchOperationDelete)) {
            this.similarity = newSimilarity;
            this.mutatorstats[patchOperation.mutationType]++;
        } else {
            patchOperation.undo(this.triangles);
            if (patchOperation.operationType == PatchOperationDelete) {
                this.renderer.render(this.triangles);
            } else {
                this.renderer.render(this.triangles, patchOperation.index1);
            }
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
