package main

import (
	"encoding/json"
	"io/ioutil"
	"os"
)

// Config is the configuration for the evolver application
type Config struct {
	// Colors
	MinHueMutation        float32
	MaxHueMutation        float32
	MinValueMutation      float32
	MaxValueMutation      float32
	MinSaturationMutation float32
	MaxSaturationMutation float32
	// Coordinates
	MinCoordinateMutation float32
	MaxCoordinateMutation float32
	// Lines
	MinLineWidthMutation    float32
	MaxLineWidthMutation    float32
	MaxLineWidth            float32
	MaxLineLength           float32
	MaxLineArea             float32
	MinCircleRadiusMutation float32
	MaxCircleRadiusMutation float32
	MaxCircleRadius         float32
	// Polygons
	MinPolygonRadius         float32
	MaxPolygonRadius         float32
	MinPolygonRadiusMutation float32
	MaxPolygonRadiusMutation float32
	MinPolygonAngleMutation  float32
	MaxPolygonAngleMutation  float32
	MinPolygonPoints         int
	MaxPolygonPoints         int
	// Other stuff
	InstructionTypes    []string
	ComplexityThreshold int     // An organism can reach this many instructions before score penalties are applied
	ComplexityPenalty   float32 // For each instruction over the threshold, this amount is added to the diff
	MaxPopulation       int     // When repopulating, don't create more than this many organisms
	MinComplexity       int     // Lower bound of default complexity when creating random organisms
	MaxComplexity       int     // Upper bound of default complexity when creating random organisms
	MinMutations        int     // Minimum number of mutations applied to an organism
	MaxMutations        int     // Maximum number of mutations applied to an organism
	WorkerCount         int     // At most this many workers. If less than or equal to zero, all cpus are applied to worker pool.
	SyncFrequency       int     // Wait at most this many iterations before fetching top organisms from the server
}

// LoadConfig loads the application config from a file
func LoadConfig(filename string) (*Config, error) {
	config := DefaultConfig()
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(data, config)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// SaveConfig saves an application configuration to disk
func SaveConfig(filename string, config *Config) error {
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.Write(data)
	return err
}

// DefaultConfig returns the default application configuration
func DefaultConfig() *Config {
	return &Config{
		MinHueMutation:          0,
		MaxHueMutation:          10,
		MinValueMutation:        0,
		MaxValueMutation:        0.1,
		MinSaturationMutation:   0,
		MaxSaturationMutation:   0.1,
		MinCoordinateMutation:   0,
		MaxCoordinateMutation:   100,
		MinLineWidthMutation:    0,
		MaxLineWidthMutation:    5,
		MaxLineWidth:            20,
		MinCircleRadiusMutation: 0,
		MaxCircleRadiusMutation: 5,
		MaxCircleRadius:         20,
		MinPolygonRadius:        2,
		MaxPolygonRadius:        10,

		MinPolygonRadiusMutation: 0,
		MaxPolygonRadiusMutation: 5,
		MinPolygonAngleMutation:  0,
		MaxPolygonAngleMutation:  20,
		MinPolygonPoints:         3,
		MaxPolygonPoints:         7,

		MaxLineLength:       50,
		MaxLineArea:         250,
		ComplexityThreshold: 10000,
		ComplexityPenalty:   0.01,
		MaxPopulation:       8,
		MinComplexity:       1000,
		MaxComplexity:       5000,
		MinMutations:        1,
		MaxMutations:        10,
		InstructionTypes: []string{
			TypeLine, TypeCircle,
		},
		WorkerCount:   0,
		SyncFrequency: 50,
	}
}
