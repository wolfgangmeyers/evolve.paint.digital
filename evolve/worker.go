package evolve

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
)

// Worker related items

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
		r.GET("/", func(ctx *gin.Context) {
			ctx.Data(http.StatusOK, "text/plain", []byte("Service is up!"))
		})
		r.GET("/work-item", handler.GetWorkItem)
		r.POST("/result", handler.SubmitResult)
		r.GET("/target", handler.GetTargetImageData)
		http.ListenAndServe("0.0.0.0:8000", r)
	}()
	time.Sleep(time.Millisecond * 100)
}

func (handler *WorkerHandler) GetWorkItem(ctx *gin.Context) {
	workItem := handler.incubator.GetWorkItem()
	ctx.JSON(http.StatusOK, workItem)
}

func (handler *WorkerHandler) SubmitResult(ctx *gin.Context) {
	workItemResult := &WorkItemResult{}
	err := ctx.BindJSON(workItemResult)
	if err != nil {
		ctx.AbortWithError(http.StatusUnprocessableEntity, err)
	}
	handler.incubator.SubmitResult(workItemResult)
}

func (handler *WorkerHandler) GetTargetImageData(ctx *gin.Context) {
	imageData := handler.incubator.GetTargetImageData()
	ctx.Data(http.StatusOK, "image/png", imageData)
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

func (client *WorkerClient) GetWorkItem() (*WorkItem, error) {
	resp, err := http.Get(fmt.Sprintf("%v/work-item", client.endpoint))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	workItem := &WorkItem{}
	err = json.Unmarshal(data, workItem)
	if err != nil {
		return nil, err
	}
	return workItem, nil
}

func (client *WorkerClient) SubmitResult(workItemResult *WorkItemResult) error {
	data, err := json.Marshal(workItemResult)
	if err != nil {
		return err
	}
	_, err = http.Post(fmt.Sprintf("%v/result", client.endpoint), "application/json", bytes.NewReader(data))
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

type Worker struct {
	imageWidth  int
	imageHeight int
	ranker      *Ranker
	inputChan   <-chan *WorkItem
	outputChan  chan<- *WorkItemResult
}

func NewWorker(imageWidth int, imageHeight int, ranker *Ranker, inputChan <-chan *WorkItem, outputChan chan<- *WorkItemResult) *Worker {
	worker := new(Worker)
	worker.imageWidth = imageWidth
	worker.imageHeight = imageHeight
	worker.ranker = ranker
	worker.inputChan = inputChan
	worker.outputChan = outputChan
	return worker
}

func (worker *Worker) Start() {
	go func() {
		for {
			workItem := <-worker.inputChan
			organism := &Organism{}
			organism.Load(workItem.OrganismData)
			renderer := NewRenderer(worker.imageWidth, worker.imageHeight)
			renderer.Render(organism.Instructions)
			renderedOrganism := renderer.GetImage()
			diff, _ := worker.ranker.DistanceFromPrecalculated(renderedOrganism)
			workItemResult := &WorkItemResult{
				ID:   workItem.ID,
				Diff: diff,
			}
			worker.outputChan <- workItemResult
		}
	}()
}

// A WorkerPool provides a multithreaded pool of workers
type WorkerPool struct {
	imageWidth        int
	imageHeight       int
	ranker            *Ranker
	inputChan         <-chan *WorkItem
	outputChan        chan<- *WorkItemResult
	numWorkers        int
	organismGenerator func(workItem *WorkItem) *Organism
}

// NewWorkerPool returns a new WorkerPool
func NewWorkerPool(
	imageWidth int,
	imageHeight int,
	ranker *Ranker,
	inputChan <-chan *WorkItem,
	outputChan chan<- *WorkItemResult,
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
	pool.organismGenerator = organismGenerator
	if pool.organismGenerator == nil {
		pool.organismGenerator = func(workItem *WorkItem) *Organism {
			organism := &Organism{}
			organism.Load(workItem.OrganismData)
			return organism
		}
	}
	return pool
}

func (pool *WorkerPool) Start() {
	numWorkers := pool.numWorkers
	if numWorkers <= 0 {
		numWorkers = runtime.NumCPU()
	}
	for i := 0; i < numWorkers; i++ {
		NewWorker(pool.imageWidth, pool.imageHeight, pool.ranker, pool.inputChan, pool.outputChan).Start()
	}
}
