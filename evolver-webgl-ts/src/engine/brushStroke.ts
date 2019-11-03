export interface BrushStroke {
    x: number;
    y: number;
    rotation: number; // rotation in euler angle
    deleted: boolean;
    color: Array<number>;
    brushIndex: number; // refers to brush set
}

export function NewBrushStroke(): BrushStroke {
    return {
        x: 0,
        y: 0,
        rotation: 0,
        deleted: false,
        color: [1,1,1,1],
        brushIndex: 0,
    }
}
