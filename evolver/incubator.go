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
	Iteration            int
	config               *Config
	target               image.Image
	organisms            []*Organism
	organismMap          map[string]*Organism
	mutator              *Mutator
	ranker               *Ranker
	organismRecord       map[string]bool
	stats                *IncubatorStats
	workerChan           chan *Organism
	workerResultChan     chan *WorkItemResult
	workerSaveChan       chan *Organism
	workerSaveResultChan chan []byte
	workerLoadChan       chan []byte
	workerLoadResultChan chan *Organism
	egressChan           chan *GetOrganismRequest
	ingressChan          chan *SubmitOrganismRequest
	saveChan             chan *SaveRequest
	loadChan             chan *LoadRequest
	iterateChan          chan VoidCallback
	getTargetDataChan    chan *TargetImageDataRequest
	statsChan            chan *IncubatorStatsRequest
	scaleChan            chan *IncubatorScaleRequest
}

// NewIncubator returns a new `Incubator`
func NewIncubator(config *Config, target image.Image, mutator *Mutator, ranker *Ranker) *Incubator {
	incubator := new(Incubator)
	incubator.stats = &IncubatorStats{}
	incubator.config = config
	incubator.target = target
	incubator.mutator = mutator
	incubator.ranker = ranker
	incubator.ranker.PrecalculateLabs(target)

	incubator.organisms = []*Organism{}
	incubator.organismRecord = map[string]bool{}
	incubator.organismMap = make(map[string]*Organism)

	// Communication channels
	incubator.workerChan = make(chan *Organism, 100)
	incubator.workerResultChan = make(chan *WorkItemResult, 100)
	incubator.workerSaveChan = make(chan *Organism, 1)
	incubator.workerSaveResultChan = make(chan []byte, 1)
	incubator.workerLoadChan = make(chan []byte, 1)
	incubator.workerLoadResultChan = make(chan *Organism, 1)
	incubator.egressChan = make(chan *GetOrganismRequest)
	incubator.ingressChan = make(chan *SubmitOrganismRequest)
	incubator.saveChan = make(chan *SaveRequest)
	incubator.loadChan = make(chan *LoadRequest)
	incubator.iterateChan = make(chan VoidCallback)
	incubator.getTargetDataChan = make(chan *TargetImageDataRequest)
	incubator.statsChan = make(chan *IncubatorStatsRequest)

	// Start up local worker pool
	localPool := NewWorkerPool(
		target.Bounds().Size().X,
		target.Bounds().Size().Y,
		ranker,
		incubator.workerChan,
		incubator.workerResultChan,
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
			case req := <-incubator.ingressChan:
				incubator.submitOrganisms(req.Organisms, req.ReplacePopulation)
				req.Callback <- nil
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
			case req := <-incubator.statsChan:
				req.Callback <- incubator.stats
			}
		}
	}()
}

// GetIncubatorStats returns the min, max and average diffs of organisms
func (incubator *Incubator) GetIncubatorStats() *IncubatorStats {
	callback := make(chan *IncubatorStats)
	incubator.statsChan <- &IncubatorStatsRequest{
		Callback: callback,
	}
	return <-callback
}

func (incubator *Incubator) updateIncubatorStats(iteration bool) {
	count := 1.0
	maxDiff := incubator.organisms[0].Diff
	minDiff := incubator.organisms[0].Diff
	totalDiff := incubator.organisms[0].Diff
	for _, organism := range incubator.organisms[1:] {
		if organism.Diff > maxDiff {
			maxDiff = organism.Diff
		}
		if organism.Diff < minDiff {
			minDiff = organism.Diff
		}
		totalDiff += organism.Diff
		count++
	}
	avgDiff := totalDiff / count
	if iteration {
		incubator.stats.MaxIterationDiff = maxDiff
		incubator.stats.MinIterationDiff = minDiff
		incubator.stats.AvgIterationDiff = avgDiff
	} else {
		incubator.stats.MaxDiff = maxDiff
		incubator.stats.MinDiff = minDiff
		incubator.stats.AvgDiff = avgDiff
	}
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
	incubator.auditPopulation("iterate0")
	incubator.growPopulation()
	incubator.auditPopulation("iterate1")
	topOrganism := incubator.organisms[0]
	incubator.scorePopulation()
	incubator.auditPopulation("iterate2")

	// If multiple improvements are found, try to apply all of them to the last
	// top organism so that no improvements are lost. Only run this after there
	// has been at least one scoring round.
	if topOrganism.Diff != -1 {
		improved := []*Organism{}
		for _, organism := range incubator.organisms[1:] {
			if organism.Diff < topOrganism.Diff {
				improved = append(improved, organism)
			}
		}
		if len(improved) > 1 {
			// More than one improvement during the scoring round, so combine the patches together
			// and apply them to the last topOrganism
			newOrganism := topOrganism.Clone()
			newOrganism.Parent = topOrganism
			newOrganism.Diff = -1
			operations := []*PatchOperation{}
			for _, organism := range improved {
				if organism.Patch == nil {
					continue
				}
				for _, operation := range organism.Patch.Operations {
					operations = append(operations, operation)
					operation.Apply(newOrganism)
				}

			}
			newOrganism.hash = ""
			newOrganism.AffectedArea = nil
			newOrganism.Patch = &Patch{
				Baseline:   topOrganism.Hash(),
				Target:     newOrganism.Hash(),
				Operations: operations,
			}
			incubator.organisms = append(incubator.organisms, newOrganism)
			incubator.organismMap[newOrganism.Hash()] = newOrganism
			incubator.organismRecord[newOrganism.Hash()] = true

			incubator.scorePopulation()
			incubator.auditPopulation("iterate2.5")
		}
	}

	incubator.shrinkPopulation()
	incubator.auditPopulation("iterate3")
	incubator.Iteration++
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
	file.WriteString(fmt.Sprintf("%v\n", incubator.Iteration))
	// Multithreaded save
	for _, organism := range incubator.organisms {
		//file.Write(organism.Save())
		incubator.workerSaveChan <- organism
	}
	for range incubator.organisms {
		saved := <-incubator.workerSaveResultChan
		file.Write(saved)
	}
	file.Close()
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
	incubator.organisms = []*Organism{}
	incubator.organismMap = map[string]*Organism{}
	incubator.organismRecord = map[string]bool{}
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		log.Fatalf("Error loading incubator: %v", err.Error())
	}
	lines := bytes.Split(data, []byte("\n"))
	header := string(bytes.TrimSpace(lines[0]))
	iteration, _ := strconv.ParseInt(header, 10, 32)
	incubator.Iteration = int(iteration)
	organismCount := len(lines) - 1
	go func() {
		for _, line := range lines[1:] {
			line = bytes.TrimSpace(line)

			incubator.workerLoadChan <- line
		}
	}()
	for i := 0; i < organismCount; i++ {
		organism := <-incubator.workerLoadResultChan
		if organism == nil {
			continue
		}
		// If the file has duplicate organisms, don't load them
		_, has := incubator.organismMap[organism.Hash()]
		if has {
			continue
		}
		organism.Diff = -1
		organism.CleanupInstructions()
		incubator.organisms = append(incubator.organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
		incubator.organismRecord[organism.Hash()] = true
	}

	incubator.scorePopulation()
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

func (incubator *Incubator) auditPopulation(hint string) {
	// This can help point out bugs in the code when they happen.
	hashes := map[string]bool{}
	for i, organism := range incubator.organisms {
		_, has := hashes[organism.Hash()]
		if has {
			log.Printf("Audit (%v): organism %v / %v has duplicate hash", hint, i, organism.Hash())
		}
		hashes[organism.Hash()] = true
		_, has = incubator.organismMap[organism.Hash()]
		if !has {
			log.Printf("Audit (%v): organism %v / %v was not indexed", hint, i, organism.Hash())
			incubator.organismMap[organism.Hash()] = organism
		}
	}
}

func (incubator *Incubator) getTargetImageData() []byte {
	buf := &bytes.Buffer{}
	png.Encode(buf, incubator.target)
	return buf.Bytes()
}

func (incubator *Incubator) shrinkPopulation() {
	toDelete := incubator.organisms[1:]
	incubator.organisms = incubator.organisms[:1]
	// Remove reference to parents to allow GC
	incubator.organisms[0].Parent = nil
	for _, organism := range toDelete {
		delete(incubator.organismMap, organism.Hash())
	}
	incubator.updateIncubatorStats(false)
}

func (incubator *Incubator) scorePopulation() {
	toScore := map[string]*Organism{}
	for _, organism := range incubator.organisms {
		if organism.Diff != -1 {
			continue
		}
		toScore[organism.Hash()] = organism
	}
	for len(toScore) > 0 {
		completedOrganisms := []string{}
		for _, organism := range toScore {
			incubator.workerChan <- organism
		}
		for range toScore {
			select {
			// TODO: integrate trust...
			case workItemResult := <-incubator.workerResultChan:
				if workItemResult == nil {
					log.Println("nil work item result")
					continue
				}
				_, has := incubator.organismMap[workItemResult.ID]
				if has {
					organism := incubator.organismMap[workItemResult.ID]
					organism.Diff = workItemResult.Diff
				} else {
					log.Printf("Warning: organism %v was scored but does not exist...", workItemResult.ID)
				}
				completedOrganisms = append(completedOrganisms, workItemResult.ID)
			}
		}
		for _, id := range completedOrganisms {
			delete(toScore, id)
		}
	}

	sort.Sort(OrganismList(incubator.organisms))
	incubator.updateIncubatorStats(true)
}

func (incubator *Incubator) growPopulation() {
	randomize := len(incubator.organisms) == 0
	for len(incubator.organisms) < incubator.config.MaxPopulation {
		var organism *Organism
		if randomize {
			organism = incubator.createRandomOrganism()
		} else {
			organism = incubator.createClonedOrganism()
		}

		if organism == nil {
			continue
		}
		// Don't repeat organisms. This prevents the population from being cluttered
		// with endless clones of the same individual
		if incubator.organismRecord[organism.Hash()] {
			continue
		}
		organism.CleanupInstructions()
		incubator.organismRecord[organism.Hash()] = true
		organism.Diff = -1
		incubator.organisms = append(incubator.organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
	}
	// Purge organismRecord occasionally
	if len(incubator.organismRecord) > 1000000 {
		incubator.organismRecord = map[string]bool{}
		for key := range incubator.organismMap {
			incubator.organismRecord[key] = true
		}
	}
}

func (incubator *Incubator) createClonedOrganism() *Organism {
	//incubator.selectRandomOrganism()
	if len(incubator.organisms) == 0 {
		return nil
	}
	parent := incubator.organisms[0]
	child := &Organism{
		Parent: parent,
	}
	child.Instructions = make([]Instruction, len(parent.Instructions))
	for i, instruction := range parent.Instructions {
		child.Instructions[i] = instruction.Clone()
	}
	incubator.applyMutations(child)
	// child.DiffFrom(parent)
	return child
}

func (incubator *Incubator) applyMutations(organism *Organism) {
	operation, affectedArea := incubator.mutator.Mutate(organism)
	baseline := organism.Hash()
	operation.Apply(organism)
	organism.hash = ""
	organism.AffectedArea = affectedArea
	organism.Patch = &Patch{
		Operations: []*PatchOperation{
			operation,
		},
		Baseline: baseline,
		Target:   organism.Hash(),
	}
}

func (incubator *Incubator) createRandomOrganism() *Organism {
	organism := &Organism{}
	numInstructions := int(rand.Int31n(int32(incubator.config.MaxComplexity-incubator.config.MinComplexity)) + int32(incubator.config.MinComplexity))
	for i := 0; i < numInstructions; i++ {
		organism.Instructions = append(organism.Instructions, incubator.mutator.RandomInstruction())
	}
	return organism
}

func (incubator *Incubator) selectRandomOrganism() *Organism {
	if len(incubator.organisms) < 1 {
		return nil
	}
	index := int(rand.Int31n(int32(len(incubator.organisms))))
	return incubator.organisms[index]
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
	if len(incubator.organisms) > 0 {
		return incubator.organisms[0]
	}
	return nil
}

// SubmitOrganisms introduces new organisms into the incubator
func (incubator *Incubator) SubmitOrganisms(organisms []*Organism, replace bool) {
	callback := make(chan error)
	req := &SubmitOrganismRequest{
		ReplacePopulation: replace,
		Organisms:         organisms,
		Callback:          callback,
	}
	incubator.ingressChan <- req
	<-callback
}

func (incubator *Incubator) submitOrganisms(organisms []*Organism, replacePopulation bool) {
	imported := 0
	var topDiff = 94.0
	if len(incubator.organisms) > 0 {
		topDiff = incubator.organisms[0].Diff
	}
	for _, organism := range organisms {
		if incubator.organismRecord[organism.Hash()] {
			continue
		}
		organism.Diff = -1
		organism.CleanupInstructions()
		incubator.organisms = append(incubator.organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
		incubator.organismRecord[organism.Hash()] = true
		imported++
	}
	log.Printf("Imported %v organisms", imported)
	incubator.scorePopulation()
	newTopDiff := incubator.organisms[0].Diff
	if !replacePopulation && newTopDiff < topDiff {
		log.Printf("New diff=%v, %v difference", newTopDiff, topDiff-newTopDiff)
	} else if !replacePopulation {
		log.Println("No difference detected...")
	} else {
		log.Printf("Population updated, diff=%v", newTopDiff)
	}
}

// GetOrganismRequest is a request for the top organism in an incubator.
// It is used to seed external worker processes.
type GetOrganismRequest struct {
	Callback chan<- *Organism
}

// SubmitOrganismRequest is a request to submit new organisms into the incubator.
type SubmitOrganismRequest struct {
	// If set to true, the current population is replaced. If false, the organisms are combined.
	ReplacePopulation bool
	Organisms         []*Organism
	Callback          VoidCallback
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
	MaxDiff          float64
	AvgDiff          float64
	MinDiff          float64
	MaxIterationDiff float64
	AvgIterationDiff float64
	MinIterationDiff float64
}

type IncubatorStatsRequest struct {
	Callback chan<- *IncubatorStats
}

type IncubatorScaleRequest struct {
	Factor   float64
	Callback VoidCallback
}
