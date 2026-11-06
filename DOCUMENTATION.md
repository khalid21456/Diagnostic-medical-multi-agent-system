# How the web app talks to the LangGraph backend

This guide explains how the React frontend (`web/`) is connected to the LangGraph
agents (`api/`). Read it top to bottom once. Each section builds on the one before.

---

## 1. The big picture

```
 Browser (localhost:5173)                     Server (localhost:8000)
┌───────────────────────────┐               ┌──────────────────────────────────────────┐
│ React UI                  │               │ FastAPI  (api/main.py)                   │
│  ChatView / ReportView    │               │   CORS middleware                        │
│        │                  │               │   routes/sessions.py                     │
│        ▼                  │   HTTP/JSON   │        │                                 │
│ useDiagnosisSession hook  │ ────────────▶ │        ▼                                 │
│        │                  │ ◀──────────── │ LangGraph graph  (src/graph.py)          │
│        ▼                  │               │   supervisor → diagnostic_agent ─┐       │
│ api/httpApi.ts            │               │        ▲                         ▼       │
│ (or mockApi.ts)           │               │        └──── patient_response ◀──┘       │
└───────────────────────────┘               │   report_agent → web_search tool         │
                                            │        │                                 │
                                            │ InMemorySaver (one thread per session)   │
                                            └────────┼─────────────────────────────────┘
                                                     ▼
                                                OpenAI API
```

- **Frontend:** only knows three HTTP calls. It has no idea LangGraph exists.
- **Backend:** translates those three calls into "start / resume the graph".
- **Contract between them:** the TypeScript types in `web/src/types/diagnosis.ts`
  and the matching Pydantic models in `api/src/schemas.py`.

---

## 2. The problem we had to solve: `input()`

Your original `PatientResponse` node looked like this:

```python
def PatientResponse(state):
    answer = input("Your answer: ")        # ← waits for someone to type in the terminal
    return {"message": [HumanMessage(content=answer)]}
```

That works in a notebook, because you are sitting at the keyboard. In a web server
there is no keyboard. The patient's answer arrives **later, in a different HTTP
request**. `input()` would block the server forever.

So the graph must be able to **stop in the middle, remember where it was, and
continue later** when the answer arrives. LangGraph has a built-in feature for this,
called *human-in-the-loop*. It needs three ingredients.

### Ingredient 1: `interrupt()` pauses the graph

```python
from langgraph.types import interrupt

def PatientResponse(state):
    last_question = ...                               # last AI message
    answer = interrupt({"question": last_question})   # ← graph stops HERE
    return {"message": [HumanMessage(content=answer)]}
```

When execution reaches `interrupt(...)`, LangGraph:
1. stops running the graph, and
2. saves the whole state (messages, question_count, …).

`graph.invoke(...)` then returns to the caller, which is our HTTP route. The route
can send the question to the browser.

### Ingredient 2: a checkpointer remembers the state

```python
from langgraph.checkpoint.memory import InMemorySaver

graph = builder.compile(checkpointer=InMemorySaver())
```

The checkpointer is where paused graphs are stored between requests. `InMemorySaver`
keeps them in a Python dictionary, which is simple but disappears when the server
restarts (see §12).

### Ingredient 3: `thread_id` tells sessions apart

Many patients can use the app at once. Each consultation gets its own **thread**:

```python
config = {"configurable": {"thread_id": session_id}}
graph.invoke(..., config)
```

The `session_id` the frontend receives *is* the LangGraph `thread_id`. Every request
for that session passes the same id, so LangGraph loads the right saved state.

### Resuming: `Command(resume=...)`

When the answer arrives, we continue the paused graph:

```python
from langgraph.types import Command

graph.invoke(Command(resume="I have a headache"), config)
```

LangGraph reloads the thread and **re-runs `PatientResponse` from the top**. This
time `interrupt(...)` doesn't pause. It *returns* `"I have a headache"`. The node
finishes, and the graph continues to `supervisor` → `diagnostic_agent` (the next
question) → `patient_response` → pause again.

> ⚠️ Because the node re-runs from the top on resume, never put side effects
> (database writes, API calls, prints you care about) **before** `interrupt()` in a node.

---

## 3. A second pause: before the report

After the 5th answer, the supervisor routes to `report_agent`. Writing the report
(maybe with web searches) takes 20–40 seconds. The frontend already has two
separate waiting states:

- `thinking`: "waiting for the next question"
- `generating`: "writing your report"

To match that, the graph also pauses **before** `report_agent`:

```python
builder.compile(
    checkpointer=InMemorySaver(),
    interrupt_before=["report_agent"],   # stop right before this node runs
)
```

So the 5th answer returns `{"status": "complete"}` immediately. The browser then
calls `GET /report`, which resumes the graph with `graph.invoke(None, config)`.
`None` means "just continue, there's no new input". Then `report_agent` runs.

---

## 4. How the routes know where the graph is: `get_state().next`

Every route first asks LangGraph where the thread is paused:

```python
snapshot = graph.get_state(config)
snapshot.values   # the saved MedicalState (dict); empty → unknown session
snapshot.next     # tuple of the node(s) that will run next
```

| `snapshot.next` | Meaning | What the routes do |
|---|---|---|
| `("patient_response",)` | waiting for an answer | `POST /answers` resumes with `Command(resume=answer)` |
| `("report_agent",)` | 5 answers in, report not written | `GET /report` resumes with `invoke(None)` |
| `()` (empty) | graph finished, `final_report` saved | `GET /report` returns the saved report |
| anything else, e.g. `("diagnostic_agent",)` | a previous run crashed halfway (OpenAI error) | `POST /answers` continues with `invoke(None)`, so the "Try again" button works without losing or duplicating the answer |

Deciding from the saved state, not from what the last request returned, keeps the
API correct even when the browser retries or a request fails partway.

---

## 5. The full life of one consultation

```
Browser                         FastAPI route                     LangGraph thread
───────                         ─────────────                     ────────────────
Start consultation
 POST /api/sessions  ─────────▶ new uuid = thread_id
                                invoke({message: [], count: 0}) ─▶ supervisor → diagnostic_agent (OpenAI: Q1)
                                                                   → patient_response → interrupt() ⏸
                     ◀───────── {sessionId, question: Q1, questionNumber: 1, totalQuestions: 5}

Patient types answer 1
 POST /sessions/{id}/answers ─▶ next == patient_response ✓
   {answer}                     invoke(Command(resume=answer)) ──▶ patient_response returns answer
                                                                   → supervisor → diagnostic_agent (Q2)
                                                                   → patient_response → interrupt() ⏸
                     ◀───────── {status: "question", question: Q2, questionNumber: 2, ...}

… answers 2, 3, 4 work the same way …

Patient types answer 5
 POST /sessions/{id}/answers ─▶ invoke(Command(resume=answer)) ──▶ supervisor (count == 5)
                                                                   → ⏸ interrupt_before report_agent
                     ◀───────── {status: "complete"}

UI shows "writing your report"
 GET /sessions/{id}/report ───▶ no final_report yet, next == report_agent
                                invoke(None) ───────────────────▶ report_agent (OpenAI + web_search)
                                                                   → supervisor → END
                     ◀───────── {sessionId, generatedAt, markdown}
```

---

## 6. The API contract

The frontend and backend agree on these shapes. Python uses `snake_case`, and the
JSON uses `camelCase`. The conversion is automatic:

```python
# api/src/schemas.py
class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

class StartSessionResponse(CamelModel):
    session_id: str            # → "sessionId" in JSON
    question: str
    question_number: int       # → "questionNumber"
    total_questions: int
```

```ts
// web/src/types/diagnosis.ts  (same shape)
export interface StartSessionResponse {
  sessionId: string
  question: string
  questionNumber: number
  totalQuestions: number
}
```

**If you change one side, change the other.**

### Endpoints

**`POST /api/sessions`**: start a consultation

```json
// response 200
{ "sessionId": "301601ba-…", "question": "What is your main symptom?", "questionNumber": 1, "totalQuestions": 5 }
```

**`POST /api/sessions/{sessionId}/answers`**: send one answer

```json
// request
{ "answer": "I have a headache" }
// response 200: next question
{ "status": "question", "question": "When did it start?", "questionNumber": 2, "totalQuestions": 5 }
// response 200: after the 5th answer
{ "status": "complete" }
```

**`GET /api/sessions/{sessionId}/report`**: get (and on the first call, generate) the report

```json
{ "sessionId": "301601ba-…", "generatedAt": "2026-11-01T18:52:06+00:00", "markdown": "## Reported symptoms\n- …" }
```

`markdown` is `MedicalState.final_report`. Calling the endpoint twice returns the same
report without calling OpenAI again.

### Errors

FastAPI returns errors as `{"detail": "…"}`. `httpApi.ts` reads `detail` and the chat
shows it in the red error box.

| Code | When |
|---|---|
| 404 | unknown `sessionId` (or the server restarted, see §12) |
| 409 | answer sent after the consultation finished, or report requested too early |
| 422 | empty answer, or longer than 1000 characters (Pydantic validation) |
| 502 | OpenAI or the graph failed. "Try again" in the UI retries safely (§4) |

You can try every endpoint by hand at **http://localhost:8000/docs** (Swagger UI,
generated by FastAPI from the Pydantic models).

---

## 7. CORS: why the browser needs permission

The page is served from `http://localhost:5173` (Vite). The API is at
`http://localhost:8000`. Different port means a different **origin**, and browsers
block JavaScript from calling another origin unless that server explicitly allows it.
That permission is CORS:

```python
# api/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # from FRONTEND_ORIGIN env var
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

When you deploy the frontend somewhere else, add its URL to `FRONTEND_ORIGIN` in
`api/.env`, comma-separated: `FRONTEND_ORIGIN=http://localhost:5173,https://my-app.com`.

---

## 8. Environment variables: two separate files

| File | Read by | Contains |
|---|---|---|
| `api/.env` | Python (`load_dotenv` in `main.py`) | `OPENAI_API_KEY`, optional `FRONTEND_ORIGIN` |
| `web/.env.local` | Vite, at build/dev time | `VITE_API_BASE_URL`, `VITE_USE_MOCK_API` |

Example `api/.env` (never commit it; it's in `api/.gitignore`):

```
OPENAI_API_KEY=sk-proj-...
FRONTEND_ORIGIN=http://localhost:5173
```

Two rules:

1. **Secrets only go in `api/.env`.** Every `VITE_*` variable is copied into the
   JavaScript bundle that any visitor can read. Never put an API key there.
2. **`load_dotenv` runs before the graph is imported.** The models
   (`init_chat_model(...)`) read `OPENAI_API_KEY` when their module is imported, so
   `main.py` loads `.env` first, then imports the routes. `override=True` makes
   the file win over an old value left in the environment, which caused the 401
   error you saw in the notebook.

`main.py` also adds `api/src` to Python's import path, because the graph files
import each other as `from state import …` and `from nodes.x import …`.

---

## 9. Running it

**Backend** (terminal 1):

```powershell
cd api
uv run fastapi dev main.py        # http://localhost:8000, reloads on save
```

**Frontend** (terminal 2):

```powershell
cd web
npm run dev                        # http://localhost:5173
```

The navbar shows **Live API** (green dot) when `web/.env.local` has
`VITE_USE_MOCK_API=false`, and **Mock API** when it uses the fake in-browser backend.
Restart `npm run dev` after editing `.env.local`.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Backend won't start: `OpenAIError: Missing credentials` | `api/.env` is missing or has no `OPENAI_API_KEY`. Create it (§8) and restart |
| Error box: "Could not reach the diagnostic service" | backend not running, or wrong `VITE_API_BASE_URL` |
| Browser console: "blocked by CORS policy" | the page's URL isn't in `FRONTEND_ORIGIN` |
| 502 and the backend log shows `AuthenticationError 401` | bad or revoked `OPENAI_API_KEY` in `api/.env`. Fix it and restart the backend |
| "Session not found" in the middle of a chat | the backend restarted (auto-reload on save counts!). `InMemorySaver` lost the sessions. Click **Start over** |
| Report takes ~30 s | normal: `report_agent` may run several web searches |

---

## 11. What changed, file by file

**Backend (`api/`)**
- `src/nodes/patient_response.py`: `input()` → `interrupt()`.
- `src/graph.py`: `build_graph()` adds `InMemorySaver` + `interrupt_before=["report_agent"]`.
- `src/nodes/report_agent.py`: executes the `web_search` tool calls the model asks
  for (max 3 rounds). Before, a tool call produced an empty report. The prompt now
  asks for Markdown sections, because the UI renders Markdown.
- `src/tools/web_search.py`: fixed an indentation bug (only the last result was
  kept) and returns a string.
- `src/schemas.py` (new): Pydantic models = the API contract.
- `src/routes/sessions.py` (new): the 3 endpoints.
- `main.py`: env loading order, `sys.path`, CORS, router.

**Frontend (`web/`)**
- `src/api/httpApi.ts`: readable FastAPI error messages.
- `.env.local` (new, git-ignored): switches the app to the live API.

Nothing else in the UI changed. Every component goes through the `DiagnosisApi`
interface, so swapping mock → HTTP needed no component edits.

---

## 12. Limits and next steps

- **Sessions are in memory.** A restart (or an auto-reload in dev) forgets every
  consultation. Use a persistent checkpointer, with the same code otherwise:
  `pip install langgraph-checkpoint-sqlite`, then
  `SqliteSaver.from_conn_string("sessions.db")`, or `PostgresSaver` in production.
- **One server process only.** `InMemorySaver` isn't shared between worker processes.
  A database checkpointer fixes this too.
- **No streaming.** The UI waits for each full question or report. LangGraph's
  `graph.stream(..., stream_mode="messages")` plus Server-Sent Events could show
  tokens as they're generated.
- **No authentication.** Anyone with a `sessionId` can read that report. Add auth
  before storing real patient data, and check the privacy rules (e.g. GDPR / Moroccan
  law 09-08) for health data.
- **The diagnostic agent can repeat a question.** In testing it asked "Where exactly
  is the pain located?" twice. Tightening `DIAGNOSTIC_SYSTEM_PROMPT` ("never repeat
  a question already asked") would help.
