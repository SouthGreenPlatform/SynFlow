FROM condaforge/mambaforge:24.9.2-0

# Configure timezone and avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Europe/Paris \
    PATH=/opt/conda/bin:$PATH

# Install system dependencies + Node.js LTS (20.x)
RUN apt-get update && apt-get install -y \
    coreutils \
    git \
    wget \
    curl \
    nginx \
    supervisor \
    squashfs-tools \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone SynFlow web application
RUN git clone https://github.com/SouthGreenPlatform/SynFlow.git /var/www/html/synflow
# Install Node.js deps + clone workflow + create conda env + download sample data + symlink comparisons
RUN cd /var/www/html/synflow \
    && npm install \
    && npm cache clean --force \
    && git clone --depth 1 --branch docker --single-branch https://gitlab.cirad.fr/agap/cluster/snakemake/synflow.git /app/workflow \
    && cd /app/workflow \
    && mamba env create -n synflow -f envs/synflow.yml --yes \
    && mamba clean -a -y \
    && mkdir -p /data/comparisons/sample /data/input /data/output /data/uploads \
    && mkdir -p /var/www/html/synflow/data \
    && ln -sf /data/comparisons /var/www/html/synflow/data/comparisons
    
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
        proxy_pass http://localhost:3031;\n\
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
    location /data/comparisons/ {\n\
        alias /data/comparisons/;\n\
        autoindex on;\n\ 
        add_header Access-Control-Allow-Origin *;\n\
        add_header Access-Control-Allow-Methods "GET, OPTIONS";\n\
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
' > /etc/supervisor/conf.d/supervisord.conf
  
# Verify installations
RUN bash -c "source /opt/conda/etc/profile.d/conda.sh && \
    conda activate synflow && \
    echo '=== Environment Check ===' && \
    python --version && \
    snakemake --version && \ 
    node --version"

# Create bashrc to auto-activate conda environment
RUN echo 'source /opt/conda/etc/profile.d/conda.sh' >> /root/.bashrc && \
    echo 'conda activate synflow' >> /root/.bashrc && \
    echo 'echo "Conda environment: synflow (activated)"' >> /root/.bashrc

# Expose ports
EXPOSE 80 3031

# Define volumes
VOLUME ["/data/comparisons", "/data/input", "/data/output", "/data/uploads"]

WORKDIR /app

# Start Supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
