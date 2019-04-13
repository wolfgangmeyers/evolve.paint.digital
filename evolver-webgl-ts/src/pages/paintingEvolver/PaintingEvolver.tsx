import * as React from "react";

import { PaintingEvolverControls, PaintingEvolverControlsProps } from "./PaintingEvolverControls";
import { PaintingEvolverStats, PaintingEvolverStatsProps } from "./PaintingEvolverStats";
import { PaintingEvolverCanvas } from "./PaintingEvolverCanvas";

export interface PaintingEvolverProps extends PaintingEvolverStatsProps, PaintingEvolverControlsProps {

}

export class PaintingEvolver extends React.Component<PaintingEvolverProps> {
    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                <h4 className="text-center">Painting Evolver</h4>
                <PaintingEvolverControls
                    currentMode={this.props.currentMode}
                    onViewModeChanged={this.props.onViewModeChanged} />
            </div>
            <div className="card-body">
                <div className="row">
                    <PaintingEvolverStats
                        fps={this.props.fps}
                        similarityText={this.props.similarityText}
                        triangleCount={this.props.triangleCount}
                        stats={this.props.stats}
                        focusExponentBase={this.props.focusExponentBase}
                        onUpdateFocusExponentBase={this.props.onUpdateFocusExponentBase}
                        frameSkip={this.props.frameSkip}
                        onUpdateFrameskip={this.props.onUpdateFrameskip}/>
                    {/* TODO: focus editor controls */}
                    <PaintingEvolverCanvas />
                </div>
            </div>
        </div>;
    }
}
