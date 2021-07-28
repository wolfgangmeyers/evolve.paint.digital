// create a list of instruction counts per frame, given total number of frames
// and total number of instructions, starting instructions per frame and multiple
export function createInstructionCounts(totalFrames: number, totalInstructions: number, start: number): Array<number> {
    let calculatedInstructions = 0;
    let multiple = 1;
    while (true) {
        calculatedInstructions = 0;
        const instructionCounts: number[] = [];
        let instructionsPerFrame = start;
        for (let i = 0; i < totalFrames; i++) {
            const step = Math.floor(instructionsPerFrame)
            instructionCounts.push(step);
            calculatedInstructions += step;
            instructionsPerFrame *= multiple;
        }
        if (calculatedInstructions >= totalInstructions) {
            return instructionCounts;
        }
        multiple *= 1.001;
    }
}