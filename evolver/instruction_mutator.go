package main

type InstructionMutator interface {
	MutateInstruction(instruction Instruction)
	RandomInstruction() Instruction
	InstructionType() string
}
