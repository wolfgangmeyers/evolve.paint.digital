import * as uuid from "uuid";
import { createProgram, hexEncodeColor } from "./util";
import { RandomBrushStrokeGenerator } from "./generators";
import { Renderer } from "./renderer";
import { Colorizer } from "./colorizer";
import { Ranker } from "./ranker";
import { FocusEditor, FocusMap } from "./focus";
import { Display } from "./display";
import { BrushStroke } from "./brushStroke";
import { BrushSet } from "./brushSet";
// Shader source
// TODO: encapsulate shader source and variable access
// in strongly typed objects.
import * as displayShaders from "./shaders/display";
import * as focusShaders from "./shaders/focus";
import * as rankerShaders from "./shaders/ranker";
import * as rendererShaders from "./shaders/renderer";
import * as colorizerShaders from "./shaders/colorizer";
import * as shrinkerShaders from "./shaders/shrinker";
import { Config } from "./config";
import { Point } from "./point";
import { Supervisor } from "./peers/supervisor";
import { Worker } from "./peers/worker";

export class Evolver {

    private gl: WebGL2RenderingContext;

    private rendererProgram: WebGLProgram;
    private colorizerProgram: WebGLProgram;
    private rankerProgram: WebGLProgram;
    private shrinkerProgram: WebGLProgram;
    private focusMapProgram: WebGLProgram;
    private focusDisplayProgram: WebGLProgram;
    private brushStrokeGenerator: RandomBrushStrokeGenerator;
    private renderer: Renderer;
    private colorizer: Colorizer;
    private ranker: Ranker;
    private focusEditor: FocusEditor;
    public display: Display;
    public running: boolean;
    private renderHandle: number;
    private displayHandle: number;
    private hintsHandle: number;
    private workerHandle: number;
    private srcImage: HTMLImageElement;
    private editingFocusMap: boolean;
    private customFocusMap: boolean;
    public strokes: Array<BrushStroke>;
    public frames: number;
    public improvements: number;
    public similarity: number;
    private totalDiff: number;
    public onSnapshot: (imageData: Uint8Array, num: number) => void;
    public snapshotCounter: number;
    private lastSnapshotSimilarity: number;
    public focusPin: Point;

    private worker: Worker;
    private supervisor: Supervisor;

    constructor(
        private canvas: HTMLCanvasElement,
        private config: Config,
        private brushSet: BrushSet,
        mode: "supervisor" | "worker" | "standalone",
        public clusterId: string,
        /** When src image is received from supervisor node */
        onReceiveSrcImage: (srcImage: HTMLImageElement) => void,
    ) {
        switch (mode) {
            case "supervisor":
                this.supervisor = new Supervisor(clusterId, (strokes: Array<BrushStroke>) => {
                    for (let stroke of strokes) {
                        this.testStroke(stroke)
                    }
                });
                break;
            case "worker":
                this.worker = new Worker(
                    clusterId,
                    (srcImage: string) => {
                        const img = new Image();
                        img.src = srcImage;
                        img.onload = () => {
                            onReceiveSrcImage(img);
                        }
                    },
                    (strokes: BrushStroke[]) => {
                        for (let stroke of strokes) {
                            this.testStroke(stroke, true);
                        }
                        if (this.running) {
                            window.setTimeout(() => this.worker.getStrokes(this.strokes.length), 1000);
                        }
                    },
                );
                break;
        }
        const gl = canvas.getContext("webgl2");
        if (!gl) {
            throw new Error("Could not initialize webgl context");
        }

        // Turn on alpha blending
        // gl.enable(gl.BLEND);
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.gl = gl as WebGL2RenderingContext;
        this.rendererProgram = createProgram(gl, rendererShaders.vert(), rendererShaders.frag());
        this.colorizerProgram = createProgram(gl, colorizerShaders.vert(), colorizerShaders.frag());
        this.rankerProgram = createProgram(gl, rankerShaders.vert(), rankerShaders.frag());
        this.shrinkerProgram = createProgram(gl, shrinkerShaders.vert(), shrinkerShaders.frag());

        // focus map
        this.focusMapProgram = createProgram(gl, focusShaders.vert(), focusShaders.frag());
        this.focusDisplayProgram = createProgram(gl, focusShaders.displayVert(), focusShaders.displayFrag());

        this.brushStrokeGenerator = null;
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

        this.strokes = [];
        this.frames = 0;
        this.improvements = 0;
        this.similarity = 0;
        this.totalDiff = 255 * 20000 * 20000;

        this.snapshotCounter = 0;

        // TODO: more elegant solution than this...
        this.canvas.onmousedown = this.onFocusPointUpdate.bind(this);
        this.canvas.onmousemove = (evt) => {
            if (this.focusPin) {
                this.onFocusPointUpdate(evt);
            }
        };

        this.canvas.onmouseup = () => {
            this.focusPin = null;
        };
    }

    onFocusPointUpdate(evt: MouseEvent) {
        const boundingRect = this.canvas.getBoundingClientRect();
        this.focusPin = {
            x: (evt.clientX - boundingRect.left) / boundingRect.width * this.canvas.width,
            y: (evt.clientY - boundingRect.top) / boundingRect.height * this.canvas.height,
        };
    }

    setSrcImage(srcImage: HTMLImageElement, width: number=0, height: number=0) {
        var gl = this.gl;
        this.srcImage = srcImage;

        width = width || srcImage.width;
        height = height || srcImage.height;
        this.canvas.width = width;
        this.canvas.height = height;
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.ranker) {
            this.ranker.dispose();
        }
        if (this.colorizer) {
            this.colorizer.dispose();
        }

        this.brushStrokeGenerator = new RandomBrushStrokeGenerator(gl.canvas.width, gl.canvas.height, this.config, this.brushSet);
        this.renderer = new Renderer(gl, this.rendererProgram, this.brushSet, width, height);

        // Colorizer and renderer share the render texture
        this.colorizer = new Colorizer(gl, this.colorizerProgram, this.brushSet, width, height);

        this.ranker = new Ranker(gl, this.rankerProgram, this.shrinkerProgram, srcImage);
        // initialize focus map from rank data output
        // so we can auto-focus based on lowest similarity to source image
        const rankData = this.ranker.getRankData();
        const focusMap = new FocusMap(rankData.width, rankData.height);
        focusMap.updateFromImageData(rankData.data);
        this.focusEditor = new FocusEditor(gl, this.focusMapProgram, this.focusDisplayProgram, srcImage, focusMap);
        this.customFocusMap = false;
        this.lastSnapshotSimilarity = this.similarity;
        if (this.supervisor) {
            this.supervisor.setSrcImageData(srcImage.src);
        }
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
        if (this.worker) {
            this.worker.getStrokes(this.strokes.length);
            // this.workerHandle = window.setInterval(() => this.worker.getStrokes(this.strokes.length), 1000);
        }
        return true;
    }

    stop() {
        if (!this.running) {
            return false;
        }
        this.running = false;
        window.clearInterval(this.renderHandle);
        window.clearInterval(this.hintsHandle);
        if (this.worker) {
            window.clearInterval(this.workerHandle);
        }
        return true;
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

    private testStroke(stroke: BrushStroke, fromSupervisor=false) {
        this.renderer.render(stroke);
        let newDiff = this.ranker.rank(this.renderer.getRenderedTexture().texture);

        if (newDiff == 0) {
            console.log("Something went wrong, so the simulation has been stopped");
            this.stop();
        }
        if (fromSupervisor || newDiff < this.totalDiff) {
            this.totalDiff = newDiff;
            this.similarity = this.ranker.toPercentage(this.totalDiff);
            if (this.worker && !fromSupervisor) {
                // Submit to supervisor and reset the renderer
                this.worker.submitStroke(stroke);
                this.renderer.render({
                    ...stroke,
                    deleted: true,
                })
                return;
            } else {
                this.strokes.push(stroke);
            }
            if (this.supervisor) {
                // The supervisor strokes are polled by workers
                this.supervisor.addStroke(stroke);
            }
            this.renderer.swap();
            this.improvements++;
        } else {
            stroke.deleted = true;
            this.renderer.render(stroke);
        }
        this.frames++;
    }

    iterate() {
        if (this.editingFocusMap) {
            return;
        }
        // Manual only mode if the mouse is down
        if (this.config.manualOnly && !this.focusPin) {
            return;
        }
        for (let i = 0; i < this.config.frameSkip; i++) {
            let stroke: BrushStroke;
            stroke = this.brushStrokeGenerator.generateBrushStroke(this.focusEditor.focusMap);

            // TODO: better way of doing this...
            if (this.focusPin) {
                let xJitter = (Math.random() * this.config.manualJitter) - (this.config.manualJitter / 2.0);
                let yJitter = (Math.random() * this.config.manualJitter) - (this.config.manualJitter / 2.0);
                stroke.x = this.focusPin.x + xJitter;
                stroke.y = this.focusPin.y + yJitter;
            }

            stroke.color = this.colorizer.render(stroke);
            this.testStroke(stroke);
        }
        const snapshotIncrement = 1.0 / this.config.maxSnapshots;
        if (this.config.saveSnapshots && this.onSnapshot && this.similarity - this.lastSnapshotSimilarity >= snapshotIncrement) {
            this.lastSnapshotSimilarity = this.similarity;
            const imageData = this.renderer.getRenderedImageData();
            this.onSnapshot(imageData, this.snapshotCounter++);
        }
    }

    exportSVG(): string {
        throw new Error("No longer supported");
    }

    exportPNG(imageDataCallback: (pixels: Uint8Array, width: number, height: number) => void) {
        const imageData = this.renderer.getRenderedImageData();
        for (let c = 0; c < imageData.length; c += 4) {
            imageData[c + 3] = 255;
        }
        imageDataCallback(imageData, this.gl.canvas.width, this.gl.canvas.height);
    }

    exportBrushStrokes(): string {
        return JSON.stringify(this.strokes);
    }

    importBrushStrokes(triangles: string) {
        this.strokes = JSON.parse(triangles);
        this.totalDiff = 255 * 20000 * 20000;
        for (let stroke of this.strokes) {
            this.renderer.render(stroke);
            this.renderer.swap();
        }
    }
}
