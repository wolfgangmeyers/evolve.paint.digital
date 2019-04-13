import * as React from "react";

export interface PaintingEvolverStatsProps {
    fps: number;
    similarityText: string;
    triangleCount: number;
    stats: Array<string>;
    focusExponentBase: number;
    onUpdateFocusExponentBase: (newBase: number) => void;
    frameSkip: number;
    onUpdateFrameskip: (newFrameskip: number) => void;
}

export class PaintingEvolverStats extends React.Component<PaintingEvolverStatsProps> {

    renderStats() {
        return (<div id="stats">
            <div className="row">
                <label className="col-sm-3">Focus Exponent</label>
                <div className="col-sm-9">
                    <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdateFocusExponentBase(this.props.focusExponentBase - 1)}>&lt;</button>
                    &nbsp;{this.props.focusExponentBase}&nbsp;
                    <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdateFocusExponentBase(this.props.focusExponentBase + 1)}>&gt;</button>
                </div>
            </div>
            <div className="row">
                <label className="col-sm-3">Frame Skip</label>
                <div className="col-sm-9">
                    <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdateFrameskip(this.props.frameSkip - 1)}>&lt;</button>
                    &nbsp;{this.props.frameSkip}&nbsp;
                    <button className="btn btn-sm btn-primary" onClick={() => this.props.onUpdateFrameskip(this.props.frameSkip + 1)}>&gt;</button>
                </div>
            </div>
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
            <h4>Controls:</h4>
            {this.renderStats()}
        </div>;
    }
}
