# Backend Structure Document

This document provides an overview of the backend architecture for Nodus-App – a custom Nostr client aimed at communities. It is written in everyday language so that anyone can understand the backend setup.

## Backend Architecture

The backend is built using a modular design where components can easily evolve to include microservices. This helps in maintaining and scaling the system as the project grows. We are using these design patterns and frameworks:

- **Modular Design:** Different services (authentication, caching, messaging) are independent.
- **Microservice Ready:** Although not fully implemented as separate microservices, the structure supports splitting services into microservices when needed.
- **Frameworks & Protocols:** The backend considers protocols like NIP-01, NIP-04, NIP-05, NIP-07, NIP-13, and NIP-42 for secure communication and custom authentication methods. 

This design ensures that the backend remains fast, scalable, and simple to maintain, even as new features are added (like push notifications or integrations with community management tools).

## Database Management

The project uses local caching and optional centralized caching mechanisms. Here are the main points:

- **Local Cache:** IndexedDB is used on the client side (via Dexie) to provide offline functionality. Data persists across sessions and can be cleared if necessary.
- **Optional Backend Caching:** Redis is considered for caching, which speeds up data retrieval if implemented in the future.
- **Primary Data Storage:** SQLite acts as the fallback database, keeping things lightweight and easy to manage in initial stages.

Data is structured and stored to allow simple synchronization between offline and online modes. This structure ensures that when users come back online, any stored changes are updated, and the feed synchronizes with changes from the network.

## Database Schema

For SQLite (the fallback database), the schema is designed with simplicity in mind but can grow over time. Here is the human-readable description followed by an SQL example:

- **Users Table:** Holds information about each user including public keys, authentication details, and profile information.
- **Messages Table:** Stores both public posts and private messages (with encrypted content for private messages).
- **Cache Table:** Used for local caching of feed events and synchronization markers.

Example SQL Schema for SQLite:

-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_key TEXT UNIQUE NOT NULL,
    username TEXT,
    profile_info TEXT
);

-- Messages Table
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_public_key TEXT NOT NULL,
    receiver_public_key TEXT,
    content TEXT NOT NULL,
    encrypted INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_public_key) REFERENCES users(public_key)
);

-- Cache Table
CREATE TABLE cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_data TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

## API Design and Endpoints

The API is designed following RESTful principles to allow smooth communication between the frontend and the backend. Key points include:

- **REST API:** We have endpoints for retrieving user profiles, post feeds, sending messages, and interactions.
- **Key Endpoints:**
  - **/users:** For creating, retrieving, and updating user accounts.
  - **/posts:** For fetching the main feed and posting new updates.
  - **/messages:** For retrieving and sending both public and encrypted private messages.
  - **/sync:** For synchronizing local caches with the main feed when the user comes online.
- **Ease of Use:** The endpoints are designed to be simple and consistent, which ensures users experience efficient communication between their client and our server, even in offline-to-online transitions.

## Hosting Solutions

The application backend is hosted in a cloud environment with containerization support. Key elements include:

- **Docker:** The preferred deployment method allows the backend to run in isolated containers, making it easier to deploy, scale, and maintain.
- **Cloud Providers:** Options like AWS, Google Cloud, or Azure can be used as they offer a robust environment while ensuring cost-effectiveness and reliable uptime.
- **Benefits:** The hosting solution is reliable (minimal downtime), scalable (handles increased user loads), and flexible (supports future microservice architecture when needed).

## Infrastructure Components

The following infrastructure components work together to enhance performance and user experience:

- **Load Balancers:** Ensure that incoming requests are distributed evenly across backend servers, which increases reliability and performance.
- **Caching (Redis):** Optional caching layer to quickly deliver frequently requested data and reduce the load on the database.
- **Content Delivery Networks (CDNs):** Even though the backend serves primarily dynamic content, CDNs can be introduced to serve static assets efficiently and improve load times.
- **Local Caching (IndexedDB):** At the client side, IndexedDB stores data offline for quick access and synchronization once online.

## Security Measures

Security is a key focus in the backend setup, especially since the application deals with secure messaging and key management.

- **Authentication & Authorization:** User authentication uses simple and secure key-based methods (NIP-42) to manage public and private keys.
- **Encryption:** Private messaging using NIP-04 ensures that messages remain encrypted and secure during transmission, protecting user privacy.
- **Data Protection:** Sensitive data such as keys and messages are stored and transmitted using best practices in encryption. While whitenoise type obfuscation isn’t implemented now, the system is designed to easily integrate additional encryption layers.
- **Regulatory Compliance:** Security measures align with industry standards to protect user data and ensure compliance with relevant regulations.

## Monitoring and Maintenance

To maintain a reliable and up-to-date backend, several tools and practices are in place:

- **Performance Monitoring:** Tools can monitor server health, track response times, and log errors to keep tabs on the system’s performance.
- **Logging:** Basic logging is implemented for actions such as user authentication, message sending, and synchronization events – paving the way for future logging and monitoring systems.
- **Regular Updates:** With a modular architecture, updates can be applied incrementally to individual components without affecting the entire system.

## Conclusion and Overall Backend Summary

In summary, the backend structure is designed to be simple, robust, and scalable while meeting the primary needs of Nodus-App with offline functionality, secure communication, and ease of management. Key takeaways include:

- A modular, microservice-ready architecture that supports scalability and future integrations.
- Use of SQLite as the lightweight primary database with an optional Redis layer for caching.
- Local cache via IndexedDB ensures offline capability and quick synchronization when back online.
- RESTful API endpoints that facilitate smooth communication between frontend and backend.
- Reliable hosting via Docker in a cloud environment, with supporting infrastructure like load balancers, CDNs, and security measures in place.
- A strong focus on security through encryption, secure key management, and user authentication.

This setup positions Nodus-App to meet its goals of offering a secure, user-friendly, and community-driven Nostr client, ready for future feature enhancements and expanding user bases.