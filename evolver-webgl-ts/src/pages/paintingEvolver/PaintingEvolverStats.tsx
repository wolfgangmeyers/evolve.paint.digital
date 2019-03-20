import * as React from "react";

export class PaintingEvolverStats extends React.Component {
    render() {
        return <div className="col-sm-6" id="stats-container">
            <h4>Stats</h4>
            FPS:
                <span id="fps">0</span>
            <br /> Triangle Count:
                <span id="triangles">0</span>
            <br /> Similarity:
                <div className="progress">
                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: "0%" }}>
                    0%
                </div>
            </div>
            <hr />
            <h4>Mutation Improvements</h4>
            <div id="stats"></div>
        </div>;
    }
}