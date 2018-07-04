package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// PolygonFactory helps pool Polygons
type PolygonFactory struct{}

// NewPolygonFactory creates a new PolygonFactory
func NewPolygonFactory() *PolygonFactory {
	return &PolygonFactory{}
}

// MakeObject creates new Polygons
func (f *PolygonFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&Polygon{
	// TODO: add fields here
	}), nil
}

// DestroyObject destroys objects
func (f *PolygonFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *PolygonFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject activates objects
func (f *PolygonFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an Polygon to its default state.
func (f *PolygonFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	// obj := object.Object.(*Polygon)
	// TODO: clean up here
	return nil
}
