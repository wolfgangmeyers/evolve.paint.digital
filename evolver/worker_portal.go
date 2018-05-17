package main

import (
	"log"
	"sort"
	"time"
)

// A WorkerPortal serves as a way for organisms to go to and from the
// server during the lifetime of the worker process.
type WorkerPortal struct {
	workerClient *WorkerClient
	importQueue  chan *Organism
	exportQueue  chan *Organism
	recorded     map[string]bool
}

// NewWorkerPortal returns a new `WorkerPortal`
func NewWorkerPortal(workerClient *WorkerClient) *WorkerPortal {
	return &WorkerPortal{
		workerClient: workerClient,
		importQueue:  make(chan *Organism, 20),
		exportQueue:  make(chan *Organism, 20),
		recorded:     map[string]bool{},
	}
}

// Start kicks off the Portal background thread
func (portal *WorkerPortal) Start() {
	go func() {
		for {
			time.Sleep(time.Second * time.Duration(config.SyncFrequency))
			portal.export()
			portal._import()
		}
	}()
}

// Export will export an organism to the server. If the export queue is full, this method has no effect.
func (portal *WorkerPortal) Export(organism *Organism) {
	select {
	case portal.exportQueue <- organism:
	default:
	}
}

func (portal *WorkerPortal) export() {
	if len(portal.exportQueue) == 0 {
		return
	}
	exporting := make([]*Organism, len(portal.exportQueue))
	for organism := range portal.exportQueue {
		if !portal.recorded[organism.Hash()] {
			exporting = append(exporting, organism)
			portal.recorded[organism.Hash()] = true
		}
	}
	if len(exporting) > config.SyncAmount {
		sort.Sort(OrganismList(exporting))
		exporting = exporting[:config.SyncAmount]
	}
	err := portal.workerClient.SubmitOrganisms(exporting)
	if err != nil {
		log.Printf("Error submitting organisms to server: '%v'", err.Error())
	}
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
	organisms, err := portal.workerClient.GetTopOrganisms(config.SyncAmount)
	if err != nil {
		log.Printf("Error getting organisms from server: '%v'", err.Error())
	}
	for _, organism := range organisms {
		if !portal.recorded[organism.Hash()] {
			select {
			case portal.importQueue <- organism:
				portal.recorded[organism.Hash()] = true
			default:
			}
		}
	}
}
