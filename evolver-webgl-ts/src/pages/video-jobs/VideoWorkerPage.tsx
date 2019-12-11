import * as React from "react";
import { Card } from "../../components/card/Card";
import { CardHeader } from "../../components/card/CardHeader";
import { CardBody } from "../../components/card/CardBody";
import { ServerClient } from "../../server/server";
import { PaintingEvolverCanvas } from "../paintingEvolver/PaintingEvolverCanvas";
import { brushData, brushes } from "../../engine/brushes";
import { loadBrushSet } from "../../engine/brushSet";
import { Config } from "../../engine/config";
import { Evolver } from "../../engine/evolver";
import NavbarCollapse from "react-bootstrap/NavbarCollapse";
import { WorkItem } from "../../server/model";
import { loadServersInfo } from "./servers";
import { ServerSwitcher } from "./ServerSwitcher";
import { Button } from "react-bootstrap";


function wait(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export const VideoWorkerPage: React.FC = () => {

    // TODO: allow the user to set this
    let host: string;
    let client: ServerClient;

    const initClient = () => {
        host = loadServersInfo().activeServer;
        client = new ServerClient(host);
    };
    initClient();

    const initialConfig: Config = {
        saveSnapshots: false,
        maxSnapshots: 0,
        focusExponent: 2,
        minColorMutation: 0.001,
        maxColorMutation: 0.01,
        frameSkip: 10,
        enabledMutations: {
            "append": true,
            "color": true,
            "delete": true,
            "points": true,
            "position": true,
        },
        enabledBrushTags: {},
        manualOnly: false,
        manualJitter: 0
    }

    const [err, setErr] = React.useState<string>(null);
    const [initialized, setInitialized] = React.useState(false);
    const [config, setConfig] = React.useState(initialConfig);
    const [evolver, setEvolver] = React.useState<Evolver>(null);
    const [waiting, setWaiting] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [fps, setFPS] = React.useState(0);
    const [switchingServer, setSwitchingServer] = React.useState(false);
    const [activeBrushTag, setActiveBrushTag] = React.useState("");


    // TODO: refresh page on completion...

    const initialize = async () => {
        const brushSet = await loadBrushSet(brushData, brushes);
        const brushTags = brushSet.getTags();
        // This will be updated over the course of the painting
        config.enabledBrushTags[brushTags[0]] = true;

        setConfig({ ...config });
        const evolver = new Evolver(
            document.getElementById("c") as HTMLCanvasElement,
            config,
            brushSet
        );
        setEvolver(evolver);

        let workItem: WorkItem;
        try {
            workItem = await client.getVideoWorkItem();
            while (!workItem) {
                setWaiting(true);
                await wait(5000);
                workItem = await client.getVideoWorkItem();
            }
            setWaiting(false);
        } catch (err) {
            setErr("Could not contact server at " + host);
            return;
        }


        const dataURI = "data:image/jpeg;base64," + workItem.imageData;
        const img = new Image();
        img.src = dataURI;
        img.onload = () => {
            evolver.setSrcImage(img, workItem.configuration.resolutionX, workItem.configuration.resolutionY);
            evolver.start();

            // Duration is in minutes
            // Convert to seconds, and expect 100 frames per second
            const maxFrames = workItem.configuration.duration * 60 * 100;
            let totalFrames = 0;
            setInterval(() => {
                totalFrames += evolver.frames;
                setFPS(evolver.frames);
                evolver.frames = 0;
                const progress = totalFrames / maxFrames;
                setProgress(progress);

                // Update brushes based on progress. Further progress activates
                // more detailed brushes.
                // Spend more time with detailed brushes than with larger ones
                const skewedProgress = 1.0 - Math.pow(1.0 - progress, 2);
                let brushTagIndex = Math.floor(skewedProgress * brushTags.length);
                if (brushTagIndex >= brushTags.length) {
                    brushTagIndex = brushTags.length - 1;
                }
                for (let i = 0; i < brushTags.length; i++) {
                    const brushTag = brushTags[i];
                    config.enabledBrushTags[brushTag] = i == brushTagIndex;
                    if (i == brushTagIndex) {
                        setActiveBrushTag(brushTag);
                    }
                }


                if (totalFrames >= maxFrames) {
                    // Finished with the render, push it back to the serverand reload.
                    evolver.stop()
                    evolver.exportPNG(async (pixels, width, height) => {
                        const canvas = document.getElementById("scratch") as HTMLCanvasElement;
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        const imageData = ctx.getImageData(0, 0, width, height);
                        for (let i = 0; i < imageData.data.length; i++) {
                            imageData.data[i] = pixels[i];
                        };
                        ctx.putImageData(imageData, 0, 0);
                        const dataURI = canvas.toDataURL("image/jpeg");
                        const parts = dataURI.split(",");
                        await client.submitVideoWorkItemResult(workItem.jobId, workItem.id, parts[1], "");
                        // reload
                        window.location.href = window.location.href;
                    });
                }


            }, 1000); // TODO: longer timeout
        };
    };

    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            initialize();
        }
        // TODO: poll for progress and completion...
    });

    const progressPercentage = (progress * 100).toFixed(2) + "%";

    return (
        <div className="row">
            <div className="col-lg-12">
                <Card>
                    <CardHeader>
                        <h4 className="text-center">
                            Video Job Worker
                        </h4>
                        <div className="pull-right">
                            Server:&nbsp;
                            <Button variant="primary" size="sm" onClick={() => setSwitchingServer(true)}>
                                {host}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {err ? <span className="text-danger">{err}</span> : null}
                        {waiting ? (
                            <>
                                <i className="fa fa-spinner fa-spin"></i>&nbsp;
                                Waiting for next work item...
                            </>
                        ) : (
                                <>
                                    <div>FPS: {fps}</div>
                                    <div>Active Brushes: {activeBrushTag}</div>
                                    <div>Frame Evolution Progress:</div>
                                    <div className="progress-bar" role="progressbar" style={{ width: progressPercentage }}>
                                        {progressPercentage}
                                    </div>
                                    <PaintingEvolverCanvas zoom={true} />
                                    <canvas id="scratch" style={{ visibility: "hidden" }} />
                                </>
                            )}

                    </CardBody>
                </Card>
            </div>
            <ServerSwitcher
                show={switchingServer}
                onClose={() => {
                    // just reload the page if the server gets switched.
                    window.location.href = window.location.href;
                }} />
        </div>
    );
};
