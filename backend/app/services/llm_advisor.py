import os
import json
import urllib.request
import urllib.error

# Path to persistent LLM response cache
CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "llm_cache.json")

def load_dotenv():
    # Look for .env in root directory or standard paths
    possible_dirs = [
        os.getcwd(),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ]
    for d in possible_dirs:
        env_path = os.path.join(d, ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as env_file:
                    for line in env_file:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
                print(f"[LLM Advisor] Loaded environment variables from {env_path}")
                return
            except Exception as e:
                print(f"[LLM Advisor] Error reading env: {e}")

load_dotenv()

# Load persistent advisor cache from file
_advisor_cache = {}
if os.path.exists(CACHE_PATH):
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as cache_f:
            _advisor_cache = json.load(cache_f)
        _advisor_cache = {
            key: value for key, value in _advisor_cache.items()
            if not (key.startswith("liquidity:") and ":low:None" in key)
        }
        print(f"[LLM Advisor] Loaded persistent cache containing {len(_advisor_cache)} items.")
    except Exception as e:
        print(f"[LLM Advisor] Failed to load persistent cache: {e}")

def save_cache_persistently():
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as cache_f:
            json.dump(_advisor_cache, cache_f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[LLM Advisor] Failed to save persistent cache: {e}")

LOCAL_FALLBACKS = {
    "liquidity": {
        "bKash": {
            "en": "Depletion warning: High net burn rate detected for bKash. Wallet balance is dropping rapidly.",
            "bn": "📣 বর্তমান লেনদেনের ধারা অনুযায়ী কয়েক মিনিটের মধ্যে আপনার বিকাশ ই-মানি শেষ হয়ে যেতে পারে। নিরাপদে সেবা চালু রাখতে অতিরিক্ত ই-মানি টপ-আপ করার পরামর্শ দেওয়া হচ্ছে।",
            "banglish": "Apnar bKash e-money balance druto komche. Approved provider operations channel diye top-up coordinate korun."
        },
        "Shared Cash": {
            "en": "Depletion warning: High cash depletion risk for Shared Cash pool box. Refill recommended.",
            "bn": "📣 বর্তমান লেনদেনের ধারা অনুযায়ী বিকেল ৫টা ২০ মিনিটের মধ্যে আপনার নগদ টাকা শেষ হয়ে যেতে পারে। সবচেয়ে বেশি চাপ আসছে বিকাশ ক্যাশ-আউট থেকে। নিরাপদভাবে সেবা চালু রাখতে কমপক্ষে ২০,০০০ টাকা অতিরিক্ত নগদ ব্যবস্থা করার পরামর্শ দেওয়া হচ্ছে।",
            "banglish": "Apnar cash box e pressure beshi. Approved field support diye cash support coordinate korun."
        },
        "default": {
            "en": "Wallet balance warning: Provider balance is under pressure. Keep balances separate and coordinate through the approved provider operations channel.",
            "bn": "⚠️ এই প্রোভাইডারের ব্যালেন্সে চাপ দেখা যাচ্ছে। ব্যালেন্স আলাদা রাখুন এবং অনুমোদিত প্রোভাইডার অপারেশনস চ্যানেলের মাধ্যমে সমন্বয় করুন।",
            "banglish": "Ei provider balance e pressure dekha jacche. Balance alada rekhe approved provider ops channel diye coordinate korun."
        }
    },
    "anomaly": {
        "near_identical_amounts": {
            "en": "Alert: Detected cluster of near-identical cash-out amounts from a small group of accounts in short intervals.",
            "bn": "📣 গত ১২ মিনিটে স্বাভাবিকের তুলনায় অনেক বেশি ক্যাশ-আউট হয়েছে। কয়েকটি লেনদেনের পরিমাণ প্রায় একই এবং অল্প কয়েকটি অ্যাকাউন্ট থেকে বারবার অনুরোধ এসেছে। এটি ঈদ-পূর্ব স্বাভাবিক চাহিদাও হতে পারে, তবে বড় অঙ্কের নগদ পুনরায় সরবরাহের আগে লেনদেনগুলো পর্যালোচনা করা প্রয়োজন।",
            "banglish": "Bhai, last 12 minute e pray eki amount er cash-out bar bar hocche. Kichu account identical transaction korche. High volume cash supply er age transaction check korun."
        },
        "default": {
            "en": "Behavioral warning: Unusual transaction velocity or repeat transactional activity detected.",
            "bn": "📣 এই এজেন্টের লেনদেনে কিছু অস্বাভাবিক বৈশিষ্ট্য পাওয়া গিয়েছে যা পর্যালোচনার দাবি রাখে।",
            "banglish": "Agent transaction e unusual behavior pawa gese. Kichu suspicious repetition pattern match korche, kindly details track korun."
        }
    }
}

def _stable_liquidity_message(details):
    provider_name = details.get("provider_name") or "Provider"
    reason = details.get("reason") or "Balances are stable or increasing based on rolling average flow."
    return {
        "en": reason,
        "bn": "",
        "banglish": "",
    }

def _data_quality_liquidity_message(details):
    provider_name = details.get("provider_name") or "provider"
    return {
        "en": f"Confidence alert: {provider_name} forecast has sparse, volatile, delayed, or incomplete input data. Confidence is reduced; verify the latest provider record before acting.",
        "bn": f"⚠️ {provider_name} পূর্বাভাসে ডেটা কম, অস্থির, বিলম্বিত বা অসম্পূর্ণ হতে পারে। কনফিডেন্স কমানো হয়েছে; সিদ্ধান্তের আগে সর্বশেষ প্রোভাইডার রেকর্ড যাচাই করুন।",
        "banglish": f"{provider_name} forecast er data sparse/volatile/late hote pare. Confidence komano hoyeche; action er age latest provider record verify korun.",
    }

def _local_liquidity_fallback(details):
    confidence = details.get("confidence")
    risk_level = details.get("risk_level")
    eta_minutes = details.get("eta_minutes")
    provider_name = details.get("provider_name")

    if risk_level == "low" and eta_minutes is None:
        if confidence is not None and float(confidence) < 0.3:
            return _data_quality_liquidity_message(details)
        return _stable_liquidity_message(details)

    fallback_map = LOCAL_FALLBACKS["liquidity"]
    return fallback_map.get(provider_name, fallback_map["default"])

def clean_json_response(raw_text):
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

def call_gemini(prompt, api_key):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=4) as response:
        res = json.loads(response.read().decode("utf-8"))
        text = res["candidates"][0]["content"]["parts"][0]["text"]
        return clean_json_response(text)

def call_openai(prompt, api_key):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "response_format": {"type": "json_object"}
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=4) as response:
        res = json.loads(response.read().decode("utf-8"))
        text = res["choices"][0]["message"]["content"]
        return json.loads(text)

def _generate_alerts_raw(context_type, details):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    if context_type == "liquidity":
        prompt = f"""
        You are the AI Risk and Liquidity Advisor for a multi-provider mobile financial services gateway (supporting bKash, Nagad, Rocket).
        Write a trilingual warning explaining a liquidity depletion/shortage warning.
        
        Details:
        - Agent Code: {details.get('agent_code')}
        - Provider Wallet: {details.get('provider_name')}
        - Current Balance: {details.get('current_balance')} BDT
        - Shortage ETA: {details.get('eta_minutes')} minutes
        - Risk Level: {details.get('risk_level')}
        - Confidence: {details.get('confidence')}
        
        Respond ONLY with a JSON object containing precisely these keys:
        - "en": English explanation (concise, clear, professional warning)
        - "bn": Bangla translation (empathetic warning, offering actionable steps)
        - "banglish": Banglish translation (Bengali text written in English characters, e.g. "Bhai, apnar bKash account e balance sesh...")
        
        Do not add any markdown blocks or formatting. Return raw JSON.
        """
    else:
        prompt = f"""
        You are the AI Risk and Liquidity Advisor for a multi-provider mobile financial services gateway.
        Write a trilingual warning explaining a transaction behavioral anomaly flag.
        
        Details:
        - Agent Code: {details.get('agent_code')}
        - Provider: {details.get('provider_name')}
        - Pattern Flag: {details.get('pattern_type')}
        - Anomaly Score: {details.get('anomaly_score')}
        - Confidence: {details.get('confidence')}
        - Evidence Metrics: {json.dumps(details.get('evidence'))}
        
        Respond ONLY with a JSON object containing precisely these keys:
        - "en": English explanation (evidence-oriented, professional, no fraud verdict)
        - "bn": Bangla translation (actionable advisory, cautionary tone)
        - "banglish": Banglish translation (Bengali text written in English characters, e.g. "Bhai, eki amount er cashout bar bar hocche...")
        
        Do not add any markdown blocks or formatting. Return raw JSON.
        """

    # 1. Try Gemini
    if gemini_key:
        try:
            return call_gemini(prompt, gemini_key)
        except Exception as e:
            print(f"[LLM Advisor] Gemini API invocation failed, trying OpenAI fallback. Error: {e}")
            
    # 2. Try OpenAI
    if openai_key:
        try:
            return call_openai(prompt, openai_key)
        except Exception as e:
            print(f"[LLM Advisor] OpenAI API invocation failed, falling back to Local Rules. Error: {e}")
            
    # 3. Local Rule-Based Fallback
    print("[LLM Advisor] Executing Local Rules fallback.")
    if context_type == "liquidity":
        return _local_liquidity_fallback(details)
    else:
        pat = details.get("pattern_type")
        fallback_map = LOCAL_FALLBACKS["anomaly"]
        return fallback_map.get(pat, fallback_map["default"])

def generate_trilingual_alerts(context_type, details):
    """
    Executes generate_trilingual_alerts wrapping with local persistent cache lookup
    """
    if context_type == "liquidity" and details.get("risk_level") == "low" and details.get("eta_minutes") is None:
        return _local_liquidity_fallback(details)

    cache_key = f"{context_type}:{details.get('agent_code')}:{details.get('provider_name')}:{details.get('pattern_type')}:{details.get('risk_level')}:{details.get('eta_minutes')}:{details.get('confidence')}"
    if cache_key in _advisor_cache:
        return _advisor_cache[cache_key]
        
    res = _generate_alerts_raw(context_type, details)
    
    if res and isinstance(res, dict) and "en" in res:
        _advisor_cache[cache_key] = res
        save_cache_persistently()
        
    return res
