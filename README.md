# NYU Hacks Arcade

A collection of classic arcade games built with Next.js, TypeScript, and Three.js for 3D graphics. Features SAT question integration for educational gameplay with AI-powered adaptive learning.

##  Games

- **Subway Surfers** - Endless runner - dodge obstacles and collect coins!
- **Squid Game** - Survive the challenges inspired by the popular series!
- **Mario** - Classic platformer - jump, run, and collect coins!
- **Pac-Man** - Classic maze game - eat dots and avoid ghosts!
- **Whack-A-Mole** - Whack the mole with the correct SAT answer!
- **Zombie Apocalypse** - First-person shooter! Shoot zombies with correct answers!
- **Carnival** - Pop balloons to answer SAT questions!

## Quick Start

### Prerequisites

- **Node.js 18+** - For the frontend
- **Python 3.8+** - For the backend
- **Supabase Account** - For authentication and database

### Option 1: Quick Start Script

```bash
# Make the script executable (first time only)
chmod +x start_local.sh

# Run both frontend and backend
./start_local.sh
```

### Option 2: Manual Setup

**Start Backend:**
```bash
cd backend
./run.sh
# Backend runs on http://localhost:8000
```

**Start Frontend (in a new terminal):**
```bash
cd frontend
npm install  # First time only
npm run dev
# Frontend runs on http://localhost:3000
```

Visit [http://localhost:3000](http://localhost:3000) to start playing!

##  Project Structure

```
NYUHacks/
├── frontend/              # Next.js frontend application
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── games/            # Game implementations
│   └── lib/              # Utilities and API client
├── backend/              # FastAPI backend
│   ├── src/             # Source code
│   │   ├── api/         # API routes
│   │   ├── services/    # Business logic
│   │   └── models/      # Data models
│   ├── agent.py         # AI learning agent
│   └── database/        # Database schema
├── start_local.sh        # Quick start script
└── README.md            # This file
```

##  Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Three.js** - 3D graphics and game rendering
- **Tailwind CSS** - Styling

### Backend
- **FastAPI** - Python web framework
- **Supabase** - Authentication and database
- **Pydantic** - Data validation
- **Claude Haiku 4.5** (via OpenRouter) - AI-powered question generation
- **DuckDuckGo Search** - Real SAT question sourcing

##  Features

- **User Authentication** - Sign up, login, and secure sessions
- **Game Score Tracking** - Save and track your game progress
- **Statistics Dashboard** - View your performance metrics
- **SAT Question Integration** - Educational gameplay with SAT questions
- **AI-Powered Adaptive Learning** - Intelligent agent analyzes performance and generates personalized questions
- **Multiple Game Modes** - Various arcade-style games
- **3D Graphics** - Immersive Three.js-powered games

##  AI Learning Agent

The backend includes an intelligent SAT learning agent that:

1. **Analyzes Performance** - Reviews your historical game data from Supabase
2. **Identifies Weak Topics** - Finds topics where you struggle (<60% accuracy)
3. **Generates Personalized Questions** - Uses Claude Haiku 4.5 to create custom questions
4. **Adaptive Strategy** - 60% weak topics, 30% mixed, 10% challenge questions
5. **Continuous Learning** - Improves question selection based on your progress

See `backend/agent.py` for implementation details.

##  Documentation

- **[Developer Guide](DEVELOPER_GUIDE.md)** - Local development, testing, and troubleshooting
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Architecture Guide](ARCHITECTURE.md)** - System design and architecture (from agent branch)
- **[Frontend README](frontend/README.md)** - Frontend-specific documentation
- **[Backend README](backend/README.md)** - Backend-specific documentation

##  Development

### Adding a New Game

1. Create a new game folder in `frontend/games/[game-name]/`
2. Create the game class `[GameName]Game.ts` extending `BaseGame`
3. Implement required methods: `init()`, `update()`, `render()`, `handleInput()`
4. Register the game in `frontend/games/GameRenderer.ts`
5. Add game metadata to `frontend/lib/games.ts`

### Game Architecture

Each game extends `BaseGame` which provides:
- Game state management (score, level, lives, pause, game over)
- Common game properties
- Abstract methods for game-specific logic

##  Environment Variables

### Backend (`backend/.env`)
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ALLOWED_ORIGINS=http://localhost:3000
OPENROUTER_API_KEY=your_openrouter_key  # For AI agent
YOUTUBE_API_KEY=your_youtube_key        # Optional: lesson videos
SERPER_API_KEY=your_serper_key          # Optional: lesson videos fallback
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url  # Optional
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  # Optional
```

##  Installation

### Frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

##  Testing

See [Developer Guide](DEVELOPER_GUIDE.md) for detailed testing instructions.

Quick test:
1. Start both servers (see Quick Start above)
2. Visit http://localhost:3000
3. Sign up for an account
4. Play a game
5. Check your stats

##  Deployment

See [Deployment Guide](DEPLOYMENT.md) for complete deployment instructions.

Quick deploy:
```bash
# Backend
cd backend
vercel --prod

# Frontend
cd frontend
vercel --prod
```

## � Troubleshooting

See [Developer Guide](DEVELOPER_GUIDE.md) for common issues and solutions.

Quick fixes:
- **CORS errors**: Make sure backend is running and CORS is configured
- **Connection errors**: Verify `NEXT_PUBLIC_API_URL` is set correctly
- **Auth errors**: Check Supabase credentials in `backend/.env`

## 📄 License

MIT

##  Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

##  Support

For issues and questions:
- Check the [Developer Guide](DEVELOPER_GUIDE.md)
- Review [Troubleshooting](DEVELOPER_GUIDE.md#troubleshooting) section
- Check backend and frontend README files
