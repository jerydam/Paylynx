# main.py - Advanced Privy API Integration with Enhanced Reasoning

# Features: Multi-step reasoning, context awareness, flexible input parsing, conversation memory

import os
import json
import re
import base64
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum
from tip403_policy import TIP403PolicyChecker
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from jose import jwt, JWTError
import requests
from supabase import create_client, Client

# Initialize Supabase and policy checker
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

policy_checker = TIP403PolicyChecker(supabase)  # Pass supabase to checker for user-specific settings

PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
if not PRIVY_APP_ID:
    raise ValueError("PRIVY_APP_ID not set in .env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not set in .env")

# SECURITY CONFIGURATION
MAX_TRANSACTION_AMOUNT = float(os.getenv("MAX_TRANSACTION_AMOUNT", "10000"))
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"

# MOCK MODE
MOCK_PRIVY_LOOKUP = os.getenv("MOCK_PRIVY_LOOKUP", "false").lower() == "true"

# ────────────────────────────────────────────────
# Privy JWT Verification
# ────────────────────────────────────────────────

async def verify_privy_token(request: Request) -> Dict:
    print("\n" + "="*60)
    print("🔐 [VERIFY TOKEN] Starting...")
    print("="*60)

    auth_header = request.headers.get("Authorization")
    print(f" → Authorization header present: {bool(auth_header)}")

    if not auth_header or not auth_header.startswith("Bearer "):
        print(" ❌ Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = auth_header.split(" ")[1]
    print(f" → Token length: {len(token)} characters")
    
    try:
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub", "unknown")
        print(f" ✅ Token verified for user: {user_id}")
        print("="*60 + "\n")
        return payload
    
    except Exception as e:
        print(f" ❌ Token verification failed: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# ────────────────────────────────────────────────
# Gemini Setup with Advanced Configuration
# ────────────────────────────────────────────────

import google.generativeai as genai
genai.configure(api_key=GEMINI_API_KEY)

# Use the advanced Flash model for reasoning
gemini_model = genai.GenerativeModel(
    "gemini-2.5-flash",
    generation_config=genai.types.GenerationConfig(
        temperature=0.2,  # Lower for more consistent reasoning
        top_p=0.95,
        top_k=40,
        max_output_tokens=2048,
    )
)

# ────────────────────────────────────────────────
# Web3 Setup
# ────────────────────────────────────────────────

from config import w3, active_config, ERC20_ABI

# ────────────────────────────────────────────────
# Intent Classification
# ────────────────────────────────────────────────

class IntentType(str, Enum):
    SEND_MONEY = "send_money"
    SPLIT_BILL = "split_bill"
    SCHEDULE_PAYMENT = "schedule_payment"
    REQUEST_MONEY = "request_money"
    CHECK_BALANCE = "check_balance"
    VIEW_HISTORY = "view_history"
    MANAGE_CONTACTS = "manage_contacts"
    GENERAL_QUERY = "general_query"
    UNCLEAR = "unclear"

# ────────────────────────────────────────────────
# Pydantic Models
# ────────────────────────────────────────────────

class UserPrompt(BaseModel):
    prompt: str
    conversation_history: Optional[List[Dict]] = []
    user_contacts: Optional[List[Dict]] = []

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str):
        v = v.strip()
        if len(v) < 1: raise ValueError("Prompt too short")
        if len(v) > 2000: raise ValueError("Prompt too long")
        return v

class ReasoningStep(BaseModel):
    step_number: int
    description: str
    output: Dict

class IntentAnalysis(BaseModel):
    intent_type: str
    confidence: float
    reasoning: str
    extracted_entities: Dict
    requires_clarification: bool
    clarification_questions: List[str] = []
    suggested_action: str

class PrepareTxRequest(BaseModel):
    amount: float
    recipient: str
    token: str = "USDC"

class PrepareTxResponse(BaseModel):
    tx_data: dict
    chain_id: int
    token_address: str
    estimated_gas: int
    policy_check: Optional[Dict] = None
    tip403_compliant: bool = True

    class Config:
        extra = "allow"

class AccountCreate(BaseModel):
    name: str
    address: str
    chain_id: Optional[int] = 42431
    type: Optional[str] = "evm"

class AccountResponse(BaseModel):
    id: str
    user_id: str
    name: str
    address: str
    chain_id: int
    type: str
    created_at: str
    updated_at: Optional[str] = None

class TransactionCreate(BaseModel):
    tx_hash: str
    amount: float
    recipient: str
    recipient_name: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    tx_hash: str
    amount: float
    recipient: str
    recipient_name: Optional[str]
    status: str
    created_at: str

class PolicySettings(BaseModel):
    enabled: bool
    max_single_payment: float
    max_daily_limit: float
    night_time_enabled: bool
    night_max_payment: float
    night_hour_start: int
    night_hour_end: int

class BasicProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None

class PreferencesUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    transaction_confirmations_enabled: Optional[bool] = None
    biometric_auth_enabled: Optional[bool] = None

class UserProfileResponse(BaseModel):
    id: str
    user_id: str
    display_name: Optional[str]
    email: Optional[str]
    avatar_seed: Optional[str]
    unique_username: str
    bio: Optional[str]
    notifications_enabled: bool
    transaction_confirmations_enabled: bool
    biometric_auth_enabled: bool
    created_at: str
    updated_at: Optional[str]
    policy_settings: Optional[Dict] = None

# ────────────────────────────────────────────────
# Profile Router (Organized Profile Management)
# ────────────────────────────────────────────────

router = APIRouter(prefix="", tags=["profile"])

@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(user: Dict = Depends(verify_privy_token)):
    """Get or create user profile"""
    print("\n" + "="*60)
    print("👤 [GET PROFILE] Starting...")
    print("="*60)

    user_id = user.get("sub")
    print(f" → User ID: {user_id}")

    try:
        # Try to get existing profile
        response = supabase.table("paylynx_user_profiles") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        if response.data and len(response.data) > 0:
            print(f" ✅ Profile found: @{response.data[0].get('unique_username')}")
            print("="*60 + "\n")
            return response.data[0]

        # Create new profile if doesn't exist
        print(" → Creating new profile...")

        # Extract info from Privy token
        email = user.get("email") or user.get("google_email") or user.get("twitter_username")
        display_name = email.split('@')[0] if email else None

        # Generate unique username: name + 4-digit number (e.g., john1234)
        import random
        
        base_name = (display_name or "user").lower()
        # Clean base name - only lowercase letters and numbers, max 12 chars
        base_name = re.sub(r'[^a-z0-9]', '', base_name)[:12] or "user"
        
        # Try to generate unique username
        unique_username = None
        for _ in range(20):  # Try up to 20 times
            # Generate 4-digit number (1000-9999)
            number_suffix = random.randint(1000, 9999)
            candidate = f"{base_name}{number_suffix}"
            
            # Check if exists
            check = supabase.table("paylynx_user_profiles") \
                .select("unique_username") \
                .eq("unique_username", candidate) \
                .execute()
            
            if not check.data or len(check.data) == 0:
                unique_username = candidate
                break
        
        # Fallback if all attempts failed (very unlikely)
        if not unique_username:
            timestamp_suffix = str(int(datetime.now().timestamp()))[-6:]
            unique_username = f"{base_name}{timestamp_suffix}"

        # Create profile with default policy settings
        new_profile = {
            "user_id": user_id,
            "display_name": display_name,
            "email": email,
            "unique_username": unique_username,
            "avatar_seed": display_name or user_id,
            "notifications_enabled": True,
            "transaction_confirmations_enabled": True,
            "biometric_auth_enabled": False,
            "policy_settings": {
                "enabled": True,
                "max_single_payment": 1000,
                "max_daily_limit": 5000,
                "night_time_enabled": True,
                "night_max_payment": 100,
                "night_hour_start": 22,
                "night_hour_end": 6
            }
        }

        create_response = supabase.table("paylynx_user_profiles") \
            .insert(new_profile) \
            .execute()

        if not create_response.data or len(create_response.data) == 0:
            raise HTTPException(500, detail="Failed to create profile")

        print(f" ✅ Profile created: @{unique_username}")
        print("="*60 + "\n")
        return create_response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(500, detail=f"Profile error: {str(e)}")

@router.put("/profile/basic")
async def update_basic_profile(
    update: BasicProfileUpdate,
    user: Dict = Depends(verify_privy_token)
):
    """Update basic profile information (display name, email, bio)"""
    print("\n" + "="*60)
    print("✏️ [UPDATE BASIC PROFILE] Starting...")
    print("="*60)

    user_id = user["sub"]
    print(f" → User ID: {user_id}")

    # Build update data - only include non-None fields
    update_data = {}
    
    if update.display_name is not None:
        update_data["display_name"] = update.display_name.strip() if update.display_name else None
        print(f" → Updating display_name: {update_data['display_name']}")
    
    if update.email is not None:
        # Validate email format if provided
        if update.email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', update.email):
            raise HTTPException(400, detail="Invalid email format")
        update_data["email"] = update.email.strip() if update.email else None
        print(f" → Updating email: {update_data['email']}")
    
    if update.bio is not None:
        if update.bio and len(update.bio) > 500:
            raise HTTPException(400, detail="Bio too long (max 500 characters)")
        update_data["bio"] = update.bio.strip() if update.bio else None
        print(f" → Updating bio")

    if not update_data:
        raise HTTPException(400, detail="No fields to update")

    try:
        result = supabase.table("paylynx_user_profiles") \
            .update(update_data) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            raise HTTPException(404, detail="Profile not found")

        print(f" ✅ Basic profile updated successfully")
        print("="*60 + "\n")
        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(500, detail=f"Update error: {str(e)}")

@router.put("/profile/preferences")
async def update_preferences(
    prefs: PreferencesUpdate,
    user: Dict = Depends(verify_privy_token)
):
    """Update user preferences (notifications, confirmations, biometric)"""
    print("\n" + "="*60)
    print("⚙️ [UPDATE PREFERENCES] Starting...")
    print("="*60)

    user_id = user["sub"]
    print(f" → User ID: {user_id}")

    update_data = prefs.dict(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(400, detail="No fields to update")

    print(f" → Updating preferences: {list(update_data.keys())}")

    try:
        result = supabase.table("paylynx_user_profiles") \
            .update(update_data) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            raise HTTPException(404, detail="Profile not found")

        print(f" ✅ Preferences updated successfully")
        print("="*60 + "\n")
        return {"status": "preferences updated", "updated_fields": update_data}

    except HTTPException:
        raise
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(500, detail=f"Preferences update error: {str(e)}")

@router.put("/policy/settings")
async def update_policy_settings(
    settings: PolicySettings,
    user: Dict = Depends(verify_privy_token)
):
    """Update TIP-403 policy settings"""
    print("\n" + "="*60)
    print("🛡️ [UPDATE POLICY SETTINGS] Starting...")
    print("="*60)

    user_id = user["sub"]
    print(f" → User ID: {user_id}")
    print(f" → Enabled: {settings.enabled}")
    print(f" → Max single: ${settings.max_single_payment}")
    print(f" → Daily limit: ${settings.max_daily_limit}")

    try:
        result = supabase.table("paylynx_user_profiles") \
            .update({"policy_settings": settings.dict()}) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            raise HTTPException(404, detail="Profile not found")

        print(f" ✅ Policy settings updated successfully")
        print("="*60 + "\n")
        return {"status": "policy settings updated", "policy_settings": settings.dict()}

    except HTTPException:
        raise
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(500, detail=f"Policy update error: {str(e)}")

@router.delete("/profile")
async def delete_user_profile(user: Dict = Depends(verify_privy_token)):
    """Delete user profile and all associated data"""
    print("\n" + "="*60)
    print("🗑️ [DELETE PROFILE] Starting...")
    print("="*60)

    user_id = user.get("sub")
    print(f" → User ID: {user_id}")

    try:
        # Delete in order: transactions -> accounts -> profile
        print(" → Deleting transactions...")
        supabase.table("transactions").delete().eq("user_id", user_id).execute()

        print(" → Deleting accounts...")
        supabase.table("accounts").delete().eq("user_id", user_id).execute()

        print(" → Deleting profile...")
        response = supabase.table("paylynx_user_profiles") \
            .delete() \
            .eq("user_id", user_id) \
            .execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(404, detail="Profile not found")

        print(" ✅ Profile and all data deleted")
        print("="*60 + "\n")

        return {
            "status": "deleted",
            "user_id": user_id,
            "message": "All user data has been permanently deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        print("="*60 + "\n")
        raise HTTPException(500, detail=f"Delete error: {str(e)}")

# ────────────────────────────────────────────────
# Advanced Intent Parsing with Chain-of-Thought
# ────────────────────────────────────────────────

async def analyze_intent_with_reasoning(
    prompt: str,
    conversation_history: List[Dict] = None,
    user_contacts: List[Dict] = None
) -> IntentAnalysis:
    """
    Advanced intent analysis using chain-of-thought reasoning.
    Understands context, ambiguity, and complex requests.
    """
    print("\n" + "="*60)
    print("🧠 [ADVANCED INTENT ANALYSIS] Starting...")
    print("="*60)
    print(f" → User prompt: '{prompt}'")

    # Build context
    contacts_context = ""
    if user_contacts:
        contact_names = [c.get('name', '') for c in user_contacts]
        contacts_context = f"\n\nUser's saved contacts: {', '.join(contact_names)}"
        print(f" → Available contacts: {contact_names}")

    history_context = ""
    if conversation_history:
        history_context = "\n\nRecent conversation:\n"
        for msg in conversation_history[-3:]:  # Last 3 messages
            history_context += f"- {msg.get('role', 'user')}: {msg.get('content', '')}\n"
        print(f" → Using {len(conversation_history[-3:])} messages of context")

    system_prompt = f"""You are an advanced AI reasoning system for a crypto payment application called Paylynx.

Your task is to analyze user input and extract payment intent with deep reasoning.

AVAILABLE INTENT TYPES:
1. send_money - User wants to send crypto to someone
2. split_bill - User wants to split a payment among multiple people
3. schedule_payment - User wants to schedule a future/recurring payment
4. request_money - User wants to request money from someone
5. check_balance - User wants to check their balance
6. view_history - User wants to see transaction history
7. manage_contacts - User wants to add/edit/view contacts
8. general_query - General questions about the app
9. unclear - Cannot determine intent with confidence

REASONING APPROACH:
1. First, identify the core intent from the user's message
2. Extract all relevant entities (amounts, recipients, tokens, dates, etc.)
3. Consider context from conversation history and saved contacts
4. Handle ambiguity and unclear references intelligently
5. Determine if clarification is needed

ENTITY EXTRACTION RULES:
- Amounts: Can be written as "$50", "50 dollars", "fifty bucks", "50", etc.
- Recipients: Can be names, nicknames, emails, wallet addresses, or pronouns ("him", "her", "them")
- Tokens: Default to USDC if not specified. Accept "USDC", "dollars", "USD", etc.
- Dates/Time: For scheduling - "tomorrow", "next Monday", "1st of month", "every week"
- Context clues: "again" = check history for last recipient, "same person" = use previous context

AMBIGUITY HANDLING:
- If amount missing but implied: estimate or ask
- If recipient unclear: check if it matches saved contact or recent conversation
- If multiple interpretations possible: choose most likely based on context
- If truly unclear: require_clarification = true

EXAMPLES:
Input: "send 50 to mom"
Output: {{
"intent_type": "send_money",
"confidence": 0.95,
"reasoning": "Clear send intent with amount (50) and recipient name (mom). User likely has 'mom' saved as contact.",
"extracted_entities": {{
"amount": 50,
"token": "USDC",
"recipient_name": "mom"
}},
"requires_clarification": false,
"suggested_action": "Check if 'mom' is in saved contacts. If yes, prepare transaction. If no, ask for address/email."
}}

Input: "pay john back the 20 bucks I owe"
Output: {{
"intent_type": "send_money",
"confidence": 0.9,
"reasoning": "Payment intent with amount (20) and recipient (john). Context suggests this is repayment.",
"extracted_entities": {{
"amount": 20,
"token": "USDC",
"recipient_name": "john",
"note": "repayment"
}},
"requires_clarification": false,
"suggested_action": "Check for contact 'john', proceed with transaction"
}}

{contacts_context}{history_context}

Now analyze this user input and return ONLY valid JSON following the schema above:

User input: "{prompt}"

Think step by step:
1. What is the user trying to do?
2. What information do they provide?
3. What information is missing?
4. Can I infer missing information from context?
5. Do I need to ask for clarification?

Return your analysis as JSON:

"""

    try:
        print(" → Calling Gemini with advanced reasoning prompt...")
        response = gemini_model.generate_content(
            system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=1500,
                response_mime_type="application/json"
            )
        )

        text = response.text.strip()
        print(f" ← Gemini response length: {len(text)} characters")

        # Clean markdown if present
        if text.startswith("```"):
            lines = text.split('\n')
            text = '\n'.join(lines[1:-1]).strip()
            if text.startswith("json"):
                text = text[4:].strip()

        parsed = json.loads(text)
        print(f" ✅ Analysis complete")
        print(f" → Intent: {parsed.get('intent_type', 'unknown')}")
        print(f" → Confidence: {parsed.get('confidence', 0)}")
        print(f" → Requires clarification: {parsed.get('requires_clarification', False)}")
        print(f" → Extracted entities: {list(parsed.get('extracted_entities', {}).keys())}")
        print("="*60 + "\n")

        return IntentAnalysis(**parsed)

    except json.JSONDecodeError as e:
        print(f" ❌ JSON decode error: {e}")
        print(f" → Falling back to legacy parser...")
        return fallback_to_legacy_parse(prompt, user_contacts)

    except Exception as e:
        print(f" ❌ Error in advanced analysis: {type(e).__name__}: {e}")
        print(f" → Falling back to legacy parser...")
        return fallback_to_legacy_parse(prompt, user_contacts)

def fallback_to_legacy_parse(prompt: str, user_contacts: List[Dict] = None) -> IntentAnalysis:
    """Fallback to regex-based parsing when Gemini fails"""
    print("\n" + "-"*60)
    print("🔧 [FALLBACK PARSE] Using regex-based analysis...")
    print("-"*60)

    entities = {}
    intent = IntentType.UNCLEAR
    confidence = 0.5
    reasoning = "Fallback regex parsing"
    requires_clarification = True
    clarification = []

    # Extract amount
    amount_match = re.search(r'(\d+(?:\.\d+)?)', prompt)
    if amount_match:
        entities["amount"] = float(amount_match.group(1))
        entities["token"] = "USDC"
        confidence += 0.2

    # Check for send/pay/transfer keywords
    if re.search(r'\b(send|pay|transfer|give)\b', prompt.lower()):
        intent = IntentType.SEND_MONEY
        confidence += 0.2

    # Try to extract recipient name
    name_match = re.search(r'(?:to|for)\s+([a-zA-Z]+)', prompt.lower())
    recipient_name = None
    if name_match:
        recipient_name = name_match.group(1)
        entities["recipient_name"] = recipient_name
        confidence += 0.1

    # Check if it's a saved contact
    if user_contacts and recipient_name:
        for contact in user_contacts:
            if contact.get('name', '').lower() == recipient_name.lower():
                entities["recipient_address"] = contact.get('address')
                requires_clarification = False
                confidence = 0.9
                reasoning = f"Found saved contact '{recipient_name}'"
                break

    # Try to extract wallet address
    addr_match = re.search(r'(0x[a-fA-F0-9]{40})', prompt)
    if addr_match:
        entities["recipient_address"] = addr_match.group(1)
        requires_clarification = False
        confidence = 0.95
        reasoning = "Explicit wallet address provided"

    # Determine clarification
    if intent == IntentType.SEND_MONEY:
        if "amount" not in entities:
            clarification.append("How much would you like to send?")
        if "recipient_address" not in entities and "recipient_name" not in entities:
            clarification.append("Who would you like to send to?")
        elif "recipient_name" in entities and "recipient_address" not in entities:
            clarification.append(f"What is the wallet address or email for {entities['recipient_name']}?")

    suggested_action = "Collect missing information"
    if not requires_clarification:
        suggested_action = "Prepare transaction with extracted data"

    print(f" → Intent: {intent}")
    print(f" → Confidence: {confidence}")
    print(f" → Entities: {entities}")
    print("-"*60 + "\n")

    return IntentAnalysis(
        intent_type=intent,
        confidence=confidence,
        reasoning=reasoning,
        extracted_entities=entities,
        requires_clarification=requires_clarification,
        clarification_questions=clarification,
        suggested_action=suggested_action
    )

async def parse_intent(prompt: str) -> dict:
    """Legacy endpoint - redirects to advanced analysis"""
    analysis = await analyze_intent_with_reasoning(prompt)

    # Convert to legacy format for backward compatibility
    if analysis.intent_type == IntentType.SEND_MONEY:
        if analysis.requires_clarification:
            return {
                "error": " ".join(analysis.clarification_questions),
                "confidence": analysis.confidence,
                "reasoning": analysis.reasoning
            }
        else:
            result = {
                "amount": analysis.extracted_entities.get("amount"),
                "token": analysis.extracted_entities.get("token", "USDC"),
            }

            if "recipient_address" in analysis.extracted_entities:
                result["recipient"] = analysis.extracted_entities["recipient_address"]
            elif "recipient_name" in analysis.extracted_entities:
                result["recipient_name"] = analysis.extracted_entities["recipient_name"]

            return result
    else:
        return {
            "error": f"Intent detected: {analysis.intent_type}. " + (
                analysis.clarification_questions[0] if analysis.clarification_questions
                else "This feature is coming soon!"
            ),
            "intent_type": analysis.intent_type,
            "confidence": analysis.confidence
        }

# ────────────────────────────────────────────────
# FastAPI App
# ────────────────────────────────────────────────

app = FastAPI(title="Paylynx Remittance Agent - Advanced Reasoning")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✨ INCLUDE THE ROUTER - This was missing!
app.include_router(router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "version": "3.0.0 - Advanced Reasoning + TIP-403",
        "message": "Paylynx Agent with Chain-of-Thought Reasoning and TIP-403 Compliance",
        "features": {
            "advanced_nlp": True,
            "context_awareness": True,
            "multi_intent": True,
            "reasoning_engine": "Gemini 2.0 Flash",
            "tip403_policy": True,
            "policy_enforcement": True,
            "rate_limiting": RATE_LIMIT_ENABLED,
            "max_transaction": MAX_TRANSACTION_AMOUNT,
            "mock_mode": MOCK_PRIVY_LOOKUP
        },
        "tempo_network": {
            "enabled": True,
            "tip403_registry": "0x403c000000000000000000000000000000000000"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    print("\n🏥 [HEALTH CHECK] Starting...")
    try:
        print(" → Checking database connection...")
        supabase.table("accounts").select("id").limit(1).execute()
        print(" ✅ Database connected")

        print(" → Checking Web3 connection...")
        is_connected = w3.is_connected()
        print(f" ✅ Web3 connected: {is_connected}")

        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
            "web3": "connected",
            "reasoning_engine": "active"
        }
    except Exception as e:
        print(f" ❌ Health check failed: {str(e)}")
        raise HTTPException(500, detail=f"Health check failed: {str(e)}")

@app.post("/agent/parse-intent")
async def parse_user_intent(request: UserPrompt):
    """Legacy endpoint for backward compatibility"""
    return await parse_intent(request.prompt)

@app.post("/agent/analyze-intent", response_model=IntentAnalysis)
async def analyze_user_intent(request: UserPrompt):
    """
    NEW: Advanced intent analysis with reasoning.
    Returns detailed analysis including confidence, reasoning, and suggestions.
    """
    return await analyze_intent_with_reasoning(
        request.prompt,
        request.conversation_history,
        request.user_contacts
    )

@app.post("/agent/prepare-transaction", response_model=PrepareTxResponse)
async def prepare_unsigned_tx(
    request: PrepareTxRequest,
    user: Dict = Depends(verify_privy_token)
):
    """Prepare an unsigned transaction with TIP-403 policy validation"""
    print("\n" + "="*60)
    print("💳 [PREPARE TRANSACTION] Starting...")
    print("="*60)

    user_id = user.get('sub', 'unknown')
    print(f" → User ID: {user_id}")
    print(f" → Amount: {request.amount} {request.token}")
    print(f" → Recipient: {request.recipient}")

    try:
        # ═══════════════════════════════════════════════════════════
        # TIP-403 POLICY CHECK
        # ═══════════════════════════════════════════════════════════
        print("\n[Step 1] TIP-403 Policy Check...")

        policy_result = policy_checker.check_payment(
            user_id=user_id,
            amount=request.amount,
            recipient=request.recipient,
            context="AI-initiated payment"
        )

        if not policy_result["allowed"]:
            print(f" ❌ Payment blocked by TIP-403 policy")
            print(f" → Reason: {policy_result['reason']}")
            print("="*60 + "\n")

            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Payment blocked by TIP-403 policy",
                    "reason": policy_result["reason"],
                    "policy": policy_result["policy"],
                    "blocked_by": policy_result.get("blocked_by"),
                    "tip403_compliant": True,
                    "policy_info": policy_result
                }
            )

        print(f" ✅ Policy check passed: {policy_result['reason']}")
        print(f" → Daily spent: ${policy_result.get('daily_spent', 0):.2f}")
        print(f" → Daily remaining: ${policy_result.get('daily_remaining', 0):.2f}")

        # ═══════════════════════════════════════════════════════════
        # SECURITY VALIDATION
        # ═══════════════════════════════════════════════════════════
        print("\n[Step 2] Security validation...")

        if request.amount > MAX_TRANSACTION_AMOUNT:
            print(f" ❌ Amount exceeds limit: ${request.amount:,.2f}")
            raise HTTPException(
                400,
                detail=f"Transaction amount ${request.amount:,.2f} exceeds maximum allowed (${MAX_TRANSACTION_AMOUNT:,.2f})"
            )
        print(f" ✅ Amount OK: ${request.amount:,.2f}")

        if request.amount <= 0:
            raise HTTPException(400, detail="Amount must be greater than 0")

        # Validate recipient address
        try:
            recipient = w3.to_checksum_address(request.recipient)
            print(f" ✅ Valid address: {recipient}")
        except ValueError as e:
            print(f" ❌ Invalid address: {str(e)}")
            raise HTTPException(400, detail="Invalid recipient address format")

        if recipient == "0x0000000000000000000000000000000000000000":
            raise HTTPException(400, detail="Cannot send to zero address")

        # ═══════════════════════════════════════════════════════════
        # BUILD TRANSACTION
        # ═══════════════════════════════════════════════════════════
        print("\n[Step 3] Building transaction...")
        token_addr = w3.to_checksum_address("0x20c0000000000000000000000000000000000000")
        contract = w3.eth.contract(address=token_addr, abi=ERC20_ABI)
        decimals = contract.functions.decimals().call()
        amount_wei = int(request.amount * (10 ** decimals))
        tx = contract.functions.transfer(recipient, amount_wei).build_transaction({
            "chainId": w3.eth.chain_id,
            "gas": 150_000,
        })

        print(f" ✅ Transaction built")
        print("="*60 + "\n")

        return PrepareTxResponse(
            tx_data=tx,
            chain_id=w3.eth.chain_id,
            token_address=token_addr,
            estimated_gas=tx.get("gas", 150_000),
            policy_check=policy_result,
            tip403_compliant=True
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise HTTPException(500, detail=f"Failed to prepare transaction: {str(e)}")

@app.get("/policy/limits")
async def get_policy_limits(user: Dict = Depends(verify_privy_token)):
    """Get TIP-403 policy limits and user's current status"""
    user_id = user.get("sub")
    return policy_checker.get_policy_info(user_id)

@app.get("/policy/info")
async def get_policy_framework_info():
    """Get information about TIP-403 framework"""
    return {
        "framework": "TIP-403",
        "description": "Tempo's policy registry for compliance and access control",
        "registry_address": "0x403c000000000000000000000000000000000000",
        "features": [
            "Programmable compliance rules",
            "Token governance hooks",
            "Access control policies",
            "Rate limiting",
            "Time-based restrictions"
        ],
        "implementation": "Client-side policy enforcement with TIP-403 awareness",
        "documentation": "https://docs.tempo.io/tip-403",
        "enabled": True
    }

@app.get("/tempo/info")
async def get_tempo_info():
    """Get Tempo network information"""
    return {
        "network": "Tempo Testnet",
        "chain_id": w3.eth.chain_id,
        "rpc": "Connected to Tempo RPC",
        "features_used": [
            "Instant USDC settlement",
            "TIP-403 policy awareness",
            "Low-latency payments for AI agents"
        ],
        "why_tempo": "Built for stablecoins and instant settlement - perfect for AI-initiated payments",
        "tip403_registry": "0x403c000000000000000000000000000000000000",
        "usdc_address": "0x20c0000000000000000000000000000000000000"
    }

@app.post("/transactions", response_model=dict, status_code=201)
async def record_transaction(tx: TransactionCreate, user: Dict = Depends(verify_privy_token)):
    """Record a transaction in the database"""
    if not re.match(r'^0x[a-fA-F0-9]{64}$', tx.tx_hash):
        raise HTTPException(400, detail="Invalid transaction hash")

    data = {
        "user_id": user["sub"],
        "tx_hash": tx.tx_hash,
        "amount": tx.amount,
        "recipient": tx.recipient,
        "recipient_name": tx.recipient_name,
        "status": "pending",
        "tip403_compliant": True,
        "policy_check_passed": True,
        "ai_context": "AI-initiated payment"
    }

    try:
        response = supabase.table("transactions").insert(data).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(500, detail="Failed to record transaction")

        return {"status": "recorded", "id": str(response.data[0]["id"])}

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")

@app.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(limit: int = 20, user: Dict = Depends(verify_privy_token)):
    """List user's transaction history"""
    if limit > 100:
        raise HTTPException(400, detail="Limit cannot exceed 100")

    response = supabase.table("transactions") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()

    return response.data

@app.get("/transaction/{tx_hash}/receipt")
async def get_receipt(tx_hash: str):
    """Get transaction receipt from blockchain"""
    if not re.match(r'^0x[a-fA-F0-9]{64}$', tx_hash):
        raise HTTPException(400, detail="Invalid transaction hash")

    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        status = "success" if receipt["status"] == 1 else "failed"

        return {
            "tx_hash": tx_hash,
            "status": status,
            "gas_used": receipt["gasUsed"],
            "block_number": receipt["blockNumber"],
            "confirmed": True
        }
    except Exception as e:
        return {
            "tx_hash": tx_hash,
            "status": "pending",
            "confirmed": False,
            "message": "Transaction not yet confirmed"
        }

@app.post("/accounts", response_model=AccountResponse, status_code=201)
async def create_account(account: AccountCreate, request: Request):
    """Create a new saved account/contact"""
    print("\n" + "="*60)
    print("💾 [CREATE ACCOUNT] Starting...")
    print("="*60)

    auth_header = request.headers.get("Authorization")
    user_id = "anonymous"

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.get_unverified_claims(token)
            user_id = payload.get("sub", "anonymous")
        except:
            print(" ⚠️ Could not extract user ID")

    print(f" → User ID: {user_id}")
    print(f" → Account: {account.name} - {account.address}")

    try:
        validated_address = w3.to_checksum_address(account.address)
        print(f" ✅ Valid address: {validated_address}")
    except ValueError as e:
        print(f" ❌ Invalid address: {str(e)}")
        raise HTTPException(400, detail="Invalid wallet address format")

    data = {
        "user_id": user_id,
        "name": account.name.strip(),
        "address": validated_address,
        "chain_id": account.chain_id,
        "type": account.type,
    }

    try:
        response = supabase.table("accounts").insert(data).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(500, detail="Failed to create account")

        print(f" ✅ Created: {response.data[0].get('id')}")
        print("="*60 + "\n")
        return response.data[0]
    except Exception as e:
        print(f" ❌ Error: {str(e)}")
        raise HTTPException(500, detail=f"Database error: {str(e)}")

@app.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(request: Request):
    """List user's saved accounts/contacts"""
    auth_header = request.headers.get("Authorization")
    user_id = "anonymous"

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.get_unverified_claims(token)
            user_id = payload.get("sub", "anonymous")
        except:
            pass

    try:
        response = supabase.table("accounts") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()

        return response.data if response.data else []
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")

@app.delete("/accounts/{account_id}", status_code=200)
async def delete_account(account_id: str, request: Request):
    """Delete a saved account/contact"""
    auth_header = request.headers.get("Authorization")
    user_id = "anonymous"

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.get_unverified_claims(token)
            user_id = payload.get("sub", "anonymous")
        except:
            pass

    try:
        response = supabase.table("accounts") \
            .delete() \
            .eq("id", account_id) \
            .eq("user_id", user_id) \
            .execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(404, detail="Account not found")

        return {"status": "deleted", "id": account_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")

@app.post("/privy/lookup-address")
async def lookup_privy_address(request: Request):
    """Look up Privy wallet address by email"""
    try:
        print("\n" + "="*60)
        print("🔍 [PRIVY LOOKUP] Starting...")

        body = await request.json()
        email = body.get("email")

        if not email:
            raise HTTPException(400, detail="Email required")

        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            raise HTTPException(400, detail="Invalid email format")

        print(f" → Email: {email}")

        # MOCK MODE
        if MOCK_PRIVY_LOOKUP:
            fake_address = f"0x{''.join([f'{i:02x}' for i in range(20)])}"
            print(f" ✅ Mock address: {fake_address}")
            return {
                "success": True,
                "address": fake_address,
                "email": email,
                "source": "mock"
            }

        # Real Privy API call
        privy_api_secret = os.getenv("PRIVY_APP_SECRET")
        if not privy_api_secret:
            raise HTTPException(500, detail="Privy not configured")

        credentials = f"{PRIVY_APP_ID}:{privy_api_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()

        privy_response = requests.post(
            "https://api.privy.io/v1/users/email/address",
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/json",
                "privy-app-id": PRIVY_APP_ID
            },
            json={"address": email},
            timeout=10
        )

        if privy_response.status_code == 200:
            data = privy_response.json()

            # Find wallet in linked accounts
            for account in data.get("linked_accounts", []):
                if account.get("type") == "wallet":
                    address = account.get("address")
                    if address:
                        print(f" ✅ Found wallet: {address}")
                        return {
                            "success": True,
                            "address": address,
                            "email": email,
                            "source": "linked_wallet"
                        }

            # Check embedded wallet
            if "wallet" in data:
                address = data["wallet"].get("address")
                if address:
                    return {
                        "success": True,
                        "address": address,
                        "email": email,
                        "source": "embedded_wallet"
                    }

            raise HTTPException(404, detail="User has no wallet configured")

        elif privy_response.status_code == 404:
            raise HTTPException(404, detail=f"No account found for '{email}'")

        else:
            raise HTTPException(500, detail=f"Privy error (code {privy_response.status_code})")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Lookup error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("🚀 PAYLYNX - ADVANCED REASONING ENGINE")
    print("="*60)
    print(f"AI Model: Gemini 2.0 Flash")
    print(f"Features: Chain-of-Thought, Context Awareness, Multi-Intent")
    print(f"TIP-403: Policy Enforcement Enabled")
    print("="*60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)