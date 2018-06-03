package main

import (
	"net/http"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// keep limited history of top organism, in order to send out patches
// apply incoming patch to current top organism
// send out top organism as patch, using history as reference (along with expected hash)

// ServerPortal provides http handlers (designed for the gin framework) to
// check out work items and submit results
type ServerPortal struct {
	incubator     *Incubator
	organismCache *OrganismCache

	// communication channels
	topOrganismChan  chan *GetOrganismRequest
	organismHashChan chan *GetOrganismByHashRequest
}

// NewServerPortal returns a new ServerPortal
func NewServerPortal(incubator *Incubator) *ServerPortal {
	handler := new(ServerPortal)
	handler.incubator = incubator
	handler.organismCache = NewOrganismCache()
	return handler
}

// Start begins listening on http port 8000 for external requests.
func (handler *ServerPortal) Start() {
	handler.startRequestHandler()
	handler.startBackgroundRoutine()
}

func (handler *ServerPortal) startBackgroundRoutine() {
	go func() {
		var topOrganism *Organism
		for {
			select {
			case req := <-handler.topOrganismChan:
				req.Callback <- topOrganism
			case req := <-handler.organismHashChan:
				organism, _ := handler.organismCache.Get(req.Hash)
				req.Callback <- organism
				// TODO: time.Ticker to update top organism, every second.
				// when top organism changes, put the old one in the cache.
			}
		}
	}()
}

func (handler *ServerPortal) startRequestHandler() {
	// Http handler
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

func (handler *ServerPortal) GetTargetImageData(ctx *gin.Context) {
	imageData := handler.incubator.GetTargetImageData()
	ctx.Data(http.StatusOK, "image/png", imageData)
}

func (handler *ServerPortal) GetTopOrganism(ctx *gin.Context) {
	topOrganism := handler.incubator.GetTopOrganism()
	ctx.JSON(http.StatusOK, topOrganism)
}

func (handler *ServerPortal) SubmitOrganisms(ctx *gin.Context) {
	batch := &OrganismBatch{}
	err := ctx.BindJSON(batch)
	if err != nil {
		ctx.AbortWithError(http.StatusBadRequest, err)
	}
	organisms := batch.Restore()
	handler.incubator.SubmitOrganisms(organisms)
}

// GetOrganismByHashRequest is used to retrieve organsims from the cache by Hash
type GetOrganismByHashRequest struct {
	Hash     string
	Callback chan<- *Organism
}
