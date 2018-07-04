package main

import (
	"crypto/md5"
	json "encoding/json"
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
	Distance float32
	Angle    float32
}

// PolypointList implements sort.Interface for []*Polypoint based on
// the Angle field.
type PolypointList []Polypoint

func (a PolypointList) Len() int           { return len(a) }
func (a PolypointList) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a PolypointList) Less(i, j int) bool { return a[i].Angle < a[j].Angle }

// RemoveAt returns a new slice of Polypoints with the item
// at the specified index removed.
func (a PolypointList) RemoveAt(i int) []Polypoint {
	// https://github.com/golang/go/wiki/SliceTricks
	// a = append(a[:i], a[i+1:]...)
	return append(a[:i], a[i+1:]...)
}

// CalculateCoordinates returns the absolute coordinates of the polypoint
// based on the relative position of the polygon center.
func (point Polypoint) CalculateCoordinates(centerX float32, centerY float32) (x float32, y float32) {
	x = (float32(math.Cos(float64(point.Angle))) * point.Distance) + centerX
	y = (float32(math.Sin(float64(point.Angle))) * point.Distance) + centerY
	return
}

func (point Polypoint) Scale(factor float32) Polypoint {
	clone := point
	clone.Distance *= factor
	return clone
}

type Polygon struct {
	X          float32
	Y          float32
	Points     []Polypoint
	Color      color.Color `json:"-"`
	SavedColor *SavedColor `json:",omitempty"`
	HexColor   string      `json:",omitempty"`
	hash       string
	bounds     Rect // Cache bounds
}

// Execute draws a polygon at point
func (polygon *Polygon) Execute(ctx *gg.Context) {
	ctx.SetColor(polygon.Color)
	// TODO: test this to see if it actually works
	x, y := polygon.Points[0].CalculateCoordinates(polygon.X, polygon.Y)
	ctx.MoveTo(float64(x), float64(y))
	for _, point := range polygon.Points[1:] {
		x, y := point.CalculateCoordinates(polygon.X, polygon.Y)
		ctx.LineTo(float64(x), float64(y))
	}
	ctx.Fill()
}

func (polygon *Polygon) Scale(factor float32) Instruction {
	clone := polygon.Clone().(*Polygon)
	clone.X *= factor
	clone.Y *= factor
	for i, point := range clone.Points {
		clone.Points[i] = point.Scale(factor)
	}
	return clone
}

func (polygon *Polygon) Save() []byte {
	polygon.HexColor = SaveColorHex(polygon.Color)
	data, _ := json.Marshal(polygon)
	return data
}

func (polygon *Polygon) Load(data []byte) {
	json.Unmarshal(data, polygon)
	if polygon.SavedColor != nil {
		polygon.Color = LoadColor(polygon.SavedColor)
	} else {
		polygon.Color = LoadColorHex(polygon.HexColor)
	}

}

func (polygon *Polygon) Type() string {
	return TypePolygon
}

func (polygon *Polygon) Clone() Instruction {
	newPolygon := *polygon
	newPolygon.Points = make([]Polypoint, len(polygon.Points))
	for i, point := range polygon.Points {
		newPoint := point
		newPolygon.Points[i] = newPoint
	}
	return &newPolygon
}

func (polygon *Polygon) Hash() string {
	if polygon.hash == "" {
		// r, g, b, _ := polygon.Color.RGBA()
		// value := fmt.Sprintf("%.4f%.4f%v%v%v", polygon.X, polygon.Y, r, g, b)
		// for _, point := range polygon.Points {
		// 	hasher.Write([]byte(fmt.Sprintf("%.4f%.4f", point.Distance, point.Angle)))
		// }
		// polygon.hash = base64.StdEncoding.EncodeToString(hasher.Sum([]byte(value)))
		data := polygon.Save()
		polygon.hash = fmt.Sprintf("%x", md5.Sum(data))
	}
	return polygon.hash
}

func (polygon *Polygon) RecalculateHash() {
	polygon.hash = ""
	polygon.Hash()
}

// Bounds returns the rectangular bounds of the polygon
func (polygon *Polygon) Bounds() Rect {
	if polygon.bounds != (Rect{}) {
		return polygon.bounds
	}
	point := polygon.Points[0]
	left, top := point.CalculateCoordinates(polygon.X, polygon.Y)
	right, bottom := left, top
	for _, point := range polygon.Points[1:] {
		x, y := point.CalculateCoordinates(polygon.X, polygon.Y)
		if x < left {
			left = x
		}
		if x > right {
			right = x
		}
		if y < top {
			top = y
		}
		if y > bottom {
			bottom = y
		}
	}
	polygon.bounds = Rect{
		Left:   left,
		Top:    top,
		Right:  right,
		Bottom: bottom,
	}
	return polygon.bounds
}
