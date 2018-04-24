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
}
