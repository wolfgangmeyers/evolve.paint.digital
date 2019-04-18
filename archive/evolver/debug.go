package main

import (
	"runtime/debug"
	"strings"
)

// ShortStack provides an abbreviated stack trace for debugging
func ShortStack() string {
	pieces := []string{}
	for _, piece := range strings.Split(string(debug.Stack()), "\n") {
		if strings.Contains(piece, "evolve") {
			piece = strings.TrimSpace(piece)
			parts := strings.Split(piece, "/")
			piece = parts[len(parts)-1]
			parts = strings.Split(piece, " ")
			piece = parts[0]
			pieces = append(pieces, piece)
		}
	}
	return strings.Join(pieces, "|")
}
