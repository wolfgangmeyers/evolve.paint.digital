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
	"os/exec"
	"runtime/pprof"
	"strings"
	"time"

	"github.com/fogleman/gg"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

var saveWorkaroundInterval = time.Minute

var cwd, _ = os.Getwd()

// framesPerSecond is used for video rendering
const framesPerSecond = 30

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

	genvideoCmd          = app.Command("genvideo", "Generates an mp4 video file from a sequence of rendered organisms, showing the path of evolution to the final image (requires ffmpeg and linux).")
	genvideoCmdPrefix    = genvideoCmd.Flag("prefix", "Prefix of the png files that will be used for the video").Required().String()
	genvideoCmdSourceDir = genvideoCmd.Flag("folder", "Folder containing the png files. Defaults to current working directory").Default(cwd).String()
	genvideoCmdLength    = genvideoCmd.Flag("length", "The length of the video in seconds. The input files will be skipped in a time-lapse fashion to speed up the video to the desired duration (defaults to 60 seconds)").Default("60").Int()
	genvideoCmdOutfile   = genvideoCmd.Flag("outfile", "Name of output video file").Default("video.mp4").String()

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
	case genvideoCmd.FullCommand():
		genvideo()
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

	lastSave := time.Now()
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
			// incubator.Load(incubatorFilename)
			bestOrganism = incubator.GetTopOrganisms(1)[0]
			bestDiff = bestOrganism.Diff
			renderer = NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
			renderer.Render(bestOrganism.Instructions)
			renderer.SaveToFile(fmt.Sprintf("%v.%07d.png", targetFilename, incubator.Iteration))
			lastSave = time.Now()
		} else if time.Since(lastSave) > saveWorkaroundInterval {
			incubator.Save(incubatorFilename)
			incubator.Load(incubatorFilename)
			bestOrganism = incubator.GetTopOrganisms(1)[0]
			bestDiff = bestOrganism.Diff
			lastSave = time.Now()
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

	// Start up worker portal
	portal := NewWorkerPortal(client)
	portal.Start()

	bestDiff := 1000.0
	var bestOrganism *Organism

	if err == nil {
		bestOrganism = incubator.GetTopOrganisms(1)[0]
		bestDiff = bestOrganism.Diff
		log.Printf("Initial diff: %v", bestDiff)
	}

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
				portal.Export(organism)
			}
		}
		importedList := []*Organism{}
		imported := portal.Import()
		for imported != nil {
			importedList = append(importedList, imported)
			imported = portal.Import()
		}
		if len(importedList) > 0 {
			incubator.SubmitOrganisms(importedList)
		}
	}
}

// Generates an mp4 video file from a sequence of rendered organisms, showing
// the path of evolution to the final image.
func genvideo() {
	// Create a local tmp dir
	os.RemoveAll("tmp")
	err := os.MkdirAll("tmp", 0755)
	if err != nil {
		log.Fatalf("Error getting temporary folder: '%v'", err.Error())
	}
	// Get list of existing files
	files, err := ioutil.ReadDir(*genvideoCmdSourceDir)
	if err != nil {
		log.Fatalf("Error getting list of files for '%v': '%v'", *genvideoCmdSourceDir, err.Error())
	}
	skip := len(files) / framesPerSecond
	if skip < 1 {
		skip = 1
	}
	count := 0
	outputNum := 0
	for _, fileinfo := range files {
		if strings.HasPrefix(fileinfo.Name(), *genvideoCmdPrefix) {
			if count%skip == 0 {
				sourceFilename := fmt.Sprintf("%v/%v", *genvideoCmdSourceDir, fileinfo.Name())
				destinationFilename := fmt.Sprintf("%v/%v", "tmp", fmt.Sprintf("%05v.png", outputNum))
				log.Printf("Copying '%v' to '%v'", sourceFilename, destinationFilename)
				// read data
				data, err := ioutil.ReadFile(sourceFilename)
				if err != nil {
					log.Fatalf("Read error: '%v'", err.Error())
				}
				err = ioutil.WriteFile(destinationFilename, data, 0644)
				if err != nil {
					log.Fatalf("Write error: '%v'", err.Error())
				}
				outputNum++
			}
			count++
		}
	}
	// ffmpeg -framerate 10 -pattern_type glob -i "(prefix)*.png" video.mp4
	ffmpeg := exec.Command(
		"ffmpeg",
		"-framerate",
		fmt.Sprint(framesPerSecond),
		"-i",
		fmt.Sprintf("%v/*.png", "tmp"),
		*genvideoCmdOutfile,
	)
	log.Printf("Running video encoder command...")
	ffmpeg.Stderr = os.Stderr
	ffmpeg.Stdout = os.Stdout
	err = ffmpeg.Run()
	if err != nil {
		log.Fatalf("Error running video encoder: '%v'", err.Error())
	}
}
