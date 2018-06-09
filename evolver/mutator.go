package main

import (
	"math/rand"
)

type Mutator struct {
	instructionMutatorMap map[string]InstructionMutator
	instructionMutators   []InstructionMutator
}

func NewMutator(instructionMutators []InstructionMutator) *Mutator {
	mut := new(Mutator)
	mut.instructionMutatorMap = map[string]InstructionMutator{}
	for _, instructionMut := range instructionMutators {
		mut.instructionMutators = append(mut.instructionMutators, instructionMut)
		mut.instructionMutatorMap[instructionMut.InstructionType()] = instructionMut
	}
	return mut
}

// Mutate is the primary function of the mutator
func (mut *Mutator) Mutate(organism *Organism) (*PatchOperation, *Rect) {
	// TODO: use configurable weights to skew randomness towards different actions
	// this will allow for auto-tuning later on
	// 0 - append random item
	// 1 - append duplicate of random item, mutated
	// 2 - delete random item
	// 3 - mutate random item
	// 4 - swap random items
	var affectedArea *Rect
	var operation *PatchOperation

	switch rand.Int31n(5) {
	case 0:
		item := mut.RandomInstruction()
		affectedArea = item.Bounds()
		operation = &PatchOperation{
			OperationType:   PatchOperationAppend,
			InstructionData: item.Save(),
			InstructionType: item.Type(),
		}
	case 1:
		item := mut.selectRandomInstruction(organism.Instructions)
		item = item.Clone()
		instructionMut := mut.instructionMutatorMap[item.Type()]
		instructionMut.MutateInstruction(item)
		affectedArea = item.Bounds()
		operation = &PatchOperation{
			OperationType:   PatchOperationAppend,
			InstructionData: item.Save(),
			InstructionType: item.Type(),
		}
	case 2:
		item := mut.selectRandomInstruction(organism.Instructions)
		affectedArea = item.Bounds()
		operation = &PatchOperation{
			OperationType:    PatchOperationDelete,
			InstructionHash1: item.Hash(),
		}
	case 3:
		item := mut.selectRandomInstruction(organism.Instructions)
		hash := item.Hash()
		item = item.Clone()
		affectedArea = item.Bounds()
		instructionMut := mut.instructionMutatorMap[item.Type()]
		instructionMut.MutateInstruction(item)
		affectedArea = affectedArea.CombineWith(item.Bounds())
		operation = &PatchOperation{
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
		affectedArea = item1.Bounds().CombineWith(item2.Bounds())
		operation = &PatchOperation{
			OperationType:    PatchOperationSwap,
			InstructionHash1: item1.Hash(),
			InstructionHash2: item2.Hash(),
		}
	}
	return operation, affectedArea
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
