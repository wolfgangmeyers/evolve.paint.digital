package main

import (
	"image/color"

	colorful "github.com/lucasb-eyer/go-colorful"
)

// MakeColor returns a colorful.Color from an RGB color
func MakeColor(clr color.Color) colorful.Color {
	r, g, b, _ := clr.RGBA()
	result := colorful.Color{
		R: float64(r) / 255.0,
		G: float64(g) / 255.0,
		B: float64(b) / 255.0,
	}
	return result
}
