package main

import "math/rand"

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
// TODO: move this into another class that isn't specific to lines
func (mut *Mutator) Mutate(instructions []Instruction) []Instruction {
	// TODO: use configurable weights to skew randomness towards different actions
	// this will allow for auto-tuning later on
	// 0 - append random item
	// 1 - append duplicate of random item, mutated
	// 2 - delete random item
	// 3 - mutate random item
	// 4 - swap random items

	switch rand.Int31n(5) {
	case 0:
		line := mut.RandomInstruction()
		instructions = append(instructions, line)
	case 1:
		item := mut.selectRandomInstruction(instructions)
		item = item.Clone()
		instructionMut := mut.instructionMutatorMap[item.Type()]
		instructionMut.MutateInstruction(item)
		instructions = append(instructions, item)
	case 2:
		i := rand.Int31n(int32(len(instructions)))
		instructions = InstructionList(instructions).Delete(int(i))
	case 3:
		item := mut.selectRandomInstruction(instructions)
		instructionMut := mut.instructionMutatorMap[item.Type()]
		instructionMut.MutateInstruction(item)
	case 4:
		i := rand.Int31n(int32(len(instructions)))
		j := rand.Int31n(int32(len(instructions)))
		instructions[i], instructions[j] = instructions[j], instructions[i]
	}
	return instructions
}

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
