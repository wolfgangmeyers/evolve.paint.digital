package main

import (
	"fmt"
	"image/color"
	"math"
	"math/rand"
	"sort"
	"strconv"

	colorful "github.com/lucasb-eyer/go-colorful"
)

type PolygonMutator struct {
	config      *Config
	imageWidth  float32
	imageHeight float32
}

func NewPolygonMutator(config *Config, imageWidth float32, imageHeight float32) *PolygonMutator {
	mut := new(PolygonMutator)
	mut.config = config
	mut.imageWidth = imageWidth
	mut.imageHeight = imageHeight
	return mut
}

func (mut *PolygonMutator) MutateInstruction(instruction Instruction) {
	polygon := instruction.(*Polygon)
	// color
	// coordinates
	// radius
	switch rand.Int31n(3) {
	case 0:
		// color
		mut.mutateColor(polygon)
	case 1:
		// coordinates
		mut.mutateCoordinates(polygon)
	default:
		// radius
		mut.mutatePolygonPoints(polygon)
	}
	polygon.RecalculateHash()
}

func (mut *PolygonMutator) InstructionType() string {
	return TypePolygon
}

// Mutate Color
// Hue, Sat, Val
// Red, Green, Blue

func (mut *PolygonMutator) mutateColor(polygon *Polygon) {
	switch rand.Int31n(3) {
	case 0:
		mut.mutateHue(polygon)
	case 1:
		mut.mutateSaturation(polygon)
	default:
		mut.mutateLightness(polygon)
	}
}

func (mut *PolygonMutator) mutateHue(polygon *Polygon) {
	hue, sat, lightness := MakeColor(polygon.Color).Hsl()
	newHue := mut.mutateValue(0, 360, mut.config.MinHueMutation, mut.config.MaxHueMutation, float32(hue))
	polygon.Color = LoadColorHex(SaveColorHex(colorful.Hsl(float64(newHue), sat, lightness)))
}

func (mut *PolygonMutator) mutateSaturation(polygon *Polygon) {
	hue, sat, lightness := MakeColor(polygon.Color).Hsl()
	newSat := mut.mutateValue(0, 1, mut.config.MinSaturationMutation, mut.config.MaxSaturationMutation, float32(sat))
	polygon.Color = LoadColorHex(SaveColorHex(colorful.Hsl(hue, float64(newSat), lightness)))
}

func (mut *PolygonMutator) mutateLightness(polygon *Polygon) {
	hue, sat, lightness := MakeColor(polygon.Color).Hsl()
	newLightness := mut.mutateValue(0, 1, mut.config.MinValueMutation, mut.config.MaxValueMutation, float32(lightness))
	polygon.Color = LoadColorHex(SaveColorHex(colorful.Hsl(hue, sat, float64(newLightness))))
}

// Mutate Brush Size
// Bigger
// Smaller
func (mut *PolygonMutator) mutatePolygonPoints(polygon *Polygon) {
	// TODO: allow configurable weights here
	// weight towards mutating existing points (2/3),
	// then split the probability between adding a point and removing a point 50/50
	switch rand.Intn(3) {
	case 0, 1:
		// select a random point and mutate it
		randomPoint := &polygon.Points[rand.Intn(len(polygon.Points))]
		mut.mutatePoint(randomPoint)
	default:
		// Add or remove a point
		switch rand.Intn(2) {
		case 0:
			// Remove a random point, but only if the count remains >= min
			if len(polygon.Points) > mut.config.MinPolygonPoints {
				polygon.Points = PolypointList(polygon.Points).RemoveAt(rand.Intn(len(polygon.Points)))
			}
		default:
			if len(polygon.Points) < mut.config.MaxPolygonPoints {
				polygon.Points = append(polygon.Points, mut.randomPoint())
			}
		}
	}
	sort.Sort(PolypointList(polygon.Points))
	polygon.bounds = Rect{}
}

func (mut *PolygonMutator) mutatePoint(point *Polypoint) {
	// Mutate angle or distance
	switch rand.Intn(2) {
	case 0:
		// Distance
		point.Distance = mut.mutateValue(
			mut.config.MinPolygonRadius,
			mut.config.MaxPolygonRadius,
			mut.config.MinPolygonRadiusMutation,
			mut.config.MaxPolygonRadiusMutation,
			point.Distance)
	default:
		point.Angle = mut.mutateValue(0, math.Pi*2, mut.config.MinPolygonAngleMutation, mut.config.MaxPolygonAngleMutation, point.Angle)
	}
}

// randomPoint generates a randon Polypoint in the valid range
func (mut *PolygonMutator) randomPoint() Polypoint {
	point := Polypoint{}
	point.Distance = mut.trunc(rand.Float32()*(mut.config.MaxPolygonRadius-mut.config.MinPolygonRadius) + mut.config.MinPolygonRadius)
	point.Angle = mut.trunc(rand.Float32() * math.Pi * 2.0)
	return point
}

// Mutate Coordinates
// Increase/Decrease X
// Increase/Decrease Y
func (mut *PolygonMutator) mutateCoordinates(polygon *Polygon) {
	polygon.X = mut.mutateValue(0, mut.imageWidth, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, polygon.X)
	polygon.Y = mut.mutateValue(0, mut.imageHeight, mut.config.MinCoordinateMutation, mut.config.MaxCoordinateMutation, polygon.Y)
	polygon.bounds = Rect{}
}

// Insert Instruction
// Remove Instruction
// Swap Instructions
func (mut *PolygonMutator) RandomInstruction() Instruction {
	numPoints := rand.Intn(mut.config.MaxPolygonPoints-mut.config.MinPolygonPoints) + mut.config.MinPolygonPoints
	polygon := objectPool.BorrowInstruction(TypePolygon).(*Polygon)
	polygon.X = mut.trunc(rand.Float32() * mut.imageWidth)
	polygon.Y = mut.trunc(rand.Float32() * mut.imageHeight)
	polygon.Color = &color.RGBA{
		A: 255,
		G: uint8(rand.Int31n(255)),
		B: uint8(rand.Int31n(255)),
		R: uint8(rand.Int31n(255)),
	}
	for i := 0; i < numPoints; i++ {
		polygon.Points = append(polygon.Points, mut.randomPoint())
	}
	return polygon
}

func (mut *PolygonMutator) mutateValue(min float32, max float32, minDelta float32, maxDelta float32, value float32) float32 {
	amt := rand.Float32()*(maxDelta-minDelta) + minDelta
	value = value + amt
	// Make the new value wrap around at the inclusive boundaries
	for value < min {
		value = value + (max - min)
	}
	for value > max {
		value = value - (max - min)
	}
	return mut.trunc(value)
}

func (mut *PolygonMutator) trunc(value float32) float32 {
	v, _ := strconv.ParseFloat(fmt.Sprintf("%.4f", value), 32)
	return float32(v)
}
