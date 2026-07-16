#!/bin/bash
set -e

# Start MinIO server in the background
minio server /data --console-address ":9001" &
MINIO_PID=$!

# Wait for MinIO to be ready before running mc commands
until mc alias set local http://localhost:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"; do
  echo "Waiting for MinIO to start..."
  sleep 2
done

# Create buckets (no-op if they already exist)
mc mb --ignore-existing local/product-image

# Set public read access
mc anonymous set public local/product-image

# Seed product images from the bind-mounted host directory
mc cp --recursive /home/image/ local/product-image/

# Hand control back to MinIO
wait $MINIO_PID