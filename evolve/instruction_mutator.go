package evolve

type InstructionMutator interface {
	MutateInstruction(instruction Instruction)
	RandomInstruction() Instruction
	InstructionType() string
}
