import * as React from "react";
import { Config } from "../../engine/config";
import { ConfigItem } from "../../components/ConfigItem";

export interface PaintingEvolverStatsProps {
    fps: number;
    similarityText: string;
    triangleCount: number;
    stats: Array<string>;
    progressSpeed: number;
    config: Config;
}

export interface PaintingEvolverStatsState {
    config: Config;
}

export class PaintingEvolverStats extends React.Component<PaintingEvolverStatsProps, PaintingEvolverStatsState> {

    constructor(props: PaintingEvolverStatsProps) {
        super(props);
        this.state = {
            config: props.config,
        };
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

    onUpdateMinColorMutation(newRate: number) {
        if (newRate < 0) {
            newRate = 0;
        }
        if (newRate >= this.state.config.maxColorMutation) {
            return;
        }
        this.state.config.minColorMutation = newRate;
        this.setState({
            config: this.state.config,
        });
    }

    onUpdateMaxColorMutation(newRate: number) {
        if (newRate >= 1 || newRate <= this.state.config.minColorMutation) {
            return;
        }
        this.state.config.maxColorMutation = newRate;
        this.setState({
            config: this.state.config,
        });
    }

    renderControls() {
        return (<div id="stats">
            <ConfigItem
                label="Focus Exponent"
                onUpdate={this.onUpdateFocusExponentBase.bind(this)}
                value={this.state.config.focusExponent} />
            <ConfigItem
                label="Frame Skip"
                onUpdate={this.onUpdateFrameSkip.bind(this)}
                value={this.state.config.frameSkip} />
            <ConfigItem
                label="Min Triangle Radius"
                onUpdate={this.onUpdateMinTriangleRadius.bind(this)}
                value={this.state.config.minTriangleRadius} />
            <ConfigItem
                label="Max Triangle Radius"
                onUpdate={this.onUpdateMaxTriangleRadius.bind(this)}
                value={this.state.config.maxTriangleRadius} />
            <ConfigItem
                label="Min Color Mutation"
                onUpdate={this.onUpdateMinColorMutation.bind(this)}
                value={this.state.config.minColorMutation}
                increment={0.001}
                skipIncrement={0.01}
                displayDecimals={3}/>
            <ConfigItem
                label="Max Color Mutation"
                onUpdate={this.onUpdateMaxColorMutation.bind(this)}
                value={this.state.config.maxColorMutation}
                increment={0.001}
                skipIncrement={0.01}
                displayDecimals={3}/>
        </div>);
    }

    renderStats() {
        return (<div id="stats">
            {
                this.props.stats.map((item, i) => {
                    return <div key={`stats-${i}`}>{item}</div>;
                })
            }
        </div>);
    }
    
    render() {
        return <div className="col-sm-6" id="stats-container">
            <h4>Stats</h4>
            FPS:
                <span id="fps">{this.props.fps}</span>
            <br /> Triangle Count:
                <span id="triangles">{this.props.triangleCount}</span>
            <br /> Progress Speed:
                <span id="triangles">{this.props.progressSpeed}</span>
            <br /> Similarity:
                <div className="progress">
                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: this.props.similarityText }}>
                    {this.props.similarityText}
                </div>
            </div>
            <hr />
            <h4>Mutation Improvements</h4>
            {this.renderStats()}
            <hr/>
            <h4>Controls</h4>
            {this.renderControls()}
        </div>;
    }
}
