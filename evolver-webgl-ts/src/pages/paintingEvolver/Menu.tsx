import * as React from "react";

export interface MenuProps {
    imageLoaded: boolean;
    imageLoading: boolean;
    started: boolean;
    onStartStop: () => void;
    onImageLoadStart: () => void;
    onImageLoadComplete: (image: HTMLImageElement) => void;
}

export class Menu extends React.Component<MenuProps> {

    renderStartStop() {
        return (
            <button
                id="startstop"
                className="btn btn-sm btn-primary"
                disabled={!this.props.imageLoaded}
                onClick={this.props.onStartStop}
            >
                {this.props.started ? "Stop" : "Start"}
            </button>
        );
    }

    /** 
     * Begins loading the image and then fires an event when load is completed.
     * This is called when a file is selected by clicking "Load Image"
     */
    onLoadImageChange(files: FileList) {
        // FileReader support
        if (FileReader && files && files.length) {
            this.props.onImageLoadStart();
            const fr = new FileReader();
            fr.onload = () => {
                const srcImage = new Image();
                srcImage.src = fr.result.toString();
                srcImage.onload = () => {
                    this.props.onImageLoadComplete(srcImage);
                };
            };
            fr.readAsDataURL(files[0]);
        } else {
            alert("Your browser can't load files. Try chrome, safari, firefox or edge");
        }
    }

    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">Menu</div>
            <div className="card-body">
                {this.renderStartStop()}
                <label
                    id="loadimage-wrapper"
                    className="btn btn-sm btn-primary btn-file"
                    style={{ marginTop: "8px" }}

                >
                    Load Image
                <input
                        id="loadimage"
                        type="file"
                        style={{ display: "none" }}
                        onChange={evt => this.onLoadImageChange(evt.target.files)}
                    />
                </label>
                <button id="saveimage" className="btn btn-sm btn-primary" disabled>Save Image</button>
                <button id="savetriangles" className="btn btn-sm btn-primary" disabled>Save Triangles</button>
                <button id="loadtriangles" className="btn btn-sm btn-primary" disabled>Load Triangles</button>
                <button id="exportsvg" className="btn btn-sm btn-primary">Export SVG</button>
            </div>
        </div>;
    }
}