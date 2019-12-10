import * as axios from "axios";
import { VideoJobConfiguration, VideoJob } from "./model";

export class ServerClient {

    private http: axios.AxiosInstance;

    constructor(private endpoint: string) {
        this.http = axios.default;
    }

    private async graphqlRequest(query: string, variables: object): Promise<any> {
        const result = (await this.http.post(this.endpoint, {
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
}
