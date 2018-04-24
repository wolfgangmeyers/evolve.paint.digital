package main

import (
	"image/color"
	"math/rand"
	"time"

	"bitbucket.org/wolfgang_meyers/evolve.paint.digital/instructions"
)

func init() {
	rand.Seed(time.Now().Unix())
}

func main() {
	numlines := 300
	renderer := NewRenderer(1000, 1000)
	items := make([]Instruction, numlines)
	for i := 0; i < numlines; i++ {
		line := &instructions.Line{
			StartX: rand.Float64() * 1000,
			StartY: rand.Float64() * 1000,
			EndX:   rand.Float64() * 1000,
			EndY:   rand.Float64() * 1000,
			Color: &color.RGBA{
				A: 255,
				G: uint8(rand.Int31n(255)),
				B: uint8(rand.Int31n(255)),
				R: uint8(rand.Int31n(255)),
			},
			Width: rand.Float64()*10 + 1,
		}
		items[i] = line
	}
	renderer.Render(items)
	renderer.SaveToFile("test.png")
}
