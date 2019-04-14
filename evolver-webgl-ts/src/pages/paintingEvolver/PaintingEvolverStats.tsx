import * as React from "react";
import { ConfigItem } from "../../components/ConfigItem";

export interface PaintingEvolverStatsProps {
    fps: number;
    similarityText: string;
    triangleCount: number;
    stats: Array<string>;
    focusExponentBase: number;
    onUpdateFocusExponentBase: (newBase: number) => void;
    frameSkip: number;
    onUpdateFrameskip: (newFrameskip: number) => void;
    minTriangleRadius: number;
    onUpdateMinTriangleRadius: (newRadius: number) => void;
    maxTriangleRadius: number;
    onUpdateMaxTriangleRadius: (newRadius: number) => void;
}

export class PaintingEvolverStats extends React.Component<PaintingEvolverStatsProps> {

    renderStats() {
        return (<div id="stats">
            <ConfigItem
                label="Focus Exponent"
                onUpdate={this.props.onUpdateFocusExponentBase}
                value={this.props.focusExponentBase} />
            <ConfigItem
                label="Frame Skip"
                onUpdate={this.props.onUpdateFrameskip}
                value={this.props.frameSkip} />
            <ConfigItem
                label="Min Triangle Radius"
                onUpdate={this.props.onUpdateMinTriangleRadius}
                value={this.props.minTriangleRadius} />
            <ConfigItem
                label="Max Triangle Radius"
                onUpdate={this.props.onUpdateMaxTriangleRadius}
                value={this.props.maxTriangleRadius} />
        </div>);
    }
    
    render() {
        return <div className="col-sm-6" id="stats-container">
            <h4>Stats</h4>
            FPS:
                <span id="fps">{this.props.fps}</span>
            <br /> Triangle Count:
                <span id="triangles">{this.props.triangleCount}</span>
            <br /> Similarity:
                <div className="progress">
                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: this.props.similarityText }}>
                    {this.props.similarityText}
                </div>
            </div>
            <hr />
            <h4>Engine Config</h4>
            {this.renderStats()}
        </div>;
    }
}
