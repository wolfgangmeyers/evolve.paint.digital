package main

import (
	"log"
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
	incubator      *Incubator
	organismCache  *OrganismCache
	patchGenerator *PatchGenerator
	patchProcessor *PatchProcessor

	// communication channels
	organismHashChan chan *GetOrganismByHashRequest
	updateChan       chan *UpdateRequest
}

// NewServerPortal returns a new ServerPortal
func NewServerPortal(incubator *Incubator) *ServerPortal {
	handler := new(ServerPortal)
	handler.incubator = incubator
	handler.patchGenerator = &PatchGenerator{}
	handler.patchProcessor = &PatchProcessor{}
	handler.organismCache = NewOrganismCache()
	handler.organismHashChan = make(chan *GetOrganismByHashRequest)
	handler.updateChan = make(chan *UpdateRequest)
	return handler
}

// Start begins listening on http port 8000 for external requests.
func (handler *ServerPortal) Start() {
	handler.startRequestHandler()
	handler.startBackgroundRoutine()
}

func (handler *ServerPortal) startBackgroundRoutine() {
	go func() {
		for {
			select {
			case req := <-handler.organismHashChan:
				organism, _ := handler.organismCache.Get(req.Hash)
				req.Callback <- organism
			case req := <-handler.updateChan:
				topOrganism := handler.incubator.GetTopOrganism()
				handler.organismCache.Put(topOrganism.Hash(), topOrganism)
				log.Printf("top=%v", topOrganism.Hash())
				req.Callback <- true
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
		r.GET("/organism/delta", handler.GetTopOrganismDelta)
		r.GET("/organism", handler.GetTopOrganism)
		r.POST("/organism", handler.SubmitOrganism)
		r.GET("/target", handler.GetTargetImageData)
		http.ListenAndServe("0.0.0.0:8000", r)
	}()
	time.Sleep(time.Millisecond * 100)
}

// Update makes sure that the current top organism is cached.
func (handler *ServerPortal) Update() {
	callback := make(chan bool)
	handler.updateChan <- &UpdateRequest{
		Callback: callback,
	}
	<-callback
}

func (handler *ServerPortal) GetTargetImageData(ctx *gin.Context) {
	imageData := handler.incubator.GetTargetImageData()
	ctx.Data(http.StatusOK, "image/png", imageData)
}

func (handler *ServerPortal) GetTopOrganism(ctx *gin.Context) {
	hashOnly := ctx.Query("hashonly") == "true"
	topOrganism := handler.incubator.GetTopOrganism()
	if hashOnly {
		ctx.Data(http.StatusOK, "text/plain", []byte(topOrganism.Hash()))
	} else {
		// TODO: change to SaveV2 at some point
		ctx.Data(http.StatusOK, "application/binary", topOrganism.Save())
	}
}

func (handler *ServerPortal) GetTopOrganismDelta(ctx *gin.Context) {
	log.Println("GetTopOrganismDelta called")
	patch := &Patch{
		Operations: []*PatchOperation{},
	}
	log.Println("1")
	previous := ctx.Query("previous")
	log.Printf("previous=%v", previous)
	topOrganism := handler.incubator.GetTopOrganism()
	log.Println("2")
	if topOrganism == nil {
		ctx.JSON(http.StatusNotFound, nil)
		return
	}
	log.Println("3")
	// No updates
	if topOrganism.Hash() == previous {
		ctx.JSON(http.StatusOK, patch)
		return
	}
	log.Println("4")
	callback := make(chan *Organism)
	handler.organismHashChan <- &GetOrganismByHashRequest{
		Hash:     previous,
		Callback: callback,
	}
	log.Println("5")
	previousOrganism := <-callback
	log.Println("6")
	if previousOrganism == nil {
		ctx.JSON(http.StatusNotFound, map[string]interface{}{"Message": "Previous organism not found"})
		return
	}
	log.Println("7")
	patch = handler.patchGenerator.GeneratePatch(previousOrganism, topOrganism)
	log.Printf("Responding with delta patch, %v operations", len(patch.Operations))
	ctx.JSON(http.StatusOK, &GetOrganismDeltaResponse{
		Hash:  topOrganism.Hash(),
		Patch: patch,
	})
}

func (handler *ServerPortal) SubmitOrganism(ctx *gin.Context) {
	patch := &Patch{}
	err := ctx.BindJSON(patch)
	if err != nil {
		ctx.AbortWithError(http.StatusBadRequest, err)
	}
	// Apply the patch to the top organism and submit to incubator
	topOrganism := handler.incubator.GetTopOrganism()
	updated := handler.patchProcessor.ProcessPatch(topOrganism, patch)
	handler.incubator.SubmitOrganisms([]*Organism{updated})
}

// GetOrganismByHashRequest is used to retrieve organsims from the cache by Hash
type GetOrganismByHashRequest struct {
	Hash     string
	Callback chan<- *Organism
}

// GetOrganismDeltaResponse contains a patch that can be applied, and a hash to
// verify the output organism is the same one as expected.
type GetOrganismDeltaResponse struct {
	Hash  string `json:"hash"`
	Patch *Patch `json:"patch"`
}

// An UpdateRequest is a request to update the portal after an iteration,
// to make sure that the top organism is always recorded in the cache.
type UpdateRequest struct {
	Callback chan<- bool
}
