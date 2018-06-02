package main

import (
	"image"
	"image/color"

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
	// TODO: organism picks the background color?
	renderer.ctx.SetColor(color.Black)
	renderer.ctx.DrawRectangle(0, 0, float64(renderer.ctx.Width()), float64(renderer.ctx.Height()))
	renderer.ctx.Fill()
	for _, instruction := range instructions {
		instruction.Execute(renderer.ctx)
	}
}

// RenderBounds will apply a set of bounds-filtered instructions to render an image. Any instructions
// that intersect the bounds will be rendered, all other instructions are ignored.
func (renderer *Renderer) RenderBounds(instructions []Instruction, bounds *Rect) {
	// TODO: organism picks the background color?
	renderer.ctx.SetColor(color.Black)
	renderer.ctx.DrawRectangle(0, 0, float64(renderer.ctx.Width()), float64(renderer.ctx.Height()))
	renderer.ctx.Fill()
	for _, instruction := range instructions {
		if instruction.Bounds().Intersects(bounds) {
			instruction.Execute(renderer.ctx)
		}
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
