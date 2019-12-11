import * as React from "react";
import { Menu } from "../Menu";
import { Card } from "../../components/card/Card";
import { CardHeader } from "../../components/card/CardHeader";
import { CardBody } from "../../components/card/CardBody";
import { VideoJob, VideoJobConfiguration } from "../../server/model";
import { ServerClient } from "../../server/server";
import { Alert, Button, OverlayTrigger, ListGroup, ListGroupItem, Popover } from "react-bootstrap";
import { CreateJobForm } from "./CreateJobForm";
import { BrushSet } from "../../engine/brushSet";
import { brushes } from "../../engine/brushes";
import { UploadVideoForm } from "./UploadVideoForm";

// TODO: allow the user to set this
const client = new ServerClient("http://localhost:8081")

// Just needed for the list of brush tags
const brushSet = new BrushSet({
    brushDataUri: "",
    brushes: brushes,
    width: 0,
    height: 0
}, null);

export const VideoJobs: React.FC = () => {
    const [jobs, setJobs] = React.useState<Array<VideoJob>>(null);
    const [loading, setLoading] = React.useState(true);
    const [err, setErr] = React.useState<string>(null);
    const [creatingJob, setCreatingJob] = React.useState(false);
    const [uploadingVideo, setUploadingVideo] = React.useState<string>(null);

    const loadJobs = async () => {
        try {
            const jobs = await client.listJobs();
            jobs.sort((a, b) => a.name.localeCompare(b.name));
            setJobs(jobs);
        } catch (err) {
            console.error(err);
            setErr("Could not contact server at http://localhost:8081");
        }
        setLoading(false);
        
    };

    React.useEffect(() => {
        if (loading) {
            loadJobs();
        }
        let timeout = setInterval(() => {
            setLoading(true);
        }, 2000);
        return () => {
            clearInterval(timeout);
        }
    });

    const onCreateJob = async (name: string, configuration: VideoJobConfiguration) => {
        setCreatingJob(false);
        try {
            const job = await client.createJob(name, configuration);
            setUploadingVideo(job.id);
            setLoading(true);
        } catch (err) {
            console.error(err);
            setErr("Could not create job");
        }
    };

    const onDeleteJob = async (id: string) => {
        if (confirm("Are you sure?")) {
            try {
                await client.deleteJob(id);
                setLoading(true);
            } catch (err) {
                console.error(err);
                setErr("Could not delete job");
            }
        }
    };

    /** Hack to un-focus popovers */
    const unfocus = () => {
        document.body.click();
    }

    const onUploadVideo = async (file: File) => {
        const jobId = uploadingVideo;
        setUploadingVideo(null);
        await client.uploadVideoFile(jobId, file);
        // TODO: busy modal
        console.log("Done!");
    };

    return (
        <div className="row">

            <div className="col-lg-8 offset-lg-2 col-md-12">
                <Menu>

                </Menu>
                <Card>
                    <CardHeader>
                        <h4 className="text-center">Video Jobs</h4>
                        <div className="pull-right">
                            <Button variant="primary" size="sm" onClick={() => setCreatingJob(true)}>
                                Create New Job
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {err ? <span className="text-danger">{err}</span> : null}
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Progress</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs ? jobs.map(job => (
                                    <tr key={`job-${job.id}`}>
                                        <td>{job.name}</td>
                                        <td>{job.completedWorkItems} / {job.workItems}</td>
                                        <td>{job.status}</td>
                                        <td>
                                            <OverlayTrigger trigger="click" overlay={(
                                                <Popover id={`open-${job.id}`}>
                                                    <ListGroup>
                                                        {job.status == "Upload Pending" ? (
                                                            <ListGroupItem action onClick={() => {unfocus(); setUploadingVideo(job.id)}}>
                                                                Upload Video
                                                            </ListGroupItem>
                                                        ) : null}
                                                        <ListGroupItem action onClick={() => {unfocus(); onDeleteJob(job.id);}}>
                                                            Delete
                                                        </ListGroupItem>
                                                    </ListGroup>
                                                </Popover>
                                            )} placement="bottom-end" rootClose={true}>
                                                <button className="btn btn-sm">
                                                    <i className="fa fa-ellipsis-h"></i>
                                                </button>
                                            </OverlayTrigger>
                                        </td>
                                    </tr>
                                )) : null}
                            </tbody>
                        </table>
                    </CardBody>
                </Card>
            </div>
            <CreateJobForm
                show={creatingJob}
                onCancel={() => setCreatingJob(false)}
                onConfirm={onCreateJob}
                brushSet={brushSet} />
            <UploadVideoForm
                show={!!uploadingVideo}
                onCancel={() => setUploadingVideo(null)}
                onUpload={onUploadVideo} />
        </div>
    );
};
