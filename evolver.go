package main

import (
	"fmt"
	"image"
	"image/color"
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/fogleman/gg"

	kingpin "gopkg.in/alecthomas/kingpin.v2"
)

var (
	app        = kingpin.New("evolver", "Program to evolve paintings from a reference image")
	testCmd    = app.Command("test", "A test command to develop features of the evolver")
	targetFile = testCmd.Arg("target", "File containing the target image").Required().String()

	compareCmd   = app.Command("compare", "Compares two image files for difference and prints the result")
	compareFile1 = compareCmd.Arg("file1", "First file to compare").Required().String()
	compareFile2 = compareCmd.Arg("file2", "Second file to compare").Required().String()
)

func init() {
	rand.Seed(time.Now().Unix())
}

func loadImage(imageFile string) image.Image {
	img, err := gg.LoadImage(imageFile)
	if err != nil {
		log.Fatalf("Error loading target image from file '%v': %v", imageFile, err.Error())
	}
	return img
}

func main() {
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
	numlines := 300
	renderer := NewRenderer(target.Bounds().Size().X, target.Bounds().Size().Y)
	items := make([]Instruction, numlines)
	for i := 0; i < numlines; i++ {
		line := &Line{
			StartX: rand.Float64() * 1000,
			StartY: rand.Float64() * 1000,
			EndX:   rand.Float64() * 1000,
			EndY:   rand.Float64() * 1000,
			Color: &color.RGBA{
				A: 255,
				G: uint8(rand.Int31n(255)),
				B: uint8(rand.Int31n(255)),
				R: uint8(rand.Int31n(255)),
			},
			Width: rand.Float64()*10 + 1,
		}
		items[i] = line
	}
	renderer.Render(items)
	rendered := renderer.GetImage()

	ranker := &Ranker{}
	diff, err := ranker.Distance(target, rendered)
	if err != nil {
		log.Fatalf("Error calculating distance: %v", err.Error())
	}
	log.Printf("Difference: %v", diff)

	renderer.SaveToFile("test.png")
}
