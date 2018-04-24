package main

import (
	"encoding/json"
	"io/ioutil"
	"os"
)

// Config is the configuration for the evolver application
type Config struct {
	MinHueMutation        float64
	MaxHueMutation        float64
	MinValueMutation      float64
	MaxValueMutation      float64
	MinSaturationMutation float64
	MaxSaturationMutation float64
	MinCoordinateMutation float64
	MaxCoordinateMutation float64
	MinLineWidthMutation  float64
	MaxLineWidthMutation  float64
}

// LoadConfig loads the application config from a file
func LoadConfig(filename string) (*Config, error) {
	config := &Config{}
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
		MinHueMutation:        0,
		MaxHueMutation:        10,
		MinValueMutation:      0,
		MaxValueMutation:      0.1,
		MinSaturationMutation: 0,
		MaxSaturationMutation: 0.1,
		MinCoordinateMutation: 0,
		MaxCoordinateMutation: 100,
		MinLineWidthMutation:  0,
		MaxLineWidthMutation:  10,
	}
}
