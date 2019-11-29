import * as React from "react";

export interface PaintingEvolverControlsProps {
    onZoomChanged(zoom: boolean): void;
    onViewModeChanged (mode: number): void;
    currentMode: number;
    zoom: boolean;
}

export class PaintingEvolverControls extends React.Component<PaintingEvolverControlsProps> {

    renderViewModeButton(mode: number, label: string) {
        return <button
            className={`btn btn-sm btn-primary${mode == this.props.currentMode ? " active" : ""}`}
            onClick={() => this.props.onViewModeChanged(mode)}>

            {label}
        </button>
    }

    render() {
        return (
            <div>
                <span id="view-menu">
                    {this.renderViewModeButton(0, "Painting")}
                    {this.renderViewModeButton(1, "Original")}
                    {this.renderViewModeButton(2, "Difference")}
                    {this.renderViewModeButton(4, "Difference (small)")}
                </span>
                <div id="focus-map-edit" className="float-right">
                    {/* Someday bring focus map back */}
                     {/* <button id="btn-edit-focusmap" disabled className="btn btn-sm btn-primary">
                        Add Focus Map
                    </button> */}
                    <button id="btn-toggle-zoom" className="btn btn-sm btn-primary" onClick={() => this.props.onZoomChanged(!this.props.zoom)}>
                        {this.props.zoom ? <i className="fa fa-compress"></i> : <i className="fa fa-expand"></i>}
                    </button>
                </div>
                <div id="focus-map-save" className="float-right" style={{ display: "none" }}>
                    <button id="btn-save-focusmap" className="btn btn-sm btn-primary">
                        Save
                    </button>
                    <button id="btn-cancel-focusmap" className="btn btn-sm btn-primary">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }
}
