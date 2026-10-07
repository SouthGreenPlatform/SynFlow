# Installation 

This document provides instructions to install and run **SynFlow** using Docker.

**Requirements**

- [Docker](https://docs.docker.com/get-docker/) version 20.x or higher


**Pulling the Docker image**

Before running SynFlow, you must first download the corresponding Docker image from the registry. This is done using the docker pull command. It ensures that you have the latest version of the image locally before launching the container.

```bash
docker pull ghcr.io/southgreenplatform/synflow:latest
``` 

**Run the application**

```bash

docker run -d --name synflow -p 8080:80 -e SNAKEMAKE_CORES=4 ghcr.io/southgreenplatform/synflow:latest

```
Then open your browser and navigate to:

```
http://localhost:8080
```

Nginx is the public façade: it serves the interface and relays uploads, downloads, and Socket.IO traffic to the internal Node.js service. Port `3031` is not published. Set `SNAKEMAKE_CORES` to choose the number of local Snakemake cores.

If you want to modify the list shown in the Existing file section, you can create a JSON configuration file as illustrated in the example:
```json
[
    { "organism": "Test", "url": "https://hpc.cirad.fr/bank/banana/synflow/" },
    { "organism": "Grapevine", "url": "https://hpc.cirad.fr/bank/vitis/Synflow/" }
]
```
In the Docker command, you need to add a CONFIG_FILE_PATH environment variable using the -e option and mount the new volume using the -v option.
```bash
docker run -d --name synflow -p 8080:80 -v  $(pwd)/config.json:/data/config.json -e CONFIG_FILE_PATH=/data/config.json -e SNAKEMAKE_CORES=4 ghcr.io/southgreenplatform/synflow:latest
```

**Support**

If you encounter issues, feel free to open an [Issue on GitHub](https://github.com/SouthGreenPlatform/SynFlow/issues).
