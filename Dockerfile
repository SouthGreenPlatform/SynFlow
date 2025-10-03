FROM condaforge/mambaforge:latest

# Configure timezone and avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Europe/Paris \
    PATH=/opt/conda/bin:$PATH
# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    nginx \
    supervisor \
    squashfs-tools \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js LTS (20.x)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone SynFlow web application
RUN git clone https://github.com/SouthGreenPlatform/SynFlow.git /var/www/html/synflow

# Install Node.js dependencies
WORKDIR /var/www/html/synflow
RUN npm install && npm cache clean --force
# Clone Snakemake workflow repository
RUN git clone https://gitlab.cirad.fr/agap/cluster/snakemake/synflow.git /app/workflow

# Create conda environment from YAML
WORKDIR /app/workflow
RUN mamba env create -f envs/synflow.yml --yes && \
    mamba clean -a -y

# Install Snakemake in base environment
#RUN mamba install -n base -c conda-forge snakemake --yes && \
#    mamba clean -a -y


# Create data directories and download sample data
RUN mkdir -p /data/comparisons/sample /data/input /data/output /data/uploads && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-acuminata-malaccensis.bed \
        https://hpc.cirad.fr/bank/banana/synflow/m-acuminata-malaccensis.bed && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-balbisiana.bed \
        https://hpc.cirad.fr/bank/banana/synflow/m-balbisiana.bed && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-acuminata-malaccensis_m-balbisiana.anchors \
        https://hpc.cirad.fr/bank/banana/synflow/m-acuminata-malaccensis_m-balbisiana.anchors && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-acuminata-malaccensis_m-balbisiana.out \
        https://hpc.cirad.fr/bank/banana/synflow/m-acuminata-malaccensis_m-balbisiana.out && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-balbisiana_m-acuminata-malaccensis.anchors \
        https://hpc.cirad.fr/bank/banana/synflow/m-balbisiana_m-acuminata-malaccensis.anchors && \
    wget --no-check-certificate -q -O /data/comparisons/sample/m-balbisiana_m-acuminata-malaccensis.out \
        https://hpc.cirad.fr/bank/banana/synflow/m-balbisiana_m-acuminata-malaccensis.out

# Create symbolic link for comparisons directory
RUN mkdir -p /var/www/html/synflow/data && \
    ln -sf /data/comparisons /var/www/html/synflow/data/comparisons

# Configure Nginx
RUN echo 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /var/www/html/synflow;\n\
    index index.html;\n\
    client_max_body_size 500M;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Proxy to Node.js API if available\n\
    location /api/ {\n\
        proxy_pass http://localhost:3000;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_connect_timeout 5s;\n\
        proxy_read_timeout 60s;\n\
        error_page 502 503 504 = @api_fallback;\n\
    }\n\
\n\
    location @api_fallback {\n\
        return 503 "{\\"error\\": \\"API service unavailable\\"}";\n\
        add_header Content-Type application/json;\n\
    }\n\
\n\
    # Allow access to comparison files\n\
    location /data/comparisons {\n\
        alias /data/comparisons;\n\
        autoindex on;\n\
        autoindex_format json;\n\
        add_header Access-Control-Allow-Origin *;\n\
    }\n\
\n\
    # File uploads\n\
    location /uploads {\n\
        alias /data/uploads;\n\
    }\n\
}\n\
' > /etc/nginx/sites-available/default

# Configure Supervisor
RUN echo '[supervisord]\n\
nodaemon=true\n\
\n\
[program:nginx]\n\
command=/usr/sbin/nginx -g "daemon off;"\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:nodejs]\n\
command=/usr/bin/node /var/www/html/synflow/src/server.js\n\
directory=/var/www/html/synflow/src/js\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
\n\
[program:snakemake_watcher]\n\
command=/app/snakemake_watcher.sh\n\
autostart=true\n\
autorestart=true\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n\
' > /etc/supervisor/conf.d/supervisord.conf

# Create Snakemake watcher script
RUN echo '#!/bin/bash\n\
echo "Snakemake watcher started..."\n\
\n\
# Initialize conda for bash\n\
source /opt/conda/etc/profile.d/conda.sh\n\
\n\
# Activate synflow environment\n\
conda activate synflow\n\
\n\
echo "Conda environment activated: synflow"\n\
echo "Python: $(which python)"\n\
echo "Snakemake: $(which snakemake)"\n\
echo "Singularity: $(which singularity)"\n\
\n\
while true; do\n\
    if [ -f /data/input/run_pipeline.json ]; then\n\
        echo "Pipeline trigger detected, starting Snakemake..."\n\
        cd /app/workflow\n\
        \n\
        # Run Snakemake with conda and singularity support\n\
        snakemake --cores 4 \\\n\
            --directory /data/output \\\n\
            --configfile /data/input/run_pipeline.json \\\n\
            --use-conda \\\n\
            --use-singularity \\\n\
            --singularity-args "--bind /data:/data"\n\
        \n\
        if [ $? -eq 0 ]; then\n\
            echo "Pipeline completed successfully"\n\
            cp /data/output/*.out /data/comparisons/ 2>/dev/null || true\n\
            cp /data/output/*.anchors /data/comparisons/ 2>/dev/null || true\n\
            cp /data/output/*.bed /data/comparisons/ 2>/dev/null || true\n\
            echo "Results copied to /data/comparisons/"\n\
        else\n\
            echo "Pipeline failed"\n\
        fi\n\
        \n\
        rm /data/input/run_pipeline.json\n\
    fi\n\
    sleep 5\n\
done\n\
' > /app/snakemake_watcher.sh && chmod +x /app/snakemake_watcher.sh

# Verify installations
RUN bash -c "source /opt/conda/etc/profile.d/conda.sh && \
    conda activate synflow && \
    echo '=== Environment Check ===' && \
    python --version && \
    snakemake --version && \
    singularity --version && \
    node --version"

# Create bashrc to auto-activate conda environment
RUN echo 'source /opt/conda/etc/profile.d/conda.sh' >> /root/.bashrc && \
    echo 'conda activate synflow' >> /root/.bashrc && \
    echo 'echo "Conda environment: synflow (activated)"' >> /root/.bashrc

# Expose ports
EXPOSE 80 3000

# Define volumes
VOLUME ["/data/comparisons", "/data/input", "/data/output", "/data/uploads"]

WORKDIR /app

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
