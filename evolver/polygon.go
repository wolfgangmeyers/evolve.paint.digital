package main

import (
	"crypto/md5"
	"encoding/base64"
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

// PolypointList implements sort.Interface for []*Polypoint based on
// the Angle field.
type PolypointList []*Polypoint

func (a PolypointList) Len() int           { return len(a) }
func (a PolypointList) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a PolypointList) Less(i, j int) bool { return a[i].Angle < a[j].Angle }

// RemoveAt returns a new slice of Polypoints with the item
// at the specified index removed.
func (a PolypointList) RemoveAt(i int) []*Polypoint {
	// https://github.com/golang/go/wiki/SliceTricks
	// a = append(a[:i], a[i+1:]...)
	return append(a[:i], a[i+1:]...)
}

// CalculateCoordinates returns the absolute coordinates of the polypoint
// based on the relative position of the polygon center.
func (point *Polypoint) CalculateCoordinates(centerX float64, centerY float64) (x float64, y float64) {
	x = (math.Cos(point.Angle) * point.Distance) + centerX
	y = (math.Sin(point.Angle) * point.Distance) + centerY
	return
}

func (point *Polypoint) Scale(factor float64) *Polypoint {
	clone := *point
	clone.Distance *= factor
	return &clone
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
	ctx.Fill()
}

func (polygon *Polygon) Scale(factor float64) Instruction {
	clone := polygon.Clone().(*Polygon)
	clone.X *= factor
	clone.Y *= factor
	for i, point := range clone.Points {
		clone.Points[i] = point.Scale(factor)
	}
	return clone
}

func (polygon *Polygon) Save() []byte {
	polygon.SavedColor = SaveColor(polygon.Color)
	// data, _ := json.Marshal(polygon)
	data, _ := polygon.MarshalJSON()
	return data
}

func (polygon *Polygon) Load(data []byte) {
	// json.Unmarshal(data, polygon)
	polygon.UnmarshalJSON(data)
	polygon.Color = LoadColor(polygon.SavedColor)
}

func (polygon *Polygon) Type() string {
	return TypePolygon
}

func (polygon *Polygon) Clone() Instruction {
	newPolygon := *polygon
	newPolygon.Points = make([]*Polypoint, len(polygon.Points))
	for i, point := range polygon.Points {
		newPoint := *point
		newPolygon.Points[i] = &newPoint
	}
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
