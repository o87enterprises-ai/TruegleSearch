# Hugging Face Spaces, Docker SDK. Spaces expects the app on 7860.
FROM python:3.11-slim

# dnstwist resolves domains and maigret opens a lot of sockets; ca-certificates
# is the one thing slim images leave out that breaks TLS everywhere.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Spaces runs as a non-root user; keeping HOME writable stops the OSINT
# libraries failing when they try to cache their site lists.
ENV HOME=/tmp PYTHONUNBUFFERED=1
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
