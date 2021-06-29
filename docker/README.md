# Docker Image

## Deps

- [Docker](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/) for running locally.

## Build

From this (`docker`) directory

### docker

```sh
docker build .. -f ./Dockerfile
``` 

### docker-compose

```sh
docker-compose build hubble
```

## Run

### setup geth node

From this (`docker`) directory:

```sh
mkdir -p testData/dev-chain
docker-compose up -d geth
```

Complete the setup steps in [Local Development Setup](../SETUP.md).

At steps in the setup instructions where it asks you to attach to geth, you can instead:
```sh
geth attach ./testData/dev-chain/geth.ipc
```

Finally, copy over `genesis.json`.
```sh
cp ../genesis.json ./genesis.json
```

### run hubble node

From this (`docker`) directory:

```sh
docker-compose up -d geth # make sure geth container is running in background
sleep 10 # wait for geth to spin up
docker-compose up hubble 
```

## Troubleshooting

You can check all docker container statuses with:
```sh
docker ps -a
```

If geth or hubble is failing to startup, you can inspect the logs with:
```sh
docker logs geth
docker logs hubble
```