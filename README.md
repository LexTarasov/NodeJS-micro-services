# NodeJS Microservices Architecture

A personal learning project built to deepen my understanding of backend development, system design, and how real-world distributed systems are structured.

---

## About This Project

This was one of my first projects diving into Node.js and backend architecture. My goal was to move beyond frontend development and understand how scalable backend systems are actually designed — not just how to write a server, but how to think about separating concerns, service communication, and infrastructure.

I chose a microservices pattern specifically because it forced me to make real architectural decisions: what belongs in its own service, how services talk to each other, and how an API gateway acts as the single entry point for the outside world.

---

## Architecture

The system is composed of five independent services, each with its own responsibility:

| Service | Responsibility |
|---|---|
| `api-gateway` | Single entry point — routes incoming requests to the correct service |
| `identity-service` | Authentication and user identity (JWT-based) |
| `post-service` | Core content logic |
| `media-service` | Media and file handling |
| `search-service` | Search functionality, decoupled from core logic |

All services run independently and are orchestrated together using **Docker Compose**.

---

## What I Learned

- How to structure a backend using the microservices pattern
- The role of an API gateway and why it matters for scalability
- Middleware, controllers, and route organization in Express
- JWT-based authentication flow across services
- How Docker Compose connects multiple services into one running system
- Why separating concerns at the service level makes systems easier to maintain and scale

---

## Tech Stack

- **Node.js** — runtime
- **Express** — server framework
- **Docker & Docker Compose** — containerization and orchestration
- **JWT** — authentication tokens
- **REST APIs** — inter-service and client communication

---

## Running the Project

```bash
# Clone the repo
git clone https://github.com/LexTarasov/NodeJS-micro-services.git
cd NodeJS-micro-services

# Start all services
docker-compose up
```

---

## Status

This is a learning project and not production-ready. It was built as a practical exercise to understand backend architecture patterns and system design fundamentals.
