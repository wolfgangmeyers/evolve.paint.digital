package main

import (
	"fmt"
	"image"
	"image/color"
	"math"
)

// Lab represents a color in the Lab color space.
// See https://en.wikipedia.org/wiki/Lab_color_space#CIELAB
type Lab struct {
	l float64
	a float64
	b float64
}

// NewLab returns a new `Lab` from its components
func NewLab(l float64, a float64, b float64) *Lab {
	return &Lab{
		l: l,
		a: a,
		b: b,
	}
}

// A Ranker calculates the difference between two images
// by comparing their pixel colors in the Lab color space
type Ranker struct {
}

// Distance calculates the distance between two images by comparing each pixel
// between the images in the Lab color space.
func (ranker *Ranker) Distance(image1 image.Image, image2 image.Image) (float64, error) {
	if image1.Bounds().Size().X != image2.Bounds().Size().X || image1.Bounds().Size().Y != image2.Bounds().Size().Y {
		return 0, fmt.Errorf("Images are not the same size")
	}
	var diff float64
	var count float64
	for x := 0; x < image1.Bounds().Size().X; x++ {
		for y := 0; y < image1.Bounds().Size().Y; y++ {
			color1 := image1.At(x, y)
			color2 := image2.At(x, y)
			diff += ranker.colorDistance(color1, color2)
			count++
		}
	}
	return diff / count, nil
}

// Calculates the distance between two colors using the Lab color space
func (ranker *Ranker) colorDistance(color1 color.Color, color2 color.Color) float64 {
	lab1 := NewLab(MakeColor(color1).Lab())
	lab2 := NewLab(MakeColor(color2).Lab())
	lDiff := math.Pow(lab2.l-lab1.l, 2)
	aDiff := math.Pow(lab2.a-lab1.a, 2)
	bDiff := math.Pow(lab2.b-lab1.b, 2)
	return math.Sqrt(lDiff + aDiff + bDiff)
}
