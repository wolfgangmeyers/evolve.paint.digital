package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// ObjectSetFactory helps pool ObjectSets
type ObjectSetFactory struct {
}

// NewObjectSetFactory creates a new ObjectSetFactory
func NewObjectSetFactory() *ObjectSetFactory {
	return &ObjectSetFactory{}
}

// MakeObject creates new ObjectSets
func (f *ObjectSetFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(map[interface{}]bool{}), nil
}

// DestroyObject destroys objects
func (f *ObjectSetFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *ObjectSetFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	return true
}

// ActivateObject activates objects
func (f *ObjectSetFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an ObjectSet to its default state.
func (f *ObjectSetFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	// Clear set
	objectSet := object.Object.(map[interface{}]bool)
	for key := range objectSet {
		delete(objectSet, key)
	}
	return nil
}
