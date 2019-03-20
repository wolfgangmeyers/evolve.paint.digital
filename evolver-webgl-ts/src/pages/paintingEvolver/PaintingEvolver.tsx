import * as React from "react";

import { PaintingEvolverControls } from "./PaintingEvolverControls";
import { PaintingEvolverStats } from "./PaintingEvolverStats";
import { PaintingEvolverCanvas } from "./PaintingEvolverCanvas";

export class PaintingEvolver extends React.Component {
    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                <h4 className="text-center">Painting Evolver</h4>
                <PaintingEvolverControls />
            </div>
            <div className="card-body">
                <div className="row">
                    <PaintingEvolverStats />
                    {/* TODO: focus editor controls */}
                    <PaintingEvolverCanvas />
                </div>
            </div>
        </div>;
    }
}