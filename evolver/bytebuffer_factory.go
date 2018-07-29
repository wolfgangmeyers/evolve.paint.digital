package main

import (
	"bytes"
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// ByteBufferFactory helps pool ByteBuffers
type ByteBufferFactory struct{}

// NewByteBufferFactory creates a new ByteBufferFactory
func NewByteBufferFactory() *ByteBufferFactory {
	return &ByteBufferFactory{}
}

// MakeObject creates new ByteBuffers
func (f *ByteBufferFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&bytes.Buffer{}), nil
}

// DestroyObject destroys objects
func (f *ByteBufferFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *ByteBufferFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject activates objects
func (f *ByteBufferFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an ByteBuffer to its default state.
func (f *ByteBufferFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	obj := object.Object.(*bytes.Buffer)
	obj.Reset()
	return nil
}
