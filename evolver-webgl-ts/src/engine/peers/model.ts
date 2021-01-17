import { BrushStroke } from "../brushStroke";
import { Config } from "../config";
import { Point } from "../point";

export interface WorkerEvent {
    eventType: "getStrokes" | "getSrcImage" | "submitStrokes";
    index?: number;
    strokes?: Uint8Array;
}

export interface SupervisorEvent {
    eventType: "srcImage" | "strokes" | "config" | "focusPin";
    strokes?: Uint8Array;
    imageData?: string;
    config?: Config;
    focusPin?: Point;
}
