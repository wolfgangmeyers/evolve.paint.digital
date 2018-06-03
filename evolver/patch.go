package main

import (
	"log"

	"github.com/pmezard/go-difflib/difflib"
)

const (
	// PatchOperationDelete indicates a delete operation
	PatchOperationDelete byte = 'd'
	// PatchOperationReplace indicates a replace operation
	PatchOperationReplace byte = 'r'
	// PatchOperationInsert indicates an insert operation
	PatchOperationInsert byte = 'i'
)

// A PatchOperation represents a single element of a patch. Typically a
// single instruction is either deleted, replaced, or inserted.
type PatchOperation struct {
	BeforeInstructionHash string   `json:"before"`
	InstructionTypes      []string `json:"instructionTypes"`
	InstructionsData      [][]byte `json:"instructions"`
	AfterInstructionHash  string   `json:"after"`
	OperationType         byte     `json:"type"`
}

// A Patch is a set of operations that will transform one
// organism into another. Organism improvements can be sent
// efficiently using patches.
type Patch struct {
	Operations []*PatchOperation `json:"operations"`
}

// PatchGenerator creates patches that can be used to upgrade
// organism instructions.
type PatchGenerator struct{}

// GeneratePatch produces a Patch that can be used by a PatchProcessor to update an organism's instructions.
func (gen *PatchGenerator) GeneratePatch(original *Organism, current *Organism) *Patch {
	hashes1 := gen.getInstructionHashes(original)
	hashes2 := gen.getInstructionHashes(current)
	matcher := difflib.NewMatcher(hashes1, hashes2)
	opcodes := matcher.GetOpCodes()
	// translate difflib opcodes to PatchOperations
	operations := make([]*PatchOperation, len(opcodes))
	for i, opcode := range opcodes {
		operation := &PatchOperation{
			OperationType: opcode.Tag,
		}
		if opcode.I1 > 0 {
			operation.BeforeInstructionHash = hashes1[opcode.I1-1]
		}
		if opcode.I2 < len(hashes1) {
			operation.AfterInstructionHash = hashes1[opcode.I2]
		}
		for j := opcode.J1; j < opcode.J2; j++ {
			operation.InstructionsData = append(operation.InstructionsData, current.Instructions[j].Save())
		}
		operations[i] = operation
	}
	return &Patch{
		Operations: operations,
	}
}

// getInstructionHashes returns a list of all instruction hashes for an organism
func (gen *PatchGenerator) getInstructionHashes(organism *Organism) []string {
	hashes := make([]string, len(organism.Instructions))
	for i, instruction := range organism.Instructions {
		hashes[i] = instruction.Hash()
	}
	return hashes
}

// A PatchProcessor can use Patches to update Organism instructions
type PatchProcessor struct{}

// ProcessPatch updates an organism according to a set of PatchOperations
func (processor *PatchProcessor) ProcessPatch(organism *Organism, patch *Patch) *Organism {
	organism = organism.Clone()
	organism.hash = ""
	instructionIndex := processor.indexInstructions(organism)
	for _, operation := range patch.Operations {
		beforeIndex, hasBefore := instructionIndex[operation.BeforeInstructionHash]
		afterIndex, hasAfter := instructionIndex[operation.AfterInstructionHash]
		start, end, canApply := processor.getOperationBounds(
			organism, operation, beforeIndex, hasBefore, afterIndex, hasAfter)
		if !canApply {
			continue
		}
		switch operation.OperationType {
		case PatchOperationDelete:
			processor.processDeleteOperation(organism, start, end)
		case PatchOperationInsert, PatchOperationReplace:
			processor.processInsertOrReplaceOperation(organism, operation, start, end)
		}
	}
	return organism
}

func (processor *PatchProcessor) processInsertOrReplaceOperation(
	organism *Organism,
	operation *PatchOperation,
	start int,
	end int,
) {
	inserted := processor.loadInstructions(operation)
	if len(inserted) == 0 {
		return
	}
	// Insert instructions at start (end == start for insert)
	organism.Instructions = append(organism.Instructions[:start], append(inserted, organism.Instructions[end:]...)...)
}

func (processor *PatchProcessor) loadInstructions(operation *PatchOperation) []Instruction {
	if len(operation.InstructionTypes) != len(operation.InstructionsData) {
		log.Printf("Instruction list doesn't match instruction type list")
		return []Instruction{}
	}
	instructions := make([]Instruction, len(operation.InstructionTypes))
	for i, instructionType := range operation.InstructionTypes {
		data := operation.InstructionsData[i]
		instruction := LoadInstruction(instructionType, data)
		instructions = append(instructions, instruction)
	}
	return instructions
}

func (processor *PatchProcessor) processDeleteOperation(
	organism *Organism,
	start int,
	end int,
) {
	organism.Instructions = append(organism.Instructions[0:start], organism.Instructions[end:]...)
}

func (processor *PatchProcessor) getOperationBounds(
	organism *Organism,
	operation *PatchOperation,
	beforeIndex int,
	hasBefore bool,
	afterIndex int,
	hasAfter bool,
) (start int, end int, success bool) {
	success = false
	if hasBefore && hasAfter {
		start = beforeIndex + 1
		end = afterIndex
		success = true
	} else if hasBefore && operation.AfterInstructionHash == "" {
		start = beforeIndex + 1
		end = len(organism.Instructions)
		success = true
	} else if hasAfter && operation.BeforeInstructionHash == "" {
		start = 0
		end = afterIndex
		success = true
	}
	return
}

func (processor *PatchProcessor) indexInstructions(organism *Organism) map[string]int {
	index := map[string]int{}
	for i, instruction := range organism.Instructions {
		index[instruction.Hash()] = i
	}
	return index
}
