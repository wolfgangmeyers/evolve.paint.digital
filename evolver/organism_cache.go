package main

import (
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
	cache.cache.Set(hash, organism, gocache.DefaultExpiration)
}

// Get retrieves an organism from the cache, if present (returns organism, true).
// If not, nil (false) is returned.
func (cache *OrganismCache) Get(hash string) (*Organism, bool) {
	item, found := cache.cache.Get(hash)
	if found {
		return item.(*Organism), true
	}
	return nil, false
}
