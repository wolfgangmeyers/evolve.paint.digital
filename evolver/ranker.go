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
	l float32
	a float32
	b float32
}

// NewLab returns a new `Lab` from its components
func NewLab(l float32, a float32, b float32) *Lab {
	return &Lab{
		l: l,
		a: a,
		b: b,
	}
}

type LabCacheRequest struct {
	Response chan<- *Lab
	Color    color.Color
}

// A Ranker calculates the difference between two images
// by comparing their pixel colors in the Lab color space
type Ranker struct {
	precalculatedImage [][]*Lab
}

func NewRanker() *Ranker {
	ranker := new(Ranker)
	return ranker
}

// PrecalculateLabs pre-calculates Lab colors for an image to avoid
// recomputing them on each comparison
func (ranker *Ranker) PrecalculateLabs(image image.Image) {
	size := image.Bounds().Size()
	ranker.precalculatedImage = make([][]*Lab, size.X)
	for x := 0; x < size.X; x++ {
		column := make([]*Lab, size.Y)
		for y := 0; y < size.Y; y++ {
			lab := ranker.getLab(image.At(x, y))
			column[y] = lab
		}
		ranker.precalculatedImage[x] = column
	}
}

func (ranker *Ranker) getLab(clr color.Color) *Lab {
	r, g, b, _ := clr.RGBA()
	l, a, b2 := MakeColorRGB(r, g, b).Lab()
	return NewLab(float32(l), float32(a), float32(b2))
}

func (ranker *Ranker) DistanceFromPrecalculatedBounds(image image.Image, boundAreas []Rect, diffMap *DiffMap) (float32, error) {
	// Keep a cache of color mappings for these images
	cache := map[uint32]*Lab{}
	for _, bounds := range boundAreas {
		left := int(bounds.Left)
		if left < 0 {
			left = 0
		}
		top := int(bounds.Top)
		if top < 0 {
			top = 0
		}
		right := int(bounds.Right)
		if right > image.Bounds().Size().X {
			right = image.Bounds().Size().X
		}
		bottom := int(bounds.Bottom)
		if bottom > image.Bounds().Size().Y {
			bottom = image.Bounds().Size().Y
		}
		for x := left; x < right; x++ {
			for y := top; y < bottom; y++ {
				lab1 := ranker.precalculatedImage[x][y]
				color2 := image.At(x, y)
				color2Key := ColorKey(color2)
				lab2, has := cache[color2Key]
				if !has {
					lab2 = ranker.getLab(color2)
					cache[color2Key] = lab2
				}
				diffMap.SetDiff(x, y, ranker.colorDistance(lab1, lab2))
			}
		}
	}

	return diffMap.GetAverageDiff(), nil
}

func (ranker *Ranker) DistanceFromPrecalculated(image image.Image, diffMap *DiffMap) (float32, error) {
	bounds := []Rect{
		Rect{
			Left:   0,
			Top:    0,
			Right:  float32(image.Bounds().Size().X),
			Bottom: float32(image.Bounds().Size().Y),
		}}
	return ranker.DistanceFromPrecalculatedBounds(image, bounds, diffMap)
}

// Distance calculates the distance between two images by comparing each pixel
// between the images in the Lab color space.
func (ranker *Ranker) Distance(image1 image.Image, image2 image.Image) (float32, error) {
	if image1.Bounds().Size().X != image2.Bounds().Size().X || image1.Bounds().Size().Y != image2.Bounds().Size().Y {
		return 0, fmt.Errorf("Images are not the same size")
	}
	// Keep a cache of color mappings for these images
	cache := map[uint32]*Lab{}
	var diff float32
	var count float32
	for x := 0; x < image1.Bounds().Size().X; x++ {
		for y := 0; y < image1.Bounds().Size().Y; y++ {
			color1 := image1.At(x, y)
			color1Key := ColorKey(color1)
			lab1, has := cache[color1Key]
			if !has {
				lab1 = ranker.getLab(color1)
				cache[color1Key] = lab1
			}
			color2 := image2.At(x, y)
			color2Key := ColorKey(color2)
			lab2, has := cache[color2Key]
			if !has {
				lab2 = ranker.getLab(color2)
				cache[color2Key] = lab2
			}
			diff += ranker.colorDistance(lab1, lab2)
			count++
		}
	}
	return diff / count, nil
}

// Calculates the distance between two colors using the Lab color space
func (ranker *Ranker) colorDistance(lab1 *Lab, lab2 *Lab) float32 {
	lDiff := lab2.l - lab1.l
	lDiff = lDiff * lDiff
	aDiff := lab2.a - lab1.a
	aDiff = aDiff * aDiff
	bDiff := lab2.b - lab1.b
	bDiff = bDiff * bDiff
	return float32(math.Sqrt(float64(lDiff) + float64(aDiff) + float64(bDiff)))
}
