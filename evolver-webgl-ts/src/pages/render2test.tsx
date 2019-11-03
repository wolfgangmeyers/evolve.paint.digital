import * as React from "react";
import * as renderShaders from "../engine/shaders/brushRenderer";
import * as displayShaders from "../engine/shaders/display";
import { createProgram } from "../engine/util";
import { Renderer } from "../engine/brushRenderer";
import { Display } from "../engine/display";
import { brushData } from "../engine/starbrush";
import { BrushSetData, BrushSet } from "../engine/brushSet";

export class RenderTest extends React.Component {

    componentDidMount() {
        // load image, get image pixels as Uint8Array in onload callback
        const img = new Image();
        img.src = brushData;
        img.onload = () => {

            const c2 = document.getElementById("c2") as HTMLCanvasElement;
            const width = img.width;
            const height = img.height;

            c2.width = width;
            c2.height = height;

            // let canvas = new OffscreenCanvas(width, height);
            const ctx = c2.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, width, height).data;

            // Build brush set from image data
            const brushSetData: BrushSetData = {
                brushDataUri: brushData,
                height: height,
                width: width,
                brushes: [
                    {
                        left: 25,
                        top: 98,
                        right: 250,
                        bottom: 200,
                    },
                    // Star #2
                    {
                        left: 33,
                        top: 2,
                        right: 70,
                        bottom: 39,
                    },
                    // // Star #4
                    // {
                    //     left: 143,
                    //     top: 2,
                    //     right: 215,
                    //     bottom: 71,
                    // }
                ],
            };
            const brushSet: BrushSet = new BrushSet(brushSetData, imageData);


            const canvas = document.getElementById("c") as HTMLCanvasElement;
            const gl = canvas.getContext("webgl2");
            const program = createProgram(gl, renderShaders.vert(), renderShaders.frag());
            const renderer = new Renderer(gl, program, 10000, brushSet);

            const displayProgram = createProgram(gl, displayShaders.vert(), displayShaders.frag());
            const display = new Display(gl, displayProgram);
            

            renderer.render([
                {
                    brushIndex: 0,
                    color: [1, 1, 1, 1],
                    deleted: false,
                    rotation: 0,
                    x: 50,
                    y: 50,
                },
                {
                    brushIndex: 1,
                    color: [1, 1, 0, 1],
                    deleted: false,
                    rotation: 1,
                    x: 500,
                    y: 500,
                },
                {
                    brushIndex: 0,
                    color: [0, 1, 1, 1],
                    deleted: false,
                    rotation: 1,
                    x: 250,
                    y: 250,
                }
            ]);

            // renderer.render([
            //     {
            //         brushIndex: 0,
            //         color: [1, 0, 0, 1],
            //         deleted: false,
            //         rotation: 0,
            //         x: 100,
            //         y: 100,
            //     },
            //     {
            //         brushIndex: 0,
            //         color: [1, 0, 0, 1],
            //         deleted: false,
            //         rotation: Math.PI,
            //         x: 500,
            //         y: 100,
            //     },
            //     {
            //         brushIndex: 0,
            //         color: [1, 0, 0, 1],
            //         deleted: false,
            //         rotation: 1,
            //         x: 250,
            //         y: 250,
            //     }
            // ], 1);

            display.displayTexture = 0;
            display.render();
        };
    }

    render() {
        return (
            <div className="row">
                <div className="col-lg-8 offset-lg-2 col-md-12">
                    <div className="card border-primary mb-3">
                        <div className="card-header">
                            <h4 className="text-center">Sandbox</h4>
    
                        </div>
                        <div className="card-body">
                            <div className="row">
                                <div className="col-sm-12">
                                    <canvas id="c" width="1024" height="1024" style={{ width: "100%", border: "1px solid black" }}></canvas>
                                    <canvas id="c2" width="1024" height="1024" style={{ display: "none" }}></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
