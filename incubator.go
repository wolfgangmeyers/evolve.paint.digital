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
	Iteration        int
	target           image.Image
	organisms        []*Organism
	mutator          *Mutator
	ranker           *Ranker
	organismRecord   map[string]bool
	workerChan       chan *WorkItem
	workerResultChan chan *WorkItemResult
}

// NewIncubator returns a new `Incubator`
func NewIncubator(target image.Image, mutator *Mutator, ranker *Ranker) *Incubator {
	incubator := new(Incubator)
	incubator.target = target
	incubator.mutator = mutator
	incubator.ranker = ranker
	incubator.ranker.PrecalculateLabs(target)

	incubator.organisms = []*Organism{}
	incubator.organismRecord = map[string]bool{}
	incubator.workerChan = make(chan *WorkItem, 100)
	incubator.workerResultChan = make(chan *WorkItemResult, 100)
	return incubator
}

func (incubator *Incubator) GetWorkItem() *WorkItem {
	return <-incubator.workerChan
}

func (incubator *Incubator) SubmitResult(workItemResult *WorkItemResult) {
	incubator.workerResultChan <- workItemResult
}

// Iterate executes one iteration of the incubator process:
// * grow
// * score
// * shrink
func (incubator *Incubator) Iterate() {
	incubator.growPopulation()
	incubator.scorePopulation()
	incubator.shrinkPopulation()
	incubator.Iteration++
}

func (incubator *Incubator) Save(filename string) {
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

func (incubator *Incubator) Load(filename string) {
	incubator.organisms = []*Organism{}
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
		organism.Diff = -1
		incubator.organisms = append(incubator.organisms, organism)
	}
	incubator.scorePopulation()
}

func (incubator *Incubator) GetTargetImageData() []byte {
	buf := &bytes.Buffer{}
	png.Encode(buf, incubator.target)
	return buf.Bytes()
}

func (incubator *Incubator) shrinkPopulation() {
	incubator.organisms = incubator.organisms[:config.MinPopulation]
}

func (incubator *Incubator) scorePopulation() {
	toScore := []*Organism{}
	for _, organism := range incubator.organisms {
		if organism.Diff != -1 {
			continue
		}
		toScore = append(toScore, organism)
	}
	orgChan := make(chan *Organism)
	for i := 0; i < runtime.NumCPU(); i++ {
		go func() {
			for {
				organism := <-orgChan
				if organism == nil {
					return
				}
				renderer := NewRenderer(incubator.target.Bounds().Size().X, incubator.target.Bounds().Size().Y)
				renderer.Render(organism.Instructions)
				renderedOrganism := renderer.GetImage()
				diff, _ := incubator.ranker.DistanceFromPrecalculated(renderedOrganism)
				organism.Diff = diff
			}
		}()
	}
	for _, organism := range toScore {
		orgChan <- organism
	}
	// poison pill for workers
	for i := 0; i < runtime.NumCPU(); i++ {
		orgChan <- nil
	}
	sort.Sort(OrganismList(incubator.organisms))
}

func (incubator *Incubator) growPopulation() {
	for len(incubator.organisms) < config.MaxPopulation {
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
	numMutations := int(rand.Int31n(int32(config.MaxMutations-config.MinMutations)) + int32(config.MinMutations))
	for i := 0; i < numMutations; i++ {
		organism.Instructions = incubator.mutator.Mutate(organism.Instructions)
	}
}

func (incubator *Incubator) createRandomOrganism() *Organism {
	organism := &Organism{}
	numInstructions := int(rand.Int31n(int32(config.MaxComplexity-config.MinComplexity)) + int32(config.MinComplexity))
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
