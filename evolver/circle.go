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
	X          float64
	Y          float64
	Radius     float64
	Color      color.Color `json:"-"`
	SavedColor *SavedColor
	hash       string
}

// Execute draws a circle at point
func (circle *Circle) Execute(ctx *gg.Context) {
	ctx.SetColor(circle.Color)
	ctx.DrawCircle(circle.X, circle.Y, circle.Radius)
	ctx.Fill()
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