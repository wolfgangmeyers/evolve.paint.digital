export interface Config {
    saveSnapshots: boolean;
    maxSnapshots: number;
    focusExponent: number;
    frameSkip: number;
    minTriangleRadius: number;
    maxTriangleRadius: number;
    // enableColorHints: boolean;
    minColorMutation: number;
    maxColorMutation: number;

    enabledMutations: {[key: string]: boolean};
}
