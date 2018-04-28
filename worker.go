package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
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

// WorkerHandler provides http handlers (designed for the gin framework) to
// check out work items and submit results
type WorkerHandler struct {
	incubator *Incubator
}

// Start begins listening on http port 8000 for external requests.
func (handler *WorkerHandler) Start() {
	go func() {
		r := gin.New()
		r.GET("/work-item", handler.GetWorkItem)
		r.POST("/result", handler.SubmitResult)
		r.GET("/target", handler.GetTargetImageData)
		http.ListenAndServe(":8000", r)
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

// for i := 0; i < runtime.NumCPU(); i++ {
// 	go func() {
// 		for {
// 			organism := <-orgChan
// 			if organism == nil {
// 				return
// 			}
// 			renderer := NewRenderer(incubator.target.Bounds().Size().X, incubator.target.Bounds().Size().Y)
// 			renderer.Render(organism.Instructions)
// 			renderedOrganism := renderer.GetImage()
// 			diff, _ := incubator.ranker.DistanceFromPrecalculated(renderedOrganism)
// 			organism.Diff = diff
// 		}
// 	}()
// }
