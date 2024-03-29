import * as React from "react";
import { saveAs } from "file-saver";
import QS from "query-string";
import * as uuid from "uuid";

import { Menu } from "../Menu";
import { PaintingEvolver } from "./PaintingEvolver";
import { Evolver } from "../../engine/evolver";
import { DownloadDialog } from "../../components/DownloadDialog";
import { PaintingEvolverMenu } from "./PaintingEvolverMenu";
import { Config } from "../../engine/config";
import { VideoJob, VideoJobsApi } from "../../client/api"

import { brushData, brushes } from "../../engine/brushes";
import { BrushSetData, BrushSet, loadBrushSet } from "../../engine/brushSet";
import { TimelapsRenderPopup } from "../../components/TimelapsRenderPopup";

const client = new VideoJobsApi(null, "http://localhost:18033")

export interface PaintingEvolverPageState {
    imageLoaded: boolean;
    started: boolean;
    complete: boolean;
    displayMode: number;
    imageLoading: boolean;
    trianglesLoading: boolean;
    lastStatsUpdate: number;
    fps: number;
    ips: number;
    similarityText: string;
    similarity: number;
    progressSpeed: number;
    triangleCount: number;
    stats: { [key: string]: number };
    currentViewMode: number;
    config: Config;
    brushTags: Array<string>;

    exportImageWidth: number;
    exportImageHeight: number;
    exportImageTimestamp: number;
    exportImageData?: Uint8Array;

    zoom: boolean;
    mode: "worker" | "supervisor" | "standalone";
    clusterId: string;

    moveRenderAvailable?: boolean
    renderingMovie?: boolean
    brushSet?: BrushSet
}

React.createContext(null);

export class PaintingEvolverPage extends React.Component<{}, PaintingEvolverPageState> {

    private evolver: Evolver;
    private snapshotCanvas: HTMLCanvasElement;

    constructor(props) {
        super(props);
        this.state = {
            imageLoaded: false,
            started: false,
            complete: false, // to help signal automation
            displayMode: 0,
            imageLoading: false,
            trianglesLoading: false,
            lastStatsUpdate: new Date().getTime(),
            fps: 0,
            ips: 0,
            similarityText: "0%",
            similarity: 0,
            progressSpeed: 0,
            triangleCount: 0,
            stats: {},
            currentViewMode: 0,
            exportImageWidth: 0,
            exportImageHeight: 0,
            exportImageData: null,
            exportImageTimestamp: new Date().getTime(),
            config: {
                saveSnapshots: false,
                maxSnapshots: 1800,
                focusExponent: 1,
                minColorMutation: 0.001,
                maxColorMutation: 0.01,
                frameSkip: 10,
                enabledMutations: {
                    "append": true,
                    "color": true,
                    "delete": true,
                    "points": true,
                    "position": true,
                },
                enabledBrushTags: {},
                manualOnly: false,
                manualJitter: 10,
            },
            brushTags: [],
            zoom: false,
            mode: "standalone",
            clusterId: ""
        };
    }

    detectTimelapseAvailable() {
        const check = async () => {
            try {
                await client.listVideoJobs()
                if (!this.state.moveRenderAvailable) {
                    this.setState({moveRenderAvailable: true})
                }

            } catch (_) {
                if (this.state.moveRenderAvailable) {
                    this.setState({moveRenderAvailable: false})
                }

            }
        }
        window.setInterval(() => check(), 10000)
        check()
    }

    componentDidMount() {
        this.detectTimelapseAvailable()
        loadBrushSet(brushData, brushes).then(brushSet => {
            // Enable large brushes by default
            brushSet.getTags().forEach((tag, i) => {
                if (i == 0) {
                    this.state.config.enabledBrushTags[tag] = true;
                }
                this.state.brushTags.push(tag);
            })
            this.setState({
                config: this.state.config,
                brushTags: this.state.brushTags,
                brushSet: brushSet,
            });
            let mode = "standalone";
            let clusterId = uuid.v4();
            if (window.location.search) {
                const query = QS.parse(window.location.search);
                if (query.mode) {
                    mode = query.mode as string;
                }
                if (query.clusterId) {
                    clusterId = query.clusterId as string;
                }
            }

            this.setState({
                mode: mode as "standalone" | "worker" | "supervisor",
                clusterId: clusterId
            })
            console.log(`clusterId=${clusterId}`);

            this.evolver = new Evolver(
                document.getElementById("c") as HTMLCanvasElement,
                this.state.config,
                brushSet,
                mode as "standalone" | "supervisor" | "worker",
                clusterId,
                (srcImage: HTMLImageElement) => this.onImageLoadComplete(srcImage),
            );
            this.evolver.onSnapshot = this.onSnapshot.bind(this);
            // Update stats twice a second
            window.setInterval(() => this.updateStats(), 500);
            window.setInterval(() => this.checkSuccessRate(), 5000)
        })
    }

    checkSuccessRate() {
        if (this.state.config.manualOnly || !this.state.started) {
            return
        }
        // get selected brush tag and detect if more than one is selected
        let selectedBrushTag: string = null
        let count = 0
        Object.keys(this.state.config.enabledBrushTags).forEach(tag => {
            if (this.state.config.enabledBrushTags[tag]) {
                selectedBrushTag = tag
                count++
            }
        })
        if (count > 1) {
            // more than one brush selected, abort default behavior
            return
        }

        const successRate = this.state.ips / this.state.fps

        // magic number alert - this will eventually need to be adjustable for quality
        if (successRate < 0.01) {
            const index = this.state.brushTags.indexOf(selectedBrushTag) + 1
            if (index >= this.state.brushTags.length) {
                this.onStartStop()
                this.setState({
                    complete: true,
                })
            } else {
                this.state.config.enabledBrushTags[selectedBrushTag] = false
                selectedBrushTag = this.state.brushTags[index]
                this.state.config.enabledBrushTags[selectedBrushTag] = true
                this.setState({
                    config: this.state.config
                })
            }
        }
    }

    onDisplayModeChanged(displayMode: number) {
        this.evolver.display.displayTexture = displayMode;
        this.setState({
            currentViewMode: displayMode,
        });
    }

    onStartStop() {
        if (this.evolver.running) {
            this.evolver.stop();
        } else {
            this.evolver.start();
        }
        this.setState({
            started: this.evolver.running,
        });
    }

    onImageLoadStart() {
        this.setState({
            imageLoading: true,
        });
    }

    onImageLoadComplete(srcImage: HTMLImageElement) {
        this.setState({
            imageLoading: false,
            imageLoaded: true,
            config: this.state.config,
            exportImageWidth: srcImage.width,
            exportImageHeight: srcImage.height,
        });
        this.evolver.setSrcImage(srcImage);
    }

    onExportImage() {
        this.evolver.exportPNG((pixels, width, height) => {
            this.setState({
                exportImageData: pixels,
                exportImageWidth: width,
                exportImageHeight: height,
                exportImageTimestamp: new Date().getTime(),
            });
        });
    }

    onExportTriangles() {
        const triangles = this.evolver.exportBrushStrokes();
        var blob = new Blob([triangles], { type: "text/plain" })
        saveAs(blob, "painting.txt");
    }

    onloadTrianglesStart() {
        this.setState({
            trianglesLoading: true,
        });
    }

    onLoadTriangles(painting: string) {
        this.evolver.importBrushStrokes(painting);
        this.setState({
            trianglesLoading: false,
        });
    }

    onCancelExportImage() {
        this.setState({
            exportImageData: null,
        });
    }

    private getSimilarityPercentage(): number {
        return this.evolver.similarity * 100;
    }

    private onSnapshot(pixels: Uint8Array, num: number) {
        const ctx = this.snapshotCanvas.getContext("2d");
        const imageData = ctx.createImageData(this.state.exportImageWidth, this.state.exportImageHeight);
        for (let i = 0; i < pixels.length; i++) {
            imageData.data[i] = pixels[i];
        }
        ctx.putImageData(imageData, 0, 0);
        let filename = `${num}`;
        while (filename.length < 4) {
            filename = "0" + filename;
        }
        filename = filename + ".png";
        this.snapshotCanvas.toBlob(result => {
            saveAs(result, filename);
        }, "image/png");
    }

    updateStats() {
        let lastStatsUpdate = this.state.lastStatsUpdate
        const now = new Date().getTime();
        const fps = Math.round(1000 * this.evolver.frames / (now - lastStatsUpdate));
        const ips = Math.round(1000 * this.evolver.improvements / (now - lastStatsUpdate));
        this.evolver.frames = 0;
        this.evolver.improvements = 0;
        lastStatsUpdate = now;
        const similarity = this.getSimilarityPercentage();
        const similarityText = similarity.toFixed(4) + "%";
        const progressSpeed = similarity - this.state.similarity;

        this.setState({
            lastStatsUpdate: lastStatsUpdate,
            fps: fps,
            ips: ips,
            similarityText: similarityText,
            similarity: similarity,
            progressSpeed: progressSpeed,
            triangleCount: this.evolver.strokes.length,
        });
    }

    onChangeZoom(zoom: boolean) {
        this.setState({
            zoom: zoom,
        });
    }

    onZoomIn() {
        this.evolver.zoom *= 1.2;
        this.evolver.offset.x += 0.1 / this.evolver.zoom;
        this.evolver.offset.y += 0.1 / this.evolver.zoom;
    }

    onZoomOut() {
        this.evolver.offset.x -= 0.1 / this.evolver.zoom;
        this.evolver.offset.y -= 0.1 / this.evolver.zoom;
        this.evolver.zoom /= 1.2;

        if (this.evolver.zoom < 1) {
            this.evolver.zoom = 1;
            this.evolver.offset.x = 0;
            this.evolver.offset.y = 0;
        }
    }

    onPan(x: number, y: number) {
        console.log("onPan", x, y)
        x = x / this.evolver.zoom;
        y = y / this.evolver.zoom;
        this.evolver.offset.x -= x;
        this.evolver.offset.y -= y;
    }

    render() {
        return <div className="row">
            <input type="hidden" id="complete" value={"" + this.state.complete} />
            <div className={this.state.zoom ? "col-lg-12" : "col-lg-8 offset-lg-2 col-md-12"}>
                <Menu>
                    <PaintingEvolverMenu onStartStop={this.onStartStop.bind(this)}
                        imageLoaded={this.state.imageLoaded}
                        started={this.state.started}
                        imageLoading={this.state.imageLoading}
                        onImageLoadStart={this.onImageLoadStart.bind(this)}
                        onImageLoadComplete={this.onImageLoadComplete.bind(this)}
                        onSaveImage={this.onExportImage.bind(this)}
                        trianglesLoading={this.state.trianglesLoading}
                        onLoadTrianglesComplete={this.onLoadTriangles.bind(this)}
                        onLoadTrianglesStart={this.onloadTrianglesStart.bind(this)}
                        onSaveTriangles={this.onExportTriangles.bind(this)}
                        mode={this.state.mode}
                        clusterId={this.state.clusterId}
                        showRenderTimelapse={this.state.moveRenderAvailable}
                        enableRenderTimelapse={this.evolver && !this.evolver.running}
                        onRenderTimelapse={() => this.setState({renderingMovie: true})}
                    />
                </Menu>
                <PaintingEvolver
                    onZoomChanged={this.onChangeZoom.bind(this)}
                    currentMode={this.state.currentViewMode}
                    onViewModeChanged={this.onDisplayModeChanged.bind(this)}
                    evolver={this.evolver}
                    onZoomIn={this.onZoomIn.bind(this)}
                    onZoomOut={this.onZoomOut.bind(this)}
                    onPan={this.onPan.bind(this)}
                    {...this.state} />
            </div>
            <DownloadDialog
                imageWidth={this.state.exportImageWidth}
                imageHeight={this.state.exportImageHeight}
                imageData={this.state.exportImageData}
                onClose={this.onCancelExportImage.bind(this)}
                timestamp={this.state.exportImageTimestamp} />
            <TimelapsRenderPopup
                brushSet={this.state.brushSet}
                client={client}
                height={this.state.exportImageHeight}
                width={this.state.exportImageWidth}
                instructions={this.state.renderingMovie && this.evolver && JSON.parse(this.evolver.exportBrushStrokes())}
                onClose={() => this.setState({
                    renderingMovie: false
                })}
                show={this.state.renderingMovie} />
            <canvas
                width={this.state.exportImageWidth}
                height={this.state.exportImageHeight}
                style={{ display: "none" }}
                ref={c => this.snapshotCanvas = c}
            />
        </div>;
    }
}
