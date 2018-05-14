package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// Worker related items

// DefaultCount - Default number of work items delivered per batch
const DefaultCount = 20

// A WorkItem is a portable form of an organism that can be passed
// across the network for distributed evalutation.
type WorkItem struct {
	ID           string
	OrganismData []byte
}

// A WorkItemResult is a submitted ranking for an organism. These
// are returned from external worker processes.
type WorkItemResult struct {
	ID   string
	Diff float64
}

// WorkItemBatch is a container for a batch of WorkItems.
// Some day it may be used as an optimization
type WorkItemBatch struct {
	WorkItems []*WorkItem
}

// WorkItemResultBatch is a container for a batch of WorkItemResults.
// Some day it may be used as an optimization
type WorkItemResultBatch struct {
	WorkItemResults []*WorkItemResult
}

// WorkerHandler provides http handlers (designed for the gin framework) to
// check out work items and submit results
type WorkerHandler struct {
	incubator *Incubator
}

// NewWorkerHandler returns a new WorkerHandler
func NewWorkerHandler(incubator *Incubator) *WorkerHandler {
	handler := new(WorkerHandler)
	handler.incubator = incubator
	return handler
}

// Start begins listening on http port 8000 for external requests.
func (handler *WorkerHandler) Start() {
	go func() {
		r := gin.New()
		r.Use(gzip.Gzip(gzip.BestCompression))
		r.GET("/", func(ctx *gin.Context) {
			ctx.Data(http.StatusOK, "text/plain", []byte("Service is up!"))
		})
		// r.GET("/work-item", handler.GetWorkItem)
		// r.POST("/result", handler.SubmitResult)
		r.GET("/organisms", handler.GetTopOrganisms)
		r.POST("/organisms", handler.SubmitOrganisms)
		r.GET("/target", handler.GetTargetImageData)
		http.ListenAndServe("0.0.0.0:8000", r)
	}()
	time.Sleep(time.Millisecond * 100)
}

func (handler *WorkerHandler) GetTargetImageData(ctx *gin.Context) {
	imageData := handler.incubator.GetTargetImageData()
	ctx.Data(http.StatusOK, "image/png", imageData)
}

func (handler *WorkerHandler) GetTopOrganisms(ctx *gin.Context) {
	countStr := ctx.Query("count")
	count, err := strconv.ParseInt(countStr, 10, 32)
	if err != nil {
		count = 1
	}
	topOrganisms := handler.incubator.GetTopOrganisms(int(count))
	batch := &OrganismBatch{}
	batch.Save(topOrganisms)
	ctx.JSON(http.StatusOK, batch)
}

func (handler *WorkerHandler) SubmitOrganisms(ctx *gin.Context) {
	batch := &OrganismBatch{}
	err := ctx.BindJSON(batch)
	if err != nil {
		ctx.AbortWithError(http.StatusBadRequest, err)
	}
	organisms := batch.Restore()
	handler.incubator.SubmitOrganisms(organisms)
}

// WorkerClient is a client to access the http api of the main server.
type WorkerClient struct {
	endpoint string
}

func NewWorkerClient(endpoint string) *WorkerClient {
	client := new(WorkerClient)
	client.endpoint = endpoint
	return client
}

func (client *WorkerClient) GetTopOrganisms(count int) ([]*Organism, error) {
	resp, err := http.Get(fmt.Sprintf("%v/organisms?count=%v", client.endpoint, count))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	batch := &OrganismBatch{}
	err = json.Unmarshal(data, batch)
	if err != nil {
		return nil, err
	}
	return batch.Restore(), nil
}

func (client *WorkerClient) SubmitOrganisms(organisms []*Organism) error {
	batch := &OrganismBatch{}
	batch.Save(organisms)
	data, err := json.Marshal(batch)
	if err != nil {
		return err
	}
	_, err = http.Post(fmt.Sprintf("%v/organisms", client.endpoint), "application/json", bytes.NewReader(data))
	return err
}

func (client *WorkerClient) GetTargetImageData() ([]byte, error) {
	resp, err := http.Get(fmt.Sprintf("%v/target", client.endpoint))
	if err != nil {
		return nil, err
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return data, nil
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
				renderer.Render(organism.Instructions)
				renderedOrganism := renderer.GetImage()
				diff, _ := worker.ranker.DistanceFromPrecalculated(renderedOrganism)
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
	organismGenerator func(workItem *WorkItem) *Organism,
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
