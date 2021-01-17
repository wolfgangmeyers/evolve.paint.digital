import { BrushStroke } from "../brushStroke";

export interface WorkerEvent {
    eventType: "getStrokes" | "getSrcImage" | "submitStrokes";
    index?: number;
    strokes?: Uint8Array;
}

export interface SupervisorEvent {
    eventType: "srcImage" | "strokes";
    strokes?: Uint8Array;
    imageData?: string;
}
