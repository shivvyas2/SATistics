"""
Configuration for backend services
Loads environment variables for AI agent and Supabase
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file in backend directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# OpenRouter API Key (optional - only needed for AI agent)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
# Anthropic API key (optional) - when set, Claude is called directly instead of through OpenRouter
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
# Don't raise error if not set - agent will handle it gracefully

# Supabase configuration (uses same as main backend)
# These are loaded from the same .env file as the main backend
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

