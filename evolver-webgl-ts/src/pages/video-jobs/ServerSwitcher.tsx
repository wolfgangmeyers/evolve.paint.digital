import * as React from "react";
import { Modal, Form, Row, Col, Button } from "react-bootstrap";
import { loadServersInfo, saveServersInfo } from "./servers";

interface ServerSwitcherProps {
    show: boolean;
    onClose: () => void;
}

export const ServerSwitcher: React.FC<ServerSwitcherProps> = props => {

    const [server, setServer] = React.useState(loadServersInfo().activeServer);

    return (
        <Modal show={props.show} onHide={props.onClose}>
            <Modal.Header>
                <h4 className="text-center">Select backend server</h4>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group as={Row}>
                        <Form.Label column className="col-sm-3">Host:</Form.Label>
                        <Col sm="7">
                            <input type="text" className="form-control" value={server} onChange={e => setServer(e.target.value)} />
                        </Col>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={props.onClose}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={() => {saveServersInfo({activeServer: server}); props.onClose();}}>
                    Confirm
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
