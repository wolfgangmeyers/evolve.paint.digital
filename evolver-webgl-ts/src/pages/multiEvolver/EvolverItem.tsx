import * as React from "react";

export interface EvolverItemProps {
    index: number;
    filename: string;
    progress: string;
    fps: number;
    running: boolean;
    onDownloadClicked: (index: number) => void;
}

export class EvolverItem extends React.Component<EvolverItemProps> {
    render() {
        return <div className="col-lg-8 offset-lg-2 col-md-12">
            <div className="card border-primary mb-3">
                <div className="card-header">
                    {this.props.filename}
                </div>
                <div className="card-body">
                    <div className="row">
                        <div className="col-lg-2 col-md-2 col-sm-2">
                            FPS: {this.props.fps}
                        </div>
                        <div className="col-lg-7 col-md-7 col-sm-10">
                            <div className="progress">
                                <div id="similarity" className="progress-bar" role="progressbar" style={{ width: this.props.progress }}>
                                    {this.props.progress}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-2 col-sm-12">
                            <button disabled={this.props.running} className="btn btn-primary" onClick={() => this.props.onDownloadClicked(this.props.index)}>
                                Download
                </button>
                        </div>
                        <div className="col-lg-1 col-md-1 col-sm-12">
                            {this.props.children}
                        </div>
                    </div>
                </div>
            </div>
        </div>;
    }
}