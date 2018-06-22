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
	exportQueue     chan *Organism
	lastImported    *Organism
	patchProcessor  *PatchProcessor
	outgoingPatches []*Patch
}

// NewWorkerPortal returns a new `WorkerPortal`
func NewWorkerPortal(workerClient *WorkerClient) *WorkerPortal {
	return &WorkerPortal{
		workerClient: workerClient,
		importQueue:  make(chan *Organism, 20),
		exportQueue:  make(chan *Organism, 100),
	}
}

// Init sets the top organism as a point of reference for
// exported organisms.
func (portal *WorkerPortal) Init(topOrganism *Organism) {
	portal.lastImported = topOrganism
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
			case organism := <-portal.exportQueue:
				portal.outgoingPatches = append(portal.outgoingPatches, organism.Patch)
			}
			// time.Sleep(time.Second * time.Duration(config.SyncFrequency))
			// portal.export()
			// portal._import()
		}
	}()
}

// Export will export an organism to the server. If the export queue is full, this method has no effect.
func (portal *WorkerPortal) Export(organism *Organism) {
	portal.exportQueue <- organism
}

func (portal *WorkerPortal) export() {
	if len(portal.outgoingPatches) == 0 {
		return
	}
	operations := []*PatchOperation{}
	for _, patch := range portal.outgoingPatches {
		operations = append(operations, patch.Operations...)
	}
	patch := &Patch{
		Baseline:   portal.outgoingPatches[0].Baseline,
		Target:     portal.outgoingPatches[len(portal.outgoingPatches)-1].Target,
		Operations: operations,
	}
	log.Printf("Exporting patch %v -> %v with %v operations", patch.Baseline, patch.Target, len(patch.Operations))
	err := portal.workerClient.SubmitOrganism(patch)
	if err != nil {
		log.Printf("Error submitting organism to server: '%v'", err.Error())
	}
	portal.outgoingPatches = portal.outgoingPatches[:0]
}

// Import returns the next organism from the server that is waiting for import.
// If the import queue is empty, nil is returned.
func (portal *WorkerPortal) Import() *Organism {
	select {
	case organism := <-portal.importQueue:
		return organism
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
				organism, err = portal.workerClient.GetTopOrganism()
			}
		} else {
			organism, err = portal.workerClient.GetTopOrganism()
			log.Printf("Delta not found, full import of %v", organism.Hash())
			if err != nil {
				log.Printf("Error importing organism: '%v'", err.Error())
			}
		}
	}

	if err != nil {
		log.Printf("Error getting organisms from server: '%v'", err.Error())
		return
	}
	if organism.Hash() != portal.lastImported.Hash() {
		log.Printf("Importing organism '%v'", organism.Hash())
		select {
		case portal.importQueue <- organism:
			portal.lastImported = organism
		default:
		}
	}
}
