package main

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"sort"
	"strconv"
)

// An Incubator contains a population of Organisms and provides
// functionality to incrementally improve the population's fitness.
type Incubator struct {
	Iteration             int
	config                *Config
	target                image.Image
	topOrganism           *Organism
	currentGeneration     []*Organism
	currentGenerationMap  map[string]*Organism
	incomingPatches       []*Patch
	mutator               *Mutator
	ranker                *Ranker
	organismRecord        map[string]bool
	workerCloneChan       chan *Organism
	workerCloneResultChan chan *Organism
	workerHashChan        chan *Organism
	workerHashResultChan  chan bool
	workerRankChan        chan *Organism
	workerRankResultChan  chan WorkItemResult
	workerSaveChan        chan *Organism
	workerSaveResultChan  chan []byte
	workerLoadChan        chan []byte
	workerLoadResultChan  chan *Organism
	egressChan            chan *GetOrganismRequest
	incomingPatchChan     chan *Patch
	incomingOrganismChan  chan *Organism
	saveChan              chan *SaveRequest
	loadChan              chan *LoadRequest
	iterateChan           chan VoidCallback
	getTargetDataChan     chan *TargetImageDataRequest
	scaleChan             chan *IncubatorScaleRequest
}

// NewIncubator returns a new `Incubator`
func NewIncubator(config *Config, target image.Image, mutator *Mutator, ranker *Ranker) *Incubator {
	incubator := new(Incubator)
	incubator.config = config
	incubator.target = target
	incubator.mutator = mutator
	incubator.ranker = ranker
	incubator.ranker.PrecalculateLabs(target)
	incubator.currentGeneration = make([]*Organism, 0, config.MaxPopulation)
	incubator.currentGenerationMap = make(map[string]*Organism, config.MaxPopulation)
	incubator.incomingPatches = make([]*Patch, 0, 100)

	incubator.organismRecord = map[string]bool{}

	// Communication channels
	incubator.workerCloneChan = make(chan *Organism, config.MaxPopulation)
	incubator.workerCloneResultChan = make(chan *Organism, config.MaxPopulation)
	incubator.workerHashChan = make(chan *Organism, config.MaxPopulation)
	incubator.workerHashResultChan = make(chan bool, config.MaxPopulation)
	incubator.workerRankChan = make(chan *Organism, config.MaxPopulation)
	incubator.workerRankResultChan = make(chan WorkItemResult, config.MaxPopulation)
	incubator.workerSaveChan = make(chan *Organism, 1)
	incubator.workerSaveResultChan = make(chan []byte, 1)
	incubator.workerLoadChan = make(chan []byte, 1)
	incubator.workerLoadResultChan = make(chan *Organism, 1)
	incubator.egressChan = make(chan *GetOrganismRequest)
	incubator.incomingPatchChan = make(chan *Patch)
	incubator.incomingOrganismChan = make(chan *Organism)
	incubator.saveChan = make(chan *SaveRequest)
	incubator.loadChan = make(chan *LoadRequest)
	incubator.iterateChan = make(chan VoidCallback)
	incubator.getTargetDataChan = make(chan *TargetImageDataRequest)

	// Start up local worker pool
	localPool := NewWorkerPool(
		target.Bounds().Size().X,
		target.Bounds().Size().Y,
		ranker,
		incubator.workerCloneChan,
		incubator.workerCloneResultChan,
		incubator.workerHashChan,
		incubator.workerHashResultChan,
		incubator.workerRankChan,
		incubator.workerRankResultChan,
		incubator.workerSaveChan,
		incubator.workerSaveResultChan,
		incubator.workerLoadChan,
		incubator.workerLoadResultChan,
		config.WorkerCount,
	)
	localPool.Start()
	return incubator
}

// Start fires up the incubator thread
func (incubator *Incubator) Start() {
	go func() {
		for {
			select {
			case patch := <-incubator.incomingPatchChan:
				incubator.submitPatch(patch)
			case organism := <-incubator.incomingOrganismChan:
				incubator.setTopOrganism(organism)
			case req := <-incubator.egressChan:
				organism := incubator.getTopOrganism()
				req.Callback <- organism
			case req := <-incubator.getTargetDataChan:
				data := incubator.getTargetImageData()
				req.Callback <- data
			case cb := <-incubator.iterateChan:
				incubator.iterate()
				cb <- nil
			case req := <-incubator.saveChan:
				incubator.save(req.Filename)
				req.Callback <- nil
			case req := <-incubator.loadChan:
				incubator.load(req.Filename)
				req.Callback <- nil
			}
		}
	}()
}

// Iterate executes one iteration of the incubator process:
// * grow
// * score
// * shrink
func (incubator *Incubator) Iterate() {
	callback := make(chan error)
	incubator.iterateChan <- callback
	<-callback
}

func (incubator *Incubator) iterate() {
	if incubator.topOrganism == nil {
		incubator.topOrganism = incubator.createRandomOrganism()
	}
	// Capture current set of instruction hashes from the top organism
	// this can be used to recycle unused instructions from organsims that are
	// being recycled.
	if incubator.topOrganism.Diff == -1 {
		incubator.addOrganism(incubator.topOrganism)
		incubator.scorePopulation()
		log.Printf("initial diff (incubator)=%v", incubator.topOrganism.Diff)
		incubator.currentGeneration = incubator.currentGeneration[:0]
		delete(incubator.currentGenerationMap, incubator.topOrganism.Hash())
	}
	incubator.applyIncomingPatches()
	incubator.growPopulation()
	incubator.scorePopulation()

	// If multiple improvements are found, try to apply all of them to the last
	// top organism so that no improvements are lost.
	improved := []*Organism{}
	for _, organism := range incubator.currentGeneration {
		if organism.Diff < incubator.topOrganism.Diff {
			// log.Printf("Improved organism: %v - %v, current=%v", organism.Hash(), FormatProgress(organism.Diff), FormatProgress(incubator.topOrganism.Diff))
			improved = append(improved, organism)
		} else {
			// fmt.Printf("%v, ", organism.Diff)
			// dispose of all organisms/patches that did not lead to improvements
			incubator.disposeOrganism(organism)
		}
	}
	incubator.clearCurrentGeneration()

	if len(improved) > 0 {
		if len(improved) == 1 {
			incubator.setTopOrganism(improved[0])
		} else {
			// More than one improvement during the scoring round, so combine the patches together
			// and apply them to the last topOrganism
			newOrganism := incubator.topOrganism.Clone()
			newOrganism.AffectedAreas = newOrganism.AffectedAreas[:0]
			if newOrganism.Patch != nil {
				objectPool.ReturnPatch(newOrganism.Patch)
			}
			patch := objectPool.BorrowPatch()
			// operations := []*PatchOperation{}
			for _, organism := range improved {
				for _, operation := range organism.Patch.Operations {
					patch.Operations = append(patch.Operations, operation)
					newOrganism.AffectedAreas = append(newOrganism.AffectedAreas, operation.Apply(newOrganism)...)
				}
				incubator.disposeOrganism(organism)
			}
			newOrganism.hash = ""
			patch.Baseline = incubator.topOrganism.Hash()
			patch.Target = newOrganism.Hash()
			newOrganism.Patch = patch

			incubator.currentGeneration = append(incubator.currentGeneration, newOrganism)
			incubator.currentGenerationMap[newOrganism.Hash()] = newOrganism
			incubator.organismRecord[newOrganism.Hash()] = true

			incubator.scorePopulation()

			incubator.setTopOrganism(incubator.currentGeneration[0])
			incubator.clearCurrentGeneration()
		}
	}
	incubator.Iteration++
}

func (incubator *Incubator) clearCurrentGeneration() {
	incubator.currentGeneration = incubator.currentGeneration[:0]
	for key := range incubator.currentGenerationMap {
		delete(incubator.currentGenerationMap, key)
	}
}

func (incubator *Incubator) applyIncomingPatches() {
	for _, patch := range incubator.incomingPatches {
		newPatch := objectPool.BorrowPatch()
		newPatch.Baseline = incubator.topOrganism.Hash()
		newOrganism := incubator.topOrganism.Clone()
		newOrganism.AffectedAreas = newOrganism.AffectedAreas[:0]
		for _, operation := range patch.Operations {
			newOrganism.AffectedAreas = append(newOrganism.AffectedAreas, operation.Apply(newOrganism)...)
			newPatch.Operations = append(newPatch.Operations, operation)
		}
		newOrganism.hash = ""
		newPatch.Target = newOrganism.Hash()
		newOrganism.Patch = newPatch
		incubator.addOrganism(newOrganism)

		objectPool.ReturnPatch(patch)
	}
	incubator.incomingPatches = incubator.incomingPatches[:0]
}

// Save saves the current population to the specified file
func (incubator *Incubator) Save(filename string) {
	callback := make(chan error)
	request := &SaveRequest{
		Filename: filename,
		Callback: callback,
	}
	incubator.saveChan <- request
	<-callback
}

func (incubator *Incubator) save(filename string) {
	file, err := os.Create(filename)
	if err != nil {
		log.Fatalf("Error saving incubator: %v", err.Error())
	}
	defer file.Close()
	file.WriteString(fmt.Sprintf("%v\n", incubator.Iteration))
	incubator.workerSaveChan <- incubator.topOrganism
	saved := <-incubator.workerSaveResultChan
	file.Write(saved)
}

// Load loads a population from the specified filename
func (incubator *Incubator) Load(filename string) {
	callback := make(chan error)
	request := &LoadRequest{
		Filename: filename,
		Callback: callback,
	}
	incubator.loadChan <- request
	<-callback
}

func (incubator *Incubator) load(filename string) {
	incubator.organismRecord = map[string]bool{}
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		log.Fatalf("Error loading incubator: %v", err.Error())
	}
	lines := bytes.Split(data, []byte("\n"))
	header := string(bytes.TrimSpace(lines[0]))
	iteration, _ := strconv.ParseInt(header, 10, 32)
	incubator.Iteration = int(iteration)
	// TODO: refactor this for a single organism
	incubator.workerLoadChan <- lines[1]
	organism := <-incubator.workerLoadResultChan
	if organism == nil {
		panic("Loaded nil organism from file")
	}
	organism.Diff = -1
	organism.CleanupInstructions()
	incubator.topOrganism = organism
	// add for scoring
	incubator.addOrganism(organism)

	incubator.scorePopulation()
	incubator.clearCurrentGeneration()
}

// GetTargetImageData returns the target image as a png file
func (incubator *Incubator) GetTargetImageData() []byte {
	callback := make(chan []byte)
	request := &TargetImageDataRequest{
		Callback: callback,
	}
	incubator.getTargetDataChan <- request
	return <-callback
}

func (incubator *Incubator) getTargetImageData() []byte {
	buf := &bytes.Buffer{}
	png.Encode(buf, incubator.target)
	return buf.Bytes()
}

// func (incubator *Incubator) shrinkPopulation() {
// 	toDelete := incubator.organisms[1:]
// 	incubator.organisms = incubator.organisms[:1]
// 	// Remove reference to parents to allow GC
// 	incubator.organisms[0].Parent = nil
// 	for _, organism := range toDelete {
// 		delete(incubator.organismMap, organism.Hash())
// 	}
// 	incubator.updateIncubatorStats(false)
// }

func (incubator *Incubator) scorePopulation() {
	for _, organism := range incubator.currentGeneration {
		incubator.workerRankChan <- organism
	}
	for range incubator.currentGeneration {
		workItemResult := <-incubator.workerRankResultChan
		incubator.currentGenerationMap[workItemResult.ID].Diff = workItemResult.Diff
	}

	sort.Sort(OrganismList(incubator.currentGeneration))
}

// disposeOrganism returns all checked out items for an organism if they aren't used anymore.
func (incubator *Incubator) disposeOrganism(organism *Organism) {
	objectPool.ReturnOrganism(organism)
}

func (incubator *Incubator) addOrganism(organism *Organism) {
	if organism == nil {
		return
	}
	organism.CleanupInstructions()
	// Don't repeat organisms. This prevents the population from being cluttered
	// with endless clones of the same individual
	if incubator.organismRecord[organism.Hash()] {
		// return instructions, patch and organism
		incubator.disposeOrganism(organism)
		return
	}
	incubator.organismRecord[organism.Hash()] = true
	incubator.currentGeneration = append(incubator.currentGeneration, organism)
	incubator.currentGenerationMap[organism.Hash()] = organism
}

func (incubator *Incubator) growPopulation() {
	if incubator.topOrganism == nil {
		incubator.topOrganism = incubator.createRandomOrganism()
	}

	for len(incubator.currentGeneration) < incubator.config.MaxPopulation {
		for i := len(incubator.currentGeneration); i < incubator.config.MaxPopulation; i++ {
			incubator.workerCloneChan <- incubator.topOrganism
		}
		for i := len(incubator.currentGeneration); i < incubator.config.MaxPopulation; i++ {
			organism := <-incubator.workerCloneResultChan
			incubator.applyMutations(organism)
			incubator.addOrganism(organism)
		}
	}
	// Purge organismRecord occasionally
	if len(incubator.organismRecord) > 1000 {
		incubator.organismRecord = map[string]bool{}
		for key := range incubator.currentGenerationMap {
			incubator.organismRecord[key] = true
		}
	}
}

func (incubator *Incubator) applyMutations(organism *Organism) {
	baseline := organism.Hash()
	operation := incubator.mutator.Mutate(organism)
	organism.hash = ""
	if organism.Patch != nil {
		objectPool.ReturnPatch(organism.Patch)
	}
	organism.Patch = objectPool.BorrowPatch()
	organism.Patch.Operations = append(organism.Patch.Operations, operation)
	organism.Patch.Baseline = baseline
	organism.Patch.Target = organism.Hash()
}

func (incubator *Incubator) createRandomOrganism() *Organism {
	organism := objectPool.BorrowOrganism()
	numInstructions := int(rand.Int31n(int32(incubator.config.MaxComplexity-incubator.config.MinComplexity)) + int32(incubator.config.MinComplexity))
	for i := 0; i < numInstructions; i++ {
		organism.Instructions = append(organism.Instructions, incubator.mutator.RandomInstruction())
	}
	return organism
}

// GetTopOrganism returns the top-ranked organism in the incubator
func (incubator *Incubator) GetTopOrganism() *Organism {
	callback := make(chan *Organism)
	req := &GetOrganismRequest{
		Callback: callback,
	}
	incubator.egressChan <- req
	return <-callback
}

func (incubator *Incubator) getTopOrganism() *Organism {
	return incubator.topOrganism.Clone()
}

// SubmitPatch will apply the patch on the next iteration
func (incubator *Incubator) SubmitPatch(patch *Patch) {
	incubator.incomingPatchChan <- patch.Clone()
}

// SetTopOrganism replaces the current top organism with a new one
func (incubator *Incubator) SetTopOrganism(organism *Organism) {
	incubator.incomingOrganismChan <- organism.Clone()
}

func (incubator *Incubator) submitPatch(patch *Patch) {
	incubator.incomingPatches = append(incubator.incomingPatches, patch)
}

func (incubator *Incubator) setTopOrganism(organism *Organism) {
	if incubator.topOrganism != nil {
		objectPool.ReturnOrganism(incubator.topOrganism)
	}
	incubator.topOrganism = organism
	incubator.currentGeneration = append(incubator.currentGeneration, organism)
	incubator.currentGenerationMap[organism.Hash()] = organism
	incubator.scorePopulation()
	incubator.clearCurrentGeneration()
}

// GetOrganismRequest is a request for the top organism in an incubator.
// It is used to seed external worker processes.
type GetOrganismRequest struct {
	Callback chan<- *Organism
}

// VoidCallback is used for calling void methods in another goroutine
type VoidCallback chan<- error

// SaveRequest is a request to save the population to a file
type SaveRequest struct {
	Filename string
	Callback VoidCallback
}

// LoadRequest is a request to load the population from a file
type LoadRequest struct {
	Filename string
	Callback VoidCallback
}

// TargetImageDataRequest is a request to get the target image data
type TargetImageDataRequest struct {
	Callback chan<- []byte
}

type IncubatorStats struct {
	MaxDiff          float32
	AvgDiff          float32
	MinDiff          float32
	MaxIterationDiff float32
	AvgIterationDiff float32
	MinIterationDiff float32
}

type IncubatorStatsRequest struct {
	Callback chan<- *IncubatorStats
}

type IncubatorScaleRequest struct {
	Factor   float32
	Callback VoidCallback
}
