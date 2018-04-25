package main

import (
	"encoding/json"
	"fmt"
	"image"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/fogleman/gg"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

var (
	app            = kingpin.New("evolver", "Program to evolve paintings from a reference image")
	testCmd        = app.Command("test", "A test command to develop features of the evolver")
	targetFile     = testCmd.Arg("target", "File containing the target image").Required().String()
	testIterations = testCmd.Flag("iterations", "Number of iterations to run").Default("10").Int()

	compareCmd   = app.Command("compare", "Compares two image files for difference and prints the result")
	compareFile1 = compareCmd.Arg("file1", "First file to compare").Required().String()
	compareFile2 = compareCmd.Arg("file2", "Second file to compare").Required().String()

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
		config = &Config{}
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
	switch cmd {
	case testCmd.FullCommand():
		test()
	case compareCmd.FullCommand():
		compare()
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

func test() {
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
	mutator := NewLineMutator(config, float64(target.Bounds().Size().X), float64(target.Bounds().Size().Y))

	ranker := &Ranker{}

	incubator := NewIncubator(target, mutator, ranker)
	_, err := os.Stat(incubatorFilename)
	if err == nil {
		log.Println("Loading previous population")
		incubator.Load(incubatorFilename)
	}
	var bestOrganism *Organism
	bestDiff := 1000.0
	for i := 0; i < *testIterations; i++ {
		incubator.Iterate()
		log.Printf("Iteration %v", incubator.Iteration)
		bestOrganism = incubator.organisms[0]
		if bestOrganism.Diff < bestDiff {
			bestDiff = bestOrganism.Diff
			log.Printf("Improvement: diff=%v", bestDiff)
			incubator.Save(incubatorFilename)
			renderer = NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
			renderer.Render(bestOrganism.Instructions)
			renderer.SaveToFile(fmt.Sprintf("%v.%v.png", targetFilename, incubator.Iteration))
		}
	}

	renderer = NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
	renderer.Render(bestOrganism.Instructions)

	log.Printf("Difference: %v", bestOrganism.Diff)

	renderer.SaveToFile("test.png")
}
