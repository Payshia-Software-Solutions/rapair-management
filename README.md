# Repair Management System

Welcome to the Repair Management repository. This project is a monorepo containing several related services and user interfaces for the repair management ecosystem.

## Project Structure

* **`front-end/`**: The primary user interface application.
* **`server/`**: The main backend service and API.
* **`nexus-portal-ui/`**: User interface for the Nexus Portal.
* **`nexus-portal-server/`**: Backend service for the Nexus Portal.
* **`local-printer/` & `local-printer-py/`**: Services and scripts for handling local printing functionality.

## Getting Started

Please refer to the individual directories for specific instructions on how to install dependencies, run development servers, and build the respective components.

## Deployment

BizzFlow runs as a SaaS application: one shared deployment serves every workspace (`APP_MODE=shared`, see `server/app/tenancy/`).

* Pushing to `live-prod` deploys the ERP API (`server/`).
* Pushing to `nexus-server-api-live` deploys the Nexus API (`nexus-portal-server/`).
