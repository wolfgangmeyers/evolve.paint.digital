import * as axios from "axios";
import { VideoJobConfiguration, VideoJob, WorkItem } from "./model";

export class ServerClient {

    private http: axios.AxiosInstance;

    constructor(private endpoint: string) {
        this.http = axios.default;
    }

    private async graphqlRequest(query: string, variables: object): Promise<any> {
        const result = (await this.http.post(`${this.endpoint}/query`, {
            query,
            variables,
        })).data;
        if (result.errors) {
            console.error(result.errors);
            throw new Error("Error during request");
        }
        return result.data;
    }

    async hello(): Promise<string> {
        return (await this.graphqlRequest(`
        query {
            hello
        }
        `, {})).hello;
    }

    async createJob(name: string, configuration: VideoJobConfiguration): Promise<VideoJob> {
        return (
            await this.graphqlRequest(
                `
                mutation CreateVideoJob($name: String!, $configuration: String!) {
                    createVideoJob(name: $name, configuration: $configuration) {
                        id
                    }
                }
                `,
                {
                    name,
                    configuration: JSON.stringify(configuration),
                }
            )
        ).createVideoJob as VideoJob;
    }

    async deleteJob(id: string): Promise<void> {
        await this.graphqlRequest(
            `
            mutation DeleteVideoJob($id: ID!) {
                deleteVideoJob(id: $id)
            }
            `
        , {
            id
        });
    }

    async listJobs(): Promise<Array<VideoJob>> {
        return (
            await this.graphqlRequest(
            `
            query ListJobs {
                videojobs {
                    id
                    name
                    status
                    workItems
                    completedWorkItems
                }
            }
            `,
            {

            }
        )).videojobs as Array<VideoJob>;
    }

    async uploadVideoFile(jobId: string, file: File): Promise<void> {
        const data = new FormData();
        data.append("video", file);
        data.append("jobId", jobId);
        await this.http.post(`${this.endpoint}/upload-video`, data);
    }

    async getVideoWorkItem(): Promise<WorkItem> {
        const workItem = (
            await this.graphqlRequest(
                `
                mutation GetWorkItem {
                    getVideoWorkItem {
                        id
                        jobId
                        configuration
                        imageData
                    }
                }
                `,
                {}
            )
        ).getVideoWorkItem as WorkItem;
        if (workItem) {
            workItem.configuration = JSON.parse(workItem.configuration as any);

        }
        return workItem;
    }

    async submitVideoWorkItemResult(jobId: string, workItemId: string, imageData: string, brushStrokes: string): Promise<void> {
        await this.graphqlRequest(
            `
            mutation SubmitWorkItem($jobId: ID!, $workItemId: ID!, $imageData: String!, $brushStrokes: String!) {
                submitVideoWorkItemResult(jobId: $jobId, workItemId: $workItemId, imageData: $imageData, brushStrokes: $brushStrokes)
            }
            `,
            {
                jobId,
                workItemId,
                imageData,
                brushStrokes
            }
        )
    }
}
