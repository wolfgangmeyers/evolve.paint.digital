package main

import (
	"log"
	"runtime"
)

// Worker related items

// A WorkItemResult is a submitted ranking for an organism. These
// are returned from external worker processes.
type WorkItemResult struct {
	ID   string
	Diff float32
}

// WorkItemResultBatch is a container for a batch of WorkItemResults.
// Some day it may be used as an optimization
type WorkItemResultBatch struct {
	WorkItemResults []*WorkItemResult
}

// A Worker allows the evolver system to run logic on multiple CPU cores effectively.
type Worker struct {
	imageWidth     int
	imageHeight    int
	ranker         *Ranker
	inputChan      <-chan *Organism
	outputChan     chan<- *WorkItemResult
	saveChan       <-chan *Organism
	saveResultChan chan<- []byte
	loadChan       <-chan []byte
	loadResultChan chan<- *Organism
}

// NewWorker returns a new `Worker`
func NewWorker(
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	inputChan <-chan *Organism,
	outputChan chan<- *WorkItemResult,
	saveChan <-chan *Organism,
	saveResultChan chan<- []byte,
	loadChan <-chan []byte,
	loadResultChan chan<- *Organism,
) *Worker {
	worker := new(Worker)
	worker.imageWidth = imageWidth
	worker.imageHeight = imageHeight
	worker.ranker = ranker
	worker.inputChan = inputChan
	worker.outputChan = outputChan
	worker.saveChan = saveChan
	worker.saveResultChan = saveResultChan
	worker.loadChan = loadChan
	worker.loadResultChan = loadResultChan
	return worker
}

func (worker *Worker) Start() {
	go func() {
		for {
			select {
			case organism := <-worker.inputChan:
				renderer := NewRenderer(worker.imageWidth, worker.imageHeight)

				// optimization - possible to calculate diff with far less
				// rendering and comparison if the organism has a parent.

				if organism.Parent == nil || organism.AffectedArea == (Rect{}) {
					renderer.Render(organism.Instructions)
				} else {
					renderer.RenderBounds(organism.Instructions, &organism.AffectedArea)
				}

				renderedOrganism := renderer.GetImage()

				var diff float32
				if organism.Parent == nil || organism.AffectedArea == (Rect{}) {
					diff, _ = worker.ranker.DistanceFromPrecalculated(renderedOrganism)
				} else {
					parentRenderer := NewRenderer(worker.imageWidth, worker.imageHeight)
					parentRenderer.RenderBounds(organism.Parent.Instructions, &organism.AffectedArea)
					renderedParent := parentRenderer.GetImage()

					diff, _ = worker.ranker.DistanceFromPrecalculatedBounds(renderedOrganism, &organism.AffectedArea)
					parentDiff, _ := worker.ranker.DistanceFromPrecalculatedBounds(renderedParent, &organism.AffectedArea)
					if diff < parentDiff {

						renderer.Render(organism.Instructions)
						renderedOrganism = renderer.GetImage()
						diff, _ = worker.ranker.DistanceFromPrecalculated(renderedOrganism)
					} else {
						// This isn't an improvement so don't bother with it.
						diff = organism.Parent.Diff + 1
					}
				}

				workItemResult := &WorkItemResult{
					ID:   organism.Hash(),
					Diff: diff,
				}
				worker.outputChan <- workItemResult
			case organism := <-worker.saveChan:
				saved := organism.Save()
				worker.saveResultChan <- saved
			case saved := <-worker.loadChan:
				if len(saved) == 0 {
					worker.loadResultChan <- nil
				} else {
					organism := &Organism{}
					organism.Load(saved)
					worker.loadResultChan <- organism
				}
			}

		}
	}()
}

// A WorkerPool provides a multithreaded pool of workers
type WorkerPool struct {
	imageWidth     int
	imageHeight    int
	ranker         *Ranker
	inputChan      <-chan *Organism
	outputChan     chan<- *WorkItemResult
	saveChan       <-chan *Organism
	saveResultChan chan<- []byte
	loadChan       <-chan []byte
	loadResultChan chan<- *Organism
	numWorkers     int
}

// NewWorkerPool returns a new WorkerPool
func NewWorkerPool(
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	inputChan <-chan *Organism,
	outputChan chan<- *WorkItemResult,
	saveChan <-chan *Organism,
	saveResultChan chan<- []byte,
	loadChan <-chan []byte,
	loadResultChan chan<- *Organism,
	numWorkers int,
) *WorkerPool {
	pool := new(WorkerPool)
	pool.imageWidth = imageWidth
	pool.imageHeight = imageHeight
	pool.ranker = ranker
	pool.inputChan = inputChan
	pool.outputChan = outputChan
	pool.numWorkers = numWorkers
	pool.saveChan = saveChan
	pool.saveResultChan = saveResultChan
	pool.loadChan = loadChan
	pool.loadResultChan = loadResultChan
	return pool
}

func (pool *WorkerPool) Start() {
	numWorkers := pool.numWorkers
	if numWorkers <= 0 {
		numWorkers = runtime.NumCPU()
	}
	log.Printf("Starting up %v workers", numWorkers)
	for i := 0; i < numWorkers; i++ {
		NewWorker(
			pool.imageWidth,
			pool.imageHeight,
			pool.ranker,
			pool.inputChan,
			pool.outputChan,
			pool.saveChan,
			pool.saveResultChan,
			pool.loadChan,
			pool.loadResultChan,
		).Start()
	}
}
