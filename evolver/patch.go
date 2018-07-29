package main

// TODO: change this to V2

const (
	// PatchOperationAppend - append an item
	PatchOperationAppend = "a"
	// PatchOperationDelete - delete item
	PatchOperationDelete = "d"
	// PatchOperationReplace - replace item
	PatchOperationReplace = "r"
	// PatchOperationSwap - swap two items
	PatchOperationSwap = "s"
)

// A PatchOperation represents a single element of a patch.
type PatchOperation struct {
	InstructionHash1 string `json:"hash1,omitempty"`
	InstructionHash2 string `json:"hash2,omitempty"`
	InstructionData  []byte `json:"data,omitempty"`
	InstructionType  string `json:"type,omitempty"`
	OperationType    string `json:"op"`
}

// LoadInstruction will return an `Instruction` that is loaded from
// the saved instruction data.
func (operation PatchOperation) LoadInstruction() Instruction {
	item := objectPool.BorrowInstruction(operation.InstructionType)
	item.Load(operation.InstructionData)
	return item
}

// Apply applies the operation to the organism
func (operation PatchOperation) Apply(organism *Organism) {
	switch operation.OperationType {
	case PatchOperationAppend:
		item := operation.LoadInstruction()
		organism.Instructions = append(organism.Instructions, item)
	case PatchOperationDelete:
		for idx, item := range organism.Instructions {
			if item.Hash() == operation.InstructionHash1 {
				organism.Instructions = InstructionList(organism.Instructions).Delete(idx)
				break
			}
		}
	case PatchOperationReplace:
		for idx, item := range organism.Instructions {
			if item.Hash() == operation.InstructionHash1 {
				item := operation.LoadInstruction()
				organism.Instructions[idx] = item
				break
			}
		}
	case PatchOperationSwap:
		idx1, idx2 := -1, -1
		for idx, item := range organism.Instructions {
			hash := item.Hash()
			if hash == operation.InstructionHash1 {
				idx1 = idx
			} else if hash == operation.InstructionHash2 {
				idx2 = idx
			}
			if idx1 >= 0 && idx2 >= 0 {
				break
			}
		}
		if idx1 >= 0 && idx2 >= 0 {
			organism.Instructions[idx1], organism.Instructions[idx2] =
				organism.Instructions[idx2], organism.Instructions[idx1]
		}
	}
}

// A Patch is a set of operations that will transform one
// organism into another. Organism improvements can be sent
// efficiently using patches.
type Patch struct {
	Operations []PatchOperation `json:"operations"`
	// Baseline is the hash of the organism that the instructions are intended to update
	Baseline string `json:"baseline"`
	// Target is the new hash of the baseline organism after applying instructions
	Target string `json:"target"`
}

// Clone returns a deep copy of the patch
func (patch *Patch) Clone() *Patch {
	clone := objectPool.BorrowPatch()
	clone.Baseline = patch.Baseline
	clone.Target = patch.Target
	clone.Operations = append(clone.Operations, patch.Operations...)
	return clone
}

// A PatchProcessor can use Patches to update Organism instructions
type PatchProcessor struct{}

// ProcessPatch updates an organism according to a set of PatchOperations
func (processor *PatchProcessor) ProcessPatch(organism *Organism, patch *Patch) *Organism {
	baseline := organism.Hash()
	organism = organism.Clone()
	organism.hash = ""
	for _, operation := range patch.Operations {
		operation.Apply(organism)
	}
	newPatch := objectPool.BorrowPatch()
	newPatch.Baseline = baseline
	newPatch.Target = organism.Hash()
	newPatch.Operations = append(newPatch.Operations, patch.Operations...)
	organism.Patch = newPatch
	return organism
}
