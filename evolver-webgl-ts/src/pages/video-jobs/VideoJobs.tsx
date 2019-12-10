import * as React from "react";
import { Menu } from "../Menu";
import { Card } from "../../components/card/Card";
import { CardHeader } from "../../components/card/CardHeader";
import { CardBody } from "../../components/card/CardBody";
import { VideoJob } from "../../server/model";
import { ServerClient } from "../../server/server";
import { Alert } from "react-bootstrap";

// TODO: allow the user to set this
const client = new ServerClient("http://localhost:8081/query")

export const VideoJobs: React.FC = () => {

    const [jobs, setJobs] = React.useState<Array<VideoJob>>(null);
    const [loading, setLoading] = React.useState(true);
    const [err, setErr] = React.useState<string>(null);

    const loadJobs = async () => {
        try {
            setJobs(await client.listJobs())
        } catch(err) {
            console.error(err);
            setErr("Could not contact server at http://localhost:8081");
        }
        setLoading(false);
    };

    React.useEffect(() => {
        if (loading) {
            loadJobs();
        }
    });

    return (
        <div className="row">
            
            <div className="col-lg-8 offset-lg-2 col-md-12">
                <Menu>
                    
                </Menu>
                <Card>
                    <CardHeader>
                        <h4 className="text-center">Video Jobs</h4>
                    </CardHeader>
                    <CardBody>
                        {err ? <span className="text-danger">{err}</span> : null}
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                        </table>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
};
