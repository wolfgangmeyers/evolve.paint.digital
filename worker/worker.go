package main

import (
	"bytes"
	"image/png"
	"log"
	"os"
	"time"

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
	ranker.PrecalculateLabs(targetImage)
	workerChan := make(chan *evolve.WorkItem, 20)
	workerResultChan := make(chan *evolve.WorkItemResult, 20)
	pool := evolve.NewWorkerPool(targetImage.Bounds().Size().X, targetImage.Bounds().Size().Y, ranker, workerChan, workerResultChan, -1, nil)
	pool.Start()
	// Request loop
	go func() {
		for {
			workItems, err := client.GetWorkItems()
			if err != nil {
				log.Fatalf("Error getting work item: '%v'", err.Error())
			}
			if len(workItems) == 0 {
				time.Sleep(time.Millisecond * 10)
			} else {
				for _, workItem := range workItems {
					workerChan <- workItem
				}
			}
		}
	}()

	// Main result loop
	results := []*evolve.WorkItemResult{}
	// Wait up to 100 milliseconds to send last uneven batch
	// This assumes that all items will complete in less than 100 milliseconds...
	timer := time.NewTimer(time.Millisecond * 100)
	for {
		select {
		case workItemResult := <-workerResultChan:
			// log.Println("Received result from worker pool")
			results = append(results, workItemResult)
			if len(results) >= evolve.DefaultCount {
				// log.Printf("Submitting %v results", len(results))
				err := client.SubmitResults(results)
				if err != nil {
					log.Fatalf("Error submitting result: '%v'", err.Error())
				}
				results = []*evolve.WorkItemResult{}
			}
			if !timer.Stop() {
				// log.Println("draining timer")
				<-timer.C
			}
			timer.Reset(time.Millisecond * 100)
		case <-timer.C:
			// log.Printf("Submitting %v results (timeout)", len(results))
			if len(results) > 0 {
				err := client.SubmitResults(results)
				if err != nil {
					log.Fatalf("Error submitting result: '%v'", err.Error())
				}
				results = []*evolve.WorkItemResult{}
			} else {
				time.Sleep(time.Millisecond * 10)
			}

			timer.Reset(time.Millisecond * 100)
		}

	}
}
