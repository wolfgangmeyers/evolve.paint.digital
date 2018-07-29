package main

import (
	"bytes"
	"context"
	"log"

	"github.com/jolestar/go-commons-pool"
)

// ObjectPool manages pools of all disposable objects.
type ObjectPool struct {
	instructionPools map[string]*pool.ObjectPool
	organismPool     *pool.ObjectPool
	patchPool        *pool.ObjectPool
	stringsetPool    *pool.ObjectPool
	objectsetPool    *pool.ObjectPool
	rendererPool     *pool.ObjectPool
	diffmapPool      *pool.ObjectPool
	byteBufferPool   *pool.ObjectPool
}

// NewObjectPool returns a new ObjectPool
func NewObjectPool() *ObjectPool {
	p := &ObjectPool{}
	ctx := context.Background()
	p.organismPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewOrganismFactory())
	p.organismPool.Config.MaxTotal = -1
	p.organismPool.Config.MaxIdle = -1
	p.patchPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewPatchFactory())
	p.patchPool.Config.MaxTotal = -1
	p.patchPool.Config.MaxIdle = -1
	p.instructionPools = make(map[string]*pool.ObjectPool)
	p.stringsetPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewStringSetFactory())
	p.stringsetPool.Config.MaxTotal = -1
	p.stringsetPool.Config.MaxIdle = -1
	p.objectsetPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewObjectSetFactory())
	p.objectsetPool.Config.MaxTotal = -1
	p.objectsetPool.Config.MaxIdle = -1
	p.byteBufferPool = pool.NewObjectPoolWithDefaultConfig(ctx, NewByteBufferFactory())
	p.byteBufferPool.Config.MaxTotal = -1
	p.byteBufferPool.Config.MaxIdle = -1
	return p
}

// SetRendererBounds prepares the object pool to provide Renderers
func (p *ObjectPool) SetRendererBounds(imageWidth int, imageHeight int) {
	ctx := context.Background()
	rendererFactory := NewRendererFactory(imageWidth, imageHeight)
	p.rendererPool = pool.NewObjectPoolWithDefaultConfig(ctx, rendererFactory)
	p.rendererPool.Config.MaxIdle = -1
	p.rendererPool.Config.MaxTotal = -1
	diffmapFactory := NewDiffMapFactory(imageWidth, imageHeight)
	p.diffmapPool = pool.NewObjectPoolWithDefaultConfig(ctx, diffmapFactory)
	p.diffmapPool.Config.MaxIdle = -1
	p.diffmapPool.Config.MaxTotal = -1
}

// AddInstructionFactory registers a PooledObjectFactory for a type of Instruction
func (p *ObjectPool) AddInstructionFactory(instructionType string, factory pool.PooledObjectFactory) {
	ctx := context.Background()
	instructionPool := pool.NewObjectPoolWithDefaultConfig(ctx, factory)
	instructionPool.Config.MaxIdle = -1
	instructionPool.Config.MaxTotal = -1
	p.instructionPools[instructionType] = instructionPool
}

// BorrowStringset checks out a string set from the pool
func (p *ObjectPool) BorrowStringset() map[string]bool {
	ctx := context.Background()
	obj, err := p.stringsetPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowStringset Error: %v", err.Error())
	}
	return obj.(map[string]bool)
}

// ReturnStringset returns a string set to the pool
func (p *ObjectPool) ReturnStringset(stringset map[string]bool) {
	ctx := context.Background()
	err := p.stringsetPool.ReturnObject(ctx, stringset)
	if err != nil {
		log.Printf("ReturnStringSet Error: %v", err.Error())
	}
}

// BorrowObjectSet checks out a string set from the pool
func (p *ObjectPool) BorrowObjectSet() map[interface{}]bool {
	ctx := context.Background()
	obj, err := p.objectsetPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowObjectSet Error: %v", err.Error())
	}
	return obj.(map[interface{}]bool)
}

// ReturnObjectSet returns a string set to the pool
func (p *ObjectPool) ReturnObjectSet(ObjectSet map[interface{}]bool) {
	ctx := context.Background()
	err := p.objectsetPool.ReturnObject(ctx, ObjectSet)
	if err != nil {
		log.Printf("ReturnObjectSet Error: %v", err.Error())
	}
}

// BorrowOrganism checks out an Organism from the pool
func (p *ObjectPool) BorrowOrganism() *Organism {
	ctx := context.Background()
	obj, err := p.organismPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowOrganism Error: %v", err.Error())
	}
	organism := obj.(*Organism)
	diffMap, err := p.diffmapPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowDiffMap Error: %v", err.Error())
	}
	organism.diffMap = diffMap.(*DiffMap)
	return obj.(*Organism)
}

// ReturnOrganism returns an Organism to the pool
func (p *ObjectPool) ReturnOrganism(organism *Organism) {
	ctx := context.Background()
	err := p.diffmapPool.ReturnObject(ctx, organism.diffMap)
	if err != nil {
		log.Printf("ReturnDiffMap Error: %v", err.Error())
	}
	err = p.organismPool.ReturnObject(ctx, organism)
	if err != nil {
		log.Printf("ReturnOrganism Error: %v", err.Error())
	}
}

// BorrowInstruction checks out an Instruction from the pool
func (p *ObjectPool) BorrowInstruction(instructionType string) Instruction {
	ctx := context.Background()
	obj, err := p.instructionPools[instructionType].BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowInstruction Error: %v", err.Error())
	}
	return obj.(Instruction)
}

// ReturnInstruction returns an Instruction to the pool
func (p *ObjectPool) ReturnInstruction(instruction Instruction) {
	ctx := context.Background()
	err := p.instructionPools[instruction.Type()].ReturnObject(ctx, instruction)
	if err != nil {
		log.Printf("ReturnInstruction Error: %v", err.Error())
	}
}

// BorrowPatch checks out a Patch from the pool
func (p *ObjectPool) BorrowPatch() *Patch {
	ctx := context.Background()
	obj, err := p.patchPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowPatch Error: %v", err.Error())
	}
	return obj.(*Patch)
}

// ReturnPatch returns a Patch to the pool
func (p *ObjectPool) ReturnPatch(patch *Patch) {
	ctx := context.Background()
	err := p.patchPool.ReturnObject(ctx, patch)
	if err != nil {
		log.Printf("ReturnPatch Error: %v", err.Error())
	}
}

// BorrowRenderer checks out a Renderer from the pool
func (p *ObjectPool) BorrowRenderer() *Renderer {
	ctx := context.Background()
	obj, err := p.rendererPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowRenderer Error: %v", err.Error())
	}
	return obj.(*Renderer)
}

// ReturnRenderer returns a Renderer to the pool
func (p *ObjectPool) ReturnRenderer(renderer *Renderer) {
	ctx := context.Background()
	err := p.rendererPool.ReturnObject(ctx, renderer)
	if err != nil {
		log.Printf("ReturnRenderer Error: %v", err.Error())
	}
}

// BorrowBuffer returns a bytes.Buffer
func (p *ObjectPool) BorrowByteBuffer() *bytes.Buffer {
	ctx := context.Background()
	obj, err := p.byteBufferPool.BorrowObject(ctx)
	if err != nil {
		log.Printf("BorrowByteBuffer Error: %v", err.Error())
	}
	return obj.(*bytes.Buffer)
}

// ReturnByteBuffer returns a bytes.Buffer to the pool
func (p *ObjectPool) ReturnByteBuffer(buf *bytes.Buffer) {
	ctx := context.Background()
	err := p.byteBufferPool.ReturnObject(ctx, buf)
	if err != nil {
		log.Printf("ReturnByteBuffer Error: %v", err.Error())
	}
}
