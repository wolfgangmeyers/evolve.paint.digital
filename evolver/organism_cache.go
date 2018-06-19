package main

import (
	json "encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// OrganismCacheExpiration is the length of time until an organism expires from the cache.
const OrganismCacheExpiration = time.Minute

// OrganismCache provides a way to cache organisms for a limited period of time.
type OrganismCache struct {
	cache *gocache.Cache
}

// NewOrganismCache returns a new `OrganismCache`
func NewOrganismCache() *OrganismCache {
	cache := new(OrganismCache)
	cache.cache = gocache.New(time.Minute, time.Minute)
	return cache
}

// Put adds an organism to the cache
func (cache *OrganismCache) Put(hash string, organism *Organism) {
	// log.Printf("Cache: Put %v", hash)
	cache.cache.Set(hash, organism, gocache.DefaultExpiration)
}

// Get retrieves an organism from the cache, if present (returns organism, true).
// If not, nil (false) is returned.
func (cache *OrganismCache) Get(hash string) (*Organism, bool) {
	item, found := cache.cache.Get(hash)
	if found {
		// log.Printf("Cache: Get %v (found)", hash)
		return item.(*Organism), true
	}
	// log.Printf("Cache: Get %v (not found)", hash)
	return nil, false
}

// GetPatch iterates through the cache and tries to produce a combined
// patch that will transform the baseline organism into the target organism.
func (cache *OrganismCache) GetPatch(baseline string, target string) *Patch {
	log.Printf("Cache: GetPatch - baseline=%v, target=%v", baseline, target)
	patches := []*Patch{}
	baselineOrganism, _ := cache.Get(target)
	targetOrganism := baselineOrganism

	for baselineOrganism != nil {
		// log.Printf("Cache: traversing %v", baselineOrganism.Hash())
		if baselineOrganism.Hash() == baseline {
			// log.Println("Found baseline")
			break
		}
		patches = append(patches, baselineOrganism.Patch)
		baselineOrganism, _ = cache.Get(baselineOrganism.Patch.Baseline)
	}
	// This indicates that some organisms along the chain have been lost from the cache,
	// and the client should request a full list of instructions.
	if baselineOrganism == nil {
		log.Println("Did not find baseline")
		return nil
	}
	log.Printf("Found %v patches", len(patches))
	operations := []*PatchOperation{}
	// Traverse patches in reverse (starting at the oldest and working to newest)
	for i := len(patches) - 1; i >= 0; i-- {
		// log.Printf("Patch %v - %v -> %v, %v operations", i, patches[i].Baseline, patches[i].Target, len(patches[i].Operations))
		for _, operation := range patches[i].Operations {
			operations = append(operations, operation)
		}
	}
	// log.Printf("Creating new patch with %v operations", len(operations))
	patch := &Patch{
		Operations: operations,
		Baseline:   baseline,
		Target:     target,
	}
	// verify patch
	organism := baselineOrganism.Clone()
	organism.hash = ""
	for _, operation := range patch.Operations {
		operation.Apply(organism)
	}
	if organism.Hash() != target {
		cache.recordBadPatch(patch, baselineOrganism, targetOrganism, organism)
		log.Printf("Error verifying patch for '%v' -> '%v', got '%v' instead", baseline, target, organism.Hash())
		return nil
	}
	return patch
}

func (cache *OrganismCache) recordBadPatch(patch *Patch, original *Organism, expected *Organism, actual *Organism) {
	file, _ := os.Create("patch.txt")
	for i, operation := range patch.Operations {
		opData, _ := json.Marshal(operation)
		file.WriteString(fmt.Sprintf("%v - %v\n", i, string(opData)))
	}
	file.Close()
	file, _ = os.Create("original.txt")
	for i, instruction := range original.Instructions {
		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
	}
	file.Close()

	file, _ = os.Create("expected.txt")
	for i, instruction := range expected.Instructions {
		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
	}
	file.Close()

	file, _ = os.Create("actual.txt")
	for i, instruction := range actual.Instructions {
		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
	}
	file.Close()
}
