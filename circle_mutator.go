package main

import (
	"image/color"
	"math/rand"

	colorful "github.com/lucasb-eyer/go-colorful"
)

type CircleMutator struct {
	config      *Config
	imageWidth  float64
	imageHeight float64
}

func NewCircleMutator(config *Config, imageWidth float64, imageHeight float64) *CircleMutator {
	mut := new(CircleMutator)
	mut.config = config
	mut.imageWidth = imageWidth
	mut.imageHeight = imageHeight
	return mut
}

func (mut *CircleMutator) MutateInstruction(instruction Instruction) {
	circle := instruction.(*Circle)
	// color
	// coordinates
	// radius
	switch rand.Int31n(3) {
	case 0:
		// color
		mut.mutateColor(circle)
	case 1:
		// coordinates
		mut.mutateCoordinates(circle)
	default:
		// radius
		mut.mutateCircleRadius(circle)
	}
}

func (mut *CircleMutator) InstructionType() string {
	return TypeCircle
}

// Mutate Color
// Hue, Sat, Val
// Red, Green, Blue

func (mut *CircleMutator) mutateColor(circle *Circle) {
	switch rand.Int31n(3) {
	case 0:
		mut.mutateHue(circle)
	case 1:
		mut.mutateSaturation(circle)
	default:
		mut.mutateLightness(circle)
	}
}

func (mut *CircleMutator) mutateHue(circle *Circle) {
	hue, sat, lightness := MakeColor(circle.Color).Hsl()
	newHue := mut.mutateValue(0, 360, mut.config.MinHueMutation, mut.config.MaxHueMutation, hue)
	circle.Color = colorful.Hsl(newHue, sat, lightness)
}

func (mut *CircleMutator) mutateSaturation(circle *Circle) {
	hue, sat, lightness := MakeColor(circle.Color).Hsl()
	newSat := mut.mutateValue(0, 1, mut.config.MinSaturationMutation, mut.config.MaxSaturationMutation, sat)
	circle.Color = colorful.Hsl(hue, newSat, lightness)
}

func (mut *CircleMutator) mutateLightness(circle *Circle) {
	hue, sat, lightness := MakeColor(circle.Color).Hsl()
	newLightness := mut.mutateValue(0, 1, mut.config.MinValueMutation, mut.config.MaxValueMutation, lightness)
	circle.Color = colorful.Hsl(hue, sat, newLightness)
}

// Mutate Brush Size
// Bigger
// Smaller
func (mut *CircleMutator) mutateCircleRadius(circle *Circle) {
	// TODO: make min/max circle width configurable
	circle.Radius = mut.mutateValue(0.1, 100, mut.config.MinCircleRadiusMutation, mut.config.MaxCircleRadiusMutation, circle.Radius)
}

// Mutate Coordinates
// Increase/Decrease X
// Increase/Decrease Y
func (mut *CircleMutator) mutateCoordinates(circle *Circle) {
	circle.X = mut.mutateValue(0, mut.imageWidth, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, circle.X)
	circle.Y = mut.mutateValue(0, mut.imageHeight, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, circle.Y)
}

// Insert Instruction
// Remove Instruction
// Swap Instructions
func (mut *CircleMutator) RandomInstruction() Instruction {
	return &Circle{
		X: rand.Float64() * mut.imageWidth,
		Y: rand.Float64() * mut.imageHeight,
		Color: &color.RGBA{
			A: 255,
			G: uint8(rand.Int31n(255)),
			B: uint8(rand.Int31n(255)),
			R: uint8(rand.Int31n(255)),
		},
		Radius: rand.Float64()*10 + 1,
	}
}

func (mut *CircleMutator) mutateValue(min float64, max float64, minDelta float64, maxDelta float64, value float64) float64 {
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
