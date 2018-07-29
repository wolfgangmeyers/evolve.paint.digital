package main

import (
	"log"
	"time"
)

// TODO: keep track of last imported from the server, use as reference to get latest as patch
// and to send out patches.
// handle patch response and whole organism response, last might be out of date
// increase frequency of polls
// Report hash mismatch as error on incoming organisms, make second call to get latest as whole organism

// A WorkerPortal serves as a way for organisms to go to and from the
// server during the lifetime of the worker process.
type WorkerPortal struct {
	workerClient    *WorkerClient
	importQueue     chan *Organism
	exportQueue     chan *Patch
	lastImported    *Organism
	patchProcessor  *PatchProcessor
	outgoingPatches []*Patch
}

// NewWorkerPortal returns a new `WorkerPortal`
func NewWorkerPortal(workerClient *WorkerClient) *WorkerPortal {
	return &WorkerPortal{
		workerClient: workerClient,
		importQueue:  make(chan *Organism, 20),
		exportQueue:  make(chan *Patch, 100),
	}
}

// Init sets the top organism as a point of reference for
// exported organisms.
func (portal *WorkerPortal) Init(topOrganism *Organism) {
	portal.lastImported = topOrganism.Clone()
	log.Printf("Init - organism=%v", topOrganism.Hash())
}

// Start kicks off the Portal background thread
func (portal *WorkerPortal) Start() {
	go func() {
		ticker := time.NewTicker(time.Second * time.Duration(config.SyncFrequency))
		for {
			select {
			case <-ticker.C:
				portal.export()
				portal._import()
			case patch := <-portal.exportQueue:
				portal.outgoingPatches = append(portal.outgoingPatches, patch)
			}
			// time.Sleep(time.Second * time.Duration(config.SyncFrequency))
			// portal.export()
			// portal._import()
		}
	}()
}

// Export will export an organism to the server.
func (portal *WorkerPortal) Export(organism *Organism) {
	if organism.Patch == nil {
		log.Printf("Error: cannot export organism '%v' without patch", organism.Hash())
		return
	}
	portal.exportQueue <- organism.Patch.Clone()
}

func (portal *WorkerPortal) export() {
	if len(portal.outgoingPatches) == 0 {
		return
	}
	newPatch := objectPool.BorrowPatch()
	for _, patch := range portal.outgoingPatches {
		newPatch.Operations = append(newPatch.Operations, patch.Operations...)
	}
	newPatch.Baseline = portal.outgoingPatches[0].Baseline
	newPatch.Target = portal.outgoingPatches[len(portal.outgoingPatches)-1].Target
	log.Printf("Exporting patch %v -> %v with %v operations", newPatch.Baseline, newPatch.Target, len(newPatch.Operations))
	err := portal.workerClient.SubmitOrganism(newPatch)
	if err != nil {
		log.Printf("Error submitting organism to server: '%v'", err.Error())
	}
	objectPool.ReturnPatch(newPatch)
	for _, patch := range portal.outgoingPatches {
		objectPool.ReturnPatch(patch)
	}
	portal.outgoingPatches = portal.outgoingPatches[:0]
}

// Import returns the next organism from the server that is waiting for import.
// If the import queue is empty, nil is returned.
func (portal *WorkerPortal) Import() *Organism {
	select {
	case organism := <-portal.importQueue:
		// Get a deep copy, this organism needs to be disposed of by the portal
		imported := organism.Clone()
		if organism.Patch != nil {
			imported.Patch = organism.Patch.Clone()
		}
		return imported
	default:
		return nil
	}
}

func (portal *WorkerPortal) _import() {
	var organism *Organism
	var delta *GetOrganismDeltaResponse
	var err error
	if portal.lastImported == nil {
		organism, err = portal.workerClient.GetTopOrganism()
		log.Printf("Full import of %v", organism.Hash())
	} else {
		delta, err = portal.workerClient.GetTopOrganismDelta(portal.lastImported.Hash())
		if err == nil && delta != nil && delta.Patch != nil {
			log.Printf("Importing %v -> %v, %v operations...", portal.lastImported.Hash(), delta.Hash, len(delta.Patch.Operations))
			if len(delta.Patch.Operations) == 0 {
				// No updates from server since last import
				return
			}
			organism = portal.patchProcessor.ProcessPatch(portal.lastImported, delta.Patch)
			if organism.Hash() != delta.Hash {
				log.Printf("Error importing organism: expected hash=%v, actual=%v", delta.Hash, organism.Hash())
				objectPool.ReturnPatch(organism.Patch)
				objectPool.ReturnOrganism(organism)
				organism, err = portal.workerClient.GetTopOrganism()
			}
		} else if err != nil {
			log.Printf("Error getting top organism delta for '%v' -> '%v'", portal.lastImported.Hash(), err.Error())
			organism, err = portal.workerClient.GetTopOrganism()
			if err == nil {
				log.Printf("Delta not found, full import of %v", organism.Hash())
			} else {
				log.Printf("Error importing organism: '%v'", err.Error())
			}
		}
	}

	if err != nil {
		log.Printf("Error getting organisms from server: '%v'", err.Error())
		return
	}
	if organism != nil && organism.Hash() != portal.lastImported.Hash() {
		log.Printf("Importing organism '%v'", organism.Hash())
		select {
		case portal.importQueue <- organism:
			objectPool.ReturnPatch(portal.lastImported.Patch)
			objectPool.ReturnOrganism(portal.lastImported)
			portal.lastImported = organism
			log.Printf("WorkerPortal: lastImported='%v'", portal.lastImported.Hash())
		default:
			log.Printf("Could not import, full queue")
			objectPool.ReturnPatch(organism.Patch)
			objectPool.ReturnOrganism(organism)
		}
	}
}
