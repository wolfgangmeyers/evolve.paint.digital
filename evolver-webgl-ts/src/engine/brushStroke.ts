export interface BrushStroke {
    x: number;
    y: number;
    rotation: number; // rotation in euler angle
    deleted: boolean;
    color: Array<number>;
    brushIndex: number; // refers to brush set
}
