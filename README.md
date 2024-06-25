# ChatAI Web

This repository contains the web frontend of the ChatAI service. This includes all necessary configuration for the web-accessible cloud server to run the ChatAI web service. The code for the HPC backend is hosted in another repository, hpcinference. Note that this repository depends on the hpcinference backend.

## Getting started

Make sure you have docker installed.

```bash
docker --version
```

Clone the git repository, then navigate to the root folder.

```bash
git clone https://gitlab-ce.gwdg.de/hpc-team/chat-ai-web
cd chat-ai-web
```

> **Note**: Change the password in the POSTGRES_PASSWORD file for security reasons.

Then, build and run the docker containers using docker compose:

```bash
docker compose up db -d
docker compose up kong-migrations
docker compose up kong -d
docker compose build chat-ai-web-front
docker compose build chat-ai-web-back
docker compose up chat-ai-web-front -d
docker compose up chat-ai-web-back -d
```

## Configuration

Configure the necessary routes in the Kong Manager GUI which is hosted on port 8002. More detail will be included in the future.

## Database Backup

To store Kong's configuration, make sure the `db` container is running and run:

```bash
docker exec -it chat-ai-web-db-1 bash -c "pg_dump -U kong -d kong -F t > /backup/<db_filename>.tar"
```

The file will be generated in `kong/backup`. To restore the database from a file, make sure the file is located in `kong/backup/` and run:

```bash
docker exec -it chat-ai-web-db-1 bash -c "pg_restore -U kong -d kong -c -W -v /backup/<db_filename>.tar"
```

## Authors
- Ali Doosthosseini <adoosth@gwdg.de>
- Priyesh Chikhaliya
