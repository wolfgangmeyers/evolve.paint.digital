package main

import (
	"image/color"
	"math/rand"

	"github.com/lucasb-eyer/go-colorful"
)

// A LineMutator creates random mutations in line instructions.
type LineMutator struct {
	config      *Config
	imageWidth  float64
	imageHeight float64
}

// NewLineMutator returns a new instance of `LineMutator`
func NewLineMutator(config *Config, imageWidth float64, imageHeight float64) *LineMutator {
	mut := new(LineMutator)
	mut.config = config
	mut.imageWidth = imageWidth
	mut.imageHeight = imageHeight
	return mut
}

// Mutate is the primary function of the mutator
// TODO: move this into another class that isn't specific to lines
func (mut *LineMutator) Mutate(instructions []Instruction) []Instruction {
	// TODO: use configurable weights to skew randomness towards different actions
	// this will allow for auto-tuning later on
	// 0 - append random item
	// 1 - append duplicate of random item, mutated
	// 2 - delete random item
	// 3 - mutate random item
}

// Mutate Color
// Hue, Sat, Val
// Red, Green, Blue

func (mut *LineMutator) mutateColor(line *Line) {
	switch rand.Int31n(3) {
	case 0:
		mut.mutateHue(line)
	case 1:
		mut.mutateSaturation(line)
	default:
		mut.mutateLightness(line)
	}
}

func (mut *LineMutator) mutateHue(line *Line) {
	hue, sat, lightness := MakeColor(line.Color).Hsl()
	newHue := mut.mutateValue(0, 360, mut.config.MinHueMutation, mut.config.MaxHueMutation, hue)
	line.Color = colorful.Hsl(newHue, sat, lightness)
}

func (mut *LineMutator) mutateSaturation(line *Line) {
	hue, sat, lightness := MakeColor(line.Color).Hsl()
	newSat := mut.mutateValue(0, 1, mut.config.MinSaturationMutation, mut.config.MaxSaturationMutation, sat)
	line.Color = colorful.Hsl(hue, newSat, lightness)
}

func (mut *LineMutator) mutateLightness(line *Line) {
	hue, sat, lightness := MakeColor(line.Color).Hsl()
	newLightness := mut.mutateValue(0, 1, mut.config.MinValueMutation, mut.config.MaxValueMutation, lightness)
	line.Color = colorful.Hsl(hue, sat, newLightness)
}

// Mutate Brush Size
// Bigger
// Smaller
func (mut *LineMutator) mutateLineWidth(line *Line) {
	// TODO: make min/max line width configurable
	line.Width = mut.mutateValue(0.1, 20, mut.config.MinLineWidthMutation, mut.config.MaxLineWidthMutation, line.Width)
}

// Mutate Coordinates
// Increase/Decrease X
// Increase/Decrease Y
func (mut *LineMutator) mutateCoordinates(line *Line) {
	switch rand.Int31n(2) {
	case 0:
		mut.mutateStart(line)
	default:
		mut.mutateEnd(line)
	}
}

func (mut *LineMutator) mutateStart(line *Line) {
	line.StartX = mut.mutateValue(0, mut.imageWidth, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, line.StartX)
	line.StartY = mut.mutateValue(0, mut.imageHeight, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, line.StartY)
}

func (mut *LineMutator) mutateEnd(line *Line) {
	line.EndX = mut.mutateValue(0, mut.imageWidth, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, line.EndX)
	line.EndY = mut.mutateValue(0, mut.imageHeight, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, line.EndY)
}

// Insert Instruction
// Remove Instruction
// Swap Instructions
func (mut *LineMutator) randomInstruction() *Line {
	return &Line{
		StartX: rand.Float64() * mut.imageWidth,
		StartY: rand.Float64() * mut.imageHeight,
		EndX:   rand.Float64() * mut.imageWidth,
		EndY:   rand.Float64() * mut.imageHeight,
		Color: &color.RGBA{
			A: 255,
			G: uint8(rand.Int31n(255)),
			B: uint8(rand.Int31n(255)),
			R: uint8(rand.Int31n(255)),
		},
		Width: rand.Float64()*10 + 1,
	}
}

func (mut *LineMutator) mutateValue(min float64, max float64, minDelta float64, maxDelta float64, value float64) float64 {
	amt := rand.Float64()*(maxDelta-minDelta) + minDelta
	value = value + amt
	// Make the new value wrap around at the inclusive boundaries
	for value < min {
		value = value + (max - min)
	}
	for value > max {
		value = value - (max - min)
	}
	return value
}
