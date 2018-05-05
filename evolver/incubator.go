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
	"runtime"
	"sort"
	"strconv"
)

// An Incubator contains a population of Organisms and provides
// functionality to incrementally improve the population's fitness.
type Incubator struct {
	Iteration         int
	config            *Config
	target            image.Image
	organisms         []*Organism
	organismMap       map[string]*Organism
	mutator           *Mutator
	ranker            *Ranker
	organismRecord    map[string]bool
	workerChan        chan *Organism
	workerResultChan  chan *WorkItemResult
	egressChan        chan *GetOrganismRequest
	ingressChan       chan *SubmitOrganismRequest
	saveChan          chan *SaveRequest
	loadChan          chan *LoadRequest
	iterateChan       chan VoidCallback
	getTargetDataChan chan *TargetImageDataRequest
}

// NewIncubator returns a new `Incubator`
func NewIncubator(config *Config, target image.Image, mutator *Mutator, ranker *Ranker) *Incubator {
	incubator := new(Incubator)
	incubator.config = config
	incubator.target = target
	incubator.mutator = mutator
	incubator.ranker = ranker
	incubator.ranker.PrecalculateLabs(target)

	incubator.organisms = []*Organism{}
	incubator.organismRecord = map[string]bool{}
	incubator.workerChan = make(chan *Organism, 100)
	incubator.workerResultChan = make(chan *WorkItemResult, 100)
	incubator.organismMap = make(map[string]*Organism)

	// Communication channels
	incubator.egressChan = make(chan *GetOrganismRequest)
	incubator.ingressChan = make(chan *SubmitOrganismRequest)
	incubator.saveChan = make(chan *SaveRequest)
	incubator.loadChan = make(chan *LoadRequest)
	incubator.iterateChan = make(chan VoidCallback)
	incubator.getTargetDataChan = make(chan *TargetImageDataRequest)

	// Start up local worker pool
	localPool := NewWorkerPool(target.Bounds().Size().X, target.Bounds().Size().Y, ranker, incubator.workerChan, incubator.workerResultChan, runtime.NumCPU(), func(workItem *WorkItem) *Organism {
		return incubator.organismMap[workItem.ID]
	})
	localPool.Start()
	return incubator
}

// Start fires up the incubator thread
func (incubator *Incubator) Start() {
	go func() {
		for {
			select {
			case cb := <-incubator.iterateChan:
				incubator.iterate()
				cb <- nil
			case req := <-incubator.saveChan:
				incubator.save(req.Filename)
				req.Callback <- nil
			case req := <-incubator.loadChan:
				incubator.load(req.Filename)
				req.Callback <- nil
			case req := <-incubator.ingressChan:
				incubator.submitOrganisms(req.Organisms)
				req.Callback <- nil
			case req := <-incubator.egressChan:
				organisms := incubator.getTopOrganisms(req.Count)
				req.Callback <- organisms
			case req := <-incubator.getTargetDataChan:
				data := incubator.getTargetImageData()
				req.Callback <- data
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
	incubator.auditPopulation("iterate0")
	incubator.growPopulation()
	incubator.auditPopulation("iterate1")
	incubator.scorePopulation()
	incubator.auditPopulation("iterate2")
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
	for _, organism := range incubator.organisms {
		file.Write(organism.Save())
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
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		log.Fatalf("Error loading incubator: %v", err.Error())
	}
	lines := bytes.Split(data, []byte("\n"))
	header := string(bytes.TrimSpace(lines[0]))
	iteration, _ := strconv.ParseInt(header, 10, 32)
	incubator.Iteration = int(iteration)
	for _, line := range lines[1:] {
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}
		organism := &Organism{}
		organism.Load(line)
		// If the file has duplicate organisms, don't load them
		_, has := incubator.organismMap[organism.Hash()]
		if has {
			continue
		}
		organism.Diff = -1
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
	toDelete := incubator.organisms[incubator.config.MinPopulation:]
	incubator.organisms = incubator.organisms[:incubator.config.MinPopulation]
	for _, organism := range toDelete {
		delete(incubator.organismMap, organism.Hash())
	}
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
}

func (incubator *Incubator) growPopulation() {
	for len(incubator.organisms) < incubator.config.MaxPopulation {
		// TODO: random switch to add fully random organism, duplicate organism, or combine organisms
		var organism *Organism
		which := int(rand.Int31n(int32(3)))
		switch which {
		case 0:
			organism = incubator.createClonedOrganism()
		case 1:
			organism = incubator.createCombinedOrganism()
		case 2:
			organism = incubator.createRandomOrganism()
		}
		if organism == nil {
			continue
		}
		// Don't repeat organisms. This prevents the population from being cluttered
		// with endless clones of the same individual
		if incubator.organismRecord[organism.Hash()] {
			continue
		}
		incubator.organismRecord[organism.Hash()] = true

		organism.Diff = -1
		incubator.organisms = append(incubator.organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
	}
}

func (incubator *Incubator) createClonedOrganism() *Organism {
	parent := incubator.selectRandomOrganism()
	if parent == nil {
		return nil
	}
	child := &Organism{}
	child.Instructions = make([]Instruction, len(parent.Instructions))
	for i, instruction := range parent.Instructions {
		child.Instructions[i] = instruction.Clone()
	}
	incubator.applyMutations(child)
	return child
}

func (incubator *Incubator) createCombinedOrganism() *Organism {
	if len(incubator.organisms) < 2 {
		return nil
	}
	parent1 := incubator.selectRandomOrganism()
	parent2 := incubator.selectRandomOrganism()
	// Make sure to pick a different organism
	for parent1 == parent2 {
		parent2 = incubator.selectRandomOrganism()
	}
	child := &Organism{}
	// Make the child halfway between the parent lengths
	childLen := (len(parent1.Instructions) + len(parent2.Instructions)) / 2
	for i := 0; i < childLen; i++ {
		if i < len(parent1.Instructions) && i < len(parent2.Instructions) {
			which := int(rand.Int31n(2))
			switch which {
			case 0:
				child.Instructions = append(child.Instructions, parent1.Instructions[i].Clone())
			default:
				child.Instructions = append(child.Instructions, parent2.Instructions[i].Clone())
			}
		} else if i < len(parent1.Instructions) {
			child.Instructions = append(child.Instructions, parent1.Instructions[i].Clone())
		} else {
			child.Instructions = append(child.Instructions, parent2.Instructions[i].Clone())
		}

	}
	// Apply mutations to child
	incubator.applyMutations(child)
	return child
}

func (incubator *Incubator) applyMutations(organism *Organism) {
	numMutations := int(rand.Int31n(int32(incubator.config.MaxMutations-incubator.config.MinMutations)) + int32(incubator.config.MinMutations))
	for i := 0; i < numMutations; i++ {
		organism.Instructions = incubator.mutator.Mutate(organism.Instructions)
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

// GetTopOrganisms returns the top-ranked organisms in the incubator
func (incubator *Incubator) GetTopOrganisms(count int) []*Organism {
	callback := make(chan []*Organism)
	req := &GetOrganismRequest{
		Count:    count,
		Callback: callback,
	}
	incubator.egressChan <- req
	return <-callback
}

func (incubator *Incubator) getTopOrganisms(count int) []*Organism {
	result := make([]*Organism, 0, count)
	for i := 0; i < count && i < len(incubator.organisms); i++ {
		result = append(result, incubator.organisms[i])
	}
	return result
}

// SubmitOrganisms introduces new organisms into the incubator
func (incubator *Incubator) SubmitOrganisms(organisms []*Organism) {
	callback := make(chan error)
	req := &SubmitOrganismRequest{
		Organisms: organisms,
		Callback:  callback,
	}
	incubator.ingressChan <- req
	<-callback
}

func (incubator *Incubator) submitOrganisms(organisms []*Organism) {
	imported := 0
	for _, organism := range organisms {
		if incubator.organismRecord[organism.Hash()] {
			continue
		}
		organism.Diff = -1
		incubator.organisms = append(incubator.organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
		incubator.organismRecord[organism.Hash()] = true
		imported++
	}
	log.Printf("Imported %v organisms", imported)
	incubator.scorePopulation()
}

// GetOrganismRequest is a request for the top organisms in an incubator.
// It is used to seed external worker processes.
type GetOrganismRequest struct {
	Count    int
	Callback chan<- []*Organism
}

// SubmitOrganismRequest is a request to submit new organisms into the incubator.
type SubmitOrganismRequest struct {
	Organisms []*Organism
	Callback  VoidCallback
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
