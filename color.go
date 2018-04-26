package main

import (
	"image/color"

	colorful "github.com/lucasb-eyer/go-colorful"
)

// MakeColor returns a colorful.Color from an RGB color
func MakeColor(clr color.Color) colorful.Color {
	r, g, b, _ := clr.RGBA()
	return MakeColorRGB(r, g, b)
}

func MakeColorRGB(r uint32, g uint32, b uint32) colorful.Color {
	result := colorful.Color{
		R: float64(r) / 255.0,
		G: float64(g) / 255.0,
		B: float64(b) / 255.0,
	}
	return result
}

func ColorKey(clr color.Color) uint32 {
	r, g, b, _ := clr.RGBA()
	return r<<16 + g<<8 + b
	// return fmt.Sprintf("%v|%v|%v", r, g, b)
}
