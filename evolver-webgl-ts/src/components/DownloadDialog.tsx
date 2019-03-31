import * as React from "react";
import { Modal, ModalTitle, ModalBody, ModalFooter } from "react-bootstrap";

export interface DownloadDialogProps {
    imageWidth: number;
    imageHeight: number;
    imageData?: Uint8Array;
}

export class DownloadDialog extends React.Component<DownloadDialogProps> {

    private canvas: HTMLCanvasElement;

    componentDidUpdate() {
        if (this.props.imageData) {
            const ctx = this.canvas.getContext("2d");
            const imageData = ctx.createImageData(this.props.imageWidth, this.props.imageHeight);
            for (let i = 0; i < this.props.imageData.length; i++) {
                imageData.data[i] = this.props.imageData[i];
            }
            ctx.putImageData(imageData, 0, 0);
        }
    }

    render() {
        return (
            <Modal show={!!this.props.imageData}>
                <ModalBody>
                    <canvas
                        ref={c => this.canvas = c}
                        />
                </ModalBody>
            </Modal>
        );
    }
}