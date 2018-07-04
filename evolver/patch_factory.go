package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// PatchFactory helps pool Patchs
type PatchFactory struct{}

// NewPatchFactory creates a new PatchFactory
func NewPatchFactory() *PatchFactory {
	return &PatchFactory{}
}

// MakeObject creates new Patchs
func (f *PatchFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&Patch{
		Operations: []*PatchOperation{},
	}), nil
}

// DestroyObject destroys objects
func (f *PatchFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *PatchFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject activates objects
func (f *PatchFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an Patch to its default state.
func (f *PatchFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	obj := object.Object.(*Patch)
	obj.Baseline = ""
	obj.Target = ""
	obj.Operations = obj.Operations[:0]
	return nil
}

// PatchOperationFactory helps pool PatchOperations
type PatchOperationFactory struct{}

// NewPatchOperationFactory creates a new PatchOperationFactory
func NewPatchOperationFactory() *PatchOperationFactory {
	return &PatchOperationFactory{}
}

// MakeObject creates new PatchOperations
func (f *PatchOperationFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&PatchOperation{
		InstructionData: []byte{},
	}), nil
}

// DestroyObject destroys objects
func (f *PatchOperationFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject validates objects
func (f *PatchOperationFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	return true
}

// ActivateObject activates objects
func (f *PatchOperationFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// PassivateObject resets an PatchOperation to its default state.
func (f *PatchOperationFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	obj := object.Object.(*PatchOperation)
	obj.InstructionData = obj.InstructionData[:0]
	obj.InstructionHash1 = ""
	obj.InstructionHash2 = ""
	obj.InstructionType = ""
	obj.OperationType = ""
	return nil
}
