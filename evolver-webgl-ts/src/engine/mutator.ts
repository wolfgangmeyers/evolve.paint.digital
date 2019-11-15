import { BrushStroke, NewBrushStroke } from "./brushStroke";
import { FocusMap } from "./focus";
import { normalizeAngle } from "./util";
import { Config } from "./config";

export const MutationTypeAppend = "append";
export const MutationTypePosition = "position";
export const MutationTypeColor = "color";
export const MutationTypeRotation = "rotation";
export const MutationTypeDelete = "delete";

export class Mutator {

    constructor(
        private imageWidth: number,
        private imageHeight: number,
        private config: Config,
        private brushCount: number,
    ) {
    }

    randomBrushStroke(): BrushStroke {
        const stroke =  NewBrushStroke();
        this.randomizeBrushStroke(stroke);
        return stroke;
    }

    randomizeBrushStroke(stroke: BrushStroke): BrushStroke {
        stroke.x = Math.random() * this.imageWidth;
        stroke.y = Math.random() * this.imageHeight;
        stroke.color[0] = Math.random() * 1;
        stroke.color[1] = Math.random() * 1;
        stroke.color[2] = Math.random() * 1;
        stroke.color[3] = 1;
        stroke.rotation = normalizeAngle(Math.random() * Math.PI * 2);
        stroke.brushIndex = Math.floor(Math.random() * this.brushCount);
        return stroke;
    }
}
