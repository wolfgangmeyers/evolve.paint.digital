export interface VideoJob {
    id: string;
    name: string;
    status: string;
    workItems: number;
    completedWorkItems: number;
    configuration: VideoJobConfiguration;
}

export interface VideoJobConfiguration {
    resolutionX: number;
    resolutionY: number;
    outputFPS: number;
    duration: number;
}

export interface WorkItem {
    id: string;
    jobId: string;
    imageData: string;
    configuration: VideoJobConfiguration;
}
