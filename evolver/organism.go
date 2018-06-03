package main

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"fmt"

	"github.com/pmezard/go-difflib/difflib"
)

// An Organism is an attempt at matching an image with
// a set of painting instructions
type Organism struct {
	Instructions []Instruction
	Diff         float64
	hash         string
	Parent       *Organism
	AffectedArea *Rect
}

// Hash returns a (probably) unique hash that represents this organism
func (organism *Organism) Hash() string {
	if organism.hash == "" {
		hasher := md5.New()
		for _, instruction := range organism.Instructions {
			hasher.Write([]byte(instruction.Hash()))
		}
		organism.hash = base64.StdEncoding.EncodeToString(hasher.Sum(nil))
	}
	return organism.hash
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
	organism.Instructions = []Instruction{}
	instructionData := bytes.Split(data, []byte("\t"))
	for _, instructionDataItem := range instructionData {
		parts := bytes.Split(instructionDataItem, []byte("|"))
		instructionType := string(parts[0])
		instruction := LoadInstruction(instructionType, parts[1])
		organism.Instructions = append(organism.Instructions, instruction)
	}
}

func (organism *Organism) Clone() *Organism {
	data := organism.Save()
	clone := &Organism{}
	clone.Load(data)
	return clone
}

// OrganismList implements sort.Interface for []*Organism based on
// the Diff field.
type OrganismList []*Organism

func (a OrganismList) Len() int           { return len(a) }
func (a OrganismList) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a OrganismList) Less(i, j int) bool { return a[i].Diff < a[j].Diff }

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
