export interface Config {
    saveSnapshots: boolean;
    maxSnapshots: number;
    focusExponent: number;
    frameSkip: number;

    // enableColorHints: boolean;
    minColorMutation: number;
    maxColorMutation: number;

    enabledMutations: {[key: string]: boolean};
    enabledBrushTags: {[key: string]: boolean};
    manualOnly: boolean;
}
