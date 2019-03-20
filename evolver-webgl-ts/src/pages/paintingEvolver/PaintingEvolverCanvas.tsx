import * as React from "react";

export class PaintingEvolverCanvas extends React.Component {
    render() {
        return <div className="col-sm-6">
            <canvas id="c" width="1024" height="1024" style={{ width: "100%", border: "1px solid black" }}></canvas>
        </div>;
    }
}