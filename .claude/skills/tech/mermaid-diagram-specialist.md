---
name: mermaid-diagram-specialist
category: tech
description: Create technical diagrams using Mermaid syntax for documentation and architecture visualization
usage: When visualizing workflows, documenting architecture, creating ERDs, or explaining system design
input: System description, architecture requirements, data model, process flows
output: Mermaid diagram code in markdown format
---

# Mermaid Diagram Specialist

## ⚙️ Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| `diagram_style` | Theme and color scheme | `base`, `dark`, `forest`, `neutral` |
| `primary_color` | Main color for nodes | `#3B82F6` (blue) |
| `default_direction` | Default flow direction | `TD` (top-down), `LR` (left-right) |
| `max_nodes` | Max nodes per diagram | `20` for readability |
| `line_style` | Connection line style | `solid`, `dotted`, `curved` |

## Purpose

Create technical diagrams using Mermaid syntax for documentation, architecture visualization, and process mapping. Supports flowcharts, sequence diagrams, ERDs, C4 diagrams, state machines, and more.

## Capabilities

- Flowcharts for decision flows and processes
- Sequence diagrams for API interactions
- ERDs for database schemas
- C4 diagrams for architecture levels
- State diagrams for lifecycle visualization
- Class diagrams for object design
- Gantt charts for timelines

## Diagram Types

### Flowchart

**Use for**: Process flows, decision trees, algorithms

```mermaid
flowchart TD
    Start([Start]) --> Input[/User Input/]
    Input --> Validate{Valid?}
    Validate -->|Yes| Process[Process Data]
    Validate -->|No| Error[Show Error]
    Process --> Save[(Save)]
    Save --> End([End])
```

**Node shapes**: `[Rectangle]`, `([Rounded])`, `{Diamond}`, `[/Parallelogram/]`, `[(Database)]`

### Sequence Diagram

**Use for**: API flows, message passing, system interactions

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API
    participant DB

    User->>Frontend: Submit Form
    Frontend->>API: POST /resource
    API->>DB: Insert Data
    DB-->>API: Success
    API-->>Frontend: 201 Created
    Frontend-->>User: Show Success
```

### ERD (Entity Relationship)

**Use for**: Database schemas, data models

```mermaid
erDiagram
    USER ||--o{ ORDER : creates
    ORDER ||--|| PAYMENT : has
    ORDER ||--|{ ITEM : contains

    USER {
        uuid id PK
        string email UK
        string name
    }
    ORDER {
        uuid id PK
        uuid user_id FK
        decimal total
        enum status
    }
```

**Relationships**: `||--||` (one-to-one), `||--o{` (one-to-many), `}o--o{` (many-to-many)

### State Diagram

**Use for**: Lifecycle management, status transitions

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Confirmed: Payment Success
    Pending --> Cancelled: Payment Failed
    Confirmed --> Active: Start Date
    Active --> Completed: End Date
    Confirmed --> Cancelled: User Cancels
    Completed --> [*]
    Cancelled --> [*]
```

## Best Practices

| Practice | Description |
|----------|-------------|
| **Simplicity** | Keep diagrams under configured max nodes |
| **Direction** | Use consistent flow direction per diagram type |
| **Labels** | Clear, descriptive labels for all elements |
| **Grouping** | Use subgraphs to organize related elements |
| **Colors** | Apply theme consistently across diagrams |
| **Testing** | Verify rendering in target markdown viewer |

## Common Patterns

### API Request Flow

```mermaid
sequenceDiagram
    Client->>+API: Request
    API->>+Service: Process
    Service->>+Model: Query
    Model->>+DB: Execute
    DB-->>-Model: Data
    Model-->>-Service: Result
    Service-->>-API: Response
    API-->>-Client: JSON
```

### Error Handling

```mermaid
flowchart TD
    Request --> Validate{Valid?}
    Validate -->|No| Error[Error Handler]
    Validate -->|Yes| Process
    Process --> DB{Success?}
    DB -->|No| Error
    DB -->|Yes| Success
    Error --> Log[Log Error]
    Log --> Response[Error Response]
```

## Styling

Apply theme configuration:

```mermaid
%%{init: {'theme':'base', 'themeVariables': {
  'primaryColor':'#3B82F6',
  'primaryTextColor':'#fff',
  'lineColor':'#6B7280'
}}}%%
flowchart TD
    A --> B --> C
```

Use class styling:

```mermaid
flowchart TD
    A[Normal] --> B[Success]
    B --> C[Error]

    classDef success fill:#10B981,stroke:#059669
    classDef error fill:#EF4444,stroke:#DC2626

    class B success
    class C error
```

## Checklist

- [ ] Diagram type appropriate for content
- [ ] All nodes clearly labeled
- [ ] Relationships accurate
- [ ] Theme colors configured
- [ ] Renders correctly in markdown
- [ ] Complexity within limits
- [ ] Direction consistent
