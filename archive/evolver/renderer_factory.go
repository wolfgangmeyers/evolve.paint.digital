package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// RendererFactory helps pool Renderers
type RendererFactory struct {
	imageWidth  int
	imageHeight int
}

// NewRendererFactory creates a new RendererFactory
func NewRendererFactory(imageWidth int, imageHeight int) *RendererFactory {
	return &RendererFactory{
		imageWidth:  imageWidth,
		imageHeight: imageHeight,
	}
}

// MakeObject creates new Renderers
func (f *RendererFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(NewRenderer(f.imageWidth, f.imageHeight)), nil
}

// DestroyObject destroys objects
func (f *RendererFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *RendererFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	return true
}

// ActivateObject activates objects
func (f *RendererFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an Renderer to its default state.
func (f *RendererFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	// No reset is necessary, since the renderer will clear itself on next use.
	return nil
}
