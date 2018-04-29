package evolve

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
	"time"
)

// An Incubator contains a population of Organisms and provides
// functionality to incrementally improve the population's fitness.
type Incubator struct {
	Iteration        int
	config           *Config
	target           image.Image
	Organisms        []*Organism
	organismMap      map[string]*Organism
	mutator          *Mutator
	ranker           *Ranker
	organismRecord   map[string]bool
	workerChan       chan *WorkItem
	workerResultChan chan *WorkItemResult
}

// NewIncubator returns a new `Incubator`
func NewIncubator(config *Config, target image.Image, mutator *Mutator, ranker *Ranker) *Incubator {
	incubator := new(Incubator)
	incubator.config = config
	incubator.target = target
	incubator.mutator = mutator
	incubator.ranker = ranker
	incubator.ranker.PrecalculateLabs(target)

	incubator.Organisms = []*Organism{}
	incubator.organismRecord = map[string]bool{}
	incubator.workerChan = make(chan *WorkItem, 100)
	incubator.workerResultChan = make(chan *WorkItemResult, 100)
	incubator.organismMap = make(map[string]*Organism)

	// Start up local worker pool
	localPool := NewWorkerPool(target.Bounds().Size().X, target.Bounds().Size().Y, ranker, incubator.workerChan, incubator.workerResultChan, runtime.NumCPU(), func(workItem *WorkItem) *Organism {
		return incubator.organismMap[workItem.ID]
	})
	localPool.Start()
	return incubator
}

func (incubator *Incubator) GetWorkItems(count int) []*WorkItem {
	workItems := make([]*WorkItem, 0, count)
	for i := 0; i < count; i++ {
		select {
		case workItem := <-incubator.workerChan:
			workItems = append(workItems, workItem)
		default:
			break
		}
	}
	return workItems
}

func (incubator *Incubator) SubmitResults(workItemResults []*WorkItemResult) {
	for _, workItemResult := range workItemResults {
		incubator.workerResultChan <- workItemResult
	}
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
	for _, organism := range incubator.Organisms {
		file.Write(organism.Save())
	}
	file.Close()
}

func (incubator *Incubator) Load(filename string) {
	incubator.Organisms = []*Organism{}
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
		organism.Diff = -1
		incubator.Organisms = append(incubator.Organisms, organism)
		incubator.organismMap[organism.Hash()] = organism
	}
	incubator.scorePopulation()
}

func (incubator *Incubator) GetTargetImageData() []byte {
	buf := &bytes.Buffer{}
	png.Encode(buf, incubator.target)
	return buf.Bytes()
}

func (incubator *Incubator) shrinkPopulation() {
	toDelete := incubator.Organisms[incubator.config.MinPopulation:]
	incubator.Organisms = incubator.Organisms[:incubator.config.MinPopulation]
	for _, organism := range toDelete {
		delete(incubator.organismMap, organism.Hash())
	}
}

func (incubator *Incubator) scorePopulation() {
	toScore := map[string]*Organism{}
	for _, organism := range incubator.Organisms {
		if organism.Diff != -1 {
			continue
		}
		toScore[organism.Hash()] = organism
	}
	for len(toScore) > 0 {
		completedOrganisms := []string{}
		for _, organism := range toScore {
			workItem := &WorkItem{
				ID:           organism.Hash(),
				OrganismData: organism.Save(),
			}
			incubator.workerChan <- workItem
		}
		// Wait one second to recover from dropped tasks
		timer := time.NewTimer(time.Second)
		for range toScore {
			select {
			// TODO: integrate trust...
			case workItemResult := <-incubator.workerResultChan:
				if workItemResult == nil {
					continue
				}
				incubator.organismMap[workItemResult.ID].Diff = workItemResult.Diff
				completedOrganisms = append(completedOrganisms, workItemResult.ID)
				if !timer.Stop() {
					<-timer.C
				}
				timer.Reset(time.Second)
			case <-timer.C:
				break
			}
		}
		for _, id := range completedOrganisms {
			delete(toScore, id)
		}
	}

	// orgChan := make(chan *Organism)
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
	// for _, organism := range toScore {
	// 	orgChan <- organism
	// }
	// // poison pill for workers
	// for i := 0; i < runtime.NumCPU(); i++ {
	// 	orgChan <- nil
	// }
	sort.Sort(OrganismList(incubator.Organisms))
}

func (incubator *Incubator) growPopulation() {
	for len(incubator.Organisms) < incubator.config.MaxPopulation {
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
		incubator.Organisms = append(incubator.Organisms, organism)
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
	if len(incubator.Organisms) < 2 {
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
	if len(incubator.Organisms) < 1 {
		return nil
	}
	index := int(rand.Int31n(int32(len(incubator.Organisms))))
	return incubator.Organisms[index]
}
