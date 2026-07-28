FROM minio/minio:RELEASE.2025-09-07T16-13-09Z

ARG MINIO_ROOT_USER
ARG MINIO_ROOT_PASSWORD

WORKDIR /data

COPY ./minio-init.sh /usr/bin/minio-init.sh

RUN chmod +x /usr/bin/minio-init.sh

ENTRYPOINT ["/usr/bin/minio-init.sh"]