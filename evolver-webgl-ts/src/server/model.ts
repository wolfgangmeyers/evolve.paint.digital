export interface VideoJob {
    id: string;
    name: string;
    status: string;
    workItems: number;
    completedWorkItems: number;
    configuration: VideoJobConfiguration;
}

export interface BrushConfiguration {
    /** Brush tag to selectively turn brushes on and off */
    tag: string;
    /** Brush tag is either enabled or disabled */
    enabled: string;
    /** How long into the process, in minutes*100FPS, does the brush tag activate? */
    start?: number;
    /** How long into the process, in minutes * 100FPS, does the brush tag deactivate? */
    end?: number;
}

export interface VideoJobConfiguration {
    resolutionX: number;
    resolutionY: number;
    outputFPS: number;
    brushConfiguration: Array<BrushConfiguration>;
}

export interface WorkItem {
    id: string;
    jobId: string;
    imageData: string;
    configuration: VideoJobConfiguration;
}
