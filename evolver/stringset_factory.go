package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// StringSetFactory helps pool StringSets
type StringSetFactory struct{}

// NewStringSetFactory creates a new StringSetFactory
func NewStringSetFactory() *StringSetFactory {
	return &StringSetFactory{}
}

// MakeObject creates new StringSets
func (f *StringSetFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(map[string]bool{}), nil
}

// DestroyObject destroys objects
func (f *StringSetFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *StringSetFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject activates objects
func (f *StringSetFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an StringSet to its default state.
func (f *StringSetFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	obj := object.Object.(map[string]bool)
	for key := range obj {
		delete(obj, key)
	}
	return nil
}
