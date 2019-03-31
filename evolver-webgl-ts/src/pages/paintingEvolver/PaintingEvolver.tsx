import * as React from "react";

import { PaintingEvolverControls } from "./PaintingEvolverControls";
import { PaintingEvolverStats, PaintingEvolverStatsProps } from "./PaintingEvolverStats";
import { PaintingEvolverCanvas } from "./PaintingEvolverCanvas";

export interface PaintingEvolverProps extends PaintingEvolverStatsProps {

}

export class PaintingEvolver extends React.Component<PaintingEvolverProps> {
    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                <h4 className="text-center">Painting Evolver</h4>
                <PaintingEvolverControls />
            </div>
            <div className="card-body">
                <div className="row">
                    <PaintingEvolverStats
                        fps={this.props.fps}
                        similarityText={this.props.similarityText}
                        triangleCount={this.props.triangleCount}
                        stats={this.props.stats}/>
                    {/* TODO: focus editor controls */}
                    <PaintingEvolverCanvas />
                </div>
            </div>
        </div>;
    }
}