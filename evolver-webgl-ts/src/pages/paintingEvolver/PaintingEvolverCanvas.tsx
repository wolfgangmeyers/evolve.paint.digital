import * as React from "react";

export interface PaintingEvolverCanvasProps {
    zoom: boolean;
}

export const PaintingEvolverCanvas = (props: PaintingEvolverCanvasProps) => {
    return (<div className={props.zoom ? "col-sm-9" : "col-sm-6"}>
        <canvas id="c" width="1024" height="1024" style={{ width: "100%", border: "1px solid black" }}></canvas>
    </div>);
};
