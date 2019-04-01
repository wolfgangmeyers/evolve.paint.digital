import * as React from "react";
import { Modal, ModalTitle, ModalBody, ModalFooter } from "react-bootstrap";

export interface DownloadDialogProps {
    imageWidth: number;
    imageHeight: number;
    imageData?: Uint8Array;
    onClose: () => void;
}

export interface DownloadDialogState {
    imageDataURL: string;
    filename: string;
}

export class DownloadDialog extends React.Component<DownloadDialogProps, DownloadDialogState> {

    private canvas: HTMLCanvasElement;

    constructor(props) {
        super(props);
        this.state = {
            imageDataURL: "",
            filename: "download.png",
        };
    }

    componentDidUpdate() {
        if (!this.canvas) {
            return;
        }
        if (this.props.imageData) {
            const ctx = this.canvas.getContext("2d");
            const imageData = ctx.createImageData(this.props.imageWidth, this.props.imageHeight);
            for (let i = 0; i < this.props.imageData.length; i++) {
                imageData.data[i] = this.props.imageData[i];
            }
            ctx.putImageData(imageData, 0, 0);
        }
        const dataURL = this.canvas.toDataURL("image/png");
        if (dataURL != this.state.imageDataURL) {

            this.setState({
                imageDataURL: dataURL,
            });
        }
    }

    render() {
        return (
            <Modal
                show={!!this.props.imageData}
                onHide={this.props.onClose}>
                <ModalBody>
                    <canvas
                        width={this.props.imageWidth}
                        height={this.props.imageHeight}
                        style={{ width: "100%" }}
                        ref={c => this.canvas = c}
                    />
                    <div>
                        <input type="text" value={this.state.filename}
                            onChange={e => this.onFilenameChange(e)} />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <a
                        href={this.state.imageDataURL}
                        className="btn btn-primary"
                        download={this.state.filename}
                        onClick={this.props.onClose}>Download</a>
                    <button className="btn btn-default" onClick={this.props.onClose}>
                        Cancel
                    </button>
                </ModalFooter>
            </Modal>
        );
    }

    onFilenameChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const target = e.target as HTMLInputElement;
        this.setState({
            filename: target.value,
        });
    }
}