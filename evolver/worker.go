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

// A Worker allows the evolver system to run logic on multiple CPU cores effectively.
type Worker struct {
	imageWidth      int
	imageHeight     int
	ranker          *Ranker
	cloneChan       <-chan *Organism
	cloneResultChan chan<- *Organism
	rankChan        <-chan *Organism
	rankResultChan  chan<- WorkItemResult
	saveChan        <-chan *Organism
	saveResultChan  chan<- []byte
	loadChan        <-chan []byte
	loadResultChan  chan<- *Organism
}

// NewWorker returns a new `Worker`
func NewWorker(
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	cloneChan <-chan *Organism,
	cloneResultChan chan<- *Organism,
	rankChan <-chan *Organism,
	rankResultChan chan<- WorkItemResult,
	saveChan <-chan *Organism,
	saveResultChan chan<- []byte,
	loadChan <-chan []byte,
	loadResultChan chan<- *Organism,
) *Worker {
	worker := new(Worker)
	worker.imageWidth = imageWidth
	worker.imageHeight = imageHeight
	worker.ranker = ranker
	worker.cloneChan = cloneChan
	worker.cloneResultChan = cloneResultChan
	worker.rankChan = rankChan
	worker.rankResultChan = rankResultChan
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
			case organism := <-worker.rankChan:
				renderer := objectPool.BorrowRenderer()
				// renderer := NewRenderer(worker.imageWidth, worker.imageHeight)

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
					diff, _ = worker.ranker.DistanceFromPrecalculated(renderedOrganism, organism.diffMap)
				} else {
					diff, _ = worker.ranker.DistanceFromPrecalculatedBounds(renderedOrganism, &organism.AffectedArea, organism.diffMap)
				}
				objectPool.ReturnRenderer(renderer)
				workItemResult := WorkItemResult{
					ID:   organism.Hash(),
					Diff: diff,
				}
				worker.rankResultChan <- workItemResult
			case organism := <-worker.saveChan:
				saved := organism.Save()
				worker.saveResultChan <- saved
			case organism := <-worker.cloneChan:
				cloned := organism.Clone()
				worker.cloneResultChan <- cloned
			case saved := <-worker.loadChan:
				if len(saved) == 0 {
					worker.loadResultChan <- nil
				} else {
					organism := objectPool.BorrowOrganism()
					organism.Load(saved)
					worker.loadResultChan <- organism
				}
			}

		}
	}()
}

// A WorkerPool provides a multithreaded pool of workers
type WorkerPool struct {
	imageWidth      int
	imageHeight     int
	ranker          *Ranker
	cloneChan       <-chan *Organism
	cloneResultChan chan<- *Organism
	rankChan        <-chan *Organism
	rankResultChan  chan<- WorkItemResult
	saveChan        <-chan *Organism
	saveResultChan  chan<- []byte
	loadChan        <-chan []byte
	loadResultChan  chan<- *Organism
	numWorkers      int
}

// NewWorkerPool returns a new WorkerPool
func NewWorkerPool(
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	cloneChan <-chan *Organism,
	cloneResultChan chan<- *Organism,
	rankChan <-chan *Organism,
	rankResultChan chan<- WorkItemResult,
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
	pool.cloneChan = cloneChan
	pool.cloneResultChan = cloneResultChan
	pool.rankChan = rankChan
	pool.rankResultChan = rankResultChan
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
			pool.cloneChan,
			pool.cloneResultChan,
			pool.rankChan,
			pool.rankResultChan,
			pool.saveChan,
			pool.saveResultChan,
			pool.loadChan,
			pool.loadResultChan,
		).Start()
	}
}
