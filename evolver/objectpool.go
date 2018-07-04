package main

import (
	"context"

	"github.com/jolestar/go-commons-pool"
)

// ObjectPool manages pools of all disposable objects.
type ObjectPool struct {
	instructionPools   map[string]*pool.ObjectPool
	organismPool       *pool.ObjectPool
	patchPool          *pool.ObjectPool
	patchOperationPool *pool.ObjectPool
}

// NewObjectPool returns a new ObjectPool
func NewObjectPool() *ObjectPool {
	p := &ObjectPool{}
	ctx := context.Background()
	p.organismPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewOrganismFactory())
	p.patchPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewPatchFactory())
	p.patchOperationPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewPatchOperationFactory())
	p.instructionPools = make(map[string]*pool.ObjectPool)
	return p
}

// AddInstructionFactory registers a PooledObjectFactory for a type of Instruction
func (p *ObjectPool) AddInstructionFactory(instructionType string, factory pool.PooledObjectFactory) {
	ctx := context.Background()
	p.instructionPools[instructionType] = pool.NewObjectPoolWithDefaultConfig(ctx, factory)
}

// BorrowOrganism checks out an Organism from the pool
func (p *ObjectPool) BorrowOrganism() *Organism {
	ctx := context.Background()
	obj, err := p.organismPool.BorrowObject(ctx)
	if err != nil {
		panic(err)
	}
	return obj.(*Organism)
}

// ReturnOrganism returns an Organism to the pool
func (p *ObjectPool) ReturnOrganism(organism *Organism) {
	ctx := context.Background()
	err := p.organismPool.ReturnObject(ctx, organism)
	if err != nil {
		panic(err)
	}
}

// BorrowInstruction checks out an Instruction from the pool
func (p *ObjectPool) BorrowInstruction(instructionType string) Instruction {
	ctx := context.Background()
	obj, err := p.instructionPools[instructionType].BorrowObject(ctx)
	if err != nil {
		panic(err)
	}
	return obj.(Instruction)
}

// ReturnInstruction returns an Instruction to the pool
func (p *ObjectPool) ReturnInstruction(instruction Instruction) {
	ctx := context.Background()
	err := p.instructionPools[instruction.Type()].ReturnObject(ctx, instruction)
	if err != nil {
		panic(err)
	}
}

// BorrowPatch checks out a Patch from the pool
func (p *ObjectPool) BorrowPatch() *Patch {
	ctx := context.Background()
	obj, err := p.patchPool.BorrowObject(ctx)
	if err != nil {
		panic(err)
	}
	return obj.(*Patch)
}

// ReturnPatch returns a Patch to the pool. Optionally returns patch operations to
// the pool as well.
func (p *ObjectPool) ReturnPatch(patch *Patch, returnOperations bool) {
	ctx := context.Background()
	if returnOperations {
		for _, operation := range patch.Operations {
			p.ReturnPatchOperation(operation)
		}
	}
	err := p.patchPool.ReturnObject(ctx, patch)
	if err != nil {
		panic(err)
	}
}

// BorrowPatchOperation checks out a PatchOperation from the pool
func (p *ObjectPool) BorrowPatchOperation() *PatchOperation {
	ctx := context.Background()
	obj, err := p.patchOperationPool.BorrowObject(ctx)
	if err != nil {
		panic(err)
	}
	return obj.(*PatchOperation)
}

// ReturnPatchOperation returns a PatchOperation to the pool
func (p *ObjectPool) ReturnPatchOperation(operation *PatchOperation) {
	ctx := context.Background()
	err := p.patchOperationPool.ReturnObject(ctx, operation)
	if err != nil {
		panic(err)
	}
}

// OrganismFactory helps pool organisms
type OrganismFactory struct{}

// NewOrganismFactory returns a new OrganismFactory
func NewOrganismFactory() *OrganismFactory {
	return &OrganismFactory{}
}

// MakeObject creates new Organisms
func (f *OrganismFactory) MakeObject(ctx context.Context) (*pool.PooledObject, error) {
	return pool.NewPooledObject(&Organism{
		Diff:         -1,
		Instructions: []Instruction{},
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
	return nil
}

// PassivateObject resets an organism to its default state. Instruction array
// capacity is maintained to avoid memory allocation upon reuse.
func (f *OrganismFactory) PassivateObject(ctx context.Context, object *pool.PooledObject) error {
	organism := object.Object.(*Organism)
	if organism.Instructions != nil {
		organism.Instructions = organism.Instructions[:0]
	}
	organism.AffectedArea = Rect{}
	organism.Diff = -1
	organism.hash = ""
	organism.Parent = nil
	organism.Patch = nil
	return nil
}
