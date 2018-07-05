package main

import (
	"bytes"
	"crypto/md5"
	"fmt"

	"github.com/pmezard/go-difflib/difflib"
)

// An Organism is an attempt at matching an image with
// a set of painting instructions
type Organism struct {
	Instructions []Instruction
	Diff         float32
	hash         string
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

func (organism *Organism) DiffFrom(other *Organism) {
	instructionHashes := make([]string, len(organism.Instructions))
	for i, instruction := range organism.Instructions {
		instructionHashes[i] = instruction.Hash() + "\n"
	}
	otherHashes := make([]string, len(other.Instructions))
	for i, instruction := range other.Instructions {
		otherHashes[i] = instruction.Hash() + "\n"
	}
	diff := difflib.UnifiedDiff{
		A:        instructionHashes,
		B:        otherHashes,
		FromFile: "Original",
		ToFile:   "Current",
		Context:  1,
	}
	matcher := difflib.NewMatcher(diff.A, diff.B)
	for _, opcode := range matcher.GetOpCodes() {
		fmt.Printf("%v\t%v\t%v\t%v\t%v\n", string([]byte{opcode.Tag}), opcode.I1, opcode.I2, opcode.J1, opcode.J2)
	}
	text, _ := difflib.GetUnifiedDiffString(diff)
	fmt.Printf(text + "\n\n")
	// if rand.Intn(100) == 0 {
	// 	fmt.Printf("%v - %v\n", diffs[0].Text, diffs[0].Type.String())
	// 	fmt.Printf("%v - %v\n", len(diffs), len(organism.Instructions))
	// }

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
	clone.hash = organism.hash
	clone.Parent = organism
	clone.Instructions = append(clone.Instructions, organism.Instructions...)
	// clone.Load(data)
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

// OrganismBatch contains a batch or organism data for import
type OrganismBatch struct {
	Organisms [][]byte
}

func (batch *OrganismBatch) Save(organisms []*Organism) {
	for _, organism := range organisms {
		batch.Organisms = append(batch.Organisms, organism.Save())
	}
}

func (batch *OrganismBatch) Restore() []*Organism {
	organisms := make([]*Organism, len(batch.Organisms))
	for i := 0; i < len(batch.Organisms); i++ {
		organism := &Organism{}
		organism.Load(batch.Organisms[i])
		organisms[i] = organism
	}
	return organisms
}
