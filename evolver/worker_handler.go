package main

import (
	"net/http"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

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
		r.GET("/organism", handler.GetTopOrganism)
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

func (handler *WorkerHandler) GetTopOrganism(ctx *gin.Context) {
	topOrganism := handler.incubator.GetTopOrganisms(1)[0]
	ctx.JSON(http.StatusOK, topOrganism)
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
