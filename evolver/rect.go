package main

// Rect represents a rectangular area
type Rect struct {
	Left   float64
	Top    float64
	Right  float64
	Bottom float64
}

// Intersects determines if two Rects intersect
func (rect *Rect) Intersects(other *Rect) bool {
	return other.Left <= rect.Right && other.Right >= rect.Left && other.Top <= rect.Bottom && other.Bottom >= rect.Top
}
