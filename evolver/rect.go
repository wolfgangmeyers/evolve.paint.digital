package main

import "math"

// Rect represents a rectangular area
type Rect struct {
	Left   float64
	Top    float64
	Right  float64
	Bottom float64
}

// Area returns the area of the Rect. Optionally will round
// coordinates before calculating.
func (rect *Rect) Area(roundCoordinates bool) float64 {
	left := rect.Left
	right := rect.Right
	top := rect.Top
	bottom := rect.Bottom
	if roundCoordinates {
		left = math.Floor(left + 0.5)
		right = math.Floor(right + 0.5)
		top = math.Floor(top + 0.5)
		bottom = math.Floor(bottom + 0.5)
	}
	return (right - left) * (bottom - top)
}

// Intersects determines if two Rects intersect
func (rect *Rect) Intersects(other *Rect) bool {
	return other.Left <= rect.Right && other.Right >= rect.Left && other.Top <= rect.Bottom && other.Bottom >= rect.Top
}

// Combine will return a new rect that contains both input rects.
func (rect *Rect) CombineWith(other *Rect) *Rect {
	newRect := &Rect{
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
