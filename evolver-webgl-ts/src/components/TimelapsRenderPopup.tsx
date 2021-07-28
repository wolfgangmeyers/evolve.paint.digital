import React, { FC, useState } from "react"
import axios from "axios"
import { Modal, FormGroup, Button, Badge } from "react-bootstrap"
import { BrushStroke } from "../engine/brushStroke"
import { VideoJob, VideoJobsApi, VideoJobStatusEnum as Status } from "../client/api"
import { createProgram } from "../engine/util";
import * as rendererShaders from "../engine/shaders/renderer";
import * as displayShaders from "../engine/shaders/display";
import { Display } from "../engine/display";
import { BrushSet } from "../engine/brushSet";
import { Renderer } from "../engine/renderer";
import { sleep } from "../engine/util"
import { createInstructionCounts } from "./timelapse"

interface Props {
    instructions: Array<BrushStroke>;
    show: boolean;
    brushSet: BrushSet;
    width: number;
    height: number;
    client: VideoJobsApi
    onClose: () => void;
}

// render onto canvas
// determine interval based on fps and time
// create job
// send snapshots to backend
// encode
// wait until complete
// download button



export const TimelapsRenderPopup: FC<Props> = props => {

    const [fps, setFps] = useState(30)
    const [lengthSeconds, setLengthSeconds] = useState(10)
    const [job, setJob] = useState<VideoJob>(null)
    const [completed, setCompleted] = useState(false)
    const [status, setStatus] = useState(Status.Pending)

    function extractPNG(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
        return new Promise(resolve => {
            canvas.toBlob(b => {
                resolve(b.arrayBuffer())
            }, "image/png")
        })
    }

    async function renderVideo() {
        setStatus(Status.Rendering)
        const movieCanvas = document.getElementById("movie") as HTMLCanvasElement
        const job = (await props.client.createVideoJob({
            name: "Evolved painting",
            fps: fps
        })).data
        setJob(job)
        const gl = movieCanvas.getContext("webgl2")
        const rendererProgram = createProgram(gl, rendererShaders.vert(), rendererShaders.frag());
        const displayProgram = createProgram(gl, displayShaders.vert(), displayShaders.frag());
        const display = new Display(gl, displayProgram);
        const renderer = new Renderer(gl, rendererProgram, props.brushSet, props.width, props.height)

        const totalFrames = lengthSeconds * fps;
        // const instructionsPerFrame = Math.ceil(props.instructions.length / totalFrames);

        console.log("totalFrames", totalFrames)
        // console.log("instructionsPerFrame", instructionsPerFrame)

        const instructionCounts = createInstructionCounts(totalFrames, props.instructions.length, 2)
        console.log(instructionCounts)
        let instructionCounter = 0
        for (let frame of instructionCounts) {
            for (let i = 0; i < frame; i++) {
                if (instructionCounter >= props.instructions.length) {
                    break
                }
                const instruction = props.instructions[instructionCounter]
                renderer.render(instruction)
                renderer.swap()
                renderer.render(instruction)
                renderer.swap()
                instructionCounter++

            }
            display.render()
            const png = await extractPNG(movieCanvas)
            console.log("adding frame")
            // await props.client.addVideoFrame(job.id, png)
            await axios.post(`http://localhost:18033/jobs/${job.id}/frames`, png, {
                headers: {
                    "Content-Type": "image/png"
                }
            })
        }

        // for (let i = 0; i < props.instructions.length; i++) {
        //     const instruction = props.instructions[i]
        //     renderer.render(instruction)
        //     renderer.swap()
        //     renderer.render(instruction)
        //     renderer.swap()
        //     const instructionsPerFrame = Math.round(Math.log2(i * lengthSeconds))
        //     if (i % instructionsPerFrame == 0) {
        //         display.render()
        //         const png = await extractPNG(movieCanvas)
        //         console.log("adding frame")
        //         // await props.client.addVideoFrame(job.id, png)
        //         await axios.post(`http://localhost:18033/jobs/${job.id}/frames`, png, {
        //             headers: {
        //                 "Content-Type": "image/png"
        //             }
        //         })
        //     }
        // }
        setStatus(Status.Encoding)
        await props.client.buildVideo(job.id)
        let jobResp = await props.client.getVideoJob(job.id)
        while (jobResp.data.status == Status.Encoding) {
            await sleep(1000)
            jobResp = await props.client.getVideoJob(job.id)
        }
        setStatus(Status.Complete)
    }

    function onClose() {
        if (job) {
            props.client.deleteVideoJob(job.id)
        }
        setJob(null)
        setStatus(Status.Pending)
        props.onClose()
    }

    function renderActionButton(): JSX.Element {
        switch (status) {
            case Status.Pending:
                return <Button variant="primary" onClick={() => renderVideo()}>Render</Button>
            case Status.Rendering:
                return <Button variant="primary" disabled>Rendering</Button>
            case Status.Encoding:
                return <Button variant="primary" disabled>Encoding</Button>
            case Status.Complete:
                return <a className="btn btn-primary" href={`http://localhost:18033/jobs/${job.id}/video`} target="_blank">Download video</a>
        }

    }

    return <Modal show={props.show}>
        <Modal.Header>
            Make a timelapse video
        </Modal.Header>
        <Modal.Body>
            <form className="form">
                <FormGroup>
                    <label>FPS</label>
                    <input type="number" value={fps} onChange={e => setFps(parseInt(e.target.value))} />

                </FormGroup>
                <FormGroup>
                    <label>Length in seconds</label>
                    <input type="number" value={lengthSeconds} onChange={e => setLengthSeconds(parseInt(e.target.value))} />
                </FormGroup>
            </form>
            <hr />
            <canvas id="movie" width={props.width} height={props.height} style={{ width: "100%", border: "1px solid black" }}></canvas>
        </Modal.Body>
        <Modal.Footer>
            {renderActionButton()}
            <Button variant="secondary" onClick={onClose}>Close</Button>
        </Modal.Footer>
    </Modal>
}