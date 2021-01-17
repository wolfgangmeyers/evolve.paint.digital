import Peer, { DataConnection } from "peerjs";
import moment from "moment";
import { BrushStroke } from "../brushStroke";
import { WorkerEvent } from "./model";
import pako from "pako";
import { Config } from "../config";
import { Point } from "../point";

export class Supervisor {

    private peer: Peer;
    private workers: Array<DataConnection> = [];

    private srcImageData: string = null;
    private strokes: Array<BrushStroke> = [];
    private workerIndex = 0;
    private lastFocusPinUpdate = moment();

    constructor(
        clusterId: string,
        private onStrokesSubmitted: (strokes: Array<BrushStroke>) => void,
    ) {
        console.log(`Supervisor instantiated in cluster ${clusterId}`);
        this.peer = new Peer(clusterId, {debug: 2});

        this.peer.on("open", id => {
            console.log("Supervisor connected to signaling server", {id});
        });

        this.peer.on("connection", (connection: DataConnection) => {
            const workerIndex = this.workerIndex++;
            console.log(`New worker connected! ${workerIndex}`);
            this.workers.push(connection);
            connection.on("data", (evt: WorkerEvent) => {
                console.log(`Supervisor received worker event from ${workerIndex}`, evt);
                switch (evt.eventType) {
                    case "getSrcImage":
                        if (this.srcImageData) {
                            connection.send({
                                eventType: "srcImage",
                                imageData: this.srcImageData,
                            });
                        }
                        break;
                    case "getStrokes":
                        const strokes = this.strokes.slice(evt.index, evt.index + 1000);
                        const data = pako.deflate(JSON.stringify(strokes));
                        console.log(`Sending ${strokes.length} strokes of ${this.strokes.length} to worker ${workerIndex}`);
                        connection.send({
                            eventType: "strokes",
                            strokes: data
                        })
                        break;
                    case "submitStrokes":
                        const submittedStrokes = JSON.parse(pako.inflate(evt.strokes, {to: "string"}));
                        this.onStrokesSubmitted(submittedStrokes);
                        break;
                }
            });
            connection.on("error", err => console.error(err));

            connection.on("close", () => {
                console.log(`Worker ${workerIndex} has disconnected from supervisor`);
                const index = this.workers.indexOf(connection);
                this.workers.splice(index, 1);
            });
        });
        this.peer.on("error", err => console.error(err));
    }

    addStroke(stroke: BrushStroke) {
        stroke.id = this.strokes.length;
        this.strokes.push(stroke);
    }

    setSrcImageData(srcImageData: string) {
        console.log(`Supervisor sending srcImage to ${this.workers.length} workers`);
        this.srcImageData = srcImageData;
        for (let connection of this.workers) {
            connection.send({
                eventType: "srcImage",
                imageData: this.srcImageData,
            });
        }
    }

    updateConfig(config: Config) {
        console.log(`Supervisor sending config to ${this.workers.length} workers`);
        for (let connection of this.workers) {
            connection.send({
                eventType: "config",
                config,
            });
        }
    }

    updateFocusPin(focusPin: Point) {
        // throttle to once per second
        if (moment().diff(this.lastFocusPinUpdate, "seconds") > 1 || !focusPin) {
            this.lastFocusPinUpdate = moment();
            console.log(`Supervisor sending focus pin to ${this.workers.length} workers`);
            for (let connection of this.workers) {
                connection.send({
                    eventType: "focusPin",
                    focusPin,
                })
            }
        }
    }
}