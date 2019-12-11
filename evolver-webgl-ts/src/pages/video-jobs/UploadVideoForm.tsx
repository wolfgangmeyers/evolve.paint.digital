import * as React from "react";
import { Modal, Button } from "react-bootstrap";

interface UploadVideoFormProps {
    show: boolean;
    onCancel: () => void;
    onUpload: (file: File) => void;
}

export const UploadVideoForm: React.FC<UploadVideoFormProps> = props => {
    return (
        <Modal show={props.show} onHide={props.onCancel}>
            <Modal.Header closeButton>
                <h4>Upload Video File</h4>
            </Modal.Header>
            <Modal.Body>
                <label
                    className="btn btn-sm btn-primary"
                    style={{ marginTop: "8px" }} >
                    Upload Video File
                    <input
                        type="file"
                        style={{ display: "none" }}
                        onChange={evt => props.onUpload(evt.target.files[0])} />
                </label>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={props.onCancel}>
                    Cancel
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
