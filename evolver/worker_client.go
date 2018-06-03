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
	organism := &Organism{}
	organism.Load(data)
	return organism, nil
}

func (client *WorkerClient) SubmitOrganisms(organisms []*Organism) error {
	batch := &OrganismBatch{}
	batch.Save(organisms)
	data, err := json.Marshal(batch)
	if err != nil {
		return err
	}
	resp, err := http.Post(fmt.Sprintf("%v/organisms", client.endpoint), "application/json", bytes.NewReader(data))
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
