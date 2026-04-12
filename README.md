# ClairvynAI

## Floor Plan Generator 

A natural language floor plan generator 

## Installation

```bash
pip install -r requirements.txt
```

## Setup

1. Create a `.env` file with your Hugging Face API token:
```
HUGGINGFACE_API_TOKEN=your_token_here
```

## Usage

Run the main script:
```bash
python main.py
```

Enter your floor plan description when prompted:
```
Enter floor plan description: I want a 2-bedroom apartment with kitchen and bathroom
```

## Output

The script generates a structured floor plan with:
- Room details (type, dimensions, position)
- Connections between rooms (doors, windows)

## Workflow Graph

```
    START
      ↓
┌─────────────────┐
│ extract_rooms   │  ← Extract room details from user input
└─────────────────┘
      ↓
┌─────────────────────┐
│ extract_connections │  ← Identify connections between rooms
└─────────────────────┘
      ↓
┌─────────────────┐
│ position_rooms  │  ← Assign x,y coordinates to rooms
└─────────────────┘
      ↓
┌─────────────────────┐
│ format_final_output │  ← Format into final schema
└─────────────────────┘
      ↓
     END
```

## Colab Notebook 

https://colab.research.google.com/drive/197gc11iL6zSQgyI72E85smEIHjOru7gf?usp=sharing
______________________________________________________________________________________

├── .env                # API toke
└── README.md           # This fi```
