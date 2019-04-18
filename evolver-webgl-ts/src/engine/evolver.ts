import { createProgram, hexEncodeColor } from "./util";
import { Mutator, MutationTypeAppend, MutationTypePosition, MutationTypeColor, MutationTypePoints, MutationTypeDelete } from "./mutator";
import { Renderer } from "./renderer";
import { Ranker } from "./ranker";
import { FocusEditor, FocusMap } from "./focus";
import { Display } from "./display";
import { Triangle } from "./triangle";
import { PatchOperation, PatchOperationDelete } from "./patch";
// Shader source
// TODO: encapsulate shader source and variable access
// in strongly typed objects.
import * as displayShaders from "./shaders/display";
import * as focusShaders from "./shaders/focus";
import * as rankerShaders from "./shaders/ranker";
import * as rendererShaders from "./shaders/renderer";
import * as shrinkerShaders from "./shaders/shrinker";
import { Config } from "./config";

export class Evolver {

    private gl: WebGL2RenderingContext;

    private rendererProgram: WebGLProgram;
    private rankerProgram: WebGLProgram;
    private shrinkerProgram: WebGLProgram;
    private focusMapProgram: WebGLProgram;
    private focusDisplayProgram: WebGLProgram;
    private mutator: Mutator;
    private renderer: Renderer;
    private ranker: Ranker;
    private focusEditor: FocusEditor;
    public display: Display;
    public running: boolean;
    private renderHandle: number;
    private displayHandle: number;
    private hintsHandle: number;
    private srcImage: HTMLImageElement;
    private editingFocusMap: boolean;
    private customFocusMap: boolean;
    public triangles: Array<Triangle>;
    public mutatorstats: { [key: string]: number };
    public frames: number;
    public similarity: number;
    private totalDiff: number;
    private optimizing: boolean;
    private optimizeCursor: number;
    private optimizeOperation: PatchOperation;

    constructor(
        private canvas: HTMLCanvasElement,
        private config: Config,
    ) {
        const gl = canvas.getContext("webgl2");
        if (!gl) {
            throw new Error("Could not initialize webgl context");
        }
        this.frames = 0;
        this.gl = gl as WebGL2RenderingContext;
        this.rendererProgram = createProgram(gl, rendererShaders.vert(), rendererShaders.frag());
        this.rankerProgram = createProgram(gl, rankerShaders.vert(), rankerShaders.frag());
        this.shrinkerProgram = createProgram(gl, shrinkerShaders.vert(), shrinkerShaders.frag());

        // focus map
        this.focusMapProgram = createProgram(gl, focusShaders.vert(), focusShaders.frag());
        this.focusDisplayProgram = createProgram(gl, focusShaders.displayVert(), focusShaders.displayFrag());

        this.mutator = null;
        this.renderer = null;
        this.ranker = null;
        this.focusEditor = null;

        // Display
        var displayProgram = createProgram(gl, displayShaders.vert(), displayShaders.frag());
        this.display = new Display(gl, displayProgram);

        this.running = false;
        this.renderHandle = null;
        this.displayHandle = null;
        // srcImage must be populated before the evolver can start
        this.srcImage = null;

        // Flag to show focus map editor
        this.editingFocusMap = false;
        this.customFocusMap = false;

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

    setSrcImage(srcImage: HTMLImageElement) {
        var gl = this.gl;
        this.srcImage = srcImage;
        this.canvas.width = srcImage.width;
        this.canvas.height = srcImage.height;
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.ranker) {
            this.ranker.dispose();
        }

        this.mutator = new Mutator(gl.canvas.width, gl.canvas.height, this.config);
        this.renderer = new Renderer(gl, this.rendererProgram, 10000);
        this.ranker = new Ranker(gl, this.rankerProgram, this.shrinkerProgram, srcImage);
         // initialize focus map from rank data output
        // so we can auto-focus based on lowest similarity to source image
        const rankData = this.ranker.getRankData();
        const focusMap = new FocusMap(rankData.width, rankData.height);
        focusMap.updateFromImageData(rankData.data);
        this.focusEditor = new FocusEditor(gl, this.focusMapProgram, this.focusDisplayProgram, srcImage, focusMap);
        this.customFocusMap = false;
    }

    deleteFocusMap() {
        this.editingFocusMap = false;
        this.customFocusMap = false;
        this.focusEditor.clearFocusMap();
    }

    editFocusMap() {
        this.editingFocusMap = true;
        this.customFocusMap = true;
        this.focusEditor.pushToGPU();
    }

    saveFocusMap() {
        this.editingFocusMap = false;
        this.focusEditor.pullFromGPU();
    }

    cancelFocusMap() {
        this.editingFocusMap = false;
    }

    start() {
        if (!this.srcImage) {
            return false;
        }
        if (this.running) {
            return false;
        }
        this.running = true;
        this.renderHandle = window.setInterval(this.iterate.bind(this), 1);
        // Only start display ticker if it isn't already going
        if (!this.displayHandle) {
            this.displayHandle = window.setInterval(this.render.bind(this), 10);
        }
        this.hintsHandle = window.setInterval(this.updateHints.bind(this), 5000);
        return true;
    }

    stop() {
        if (!this.running) {
            return false;
        }
        this.running = false;
        window.clearInterval(this.renderHandle);
        window.clearInterval(this.hintsHandle);
        return true;
    }

    optimize() {
        this.optimizing = true;
        this.optimizeCursor = 0;
    }

    render() {
        if (this.editingFocusMap) {
            this.focusEditor.render();
        } else {
            this.display.render();
        }
    }

    updateHints() {
        // Update auto focus map if a custom focus map isn't being used
        if (!this.customFocusMap) {
            const rankData = this.ranker.getRankData();
            this.focusEditor.focusMap.updateFromImageData(rankData.data);
        }
    }

    iterate() {
        if (this.editingFocusMap) {
            return;
        }
        for (let i = 0; i < this.config.frameSkip; i++) {
            let patchOperation: PatchOperation;
            if (this.optimizing && this.optimizeCursor < this.triangles.length) {
                patchOperation = this.optimizeOperation;
                patchOperation.index1 = this.optimizeCursor++;
            } else if (this.optimizing) {
                this.optimizing = false;
                const newTriangles = [];
                for (let triangle of this.triangles) {
                    if (!triangle.deleted) {
                        newTriangles.push(triangle);
                    }
                }
                this.triangles = newTriangles;
                this.renderer.render(this.triangles);
                continue;
            } else {
                patchOperation = this.mutator.mutate(this.triangles, this.focusEditor.focusMap);
            }
            patchOperation.apply(this.triangles);
            this.renderer.render(this.triangles, patchOperation.index1);

            let newDiff = this.ranker.rank();
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
    }

    exportSVG(): string {
        const lines = [];
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
            const pointData = [];
            for (let point of triangle.points) {
                const x = triangle.x + Math.cos(point.angle) * point.distance;
                const y = triangle.y + Math.sin(point.angle) * point.distance;
                pointData.push(x + "," + y);
            }
            const fill = hexEncodeColor(triangle.color);
            lines.push("<polygon points=\"" + pointData.join(" ") + "\" style=\"fill:" + fill + "\" />");
        }

        lines.push("</svg>");
        return lines.join("\n");
    }

    exportPNG(imageDataCallback: (pixels: Uint8Array, width: number, height: number) => void) {
        const imageData = this.renderer.getRenderedImageData();
        imageDataCallback(imageData, this.gl.canvas.width, this.gl.canvas.height);
    }

    exportTriangles(): string {
        return JSON.stringify(this.triangles);
    }

    importTriangles(triangles: string) {
        this.triangles = JSON.parse(triangles);
        this.totalDiff = 255 * 20000 * 20000;
        this.renderer.render(this.triangles);
    }
}
