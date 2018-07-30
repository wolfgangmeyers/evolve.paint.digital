package main

import (
	"bytes"
	"image"
	"image/png"
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
	organismCache  *PatchCache
	patchProcessor *PatchProcessor

	// communication channels
	patchRequestChan chan *GetPatchRequest
	updateChan       chan *UpdateRequest
	focusImageData   []byte
}

// NewServerPortal returns a new ServerPortal
func NewServerPortal(incubator *Incubator, focusImage image.Image) *ServerPortal {
	handler := new(ServerPortal)
	handler.incubator = incubator
	handler.patchProcessor = &PatchProcessor{}
	handler.organismCache = NewPatchCache()
	handler.patchRequestChan = make(chan *GetPatchRequest)
	handler.updateChan = make(chan *UpdateRequest)
	if focusImage != nil {
		buf := &bytes.Buffer{}
		png.Encode(buf, focusImage)
		handler.focusImageData = buf.Bytes()
	}
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
			case req := <-handler.patchRequestChan:
				req.Callback <- handler.organismCache.GetPatch(req.Baseline, req.Target, true)
			case req := <-handler.updateChan:
				topOrganism := handler.incubator.GetTopOrganism()
				_, has := handler.organismCache.Get(topOrganism.Hash())
				if !has {
					if topOrganism.Patch == nil {
						emptyPatch := objectPool.BorrowPatch()
						emptyPatch.Baseline = "<none>"
						emptyPatch.Target = topOrganism.Hash()
						handler.organismCache.Put(topOrganism.Hash(), emptyPatch)
					} else {
						handler.organismCache.Put(topOrganism.Hash(), topOrganism.Patch.Clone())
					}
				}
				objectPool.ReturnOrganism(topOrganism)

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
		r.GET("/focus", handler.GetFocusImageData)
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

func (handler *ServerPortal) GetFocusImageData(ctx *gin.Context) {
	if handler.focusImageData == nil {
		ctx.AbortWithStatus(http.StatusNoContent)
		return
	}
	ctx.Data(http.StatusOK, "image/png", handler.focusImageData)
}

func (handler *ServerPortal) GetTopOrganism(ctx *gin.Context) {
	hashOnly := ctx.Query("hashonly") == "true"
	topOrganism := handler.incubator.GetTopOrganism()
	if hashOnly {
		ctx.Data(http.StatusOK, "text/plain", []byte(topOrganism.Hash()))
	} else {
		// TODO: change to SaveV2 at some point
		ctx.Data(http.StatusOK, "application/binary", topOrganism.Save())
		log.Printf("GetTopOrganism: exported top organism '%v'", topOrganism.Hash())
	}
	objectPool.ReturnOrganism(topOrganism)
}

func (handler *ServerPortal) GetTopOrganismDelta(ctx *gin.Context) {

	previous := ctx.Query("previous")
	topOrganism := handler.incubator.GetTopOrganism()
	if topOrganism == nil {
		log.Println("GetTopOrganismDelta - No top organism loaded...")
		ctx.JSON(http.StatusNotFound, nil)
		return
	}
	// No updates
	if topOrganism.Hash() == previous {
		log.Printf("GetTopOrganismDelta %v - no changes", previous)
		patch := objectPool.BorrowPatch()
		ctx.JSON(http.StatusOK, patch)
		objectPool.ReturnPatch(patch)
		objectPool.ReturnOrganism(topOrganism)
		return
	}
	// Ensure topOrganism is in the cache
	if topOrganism.Patch != nil {
		_, stored := handler.organismCache.Get(topOrganism.Hash())
		if !stored {
			handler.organismCache.Put(topOrganism.Hash(), topOrganism.Patch)
		}
	}

	callback := make(chan *Patch)
	handler.patchRequestChan <- &GetPatchRequest{
		Baseline: previous,
		Target:   topOrganism.Hash(),
		Callback: callback,
	}
	patch := <-callback
	if patch == nil {
		log.Printf("GetTopOrganismDelta: %v not found", previous)
		ctx.JSON(http.StatusNotFound, map[string]interface{}{"Message": "Previous organism not found"})
		return
	}

	log.Printf("GetTopOrganismDelta: Sending %v -> %v, %v operations", previous, topOrganism.Hash(), len(patch.Operations))
	ctx.JSON(http.StatusOK, patch)
	objectPool.ReturnPatch(patch)
	objectPool.ReturnOrganism(topOrganism)
}

func (handler *ServerPortal) SubmitOrganism(ctx *gin.Context) {
	patch := objectPool.BorrowPatch()
	err := ctx.BindJSON(patch)
	if err != nil {
		log.Printf("Error importing patch: '%v'", err.Error())
		objectPool.ReturnPatch(patch)
		ctx.AbortWithError(http.StatusBadRequest, err)
		return
	}
	log.Printf("Importing patch '%v' -> '%v'", patch.Baseline, patch.Target)
	handler.incubator.SubmitPatch(patch)
}

// GetPatchRequest is a request to get a combined Patch that will transform
// the baseline organism into the target organism
type GetPatchRequest struct {
	Baseline string
	Target   string
	Callback chan<- *Patch
}

// An UpdateRequest is a request to update the portal after an iteration,
// to make sure that the top organism is always recorded in the cache.
type UpdateRequest struct {
	Callback chan<- bool
}
