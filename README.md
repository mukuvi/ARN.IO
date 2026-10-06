# ARN.IO

A digital library and reading companion. Browse a book collection, read in the browser, track your progress, take notes and ask an assistant about whatever you are reading.

## Features

### Library and reading

- A curated collection of books with full chapter content
- Chapter by chapter reading in the browser
- Search by title, author or genre
- Upload your own PDF, Word, TXT, Markdown, HTML or RTF files, split into chapters automatically

### Progress

- Per book progress with the current chapter and percent complete
- Reading streaks and session tracking in minutes and pages
- Remove books from your reading list

### Notes

- Notes tied to a specific book and chapter
- View and manage all notes for a book

### Assistant

- Chat about any book for summaries, themes, character analysis and recommendations
- Chat history kept per book
- Works with built in keyword matching out of the box, and can use an API key for richer answers

## Stack

- Client: React and Vite
- Server: Node.js, Express and PostgreSQL
- Infrastructure: Docker, docker-compose, Vercel

## Run it

### With Docker

Create a `.env` file with the values below, then start the stack:

```bash
docker-compose up --build
```

```
FRONTEND_PORT=3000
BACKEND_PORT=3001
PG_HOST=
PG_PORT=
PG_USER=
PG_PASSWORD=
PG_DATABASE=
DATABASE_URL=
GROQ_API_KEY=
DEEPSEEK_API_KEY=
```

### Manually

Client:

```bash
cd client
npm install
npm run dev
```

Server:

```bash
cd server
npm install
npm run dev
```

## Repository layout

```
ARN.IO/
  client/   React and Vite front end
  server/   Express API and PostgreSQL
  Dockerfile.client
  Dockerfile.server
  docker-compose.yml
```

## License

No license is set yet. Add one (MIT is a good default) so people know how they may use the code.
