FROM condaforge/mambaforge:24.9.2-0

# Configure timezone and avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Europe/Paris \
    PATH=/opt/conda/bin:$PATH

# Install system dependencies + Node.js LTS (20.x) via NodeSource apt repo
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    coreutils \
    git \
    wget \
    curl \
    nginx \
    supervisor \
    squashfs-tools \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy local SynFlow app (uses .dockerignore to exclude node_modules, .git, data)
COPY . /var/www/html/synflow

# Install Node.js deps + clone workflow + create conda env + symlink comparisons
RUN cd /var/www/html/synflow \
    && npm install --omit=dev \
    && npm cache clean --force \
    && git clone --depth 1 --branch docker --single-branch https://gitlab.cirad.fr/agap/cluster/snakemake/synflow.git /app/workflow \
    && cd /app/workflow \
    && mamba env create -n synflow -f envs/synflow.yml --yes \
    && mamba clean -a -y \
    && mkdir -p /data/comparisons/sample /data/input /data/output /data/uploads \
    && mkdir -p /var/www/html/synflow/data \
    && ln -sf /data/comparisons /var/www/html/synflow/data/comparisons

# Copy config files (lisibles, maintenables)
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create non-root user for running services + verify installations
RUN groupadd -r synflow && useradd -r -g synflow -m -d /home/synflow synflow \
    && chown -R synflow:synflow /data /var/www/html/synflow \
    && chown -R synflow:synflow /var/log/nginx /var/lib/nginx /run \
    && echo 'source /opt/conda/etc/profile.d/conda.sh' >> /home/synflow/.bashrc \
    && echo 'conda activate synflow' >> /home/synflow/.bashrc \
    && bash -c "source /opt/conda/etc/profile.d/conda.sh && \
       conda activate synflow && \
       echo '=== Environment Check ===' && \
       python --version && \
       snakemake --version && \
       node --version"

# Health check : vérifie que nginx et node répondent
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Expose ports
EXPOSE 80 3031

# Define volumes
VOLUME ["/data/comparisons", "/data/input", "/data/output", "/data/uploads"]

WORKDIR /app

# Supervisor tourne en root (nécessaire pour nginx port 80)
# mais Node.js tourne en user synflow (via user=synflow dans supervisord.conf)

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
