package main

import (
	"github.com/fogleman/gg"
)

// An Instruction encapsulates the logic to draw something
// on a canvas (gg.Context)
type Instruction interface {
	Type() string
	Execute(ctx *gg.Context)
	Save() []byte
	Load([]byte)
	Clone() Instruction
	Hash() string
}

// InstructionList provides convenience methods for instruction lists
type InstructionList []Instruction

// Delete deletes the an item at the specified index
func (lst InstructionList) Delete(i int) []Instruction {
	a := []Instruction(lst)
	return append(a[:i], a[i+1:]...)
}

// Insert inserts an instruction at the specified index
func (lst InstructionList) Insert(i int, item Instruction) []Instruction {
	a := []Instruction(lst)
	return append(a[:i], append([]Instruction{item}, a[i:]...)...)
}
