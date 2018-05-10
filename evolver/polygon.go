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

// TypePolygon is the type name for polygons
const TypePolygon = "polygon"

// A Polypoint represents one point of a polygon. It includes the distance
// from the center, and the angle (in radians) around the center that the
// point occurs.
type Polypoint struct {
	Distance float64
	Angle    float64
}

// CalculateCoordinates returns the absolute coordinates of the polypoint
// based on the relative position of the polygon center.
func (point *Polypoint) CalculateCoordinates(centerX float64, centerY float64) (x float64, y float64) {
	x = (math.Cos(point.Angle) * point.Distance) + centerX
	y = (math.Sin(point.Angle) * point.Distance) + centerY
	return
}

type Polygon struct {
	X          float64
	Y          float64
	Points     []*Polypoint
	Color      color.Color `json:"-"`
	SavedColor *SavedColor
	hash       string
}

// Execute draws a polygon at point
func (polygon *Polygon) Execute(ctx *gg.Context) {
	ctx.SetColor(polygon.Color)
	// TODO: test this to see if it actually works
	ctx.MoveTo(polygon.Points[0].CalculateCoordinates(polygon.X, polygon.Y))
	for _, point := range polygon.Points[1:] {
		ctx.LineTo(point.CalculateCoordinates(polygon.X, polygon.Y))
	}
	ctx.ClosePath()
	ctx.Fill()
}

func (polygon *Polygon) Save() []byte {
	polygon.SavedColor = SaveColor(polygon.Color)
	data, _ := json.Marshal(polygon)
	return data
}

func (polygon *Polygon) Load(data []byte) {
	json.Unmarshal(data, polygon)
	polygon.Color = LoadColor(polygon.SavedColor)
}

func (polygon *Polygon) Type() string {
	return TypePolygon
}

func (polygon *Polygon) Clone() Instruction {
	newPolygon := *polygon
	return &newPolygon
}

func (polygon *Polygon) Hash() string {
	if polygon.hash == "" {
		r, g, b, _ := polygon.Color.RGBA()
		value := fmt.Sprintf("%v%v%v%v%v", polygon.X, polygon.Y, r, g, b)
		hasher := md5.New()
		for _, point := range polygon.Points {
			hasher.Write([]byte(fmt.Sprintf("%v%v", point.Distance, point.Angle)))
		}
		polygon.hash = base64.StdEncoding.EncodeToString(hasher.Sum([]byte(value)))
	}
	return polygon.hash
}
