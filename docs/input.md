
# Input
You can explore genomic comparisons in three ways:

- [Use an existing dataset](#use-an-existing-dataset)
- [Upload your own SyRI results](#upload-your-own-syri-output)
- [Run the Synmake workflow with your FASTA genomes](#run-the-synmake-workflow)
- [Browse_FTP](#browse-ftp)


## Use an existing dataset

To explore without uploading anything, you can choose from a list of curated genome comparisons available for:

- **Banana** (*Musa* species)
- **Grapevine** (*Vitis* species)

Go to the **“Existing files”** tab.

![Existing files](assets/existing_files.png "Existing files")

Select your dataset from the dropdown (e.g. *m acuminata banksii - m acuminata malaccensis*).

![Dataset](assets/select_genome.png "Dataset")

Click **Draw** to visualize the structural variants.

---

## Upload your own SyRI output

Files must be in SyRI output results in TSV formats. [See the SyRI documentation](https://schneebergerlab.github.io/syri/fileformat.html)

Go to the **“Upload files”** tab.

![Upload file](assets/upload_file.png "Upload file")

---

## Run workflow

Don’t have SyRI results yet? You can submit two genome assemblies (FASTA files), and the **Synmake** pipeline will compute alignments and run SyRI for you.

[Synmake](https://gitlab.cirad.fr/agap/cluster/snakemake/synflow) is a Snakemake-based workflow developed to generate SyRI-compatible results for use in Synflow.

The workflow can either be executed directly from the web application or installed and run locally.
If run locally, the results can be shared with Synflow by providing a public URL in the "Browse FTP" section of the web application.

**Required files:**

- FASTA files: Genome assemblies in FASTA format
- Minimum 2 genomes required

**Optional inputs:**

- GFF3 files: Gene annotations (required only for MCScanX analysis)
  
Must be provided for all genomes. The same prefix must be used if synteny involves genomes with different chromosome counts.
These files are also required for protein extraction and gene-based synteny detection.

Go to the **“Run Workflow”** tab.

![Run job](assets/run_workflow.png "Run job")

Upload two `.fasta` genome files (reference and query).

---

## Browse FTP


---


Click **Submit**. 

 
