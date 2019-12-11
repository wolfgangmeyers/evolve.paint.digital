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

// TODO: allow the user to set this
const client = new ServerClient("http://localhost:8081")

function wait(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export const VideoWorkerPage: React.FC = () => {

    const initialConfig: Config = {
        saveSnapshots: false,
        maxSnapshots: 0,
        focusExponent: 1,
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
    const [lastUpdate, setLastUpdate] = React.useState(new Date().getTime());
    const [config, setConfig] = React.useState(initialConfig);
    const [evolver, setEvolver] = React.useState<Evolver>(null);
    const [waiting, setWaiting] = React.useState(false);


    // TODO: refresh page on completion...

    const initialize = async () => {
        const brushSet = await loadBrushSet(brushData, brushes);
        // TODO: configure which brushes should be on over time
        for (let tag of brushSet.getTags()) {
            config.enabledBrushTags[tag] = true;
        }

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
        } catch(err) {
            setErr("Could not contact server at http://localhost:8081");
            return;
        }
        

        const dataURI = "data:image/jpeg;base64," + workItem.imageData;
        const img = new Image();
        img.src = dataURI;
        img.onload = () => {
            evolver.setSrcImage(img, workItem.configuration.resolutionX, workItem.configuration.resolutionY);
            evolver.start();

            // HACK!!!!
            // replace this with something smarter asap
            setTimeout(() => {
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
            }, workItem.configuration.duration * 1000); // TODO: longer timeout
        };
    };

    React.useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            initialize();
        }
        // TODO: poll for progress and completion...
    });

    return (
        <div className="row">
            <div className="col-lg-12">
                <Card>
                    <CardHeader>
                        <h4 className="text-center">
                            Video Job Worker
                        </h4>
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
                                    <PaintingEvolverCanvas zoom={true} />
                                    <canvas id="scratch" style={{ visibility: "hidden" }} />
                                </>
                            )}

                    </CardBody>
                </Card>
            </div>
        </div>
    );
};
