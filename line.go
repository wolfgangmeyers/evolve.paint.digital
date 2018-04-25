package main

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/color"

	"github.com/fogleman/gg"
)

// TypeLine is a constant describing the "line" type
const TypeLine = "line"

type SavedColor struct {
	R uint8
	G uint8
	B uint8
	A uint8
}

// Line represents an instruction that draws a line between two points
type Line struct {
	StartX     float64
	StartY     float64
	EndX       float64
	EndY       float64
	Width      float64
	Color      color.Color `json:"-"`
	SavedColor SavedColor
	hash       string
}

// Execute draws a line between two points
func (line *Line) Execute(ctx *gg.Context) {
	ctx.SetColor(line.Color)
	ctx.SetLineWidth(line.Width)
	ctx.DrawLine(line.StartX, line.StartY, line.EndX, line.EndY)
	ctx.Stroke()
}

// Save saves the line to a persisted form
func (line *Line) Save() []byte {
	r, g, b, a := line.Color.RGBA()
	line.SavedColor = SavedColor{
		R: uint8(r),
		G: uint8(g),
		B: uint8(b),
		A: uint8(a),
	}
	data, _ := json.Marshal(line)
	return data
}

// Load loads the line from a persisted form
func (line *Line) Load(data []byte) {
	json.Unmarshal(data, line)
	line.Color = &color.RGBA{
		line.SavedColor.R,
		line.SavedColor.G,
		line.SavedColor.B,
		line.SavedColor.A,
	}
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
