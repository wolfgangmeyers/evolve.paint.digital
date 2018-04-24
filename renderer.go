package main

import (
	"image"

	"github.com/fogleman/gg"
)

// Renderer contains the logic to render images from instructions
type Renderer struct {
	ctx *gg.Context
}

// NewRenderer returns a new instance of Renderer
func NewRenderer(width int, height int) *Renderer {
	renderer := new(Renderer)
	renderer.ctx = gg.NewContext(width, height)
	return renderer
}

// Render will apply a set of instructions to render an image
func (renderer *Renderer) Render(instructions []Instruction) {
	for _, instruction := range instructions {
		instruction.Execute(renderer.ctx)
	}
}

// GetImage returns the currently rendered image
func (renderer *Renderer) GetImage() image.Image {
	return renderer.ctx.Image()
}

// SaveToFile saves the rendered image to a file as a PNG image
func (renderer *Renderer) SaveToFile(filename string) error {
	return renderer.ctx.SavePNG(filename)
}
