import * as React from "react";
import { VideoJobConfiguration, BrushConfiguration } from "../../server/model";
import { Modal, Button, FormGroup, FormLabel, FormControl, Row, Form, Col, FormCheck } from "react-bootstrap";
import { TextInput } from "../../components/form/TextInput";
import { BrushSet } from "../../engine/brushSet";
import { Checkbox } from "../../components/form/Checkbox";
import { FormFields } from "../../components/form/FormFields";

interface CreateJobFormProps {
    show: boolean;
    onCancel: () => void;
    onConfirm: (name: string, configuration: VideoJobConfiguration) => void;
    brushSet: BrushSet;
}



export const CreateJobForm: React.FC<CreateJobFormProps> = props => {

    const brushTags = props.brushSet.getTags();

    const defaultFormData = (): FormFields => {
        const result = {
            name: "New Video Job",
            resolutionX: "1080",
            resolutionY: "720",
            outputFPS: "30",
        };
        for (let tag of brushTags) {
            result[`${tag} enabled`] = "true";
            result[`${tag} start`] = 0;
            result[`${tag} end`] = 20;
        }
        return result;
    }

    const [formData, setFormData] = React.useState<{ [key: string]: string }>(defaultFormData());



    const onCancel = () => {
        setFormData(defaultFormData());
        props.onCancel();
    };

    const textInput = (field: string) => (
        <TextInput
            formData={formData}
            field={field}
            onChange={setFormData} />
    );

    const checkbox = (field: string, label: string) => (
        <Checkbox
            field={field}
            label={label}
            formData={formData}
            onChange={setFormData} />
    );

    const onCreate = () => {
        const name = formData["name"];
        const configuration: VideoJobConfiguration = {
            resolutionX: parseInt(formData["resolutionX"]),
            resolutionY: parseInt(formData["resolutionY"]),
            outputFPS: parseInt(formData["outputFPS"]),
            brushConfiguration: [],
        };
        for (let tag of brushTags) {
            const brushConfiguration: BrushConfiguration = {
                enabled: formData[`${tag} enabled`] == "true",
                tag: tag,
                start: parseInt(formData[`${tag} start`]),
                end: parseInt(formData[`${tag} end`])
            }
            configuration.brushConfiguration.push(brushConfiguration);
        }
        props.onConfirm(name, configuration);
        setFormData(defaultFormData());
    };

    return (
        <Modal size="lg" show={props.show} onHide={onCancel}>
            <Modal.Header closeButton><h4>Create New Video Job</h4></Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group as={Row}>
                        <Form.Label column className="col-sm-3">Name:</Form.Label>
                        <Col sm="7">
                            {textInput("name")}
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row}>
                        <Form.Label column className="col-sm-3">Resolution:</Form.Label>
                        <Col sm="3">
                            {textInput("resolutionX")}
                        </Col>
                        <Col sm="1" style={{ marginTop: "5px" }}>
                            <i className="fa fa-times"></i>
                        </Col>
                        <Col sm="3">
                            {textInput("resolutionY")}
                        </Col>
                    </Form.Group>
                    <Form.Group as={Row}>
                        <Form.Label column className="col-sm-3">Output FPS:</Form.Label>
                        <Col sm="3">
                            {textInput("outputFPS")}
                        </Col>
                    </Form.Group>
                    <hr />
                    <Form.Group as={Row}>
                        <Col sm="3">Brush Tag</Col>
                        <Col sm="4">Start (minutes)</Col>
                        <Col sm="3">End (minutes)</Col>
                    </Form.Group>
                    {brushTags.map(tag => (
                        <Form.Group as={Row} key={`brush-tag-${tag}`}>
                            <Col sm="3">
                                {checkbox(`${tag} enabled`, tag)}
                                {/* <FormCheck label={tag}></FormCheck> */}
                            </Col>
                            <Col sm="3">
                                {textInput(`${tag} start`)}
                            </Col>
                            <Col sm="1" style={{ marginTop: "5px" }}>
                                to
                            </Col>
                            <Col sm="3">
                                {textInput(`${tag} end`)}
                            </Col>
                        </Form.Group>
                    ))}

                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={onCreate}>
                    Create
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
