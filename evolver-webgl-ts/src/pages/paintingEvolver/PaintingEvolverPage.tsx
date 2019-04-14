import * as React from "react";
import { Menu } from "../Menu";
import { PaintingEvolver } from "./PaintingEvolver";
import { Evolver } from "../../engine/evolver";
import { DownloadDialog } from "../../components/DownloadDialog";
import { PaintingEvolverMenu } from "./PaintingEvolverMenu";
import { Config } from "../../engine/config";

export interface PaintingEvolverPageState {
    imageLoaded: boolean;
    started: boolean;
    displayMode: number;
    imageLoading: boolean;
    lastStatsUpdate: number;
    fps: number;
    similarityText: string;
    triangleCount: number;
    stats: Array<string>;
    currentViewMode: number;
    config: Config;

    exportImageWidth: number;
    exportImageHeight: number;
    exportImageTimestamp: number;
    exportImageData?: Uint8Array;
}

React.createContext(null, null);

export class PaintingEvolverPage extends React.Component<{}, PaintingEvolverPageState> {

    private evolver: Evolver;

    constructor(props) {
        super(props);
        this.state = {
            imageLoaded: false,
            started: false,
            displayMode: 0,
            imageLoading: false,
            lastStatsUpdate: new Date().getTime(),
            fps: 0,
            similarityText: "0%",
            triangleCount: 0,
            stats: [],
            currentViewMode: 0,
            exportImageWidth: 0,
            exportImageHeight: 0,
            exportImageData: null,
            exportImageTimestamp: new Date().getTime(),
            config: {
                focusExponent: 1,
                minColorMutation: 0.001,
                maxColorMutation: 0.1,
                frameSkip: 10,
                minTriangleRadius: 5,
                maxTriangleRadius: 10,
            },
        };
    }

    componentDidMount() {
        this.evolver = new Evolver(
            document.getElementById("c") as HTMLCanvasElement,
            this.state.config,
        );
        // Update stats twice a second
        window.setInterval(() => this.updateStats(), 500);
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
        const size = Math.sqrt(Math.pow(srcImage.width, 2) + Math.pow(srcImage.height, 2));
        this.state.config.maxTriangleRadius = Math.floor(size / 10);
        this.state.config.minTriangleRadius = Math.floor(size / 100);
        this.setState({
            imageLoading: false,
            imageLoaded: true,
            config: this.state.config,
        });
        if (this.evolver.running) {
            this.onStartStop();
        }
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

    onCancelExportImage() {
        this.setState({
            exportImageData: null,
        });
    }

    updateStats() {
        let lastStatsUpdate = this.state.lastStatsUpdate
        const now = new Date().getTime();
        const fps = Math.round(1000 * this.evolver.frames / (now - lastStatsUpdate));
        this.evolver.frames = 0;
        lastStatsUpdate = now;
        const similarityText = (this.evolver.similarity * 100).toFixed(4) + "%";
        this.setState({
            lastStatsUpdate: lastStatsUpdate,
            fps: fps,
            similarityText: similarityText,
            triangleCount: this.evolver.triangles.length,
        });
    }

    onUpdateFocusExponentBase(newBase: number) {
        if (newBase < 0) {
            newBase = 0;
        }
        if (newBase > 10) {
            newBase = 10;
        }
        this.state.config.focusExponent = newBase;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateFrameSkip(newFrameSkip: number) {
        if (newFrameSkip < 1) {
            newFrameSkip = 1;
        }
        if (newFrameSkip > 100) {
            newFrameSkip = 100;
        }
        this.state.config.frameSkip = newFrameSkip;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMinTriangleRadius(newRadius: number) {
        if (newRadius < 1 || newRadius >= this.state.config.maxTriangleRadius) {
            return;
        }
        this.state.config.minTriangleRadius = newRadius;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMaxTriangleRadius(newRadius: number) {
        if (newRadius > 1000 || newRadius <= this.state.config.minTriangleRadius) {
            return;
        }
        this.state.config.maxTriangleRadius = newRadius;
        this.setState({
            config: this.state.config,
        });
    }

    render() {
        return <div className="row">
            <div className="col-lg-8 offset-lg-2 col-md-12">
                <Menu>
                    <PaintingEvolverMenu onStartStop={this.onStartStop.bind(this)}
                    imageLoaded={this.state.imageLoaded}
                    started={this.state.started}
                    imageLoading={this.state.imageLoading}
                    onImageLoadStart={this.onImageLoadStart.bind(this)}
                    onImageLoadComplete={this.onImageLoadComplete.bind(this)}
                    onSaveImage={this.onExportImage.bind(this)} />
                </Menu>
                <PaintingEvolver
                    fps={this.state.fps}
                    similarityText={this.state.similarityText}
                    triangleCount={this.state.triangleCount}
                    stats={this.state.stats}
                    currentMode={this.state.currentViewMode}
                    onViewModeChanged={this.onDisplayModeChanged.bind(this)}
                    focusExponentBase={this.state.config.focusExponent}
                    onUpdateFocusExponentBase={this.onUpdateFocusExponentBase.bind(this)}
                    frameSkip={this.state.config.frameSkip}
                    onUpdateFrameskip={this.onUpdateFrameSkip.bind(this)}
                    minTriangleRadius={this.state.config.minTriangleRadius}
                    maxTriangleRadius={this.state.config.maxTriangleRadius}
                    onUpdateMaxTriangleRadius={this.onUpdateMaxTriangleRadius.bind(this)}
                    onUpdateMinTriangleRadius={this.onUpdateMinTriangleRadius.bind(this)}/>
            </div>
            <DownloadDialog
                imageWidth={this.state.exportImageWidth}
                imageHeight={this.state.exportImageHeight}
                imageData={this.state.exportImageData}
                onClose={this.onCancelExportImage.bind(this)}
                timestamp={this.state.exportImageTimestamp}/>
            {/* TODO: make this dialog pop up with rendered image on "Save Image" click */}
        </div>;
    }
}
