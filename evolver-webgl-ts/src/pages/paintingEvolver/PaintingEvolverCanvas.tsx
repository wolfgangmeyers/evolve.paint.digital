import React, {useEffect, useState} from "react";

export interface PaintingEvolverCanvasProps {
    zoom: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onPan: (x: number, y: number) => void;
}

export const PaintingEvolverCanvas = (props: PaintingEvolverCanvasProps) => {

    // const handleScroll = (e: React.WheelEvent<HTMLCanvasElement>) => {
    //     e.preventDefault()
    //     console.log(e.deltaY);
    // }

    const handleScroll = (e: WheelEvent) => {
        e.preventDefault()
        if (e.shiftKey) {
            if (e.deltaY < 0) {
                props.onZoomIn();
            } else if (e.deltaY > 0) {
                props.onZoomOut();
            }
        }
    }



    useEffect(() => {
        let lastX = 0;
        let lastY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            const canvas = e.target as HTMLCanvasElement;
            console.log("lastX", lastX)
            const x = e.offsetX / canvas.offsetWidth;
            const y = e.offsetY / canvas.offsetHeight;
            if (e.buttons & 1 && e.shiftKey) {
                // console.log("x", e.offsetX / canvas.offsetWidth);
                // console.log("y", e.offsetY / canvas.offsetHeight);
                props.onPan(x - lastX, y - lastY);
            }
            lastX = x;
            lastY = y;
        }

        const canvas = document.getElementById("c");
        canvas.addEventListener("wheel",handleScroll)
        canvas.addEventListener("mousemove", handleMouseMove)

        return () => {
            canvas.removeEventListener("wheel", handleScroll)
            canvas.removeEventListener("mousemove", handleMouseMove)
        }
    }, [])

    return (<div className={props.zoom ? "col-sm-9" : "col-sm-6"}>
        <canvas id="c" width="1024" height="1024" style={{ width: "100%", border: "1px solid black" }}></canvas>
    </div>);
};
