package main

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/color"

	"github.com/fogleman/gg"
)

const TypeCircle = "circle"

type Circle struct {
	X          float32
	Y          float32
	Radius     float32
	Color      color.Color `json:"-"`
	SavedColor *SavedColor
	hash       string
}

// Execute draws a circle at point
func (circle *Circle) Execute(ctx *gg.Context) {
	ctx.SetColor(circle.Color)
	ctx.DrawCircle(float64(circle.X), float64(circle.Y), float64(circle.Radius))
	ctx.Fill()
}

func (circle *Circle) Scale(factor float32) Instruction {
	clone := circle.Clone().(*Circle)
	clone.X *= factor
	clone.Radius *= factor
	clone.Y *= factor
	return clone
}

func (circle *Circle) Save() []byte {
	circle.SavedColor = SaveColor(circle.Color)
	data, _ := json.Marshal(circle)
	return data
}

func (circle *Circle) Load(data []byte) {
	json.Unmarshal(data, circle)
	circle.Color = LoadColor(circle.SavedColor)
}

func (circle *Circle) Type() string {
	return TypeCircle
}

func (circle *Circle) Clone() Instruction {
	newCircle := *circle
	return &newCircle
}

func (circle *Circle) Hash() string {
	if circle.hash == "" {
		r, g, b, _ := circle.Color.RGBA()
		value := fmt.Sprintf("%v%v%v%v%v%v", circle.X, circle.Y, circle.Radius, r, g, b)
		hasher := md5.New()
		circle.hash = base64.StdEncoding.EncodeToString(hasher.Sum([]byte(value)))
	}
	return circle.hash
}

// Bounds returns the rectangular bounds of the circle
func (circle *Circle) Bounds() *Rect {
	return &Rect{
		Left:   circle.X - circle.Radius,
		Right:  circle.X + circle.Radius,
		Top:    circle.Y - circle.Radius,
		Bottom: circle.Y + circle.Radius,
	}
}
