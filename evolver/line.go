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
	StartX     float64
	StartY     float64
	EndX       float64
	EndY       float64
	Width      float64
	Color      color.Color `json:"-"`
	SavedColor *SavedColor
	hash       string
}

// Execute draws a line between two points
func (line *Line) Execute(ctx *gg.Context) {
	ctx.SetColor(line.Color)
	ctx.SetLineWidth(line.Width)
	ctx.DrawLine(line.StartX, line.StartY, line.EndX, line.EndY)
	ctx.Stroke()
}

func (line *Line) Scale(factor float64) Instruction {
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
	left := math.Min(line.StartX, line.EndX)
	right := math.Max(line.StartX, line.EndX)
	top := math.Min(line.StartY, line.EndY)
	bottom := math.Max(line.StartY, line.EndY)
	return &Rect{
		Left:   left,
		Right:  right,
		Top:    top,
		Bottom: bottom,
	}
}
