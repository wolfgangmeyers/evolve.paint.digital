package main

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/color"
	"math"

	"github.com/fogleman/gg"
)

// TypeLine is a constant describing the "line" type
const TypeLine = "line"

// Line represents an instruction that draws a line between two points
type Line struct {
	StartX     float32
	StartY     float32
	EndX       float32
	EndY       float32
	Width      float32
	Color      color.Color `json:"-"`
	SavedColor *SavedColor
	hash       string
}

// Execute draws a line between two points
func (line *Line) Execute(ctx *gg.Context) {
	ctx.SetColor(line.Color)
	ctx.SetLineWidth(float64(line.Width))
	ctx.DrawLine(float64(line.StartX), float64(line.StartY), float64(line.EndX), float64(line.EndY))
	ctx.Stroke()
}

func (line *Line) Scale(factor float32) Instruction {
	clone := line.Clone().(*Line)
	line.StartX *= factor
	line.StartY *= factor
	line.EndX *= factor
	line.EndY *= factor
	line.Width *= factor
	return clone
}

// Save saves the line to a persisted form
func (line *Line) Save() []byte {
	line.SavedColor = SaveColor(line.Color)
	data, _ := json.Marshal(line)
	return data
}

// Load loads the line from a persisted form
func (line *Line) Load(data []byte) {
	json.Unmarshal(data, line)
	line.Color = LoadColor(line.SavedColor)
}

// Type returns "line" type
func (line *Line) Type() string {
	return TypeLine
}

// Clone returns a deep copy of the instruction
func (line *Line) Clone() Instruction {
	// Cheap deep copy!
	newLine := *line
	return &newLine
}

// Hash returns a (probably) unique hash that represents this particular instruction
func (line *Line) Hash() string {
	if line.hash == "" {
		r, g, b, _ := line.Color.RGBA()
		value := fmt.Sprintf(
			"%v%v%v%v%v%v%v%v", line.StartX, line.StartY, line.EndX, line.EndY, line.Width, r, g, b)
		hasher := md5.New()
		line.hash = base64.StdEncoding.EncodeToString(hasher.Sum([]byte(value)))
	}
	return line.hash
}

// Bounds returns the rectangular bounds of the line
func (line *Line) Bounds() *Rect {
	left := math.Min(float64(line.StartX), float64(line.EndX))
	right := math.Max(float64(line.StartX), float64(line.EndX))
	top := math.Min(float64(line.StartY), float64(line.EndY))
	bottom := math.Max(float64(line.StartY), float64(line.EndY))
	return &Rect{
		Left:   float32(left),
		Right:  float32(right),
		Top:    float32(top),
		Bottom: float32(bottom),
	}
}
