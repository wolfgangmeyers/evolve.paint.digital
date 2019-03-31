import * as React from "react";
import { Menu } from "./Menu";
import { PaintingEvolver } from "./PaintingEvolver";
import { Evolver } from "../../engine/evolver";
import { MutationTypeAppend, MutationTypePosition, MutationTypeColor, MutationTypePoints, MutationTypeDelete } from "../../engine/mutator";

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
}

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
        };
    }

    componentDidMount() {
        this.evolver = new Evolver(
            document.getElementById("c") as HTMLCanvasElement,
        );
        // Optimize every minute
        window.setInterval(() => this.evolver.optimize(), 60000);
        // Update stats twice a second
        window.setInterval(() => this.updateStats(), 500);
    }

    onDisplayModeChanged(displayMode: number) {
        this.evolver.display.displayTexture = displayMode;
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
        });
        if (this.evolver.running) {
            this.onStartStop();
        }
        this.evolver.setSrcImage(srcImage);
    }

    updateStats() {
        let lastStatsUpdate = this.state.lastStatsUpdate
        const now = new Date().getTime();
        const fps = Math.round(1000 * this.evolver.frames / (now - lastStatsUpdate));
        this.evolver.frames = 0;
        lastStatsUpdate = now;
        const similarityText = (this.evolver.similarity * 100).toFixed(4) + "%";
        const stats = [
            `Append Random Triangle: ${this.evolver.mutatorstats[MutationTypeAppend]}`,
            `Adjust Triangle Position: ${this.evolver.mutatorstats[MutationTypePosition]}`,
            `Adjust Triangle Color: ${this.evolver.mutatorstats[MutationTypeColor]}`,
            `Adjust Triangle Shape: ${this.evolver.mutatorstats[MutationTypePoints]}`,
            `Delete Triangle: ${this.evolver.mutatorstats[MutationTypeDelete]}`,
        ];
        this.setState({
            lastStatsUpdate: lastStatsUpdate,
            fps: fps,
            similarityText: similarityText,
            stats: stats,
            triangleCount: this.evolver.triangles.length,
        });
    }

    render() {
        return <div className="row">
            <div className="col-lg-8 offset-lg-2 col-md-12">
                <Menu
                    onStartStop={this.onStartStop.bind(this)}
                    imageLoaded={this.state.imageLoaded}
                    started={this.state.started}
                    imageLoading={this.state.imageLoading}
                    onImageLoadStart={this.onImageLoadStart.bind(this)}
                    onImageLoadComplete={this.onImageLoadComplete.bind(this)} />
                <PaintingEvolver
                    fps={this.state.fps}
                    similarityText={this.state.similarityText}
                    triangleCount={this.state.triangleCount}
                    stats={this.state.stats} />
            </div>
        </div>;
    }
}