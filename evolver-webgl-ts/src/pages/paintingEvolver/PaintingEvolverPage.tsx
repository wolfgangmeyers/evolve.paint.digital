import * as React from "react";
import { Menu } from "./Menu";
import { PaintingEvolver } from "./PaintingEvolver";
import { Evolver } from "../../engine/evolver";

export interface PaintingEvolverPageState {
    imageLoaded: boolean;
    started: boolean;
    displayMode: number;
    imageLoading: boolean;
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
        };
    }

    componentDidMount() {
        this.evolver = new Evolver(
            document.getElementById("c") as HTMLCanvasElement,
        );
        // Optimize every minute
        window.setInterval(() => this.evolver.optimize(), 60000);
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

    render() {
        return <div className="row">
            <div className="col-lg-8 offset-lg-2 col-md-12">
                <Menu
                    onStartStop={this.onStartStop.bind(this)}
                    imageLoaded={this.state.imageLoaded}
                    started={this.state.started}
                    imageLoading={this.state.imageLoading}
                    onImageLoadStart={this.onImageLoadStart.bind(this)}
                    onImageLoadComplete={this.onImageLoadComplete.bind(this)}/>
                <PaintingEvolver />
            </div>
        </div>;
    }
}