package main

import (
	"image"
	"math/rand"
)

// A Mutator provides a way to alter organisms in an attempt to improve them.
type Mutator struct {
	instructionMutatorMap map[string]InstructionMutator
	instructionMutators   []InstructionMutator
	focusMap              image.Image
	maxFocusValue         int
}

// NewMutator returns a new Mutator
// focusMap is an optional arg, if provided the mutator will apply focus
// to certain areas with higher value.
func NewMutator(instructionMutators []InstructionMutator, focusMap image.Image) *Mutator {
	mut := new(Mutator)
	mut.focusMap = focusMap
	if focusMap != nil {
		// scan for the largest value in the map
		for x := 0; x < focusMap.Bounds().Size().X; x++ {
			for y := 0; y < focusMap.Bounds().Size().Y; y++ {
				pixel := focusMap.At(x, y)
				r, _, _, _ := pixel.RGBA()
				value := int(r)
				if value > mut.maxFocusValue {
					mut.maxFocusValue = value
				}
			}
		}
	}
	mut.instructionMutatorMap = map[string]InstructionMutator{}
	for _, instructionMut := range instructionMutators {
		mut.instructionMutators = append(mut.instructionMutators, instructionMut)
		mut.instructionMutatorMap[instructionMut.InstructionType()] = instructionMut
	}
	return mut
}

// Mutate is the primary function of the mutator
func (mut *Mutator) Mutate(organism *Organism) PatchOperation {
	// TODO: use configurable weights to skew randomness towards different actions
	// this will allow for auto-tuning later on
	// 0 - append random item
	// 1 - append duplicate of random item, mutated
	// 2 - delete random item
	// 3 - mutate random item
	// 4 - swap random items
	var operation PatchOperation
	accepted := false
	var focusThreshold int
	if mut.focusMap != nil {
		focusThreshold = rand.Intn(mut.maxFocusValue)
	}

	for !accepted {
		organism.AffectedAreas = organism.AffectedAreas[:0]
		switch rand.Int31n(5) {
		case 0:
			item := mut.RandomInstruction()
			organism.AffectedAreas = append(organism.AffectedAreas, item.Bounds())
			operation = PatchOperation{
				OperationType:   PatchOperationAppend,
				InstructionData: item.Save(),
				InstructionType: item.Type(),
			}
			objectPool.ReturnInstruction(item)
		case 1:
			item := mut.selectRandomInstruction(organism.Instructions)
			item = item.Clone()
			instructionMut := mut.instructionMutatorMap[item.Type()]
			instructionMut.MutateInstruction(item)
			organism.AffectedAreas = append(organism.AffectedAreas, item.Bounds())
			operation = PatchOperation{
				OperationType:   PatchOperationAppend,
				InstructionData: item.Save(),
				InstructionType: item.Type(),
			}
		case 2:
			item := mut.selectRandomInstruction(organism.Instructions)
			organism.AffectedAreas = append(organism.AffectedAreas, item.Bounds())
			operation = PatchOperation{
				OperationType:    PatchOperationDelete,
				InstructionHash1: item.Hash(),
			}
		case 3:
			item := mut.selectRandomInstruction(organism.Instructions)
			hash := item.Hash()
			item = item.Clone()
			organism.AffectedAreas = append(organism.AffectedAreas, item.Bounds())
			instructionMut := mut.instructionMutatorMap[item.Type()]
			instructionMut.MutateInstruction(item)
			organism.AffectedAreas = append(organism.AffectedAreas, item.Bounds())
			operation = PatchOperation{
				OperationType:    PatchOperationReplace,
				InstructionHash1: hash,
				InstructionData:  item.Save(),
				InstructionType:  item.Type(),
			}
		case 4:
			i := rand.Int31n(int32(len(organism.Instructions)))
			j := rand.Int31n(int32(len(organism.Instructions)))
			item1 := organism.Instructions[i]
			item2 := organism.Instructions[j]
			organism.AffectedAreas = append(organism.AffectedAreas, item1.Bounds())
			organism.AffectedAreas = append(organism.AffectedAreas, item2.Bounds())
			operation = PatchOperation{
				OperationType:    PatchOperationSwap,
				InstructionHash1: item1.Hash(),
				InstructionHash2: item2.Hash(),
			}
		}
		if mut.focusMap == nil {
			accepted = true
		} else {
			// Verify that at least one affected area is centered in a pixel
			// that is at or above the focus threshold
			for _, area := range organism.AffectedAreas {
				x, y := area.Center()
				pixel := mut.focusMap.At(int(x), int(y))
				r, _, _, _ := pixel.RGBA()
				if int(r) >= focusThreshold {
					accepted = true
					break
				}
			}
		}
	}
	operation.Apply(organism)
	return operation
}

// RandomInstruction returns a new random Instruction
func (mut *Mutator) RandomInstruction() Instruction {
	i := int(rand.Intn(len(mut.instructionMutators)))
	instructionMut := mut.instructionMutators[i]
	line := instructionMut.RandomInstruction()
	return line
}

func (mut *Mutator) selectRandomInstruction(instructions []Instruction) Instruction {
	i := rand.Int31n(int32(len(instructions)))
	return instructions[i]
}
