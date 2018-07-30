package main

import "math"

// Rect represents a rectangular area
type Rect struct {
	Left   float32
	Top    float32
	Right  float32
	Bottom float32
}

// Area returns the area of the Rect. Optionally will round
// coordinates before calculating.
func (rect Rect) Area(roundCoordinates bool) float32 {
	left := rect.Left
	right := rect.Right
	top := rect.Top
	bottom := rect.Bottom
	if roundCoordinates {
		left = float32(math.Floor(float64(left)))
		right = float32(math.Ceil(float64(right)))
		top = float32(math.Floor(float64(top)))
		bottom = float32(math.Ceil(float64(bottom)))
	}
	return (right - left) * (bottom - top)
}

// Center returns the center of the Rect
func (rect Rect) Center() (float32, float32) {
	return (rect.Left + rect.Right) / 2.0, (rect.Top + rect.Bottom) / 2.0
}

// Intersects determines if two Rects intersect
func (rect Rect) Intersects(other *Rect) bool {
	return other.Left <= rect.Right && other.Right >= rect.Left && other.Top <= rect.Bottom && other.Bottom >= rect.Top
}

// Combine will return a new rect that contains both input rects.
func (rect Rect) CombineWith(other Rect) Rect {
	newRect := Rect{
		Left:   rect.Left,
		Top:    rect.Top,
		Right:  rect.Right,
		Bottom: rect.Bottom,
	}
	if other.Left < newRect.Left {
		newRect.Left = other.Left
	}
	if other.Top < newRect.Top {
		newRect.Top = other.Top
	}
	if other.Right > newRect.Right {
		newRect.Right = other.Right
	}
	if other.Bottom > newRect.Bottom {
		newRect.Bottom = other.Bottom
	}
	return newRect
}
