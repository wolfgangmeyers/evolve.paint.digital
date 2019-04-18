package main

import "fmt"

// FormatProgress formats an average pixel diff as a progress complete percentage.
func FormatProgress(diff float32) string {
	return fmt.Sprintf("%.15f%%", 100.0-((diff/maxImageDiff)*100))
}
