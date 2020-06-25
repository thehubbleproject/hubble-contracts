dep:
	dep ensure -v
	rm -rf vendor/github.com/ethereum
	mkdir -p vendor/github.com/ethereum
	git clone -b v1.9.0 --single-branch --depth 1 https://github.com/ethereum/go-ethereum vendor/github.com/ethereum/go-ethereum
	
contracts:
	abigen --abi=contracts/rollup/rollup.abi --pkg=rollup --out=contracts/rollup/rollup.go
	abigen --abi=contracts/merkleTree/merkleTree.abi --pkg=merkleTree --out=contracts/merkleTree/merkleTree.go
	abigen --abi=contracts/trial/trial.abi --pkg=trial --out=contracts/trial/trial.go
	abigen --abi=contracts/logger/logger.abi --pkg=logger --out=contracts/logger/logger.go
	abigen --abi=contracts/depositmanager/depositmanager.abi --pkg=depositmanager --out=contracts/depositmanager/depositmanager.go
	abigen --abi=contracts/coordinatorproxy/coordinatorproxy.abi --pkg=coordinatorproxy --out=contracts/coordinatorproxy/coordinatorproxy.go

clean:
	rm -rf build

build: clean
	mkdir -p build
	go build -o build/hubble ./cmd

buidl: build

init:
	./build/hubble init

reset:
	./build/hubble migration down --all
	./build/hubble migration up

migrate-up:
	./build/hubble migration up

migrate-down:
	./build/hubble migration down --all

start:
	mkdir -p logs &
	./build/hubble start > ./logs/node.log & 

start-simulator:
	mkdir -p logs &
	./build/hubble start-simulating > ./logs/simulator.log & 
	 
.PHONY: contracts dep start-simulator build clean start buidl
