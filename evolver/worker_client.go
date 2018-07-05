package main

import (
	"bytes"
	json "encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

// WorkerClient is a client to access the http api of the main server.
type WorkerClient struct {
	endpoint string
}

func NewWorkerClient(endpoint string) *WorkerClient {
	client := new(WorkerClient)
	client.endpoint = endpoint
	return client
}

func (client *WorkerClient) GetTopOrganism() (*Organism, error) {
	resp, err := http.Get(fmt.Sprintf("%v/organism", client.endpoint))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	organism := objectPool.BorrowOrganism()
	organism.Load(data)
	return organism, nil
}

func (client *WorkerClient) GetTopOrganismDelta(previous string) (*GetOrganismDeltaResponse, error) {
	resp, err := http.Get(fmt.Sprintf("%v/organism/delta?previous=%v", client.endpoint, previous))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Received status code %v from server", resp.StatusCode)
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	result := &GetOrganismDeltaResponse{}
	err = json.Unmarshal(data, result)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (client *WorkerClient) SubmitOrganism(patch *Patch) error {
	data, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	resp, err := http.Post(fmt.Sprintf("%v/organism", client.endpoint), "application/json", bytes.NewReader(data))
	if resp != nil {
		resp.Body.Close()
	}
	return err
}

func (client *WorkerClient) GetTargetImageData() ([]byte, error) {
	resp, err := http.Get(fmt.Sprintf("%v/target", client.endpoint))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return data, nil
}

// GetFocusImageData returns the focus image as a png.
func (client *WorkerClient) GetFocusImageData() ([]byte, error) {
	resp, err := http.Get(fmt.Sprintf("%v/focus", client.endpoint))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return data, nil
}
