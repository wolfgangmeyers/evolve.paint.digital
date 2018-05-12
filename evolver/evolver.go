package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"runtime/pprof"
	"strings"
	"time"

	"github.com/fogleman/gg"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

var (
	app = kingpin.New("evolver", "Program to evolve paintings from a reference image")

	prof = app.Flag("prof", "Enable profiling and write to specified file").String()

	serverCmd  = app.Command("server", "Run a server process")
	targetFile = serverCmd.Arg("target", "File containing the target image").Required().String()
	iterations = serverCmd.Flag("iterations", "Number of iterations to run").Default("10000").Int()

	compareCmd   = app.Command("compare", "Compares two image files for difference and prints the result")
	compareFile1 = compareCmd.Arg("file1", "First file to compare").Required().String()
	compareFile2 = compareCmd.Arg("file2", "Second file to compare").Required().String()

	workerCmd = app.Command("worker", "Run a worker process")
	endpoint  = workerCmd.Arg("endpoint", "Endpoint of the server process").Required().String()

	config *Config
)

func init() {
	rand.Seed(time.Now().Unix())
	config = loadConfig()
}

func loadConfig() *Config {
	var config *Config
	_, err := os.Stat("config.json")
	if err != nil {
		log.Println("Creating new default config.json")
		config = DefaultConfig()
		saveConfig(config)
	} else {
		data, err := ioutil.ReadFile("config.json")
		if err != nil {
			log.Fatalf("Error reading config.json: '%v'", err.Error())
		}
		// Missing properties in json will be replaced by defaults
		config = DefaultConfig()
		err = json.Unmarshal(data, config)
		if err != nil {
			log.Fatalf("Error parsing config.json: '%v'", err.Error())
		}
	}
	return config
}

func saveConfig(config *Config) {
	data, _ := json.MarshalIndent(config, "", "    ")
	file, err := os.Create("config.json")
	if err != nil {
		log.Fatalf("Error saving config.json: '%v'", err.Error())
	}
	defer file.Close()
	_, err = file.Write(data)
	if err != nil {
		log.Fatalf("Error writing data to config.json: '%v'", err.Error())
	}
}

func loadImage(imageFile string) image.Image {
	img, err := gg.LoadImage(imageFile)
	if err != nil {
		log.Fatalf("Error loading target image from file '%v': %v", imageFile, err.Error())
	}
	return img
}

func main() {
	config = loadConfig()
	cmd := kingpin.MustParse(app.Parse(os.Args[1:]))
	if *prof != "" {
		f, err := os.Create(*prof)
		if err != nil {
			log.Fatalf("Error creating profile file: %v", err.Error())
		}
		if err := pprof.StartCPUProfile(f); err != nil {
			log.Fatalf("Error creating profile: %v", err.Error())
		}
		defer pprof.StopCPUProfile()
	}
	switch cmd {
	case serverCmd.FullCommand():
		server()
	case compareCmd.FullCommand():
		compare()
	case workerCmd.FullCommand():
		worker()
	default:
		log.Fatalf("Unimplemented command: %v", cmd)
	}
}

func compare() {
	image1 := loadImage(*compareFile1)
	image2 := loadImage(*compareFile2)
	ranker := &Ranker{}
	diff, err := ranker.Distance(image1, image2)
	if err != nil {
		log.Fatalf("Error comparing images: %v", err.Error())
	}
	fmt.Printf("Diff: %v", diff)
}

func server() {
	target := loadImage(*targetFile)
	targetFilename := *targetFile
	if strings.Contains(targetFilename, "\\") {
		parts := strings.Split(targetFilename, "\\")
		targetFilename = parts[len(parts)-1]
	} else if strings.Contains(targetFilename, "/") {
		parts := strings.Split(targetFilename, "/")
		targetFilename = parts[len(parts)-1]
	}
	log.Printf("Target file: %v", targetFilename)
	incubatorFilename := targetFilename + ".population.txt"
	renderer := NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
	mutator := createMutator(target)

	ranker := NewRanker()
	incubator := NewIncubator(config, target, mutator, ranker)
	incubator.Start()
	bestDiff := 1000.0
	var bestOrganism *Organism
	_, err := os.Stat(incubatorFilename)
	if err == nil {
		log.Println("Loading previous population")
		incubator.Load(incubatorFilename)
		bestOrganism = incubator.GetTopOrganisms(1)[0]
		bestDiff = bestOrganism.Diff
		log.Printf("Initial diff: %v", bestDiff)
	}

	// Launch external server handler
	workerHandler := NewWorkerHandler(incubator)
	workerHandler.Start()

	for incubator.Iteration < *iterations {
		incubator.Iterate()
		stats := incubator.GetIncubatorStats()
		log.Printf("Iteration %v: Min=%v, Avg=%v, Max=%v",
			incubator.Iteration,
			stats.MinDiff,
			stats.AvgDiff,
			stats.MaxDiff,
		)
		bestOrganism = incubator.GetTopOrganisms(1)[0]
		if bestOrganism.Diff < bestDiff {
			bestDiff = bestOrganism.Diff
			log.Printf("Improvement: diff=%v", bestDiff)
			incubator.Save(incubatorFilename)
			incubator.Load(incubatorFilename)
			renderer = NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
			renderer.Render(bestOrganism.Instructions)
			renderer.SaveToFile(fmt.Sprintf("%v.%07d.png", targetFilename, incubator.Iteration))
		}
	}
}

func createMutator(target image.Image) *Mutator {
	lineMutator := NewLineMutator(config, float64(target.Bounds().Size().X), float64(target.Bounds().Size().Y))
	circleMutator := NewCircleMutator(config, float64(target.Bounds().Size().X), float64(target.Bounds().Size().Y))
	polygonMutator := NewPolygonMutator(config, float64(target.Bounds().Size().X), float64(target.Bounds().Size().Y))
	instructionMutators := []InstructionMutator{}
	for _, instructionType := range config.InstructionTypes {
		if instructionType == TypeCircle {
			instructionMutators = append(instructionMutators, circleMutator)
		}
		if instructionType == TypeLine {
			instructionMutators = append(instructionMutators, lineMutator)
		}
		if instructionType == TypePolygon {
			instructionMutators = append(instructionMutators, polygonMutator)
		}
	}
	mutator := NewMutator(instructionMutators)
	return mutator
}

func worker() {

	client := NewWorkerClient(*endpoint)
	targetImageData, err := client.GetTargetImageData()
	if err != nil {
		log.Fatalf("Error getting target image: '%v'", err.Error())
	}
	target, err := png.Decode(bytes.NewReader(targetImageData))
	if err != nil {
		log.Fatalf("Error reading image: '%v'", err.Error())
	}
	mutator := createMutator(target)
	ranker := NewRanker()
	incubator := NewIncubator(config, target, mutator, ranker)
	incubator.Start()

	// Load seed organisms from the server
	log.Println("Getting seed organisms from server...")
	organisms, err := client.GetTopOrganisms(config.MinPopulation)
	if err != nil {
		log.Fatalf("Error getting initial seed population: '%v'", err.Error())
	}
	incubator.SubmitOrganisms(organisms)

	bestDiff := 1000.0
	var bestOrganism *Organism

	if err == nil {
		bestOrganism = incubator.GetTopOrganisms(1)[0]
		bestDiff = bestOrganism.Diff
		log.Printf("Initial diff: %v", bestDiff)
	}

	// queue of 100 organisms
	outbound := make(chan *Organism, 100)
	go func() {
		buffer := []*Organism{}
		timer := time.NewTicker(time.Second)
		for {
			select {
			case organism := <-outbound:
				buffer = append(buffer, organism)
			case <-timer.C:
				if len(buffer) > 0 {
					err = client.SubmitOrganisms(buffer)
					buffer = []*Organism{}
					if err != nil {
						log.Printf("Error submitting top organisms back to server: '%v'", err.Error())
					}
				}
			}
		}
	}()

	// Don't send organisms if they have already traveled
	traveled := map[string]bool{}
	for {
		incubator.Iterate()
		log.Printf("Iteration %v", incubator.Iteration)
		bestOrganism = incubator.GetTopOrganisms(1)[0]
		if bestOrganism.Diff < bestDiff {
			bestDiff = bestOrganism.Diff
			log.Printf("Improvement: diff=%v", bestDiff)
			// Submit top 10 organisms to the server for rebreeding
			topOrganisms := incubator.GetTopOrganisms(config.SyncAmount)
			for _, organism := range topOrganisms {
				if traveled[organism.Hash()] {
					continue
				}
				select {
				case outbound <- organism:
					traveled[organism.Hash()] = true
				default:
					break
				}
			}
		}
		if incubator.Iteration%config.SyncFrequency == 0 {
			go func() {
				// import the top 10 organisms from the server into the local incubator
				topRemoteOrganisms, err := client.GetTopOrganisms(config.SyncAmount)
				if err == nil {
					for _, organism := range topRemoteOrganisms {
						traveled[organism.Hash()] = true
					}
					incubator.SubmitOrganisms(topRemoteOrganisms)
					bestOrganism = incubator.GetTopOrganisms(1)[0]
					if bestDiff != bestOrganism.Diff {
						log.Printf("Improvement (imported): diff=%v", bestDiff)
					}
					bestDiff = bestOrganism.Diff
				} else {
					log.Printf("Error getting remote organisms: '%v'", err.Error())
				}
			}()

		}

	}
}
