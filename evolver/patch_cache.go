package main

import (
	"log"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// PatchCacheExpiration is the length of time until an organism expires from the cache.
const PatchCacheExpiration = time.Minute * 10

// PatchMaxLookupDepth is the maximum number of lookups that will be made in the
// cache for patches, when following ancestor lines.
const PatchMaxLookupDepth = 100

// PatchCache provides a way to cache organisms for a limited period of time.
type PatchCache struct {
	cache *gocache.Cache
}

// NewPatchCache returns a new `OrganismCache`
func NewPatchCache() *PatchCache {
	cache := new(PatchCache)
	cache.cache = gocache.New(PatchCacheExpiration, time.Minute)
	cache.cache.OnEvicted(func(key string, obj interface{}) {
		patch := obj.(*Patch)
		objectPool.ReturnPatch(patch)
	})
	return cache
}

// Put adds an organism to the cache
func (cache *PatchCache) Put(hash string, patch *Patch) {
	log.Printf("Cache: Put %v, target=%v, baseline=%v", hash, patch.Target, patch.Baseline)
	cache.cache.Set(hash, patch, gocache.DefaultExpiration)
}

// Get retrieves an organism from the cache, if present (returns organism, true).
// If not, nil (false) is returned.
func (cache *PatchCache) Get(hash string) (*Patch, bool) {
	item, found := cache.cache.Get(hash)
	if found {
		return item.(*Patch), found
	}
	log.Printf("Cache: Get %v (not found)", hash)
	return nil, false
}

// GetPatch iterates through the cache and tries to produce a combined
// patch that will transform the baseline organism into the target organism.
func (cache *PatchCache) GetPatch(baseline string, target string, verify bool) *Patch {
	log.Printf("Cache: GetPatch - baseline=%v, target=%v", baseline, target)
	patches := []*Patch{}
	baselinePatch, _ := cache.Get(target)

	depth := 0
	for baselinePatch != nil && depth < PatchMaxLookupDepth {
		log.Printf("Cache: traversing %v->%v, found=%v", baselinePatch.Target, baselinePatch.Baseline, baselinePatch.Target == baseline)
		if baselinePatch.Target == baseline {
			log.Println("Found baseline")
			break
		}
		patches = append(patches, baselinePatch)
		baselinePatch, _ = cache.Get(baselinePatch.Baseline)
		depth++
	}
	// This indicates that some organisms along the chain have been lost from the cache,
	// and the client should request a full list of instructions.
	if baselinePatch == nil || depth >= PatchMaxLookupDepth {
		if verify {
			log.Println("Did not find baseline, aborting")
			return nil
		}
	}
	log.Printf("Found %v patches", len(patches))
	patch := objectPool.BorrowPatch()
	// Traverse patches in reverse (starting at the oldest and working to newest)
	for i := len(patches) - 1; i >= 0; i-- {
		log.Printf("Patch %v - %v -> %v, %v operations", i, patches[i].Baseline, patches[i].Target, len(patches[i].Operations))
		for _, operation := range patches[i].Operations {
			patch.Operations = append(patch.Operations, operation)
		}
	}
	log.Printf("Creating new patch with %v operations", len(patch.Operations))
	patch.Baseline = baseline
	patch.Target = target
	return patch
}

// func (cache *OrganismCache) recordBadPatch(patch *Patch, original *Organism, expected *Organism, actual *Organism) {
// 	file, _ := os.Create("patch.txt")
// 	for i, operation := range patch.Operations {
// 		opData, _ := json.Marshal(operation)
// 		file.WriteString(fmt.Sprintf("%v - %v\n", i, string(opData)))
// 	}
// 	file.Close()
// 	file, _ = os.Create("original.txt")
// 	for i, instruction := range original.Instructions {
// 		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
// 	}
// 	file.Close()

// 	file, _ = os.Create("expected.txt")
// 	for i, instruction := range expected.Instructions {
// 		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
// 	}
// 	file.Close()

// 	file, _ = os.Create("actual.txt")
// 	for i, instruction := range actual.Instructions {
// 		file.WriteString(fmt.Sprintf("%v - %v\n", i, instruction.Hash()))
// 	}
// 	file.Close()
// }
