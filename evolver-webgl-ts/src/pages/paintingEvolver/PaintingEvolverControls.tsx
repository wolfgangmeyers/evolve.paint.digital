import * as React from "react";

export class PaintingEvolverControls extends React.Component {
    render() {
        return (
            <div>
                <span id="view-menu">
                    <button id="viewpainting" className="btn btn-sm btn-primary active">Painting</button>
                    <button id="vieworiginal" className="btn btn-sm btn-primary">Original</button>
                    <button id="viewdiff" className="btn btn-sm btn-primary">Difference</button>
                    <button id="viewdiffsmall" className="btn btn-sm btn-primary">Difference (small)</button>
                </span>
                <div id="focus-map-edit" className="float-right">
                    <button id="btn-edit-focusmap" disabled className="btn btn-sm btn-primary">
                        Add Focus Map
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