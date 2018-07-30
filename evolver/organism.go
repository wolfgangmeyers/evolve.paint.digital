package main

import (
	"bytes"
	"crypto/md5"
	"fmt"
)

// An Organism is an attempt at matching an image with
// a set of painting instructions
type Organism struct {
	Instructions []Instruction
	Diff         float32
	hash         string
	diffMap      *DiffMap
	Parent       *Organism
	AffectedArea Rect
	Patch        *Patch
}

// Hash returns a (probably) unique hash that represents this organism
func (organism *Organism) Hash() string {
	if organism.hash == "" {
		hasher := md5.New()
		for _, instruction := range organism.Instructions {
			hasher.Write([]byte(instruction.Hash()))
		}
		organism.hash = fmt.Sprintf("%x", hasher.Sum(nil))
	}
	return fmt.Sprintf("%v", organism.hash)
}

func (organism *Organism) Save() []byte {
	buf := &bytes.Buffer{}
	for i, instruction := range organism.Instructions {
		if i > 0 {
			buf.Write([]byte("\t"))
		}
		buf.Write([]byte(instruction.Type()))
		buf.Write([]byte("|"))
		buf.Write(instruction.Save())
	}
	buf.Write([]byte("\n"))
	return buf.Bytes()
}

// SaveV2 uses a newline delimiter between instructions
func (organism *Organism) SaveV2() []byte {
	buf := &bytes.Buffer{}
	for i, instruction := range organism.Instructions {
		if i > 0 {
			buf.Write([]byte("\n"))
		}
		buf.Write([]byte(instruction.Type()))
		buf.Write([]byte("|"))
		buf.Write(instruction.Save())
	}
	buf.Write([]byte("\n"))
	return buf.Bytes()
}

func (organism *Organism) Load(data []byte) {
	instructionData := bytes.Split(data, []byte("\t"))
	for _, instructionDataItem := range instructionData {
		parts := bytes.Split(instructionDataItem, []byte("|"))
		instructionType := string(parts[0])
		instruction := LoadInstruction(instructionType, parts[1])
		organism.Instructions = append(organism.Instructions, instruction)
	}
}

func (organism *Organism) Clone() *Organism {
	// data := organism.Save()
	clone := objectPool.BorrowOrganism()
	clone.AffectedArea = organism.AffectedArea
	clone.Diff = organism.Diff
	clone.Parent = organism
	for _, instruction := range organism.Instructions {
		clone.Instructions = append(clone.Instructions, instruction.Clone())
	}
	if organism.Patch != nil {
		clone.Patch = organism.Patch.Clone()
	}
	// copy over diffmap
	for x := 0; x < len(organism.diffMap.Diffs); x++ {
		for y := 0; y < len(organism.diffMap.Diffs[0]); y++ {
			clone.diffMap.Diffs[x][y] = organism.diffMap.Diffs[x][y]
		}
	}
	clone.diffMap.Total = organism.diffMap.Total
	return clone
}

// CleanupInstructions removes any duplicate instructions. In the future
// it might do more cleanup related stuff.
func (organism *Organism) CleanupInstructions() {
	// Iterate over the instructions. For each duplicate found, begin shifting
	// items backwards.
	instructionHashes := objectPool.BorrowStringset()
	for i := 0; i < len(organism.Instructions); i++ {
		hash := organism.Instructions[i].Hash()
		if instructionHashes[hash] {
			// Return instruction to the pool
			objectPool.ReturnInstruction(organism.Instructions[i])
			// Shift everything beyond i one to the left and trim the end.
			for j := i; j < len(organism.Instructions)-1; j++ {
				organism.Instructions[j] = organism.Instructions[j+1]
			}
			organism.Instructions = organism.Instructions[:len(organism.Instructions)-1]
		}
		instructionHashes[hash] = true
	}
	objectPool.ReturnStringset(instructionHashes)
}

// GetInstructionHashSet gets a set of hashes from the organism's instructions
func (organism *Organism) GetInstructionHashSet() map[string]bool {
	hashset := objectPool.BorrowStringset()
	for _, instruction := range organism.Instructions {
		hashset[instruction.Hash()] = true
	}
	return hashset
}

// OrganismList implements sort.Interface for []*Organism based on
// the Diff field.
type OrganismList []*Organism

func (a OrganismList) Len() int      { return len(a) }
func (a OrganismList) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a OrganismList) Less(i, j int) bool {
	return a[i].Diff < a[j].Diff ||
		(a[i].Diff == a[j].Diff && len(a[i].Instructions) < len(a[j].Instructions))
}
