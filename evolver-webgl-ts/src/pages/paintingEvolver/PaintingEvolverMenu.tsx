import * as React from "react";
import { NavLink } from "react-router-dom";


export interface PaintingEvolverMenuProps {
    imageLoaded: boolean;
    imageLoading: boolean;
    trianglesLoading: boolean;
    started: boolean;
    mode: "worker" | "supervisor" | "standalone";
    clusterId: string;
    showRenderTimelapse: boolean
    enableRenderTimelapse: boolean
    onStartStop: () => void;
    onImageLoadStart: () => void;
    onImageLoadComplete: (image: HTMLImageElement) => void;
    onSaveImage: () => void;
    onSaveTriangles: () => void;
    // onSaveSVG: () => void;
    onLoadTrianglesStart: () => void;
    onLoadTrianglesComplete: (triangles: string) => void;
    onRenderTimelapse: () => void
}

export class PaintingEvolverMenu extends React.Component<PaintingEvolverMenuProps> {

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

    renderTimelapse() {
        if (!this.props.showRenderTimelapse) {
            return
        }
        return <button
            className="btn btn-sm btn-primary"
            onClick={this.props.onRenderTimelapse}
            disabled={!this.props.enableRenderTimelapse}
        >
            Render Timelapse
        </button>
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

    onLoadTrianglesChange(files: FileList) {
        // FileReader support
        if (FileReader && files && files.length) {
            this.props.onLoadTrianglesStart();
            const fr = new FileReader();
            fr.onload = () => {
                this.props.onLoadTrianglesComplete(fr.result.toString());
            };
            fr.readAsText(files[0]);
        } else {
            alert("Your browser can't load files. Try chrome, safari, firefox or edge");
        }
    }

    render() {
        return <div>
            {this.renderStartStop()}
            <label
                id="loadimage-wrapper"
                className={`btn btn-sm btn-primary btn-file${this.props.imageLoaded || this.props.imageLoading ? " disabled" : ""}`}
                style={{ marginTop: "8px" }}
            >
                Load Image
                <input
                    id="loadimage"
                    type="file"
                    style={{ display: "none" }}
                    onChange={evt => this.onLoadImageChange(evt.target.files)}
                    disabled={this.props.imageLoaded || this.props.imageLoading}
                />
            </label>
            <button
                className="btn btn-sm btn-primary"
                disabled={!(this.props.imageLoaded && !this.props.started)}
                onClick={this.props.onSaveImage}>Save Image</button>
            <button id="savetriangles"
                className="btn btn-sm btn-primary"
                onClick={this.props.onSaveTriangles}
                disabled={this.props.started || !this.props.imageLoaded}>Save Triangles</button>
            {/* <button id="loadtriangles" className="btn btn-sm btn-primary" onClick={this.props.onLoadTriangles}>Load Triangles</button> */}

            <label
                id="loadtriangles-wrapper"
                className={`btn btn-sm btn-primary btn-file${this.props.started || !this.props.imageLoaded ? " disabled" : ""}`}
                style={{ marginTop: "8px" }}
            >
                Load Triangles
                <input
                    id="loadtriangles"
                    type="file"
                    style={{ display: "none" }}
                    onChange={evt => this.onLoadTrianglesChange(evt.target.files)}
                    disabled={this.props.started || !this.props.imageLoaded}
                />
            </label>
            {this.props.mode == "supervisor" && <a target="_blank" href={`${window.location.protocol + "//" + window.location.host}/painting-evolver?mode=worker&clusterId=${this.props.clusterId}`} className="btn btn-sm btn-primary">Worker Link</a>}
            {/* <button id="exportsvg" className="btn btn-sm btn-primary" onClick={this.props.onSaveSVG} disabled={!this.props.imageLoaded || this.props.started}>Export SVG</button> */}
            {this.renderTimelapse()}
        </div>;
    }
}
