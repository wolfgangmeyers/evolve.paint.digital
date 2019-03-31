import * as React from "react";

export interface PaintingEvolverStatsProps {
    fps: number;
    similarityText: string;
    triangleCount: number;
    stats: Array<string>;
}

export class PaintingEvolverStats extends React.Component<PaintingEvolverStatsProps> {
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
            <br /> Similarity:
                <div className="progress">
                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: this.props.similarityText }}>
                    {this.props.similarityText}
                </div>
            </div>
            <hr />
            <h4>Mutation Improvements</h4>
            {this.renderStats()}
        </div>;
    }
}