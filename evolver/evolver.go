package main

import (
	"bufio"
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
	"runtime"
	"runtime/pprof"
	"strings"
	"time"

	"github.com/fogleman/gg"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

const maxImageDiff = 94.0
const gcFrequency = 100

var cwd, _ = os.Getwd()

// framesPerSecond is used for video rendering
const framesPerSecond = 30

// profileDuration is the amount of time before program terminates, if profiling is enabled
// const profileDuration = time.Minute * 2

var (
	app = kingpin.New("evolver", "Program to evolve paintings from a reference image")

	prof    = app.Flag("prof", "Enable profiling and write to specified file").String()
	memprof = app.Flag("memprof", "Enable memory profiling and write to specified file").String()

	serverCmd        = app.Command("server", "Run a server process")
	targetFile       = serverCmd.Arg("target", "File containing the target image").Required().String()
	focusFile        = serverCmd.Flag("focus", "File containing a focus map").String()
	serverMaxSeconds = serverCmd.Flag("max_seconds", "Maximum number of seconds to run").Int()

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

	scaleCmd           = app.Command("scale", "Scales a population file by a specified factor")
	scaleCmdFile       = scaleCmd.Flag("file", "Path to the population file to scale").Required().String()
	scaleCmdOutputFile = scaleCmd.Flag("output-file", "Path to scaled output population file").Short('o').Required().String()
	scaleCmdFactor     = scaleCmd.Flag("factor", "Factor to scale the population by").Required().Float32()

	renderCmd           = app.Command("render", "Renders thie top organism from a population file")
	renderCmdFile       = renderCmd.Flag("file", "Path to the population file to render").Required().String()
	renderCmdOutputFile = renderCmd.Flag("output-file", "Path of the output file to create").Required().Short('o').String()
	// TODO: embed image width and height in population file so that it can scale more sanely
	renderCmdWidth  = renderCmd.Flag("width", "Width of output image in pixels").Short('w').Required().Int()
	renderCmdHeight = renderCmd.Flag("height", "Height of output image in pixels").Short('h').Required().Int()

	downloadCmd      = app.Command("download", "Downloads a number of top organisms from the server and saves to a local file")
	downloadEndpoint = downloadCmd.Flag("endpoint", "Endpoint of server to download from").Required().String()
	downloadOutfile  = downloadCmd.Flag("outfile", "Output file to save downloaded organisms to").Required().String()
	downloadCount    = downloadCmd.Flag("count", "Number of top organisms to download").Default("1").Int()

	config *Config
	// objectPool is global to allow easy access
	objectPool *ObjectPool
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

func createObjectPool() *ObjectPool {
	p := NewObjectPool()
	p.AddInstructionFactory(TypePolygon, NewPolygonFactory())
	return p
}

func main() {
	config = loadConfig()
	objectPool = createObjectPool()
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
	if *memprof != "" {
		defer func() {
			f, err := os.Create(*memprof)
			if err != nil {
				log.Fatalf("Error creating profile file: %v", err.Error())
			}
			pprof.WriteHeapProfile(f)
			f.Close()
		}()
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
	case scaleCmd.FullCommand():
		scale()
	case renderCmd.FullCommand():
		render()
	case downloadCmd.FullCommand():
		download()
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

func download() {
	workerClient := NewWorkerClient(*downloadEndpoint)
	organism, err := workerClient.GetTopOrganism()
	if err != nil {
		panic(err)
	}
	file, err := os.Create(*downloadOutfile)
	if err != nil {
		panic(err)
	}
	defer file.Close()
	line := organism.SaveV2()
	file.Write(line)
	file.WriteString("\n")
}

func scale() {
	file, err := os.Open(*scaleCmdFile)
	if err != nil {
		panic(err.Error())
	}
	defer file.Close()
	outfile, err := os.Create(*scaleCmdOutputFile)
	if err != nil {
		panic(err.Error())
	}
	defer outfile.Close()
	reader := bufio.NewScanner(file)
	// 10 MB buffer for organisms, they might be really big. Adjust as needed.
	buf := make([]byte, 1024*1024*10)
	reader.Buffer(buf, len(buf))
	reader.Scan()
	iterationLine := reader.Text()

	for reader.Scan() {
		line := reader.Bytes()
		if len(line) == 0 {
			continue
		}
		organism := &Organism{}
		organism.Load(line)
		for i, instruction := range organism.Instructions {
			instruction = instruction.Scale(*scaleCmdFactor)
			organism.Instructions[i] = instruction
		}
		line = organism.Save()
		outfile.WriteString(iterationLine)
		// TODO: verify if this newline is needed or not...
		outfile.WriteString("\n")
		outfile.Write(line)
		outfile.WriteString("\n")
	}
}

func render() {
	file, err := os.Open(*renderCmdFile)
	if err != nil {
		panic(err.Error())
	}
	defer file.Close()
	reader := bufio.NewScanner(file)
	// 10 MB buffer for organisms, they might be really big. Adjust as needed.
	buf := make([]byte, 1024*1024*10)
	reader.Buffer(buf, len(buf))
	// skip first line
	reader.Scan()
	if reader.Scan() {
		line := reader.Bytes()
		organism := &Organism{}
		organism.Load(line)
		renderer := NewRenderer(*renderCmdWidth, *renderCmdHeight)
		renderer.Render(organism.Instructions)
		renderer.SaveToFile(*renderCmdOutputFile)
	} else {
		log.Println("No organisms found in file")
	}
}

func server() {
	start := time.Now()
	target := loadImage(*targetFile)
	objectPool.SetRendererBounds(target.Bounds().Size().X, target.Bounds().Size().Y)
	var focusImage image.Image
	if *focusFile != "" {
		focusImage = loadImage(*focusFile)
	}
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
	mutator := createMutator(target, focusImage)

	ranker := NewRanker()
	incubator := NewIncubator(config, target, mutator, ranker)
	incubator.Start()
	bestDiff := float32(1000.0)
	instructionCount := 0
	var bestOrganism *Organism
	_, err := os.Stat(incubatorFilename)
	if err == nil {
		log.Println("Loading previous population")
		incubator.Load(incubatorFilename)
		bestOrganism = incubator.GetTopOrganism()
		bestDiff = bestOrganism.Diff
		instructionCount = len(bestOrganism.Instructions)
		log.Printf("Hash=%v, Initial diff: %v", bestOrganism.Hash(), bestDiff)
	}

	// Launch external server handler
	serverPortal := NewServerPortal(incubator, focusImage)
	serverPortal.Start()

	lastSave := time.Now()
	for {
		if incubator.Iteration%gcFrequency == 0 {
			log.Println("Running garbage collection")
			runtime.GC()
			log.Println("garbage collection completed")
		}
		if *serverMaxSeconds != 0 && time.Since(start) >= time.Second*time.Duration(*serverMaxSeconds) {
			return
		}
		// if (memprof != nil || prof != nil) && time.Since(start) >= profileDuration {
		// 	return
		// }
		incubator.Iterate()
		serverPortal.Update()
		// stats := incubator.GetIncubatorStats()
		displayProgress(bestDiff, instructionCount)
		bestOrganism = incubator.GetTopOrganism()
		if bestOrganism.Diff < bestDiff {
			bestDiff = bestOrganism.Diff
			instructionCount = len(bestOrganism.Instructions)
			if time.Since(lastSave) > time.Minute {
				incubator.Save(incubatorFilename)
				// incubator.Load(incubatorFilename)
				bestOrganism = incubator.GetTopOrganism()

				bestDiff = bestOrganism.Diff
				renderer = NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
				renderer.Render(bestOrganism.Instructions)
				renderer.SaveToFile(fmt.Sprintf("%v.%07d.png", targetFilename, incubator.Iteration))
				lastSave = time.Now()
				log.Printf("%v updated", incubatorFilename)
			}
		}
	}
}

func createMutator(target image.Image, focusImage image.Image) *Mutator {
	lineMutator := NewLineMutator(config, float32(target.Bounds().Size().X), float32(target.Bounds().Size().Y))
	circleMutator := NewCircleMutator(config, float32(target.Bounds().Size().X), float32(target.Bounds().Size().Y))
	polygonMutator := NewPolygonMutator(config, float32(target.Bounds().Size().X), float32(target.Bounds().Size().Y))
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
	mutator := NewMutator(instructionMutators, focusImage)
	return mutator
}

func displayProgress(bestDiff float32, instructionCount int) {
	log.Printf("Similarity: %v (diff=%v, instructions=%v)", FormatProgress(bestDiff), bestDiff, instructionCount)
}

func worker() {
	// start := time.Now()
	client := NewWorkerClient(*endpoint)
	targetImageData, err := client.GetTargetImageData()
	if err != nil {
		log.Fatalf("Error getting target image: '%v'", err.Error())
	}
	target, err := png.Decode(bytes.NewReader(targetImageData))
	if err != nil {
		log.Fatalf("Error reading image: '%v'", err.Error())
	}
	objectPool.SetRendererBounds(target.Bounds().Size().X, target.Bounds().Size().Y)
	var focusImage image.Image
	focusImageData, err := client.GetFocusImageData()
	if err != nil {
		log.Printf("Error loading focus image: '%v'", err.Error())
	} else if focusImageData != nil {
		focusImage, err = png.Decode(bytes.NewReader(focusImageData))
		if err != nil {
			log.Printf("Error reading focus image: '%v'", err.Error())
		} else {
			log.Println("Focus image is active")
		}
	}
	mutator := createMutator(target, focusImage)
	ranker := NewRanker()
	incubator := NewIncubator(config, target, mutator, ranker)
	incubator.Start()

	// Load seed organisms from the server
	log.Println("Getting seed organism from server...")
	organism, err := client.GetTopOrganism()

	if err != nil {
		log.Fatalf("Error getting initial seed population: '%v'", err.Error())
	}
	incubator.SetTopOrganism(organism)
	incubator.Iterate()

	// Start up worker portal
	portal := NewWorkerPortal(client)
	portal.Init(organism)
	portal.Start()

	bestDiff := float32(1000.0)
	instructionCount := 0
	var bestOrganism *Organism

	if err == nil {
		bestOrganism = incubator.GetTopOrganism()
		bestDiff = bestOrganism.Diff
		instructionCount = len(bestOrganism.Instructions)
		log.Printf("Initial similarity: %.15f%%", (1.0-(bestDiff/maxImageDiff))*100)
	}

	for {
		if incubator.Iteration%gcFrequency == 0 {
			log.Println("Running garbage collection")
			runtime.GC()
			log.Println("garbage collection completed")
		}
		// if (memprof != nil || prof != nil) && time.Since(start) >= profileDuration {
		// 	return
		// }
		incubator.Iterate()

		// log.Printf("Iteration %v", incubator.Iteration)
		bestOrganism = incubator.GetTopOrganism()
		if bestOrganism.Diff < bestDiff && bestOrganism.Diff != -1 {
			bestDiff = bestOrganism.Diff
			instructionCount = len(bestOrganism.Instructions)
			// TODO: don't make two calls here... duh...
			topOrganism := incubator.GetTopOrganism()
			portal.Export(topOrganism)
		}
		imported := portal.Import()
		if imported != nil {
			incubator.SetTopOrganism(imported)
			bestOrganism = imported
			bestDiff = imported.Diff
		}
		displayProgress(bestDiff, instructionCount)
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
	srcNumFrames := len(files)
	destNumFrames := framesPerSecond * *genvideoCmdLength
	skip := srcNumFrames / destNumFrames
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
		"-y",
		"-framerate",
		fmt.Sprint(framesPerSecond),
		"-i",
		// -i C:\myimages\img%03d.png
		fmt.Sprintf("%v/%%05d.png", "tmp"),
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
