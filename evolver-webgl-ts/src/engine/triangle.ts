export interface Point {
    distance: number;
    angle: number;
}

export interface Triangle {
    x: number;
    y: number;
    color: Array<number>;
    points: Array<Point>;
    deleted: boolean;
}

export function NewTriangle(): Triangle {
    return {
        x: 0,
        y: 0,
        color: [0, 0, 0, 255],
        points: [
            { distance: 0, angle: 0 },
            { distance: 0, angle: 0 },
            { distance: 0, angle: 0 },
        ],
        deleted: false,
    }
}