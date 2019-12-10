import * as React from "react";
import { VideoJobConfiguration } from "../../server/model";
import { Modal } from "react-bootstrap";

interface CreateJobFormProps {
    show: boolean;
    onCancel: () => void;
    onConfirm: (name: string, configuration: VideoJobConfiguration) => void;
}

export const CreateJobForm: React.FC<CreateJobFormProps> = props => {

    // TODO: some kind of state for the form

    const onCancel = () => {
        // TODO: clean state
        props.onCancel();
    };

    return (
        <Modal show={props.show} onHide={onCancel}>
{/* TODO: form implementation */}
        </Modal>
    );
}
