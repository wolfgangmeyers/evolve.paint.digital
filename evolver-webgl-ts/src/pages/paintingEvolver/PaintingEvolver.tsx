import * as React from "react";

import { PaintingEvolverControls, PaintingEvolverControlsProps } from "./PaintingEvolverControls";
import { PaintingEvolverStats, PaintingEvolverStatsProps } from "./PaintingEvolverStats";
import { PaintingEvolverCanvas, PaintingEvolverCanvasProps } from "./PaintingEvolverCanvas";

export interface PaintingEvolverProps extends PaintingEvolverStatsProps, PaintingEvolverControlsProps, PaintingEvolverCanvasProps {

}

export class PaintingEvolver extends React.Component<PaintingEvolverProps> {
    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                <h4 className="text-center">Painting Evolver</h4>
                <PaintingEvolverControls
                    {...this.props} />
            </div>
            <div className="card-body">
                <div className="row">
                    <PaintingEvolverStats
                        {...this.props}/>
                    {/* TODO: focus editor controls */}
                    <PaintingEvolverCanvas {...this.props} />
                </div>
            </div>
        </div>;
    }
}
