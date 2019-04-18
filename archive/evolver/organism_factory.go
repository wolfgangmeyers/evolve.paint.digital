package main

import (
	"context"

	pool "github.com/jolestar/go-commons-pool"
)

// OrganismFactory helps pool organisms
type OrganismFactory struct {
}

// NewOrganismFactory returns a new OrganismFactory
func NewOrganismFactory() *OrganismFactory {
	return &OrganismFactory{}
}

// MakeObject creates new Organisms
func (f *OrganismFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&Organism{
		Diff:          -1,
		Instructions:  []Instruction{},
		AffectedAreas: []Rect{},
	}), nil
}

// DestroyObject does nothing
func (f *OrganismFactory) DestroyObject(ctx context.Context, object *pool.PooledObject) error {
	return nil
}

// ValidateObject does nothing
func (f *OrganismFactory) ValidateObject(ctx context.Context, object *pool.PooledObject) bool {
	// TODO: should any validation be performed?
	return true
}

// ActivateObject does nothing
func (f *OrganismFactory) ActivateObject(ctx context.Context, object *pool.PooledObject) error {
	// log.Printf("%v", string(debug.Stack()))
	return nil
}

// PassivateObject resets an organism to its default state. Instruction array
// capacity is maintained to avoid memory allocation upon reuse.
func (f *OrganismFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	// log.Printf("%v", string(debug.Stack()))
	organism := object.Object.(*Organism)
	if organism.Instructions != nil {
		for i := 0; i < len(organism.Instructions); i++ {
			organism.Instructions[i] = nil
		}
		organism.Instructions = organism.Instructions[:0]
	}
	organism.AffectedAreas = organism.AffectedAreas[:0]
	organism.Diff = -1
	organism.hash = ""
	organism.Parent = nil
	organism.Patch = nil
	organism.diffMap = nil
	return nil
}
