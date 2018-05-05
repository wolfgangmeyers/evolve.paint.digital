package main

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"log"
)

// An Organism is an attempt at matching an image with
// a set of painting instructions
type Organism struct {
	Instructions []Instruction
	Diff         float64
	hash         string
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

func (organism *Organism) Load(data []byte) {
	organism.Instructions = []Instruction{}
	instructionData := bytes.Split(data, []byte("\t"))
	for _, instructionDataItem := range instructionData {
		parts := bytes.Split(instructionDataItem, []byte("|"))
		instructionType := string(parts[0])
		var instruction Instruction
		// TODO: support other instruction types
		if instructionType == TypeLine {
			instruction = &Line{}
			instruction.Load(parts[1])
		} else if instructionType == TypeCircle {
			instruction = &Circle{}
			instruction.Load(parts[1])
		} else {
			log.Fatalf("Unknown instruction type: '%v'", instructionType)
		}
		organism.Instructions = append(organism.Instructions, instruction)
	}
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
