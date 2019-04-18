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
	workerID        int
	imageWidth      int
	imageHeight     int
	ranker          *Ranker
	cloneChan       <-chan *Organism
	cloneResultChan chan<- *Organism
	hashChan        <-chan *Organism
	hashResultChan  chan<- bool
	rankChan        <-chan *Organism
	rankResultChan  chan<- WorkItemResult
	saveChan        <-chan *Organism
	saveResultChan  chan<- []byte
	loadChan        <-chan []byte
	loadResultChan  chan<- *Organism
}

// NewWorker returns a new `Worker`
func NewWorker(
	workerID int,
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	cloneChan <-chan *Organism,
	cloneResultChan chan<- *Organism,
	hashChan <-chan *Organism,
	hashResultChan chan<- bool,
	rankChan <-chan *Organism,
	rankResultChan chan<- WorkItemResult,
	saveChan <-chan *Organism,
	saveResultChan chan<- []byte,
	loadChan <-chan []byte,
	loadResultChan chan<- *Organism,
) *Worker {
	worker := new(Worker)
	worker.workerID = workerID
	worker.imageWidth = imageWidth
	worker.imageHeight = imageHeight
	worker.ranker = ranker
	worker.cloneChan = cloneChan
	worker.cloneResultChan = cloneResultChan
	worker.hashChan = hashChan
	worker.hashResultChan = hashResultChan
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
				// log.Printf(
				// 	"Worker %v processing organism %p, diffmap=%p, diff=%v, diffmap-avg=%v",
				// 	worker.workerID, organism, organism.diffMap, organism.Diff, organism.diffMap.GetAverageDiff())
				renderer := objectPool.BorrowRenderer()
				// renderer := NewRenderer(worker.imageWidth, worker.imageHeight)

				// optimization - possible to calculate diff with far less
				// rendering and comparison if the organism has a parent.

				if organism.Parent == nil || len(organism.AffectedAreas) == 0 {
					renderer.Render(organism.Instructions)
				} else {
					renderer.RenderBounds(organism.Instructions, organism.AffectedAreas)
				}

				renderedOrganism := renderer.GetImage()

				var diff float32
				if organism.Parent == nil || len(organism.AffectedAreas) == 0 {
					diff, _ = worker.ranker.DistanceFromPrecalculated(renderedOrganism, organism.diffMap)
				} else {
					// There is a ton of troubleshooting code here. In case the drift comes back
					// re-enable all of this for debugging. Sorry for the code noise :(

					// initialDiff := organism.diffMap.GetAverageDiff()
					diff, _ = worker.ranker.DistanceFromPrecalculatedBounds(renderedOrganism, organism.AffectedAreas, organism.diffMap)
					// // if this is an improvement, make sure to update the entire diffmap
					// // this prevents the state of the diffmap from drifting and providing
					// // a false diff value. Some day the drift may be fixed so that this isn't necessary...
					// if diff < initialDiff {
					// 	tmp := diff
					// 	organism.diffMap.RecalculateTotal()
					// 	tmp2 := organism.diffMap.GetAverageDiff()
					// 	organism.diffMap.Clear()
					// 	renderer.Render(organism.Instructions)
					// 	renderedOrganism = renderer.GetImage()
					// 	diff, _ = worker.ranker.DistanceFromPrecalculated(renderedOrganism, organism.diffMap)
					// 	log.Printf(
					// 		"initial=%v, new=%v, new-recalc=%v, checked=%v, org=%p, hash=%v",
					// 		initialDiff, tmp, tmp2, diff, organism, organism.Hash())
					// }
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
			case organism := <-worker.hashChan:
				organism.Hash()
				worker.hashResultChan <- true
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
	hashChan        <-chan *Organism
	hashResultChan  chan<- bool
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
	hashChan <-chan *Organism,
	hashResultChan chan<- bool,
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
	pool.hashChan = hashChan
	pool.hashResultChan = hashResultChan
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
			i,
			pool.imageWidth,
			pool.imageHeight,
			pool.ranker,
			pool.cloneChan,
			pool.cloneResultChan,
			pool.hashChan,
			pool.hashResultChan,
			pool.rankChan,
			pool.rankResultChan,
			pool.saveChan,
			pool.saveResultChan,
			pool.loadChan,
			pool.loadResultChan,
		).Start()
	}
}
