package main

import (
	"bytes"
	"image/png"
	"log"
	"os"

	"bitbucket.org/wolfgang_meyers/evolve.paint.digital/evolve"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

var (
	app = kingpin.New("worker", "Launch external worker process for evolve.paint.digital")

	runCmd         = app.Command("run", "Run the worker process")
	runCmdEndpoint = runCmd.Arg("endpoint", "Endpoint of the main server process").Required().String()
)

func main() {
	cmd := kingpin.MustParse(app.Parse(os.Args[1:]))
	switch cmd {
	case runCmd.FullCommand():
		run()
	default:
		log.Fatalf("Unknown command: %v", cmd)
	}
}

func run() {
	client := evolve.NewWorkerClient(*runCmdEndpoint)
	targetImageData, err := client.GetTargetImageData()
	if err != nil {
		log.Fatalf("Error getting target image: '%v'", err.Error())
	}
	ranker := evolve.NewRanker()
	targetImage, err := png.Decode(bytes.NewReader(targetImageData))
	if err != nil {
		log.Fatalf("Error reading image: '%v'", err.Error())
	}
	workerChan := make(chan *evolve.WorkItem)
	workerResultChan := make(chan *evolve.WorkItemResult)
	pool := evolve.NewWorkerPool(targetImage.Bounds().Size().X, targetImage.Bounds().Size().Y, ranker, workerChan, workerResultChan, -1, nil)
	pool.Start()
	// Request loop
	go func() {
		for {
			workItem, err := client.GetWorkItem()
			if err != nil {
				log.Fatalf("Error getting work item: '%v'", err.Error())
			}
			workerChan <- workItem
		}
	}()

	// Main result loop
	for {
		workItemResult := <-workerResultChan
		err := client.SubmitResult(workItemResult)
		if err != nil {
			log.Fatalf("Error submitting result: '%v'", err.Error())
		}
	}
}
