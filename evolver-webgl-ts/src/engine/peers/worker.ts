import Peer, { DataConnection } from "peerjs";
import pako from "pako";
import { BrushStroke } from "../brushStroke";
import { SupervisorEvent } from "./model";
import { Point } from "../point";
import { Config } from "../config";

export class Worker {
    private peer: Peer;
    private connection: DataConnection;
    private connected = false;
    private strokesQueue: Array<BrushStroke> = [];

    private receivedStrokes: {[key: number]: boolean} = {};

    constructor(
        clusterId: string,
        private onSrcImageReceived: (srcImage: string) => void,
        private onStrokesReceived: (strokes: Array<BrushStroke>) => void,
        private onFocusPinUpdate: (focusPin: Point) => void,
        private onConfigUpdate: (config: Config) => void,
    ) {
        console.log(`Worker instantiated in cluster ${clusterId}`);
        this.peer = new Peer(null, {debug: 2});
        this.peer.on("open", id => {
            console.log("Worker connected to signaling server", {id});
            this.connection = this.peer.connect(clusterId, {
                reliable: true,
            });
            this.connection.on("open", () => {
                console.log("Worker connected to supervisor");
                this.connection.send({
                    eventType: "getSrcImage"
                });
            });
            this.connection.on("data", (evt: SupervisorEvent) => {
                console.log("Worker received event from supervisor", evt);
                switch (evt.eventType) {
                    case "srcImage":
                        this.onSrcImageReceived(evt.imageData);
                        break;
                    case "strokes":
                        const evtStrokes = JSON.parse(pako.inflate(evt.strokes, {to: "string"}));
                        const strokes: Array<BrushStroke> = [];
                        evtStrokes.forEach(stroke => {
                            if (this.receivedStrokes[stroke.id]) {
                                return;
                            }
                            this.receivedStrokes[stroke.id] = true;
                            strokes.push(stroke);
                        })
                        if (strokes.length > 0) {
                            this.onStrokesReceived(strokes);
                        }

                        break;
                    case "config":
                        this.onConfigUpdate(evt.config);
                        break;
                    case "focusPin":
                        this.onFocusPinUpdate(evt.focusPin);
                        break;
                }
            });
            this.connection.on("error", err => console.error(err));

            window.setInterval(() => {
                if (this.strokesQueue.length > 0) {
                    this.connection.send({
                        eventType: "submitStrokes",
                        strokes: pako.deflate(JSON.stringify(this.strokesQueue)),
                    });
                    this.strokesQueue = [];
                }
            }, 1000);
        });
        this.peer.on("error", err => console.error(err));
    }

    getStrokes(index: number) {
        this.connection.send({
            eventType: "getStrokes",
            index
        });
    }

    submitStroke(stroke: BrushStroke) {
        this.strokesQueue.push(stroke);
    }
}