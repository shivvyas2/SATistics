# SAT Learning Agent Backend 🤖

AI-powered adaptive learning agent using **Claude Haiku 4.5** + **Supabase** + **DuckDuckGo search**.

## 🚀 Quick Start

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 🔑 Setup .env

Create `.env` file:

```bash
# OpenRouter (for Claude AI)
OPENROUTER_API_KEY=sk-or-v1-...

# Lesson videos (optional). Tried in this order; DuckDuckGo is the keyless fallback
YOUTUBE_API_KEY=...
SERPER_API_KEY=...

# Supabase (get from Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  # service_role key!
```

## 🧪 Test

```bash
# Edit test file - replace UUID with real user from Supabase
python test_supabase_agent.py
```

## 🎯 What It Does

### **Adaptive Question Generation**
- Analyzes user performance from Supabase
- Identifies weak topics (<60% accuracy)
- Generates 50 personalized SAT questions
- Uses Claude Haiku 4.5 via OpenRouter
- Optionally searches web with DuckDuckGo

### **60-30-10 Strategy**
- 60% questions on weak topics
- 30% mixed/exploratory
- 10% hard questions on strong topics

### **Example Usage**

```python
from agent import ExamLearningAgent

# Initialize agent for a user
agent = ExamLearningAgent(user_id="user-uuid-from-supabase")

# Get personalized questions
questions = await agent.generate_questions(50)

# Save results
agent.update_performance(question_attempts, game_data)
```

## 📊 How It Works

```
1. User plays game → Results saved to Supabase
2. Agent analyzes Supabase data → Finds weak topics
3. Claude Haiku 4.5 generates personalized questions
4. Questions sent to frontend
5. Cycle repeats - agent keeps learning!
```

## 🛠️ Tech Stack

- **FastAPI** - API framework
- **Supabase** - Database & auth
- **OpenRouter** - AI gateway
- **Claude Haiku 4.5** - Question generation (~$0.003 per 50 questions!)
- **DuckDuckGo** - Web search for real SAT questions

## 📁 Key Files

- `agent.py` - AI learning agent logic
- `supabase_client.py` - Supabase operations
- `config.py` - Environment configuration
- `test_supabase_agent.py` - Test script

## 🚀 For Production

The agent automatically:
- ✅ Reads user stats from Supabase
- ✅ Generates adaptive questions
- ✅ Saves game results to Supabase
- ✅ Updates user performance analytics

---

**Built for NYU Hacks 2025! 🎓**
