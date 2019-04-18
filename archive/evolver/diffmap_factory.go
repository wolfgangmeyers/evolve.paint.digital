package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// DiffMapFactory helps pool DiffMaps
type DiffMapFactory struct {
	width  int
	height int
}

// NewDiffMapFactory creates a new DiffMapFactory
func NewDiffMapFactory(width int, height int) *DiffMapFactory {
	return &DiffMapFactory{
		width:  width,
		height: height,
	}
}

// MakeObject creates new DiffMaps
func (f *DiffMapFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	obj := &DiffMap{
		Diffs: make([][]int64, f.width),
	}
	for x := 0; x < len(obj.Diffs); x++ {
		obj.Diffs[x] = make([]int64, f.height)
	}
	return pool.NewPooledObject(obj), nil
}

// DestroyObject destroys objects
func (f *DiffMapFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *DiffMapFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject activates objects
func (f *DiffMapFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an DiffMap to its default state.
func (f *DiffMapFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	obj := object.Object.(*DiffMap)
	for x := 0; x < len(obj.Diffs); x++ {
		column := obj.Diffs[x]
		for y := 0; y < len(column); y++ {
			obj.Diffs[x][y] = 0
		}
	}
	obj.Total = 0
	return nil
}
