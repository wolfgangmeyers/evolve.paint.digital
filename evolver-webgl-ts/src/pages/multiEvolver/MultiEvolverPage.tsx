import * as React from "react";
import { Menu } from "../Menu";
import { Evolver } from "../../engine/evolver";
import { EvolverItem } from "./EvolverItem";
import { DownloadDialog } from "../../components/DownloadDialog";

export interface EvolverState {
    filename: string;
    progress: string;
    fps: number;
    evolver?: Evolver;
    image?: HTMLImageElement;
    canvas?: HTMLCanvasElement;
}

export interface MultiEvolverState {
    evolvers: Array<EvolverState>;
    running: boolean;
    loading: boolean;
    loaded: boolean;
    lastUpdate: number;

    exportImageWidth: number;
    exportImageHeight: number;
    exportImageTimestamp: number;
    exportImageData?: Uint8Array;
    exportImageFilename?: string;
}

export class MultiEvolverPage extends React.Component<{}, MultiEvolverState> {

    private timerHandle: number;

    constructor(props: any) {
        super(props);
        this.state = {
            evolvers: [],
            running: false,
            loading: false,
            loaded: false,
            lastUpdate: new Date().getTime(),
            exportImageWidth: 0,
            exportImageHeight: 0,
            exportImageTimestamp: new Date().getTime(),
        };
    }

    onDownloadItem(index: number) {
        const item = this.state.evolvers[index];
        item.evolver.exportPNG((pixels, width, height) => {
            this.setState({
                exportImageData: pixels,
                exportImageWidth: width,
                exportImageHeight: height,
                exportImageFilename: item.filename,
                exportImageTimestamp: new Date().getTime(),
            });
        });
    }

    onCancelDownload() {
        this.setState({
            exportImageData: null,
        });
    }

    renderEvolverItem(index: number) {
        const item = this.state.evolvers[index];
        return <EvolverItem
            index={index}
            running={this.state.running}
            key={`evolver${index}`}
            filename={item.filename}
            progress={item.progress}
            fps={item.fps}
            onDownloadClicked={this.onDownloadItem.bind(this)}>

            <canvas height="1024" width="1024" style={{ width: "50px" }} ref={(c => this.state.evolvers[index].canvas = c)}></canvas>
        </EvolverItem>
    }

    private loadImage(index: number, file: File) {
        const fileReader = new FileReader();
        fileReader.onload = () => {
            const srcImage = new Image();
            srcImage.src = fileReader.result.toString();
            srcImage.onload = () => {
                const evolverState = this.state.evolvers[index];
                const size = Math.sqrt(Math.pow(srcImage.width, 2) + Math.pow(srcImage.height, 2));
                const evolver = new Evolver(evolverState.canvas, {
                    focusExponent: 1,
                    frameSkip: 10,
                    minColorMutation: 0.001,
                    maxColorMutation: 0.1,
                    minTriangleRadius: Math.floor(size / 10),
                    maxTriangleRadius: Math.floor(size / 100),
                    maxSnapshots: 1800,
                    saveSnapshots: false,
                    enabledMutations: {
                        "append": true,
                        "color": true,
                        "delete": true,
                        "points": true,
                        "position": true,
                    },
                });
                evolver.setSrcImage(srcImage);
                evolverState.image = srcImage;
                evolverState.evolver = evolver;

                // Check if fully loaded
                let loaded = true;
                for (let item of this.state.evolvers) {
                    if (!item.image) {
                        loaded = false;
                    }
                }
                this.setState({
                    loading: !loaded,
                    loaded: loaded,
                });
                if (loaded) {
                    this.timerHandle = window.setInterval(() => {
                        this.updateView();
                    }, 1000);
                }
            };
        };
        fileReader.readAsDataURL(file);
    }

    onLoadImagesChanged(files: FileList) {
        const evolvers = this.state.evolvers;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            evolvers.push({
                filename: file.name,
                progress: "0%",
                fps: 0,
            });
            this.loadImage(i, file);
        }
        this.setState({
            loading: true,
            evolvers: evolvers,
        });
    }

    startStop() {
        if (this.state.running) {
            for (let item of this.state.evolvers) {
                item.evolver.stop();
            }
        } else {
            for (let item of this.state.evolvers) {
                item.evolver.start();
            }
        }
        this.setState({
            running: !this.state.running,
        });
    }

    updateView() {
        let lastUpdate = this.state.lastUpdate
        const now = new Date().getTime();
        for (let i = 0; i < this.state.evolvers.length; i++) {
            const item = this.state.evolvers[i];
            item.progress = (item.evolver.similarity * 100).toFixed(4) + "%";;
            item.fps = Math.round(1000 * item.evolver.frames / (now - lastUpdate));
            item.evolver.frames = 0;
        }
        this.setState({
            evolvers: this.state.evolvers,
            lastUpdate: now,
        });
    }

    componentWillUnmount() {
        window.clearInterval(this.timerHandle);
    }

    render() {
        return <div>
            <div className="row">
                <div className="col-lg-8 offset-lg-2 col-md-12">
                    <Menu>
                        <label
                            id="loadimage-wrapper"
                            className="btn btn-sm btn-primary btn-file"
                            style={{ marginTop: "8px" }}
                        >
                            Load Images
                            <input
                                id="loadimage"
                                type="file"
                                style={{ display: "none" }}
                                onChange={evt => this.onLoadImagesChanged(evt.target.files)}
                                multiple={true}
                                disabled={this.state.loading || this.state.loaded}
                            />
                        
                        </label>
                        <button className="btn btn-sm btn-primary"
                            onClick={this.startStop.bind(this)}
                            disabled={!this.state.loaded}>
                            {this.state.running ? "Stop" : "Start"}
                        </button>
                    </Menu>

                </div>
                <DownloadDialog
                imageWidth={this.state.exportImageWidth}
                imageHeight={this.state.exportImageHeight}
                imageData={this.state.exportImageData}
                filename={this.state.exportImageFilename}
                onClose={this.onCancelDownload.bind(this)}
                timestamp={this.state.exportImageTimestamp}/>
            </div>
            {this.state.evolvers.map((_, i) => {
                return this.renderEvolverItem(i);
            })}
        </div>;
    }
}
