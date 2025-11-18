# Installation Guide — SynFlow

This document provides instructions to install and run **SynFlow**, a web-based genome synteny visualization tool, using Docker.

---

## Quick Start with Docker

This command builds a lightweight Nginx-based Docker image containing the full SynFlow web application and some example data files.

### Create directory

```bash
mkdir -p data/{comparisons,input,output,uploads}
```

###  Run the Application

```bash
docker run -d --name synflow  -p 8080:80   -p 3031:3031   -v $(pwd)/data/comparisons:/data/comparisons  -v $(pwd)/data/input:/data/input -v $(pwd)/data/output:/data/output  -v $(pwd)/data/uploads:/data/uploads  -e SNAKEMAKE_CORES=4  ghcr.io/southgreenplatform/synflow:latest
```

Then open your browser and navigate to:

```
http://localhost:8080
```
---

## Example Data Included

When building the Docker image, two example files are automatically downloaded to the `/public/data/` directory:

- `example.syri.out`

These allow you to test the interface immediately.

---

## Using Your Own Data

You can mount your own directory at runtime to replace or extend the `public/data` folder:

```bash
docker run --rm -p 8080:80 \
  -v $(pwd)/my_data:/usr/share/nginx/html/public/data \
  synflow
```
---


## Requirements

- [Docker](https://docs.docker.com/get-docker/) version 20.x or higher

---

## Support

If you encounter issues, feel free to open an [Issue on GitHub](https://github.com/SouthGreenPlatform/SynFlow/issues).
