import os
import json
import urllib.request
import urllib.error

# In-memory advisor cache to prevent redundant API calls
_advisor_cache = {}

LOCAL_FALLBACKS = {
    "liquidity": {
        "bKash": {
            "en": "Depletion warning: High net burn rate detected for bKash. Wallet balance is dropping rapidly.",
            "bn": "📣 বর্তমান লেনদেনের ধারা অনুযায়ী কয়েক মিনিটের মধ্যে আপনার বিকাশ ই-মানি শেষ হয়ে যেতে পারে। নিরাপদে সেবা চালু রাখতে অতিরিক্ত ই-মানি টপ-আপ করার পরামর্শ দেওয়া হচ্ছে।",
            "banglish": "Bhai, apnar bKash wallet e-money khub druto sesh hoye jacche. Seba chalu rakhte kindly bank app theke e-money refill korun."
        },
        "Shared Cash": {
            "en": "Depletion warning: High cash depletion risk for Shared Cash pool box. Refill recommended.",
            "bn": "📣 বর্তমান লেনদেনের ধারা অনুযায়ী আপনার ড্রয়ারের নগদ টাকা শেষ হয়ে যেতে পারে। সবচেয়ে বেশি চাপ আসছে বিকাশ ক্যাশ-আউট থেকে। ২০,০০০+ টাকা অতিরিক্ত নগদ রিফিল করুন।",
            "banglish": "Apnar cash box e taka sesh hoye jabe. bKash cash-out pressure besi. Kindly bank standard agent refilling point theke cash box fill-up korun."
        },
        "default": {
            "en": "Wallet balance warning: Feed updates lag detected or wallet balance is low.",
            "bn": "⚠️ রকেট তথ্য সরবরাহে সাময়িক বিলম্ব হচ্ছে। সঠিক পূর্বাভাসের জন্য অপেক্ষা করা হচ্ছে, অনুগ্রহ করে সর্বশেষ ব্যাংক স্টেটমেন্ট দেখে সিদ্ধান্ত নিন।",
            "banglish": "Rocket feed updates late hocche. Sothik information er jonno kindly bank state check kore balance confirm korun."
        }
    },
    "anomaly": {
        "near_identical_amounts": {
            "en": "Alert: Detected cluster of near-identical cash-out amounts from a small group of accounts in short intervals.",
            "bn": "📣 গত ১২ মিনিটে স্বাভাবিকের তুলনায় অনেক বেশি ক্যাশ-আউট হয়েছে। কয়েকটি লেনদেনের পরিমাণ একই এবং অল্প কয়েকটি অ্যাকাউন্ট থেকে বারবার অনুরোধ এসেছে। বড় অঙ্কের নগদ পুনরায় সরবরাহের আগে পর্যালোচনা করুন।",
            "banglish": "Bhai, last 12 minute e pray eki amount er cash-out bar bar hocche. Kichu account identical transaction korche. High volume cash supply er age transaction check korun."
        },
        "default": {
            "en": "Behavioral warning: Unusual transaction velocity or repeat transactional activity detected.",
            "bn": "📣 এই এজেন্টের লেনদেনে কিছু অস্বাভাবিক বৈশিষ্ট্য পাওয়া গিয়েছে যা পর্যালোচনার দাবি রাখে।",
            "banglish": "Agent transaction e unusual behavior pawa gese. Kichu suspicious repetition pattern match korche, kindly details track korun."
        }
    }
}

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
        prov = details.get("provider_name")
        fallback_map = LOCAL_FALLBACKS["liquidity"]
        return fallback_map.get(prov, fallback_map["default"])
    else:
        pat = details.get("pattern_type")
        fallback_map = LOCAL_FALLBACKS["anomaly"]
        return fallback_map.get(pat, fallback_map["default"])

def generate_trilingual_alerts(context_type, details):
    """
    Executes generate_trilingual_alerts wrapping with local in-memory cache lookup
    """
    cache_key = f"{context_type}:{details.get('agent_code')}:{details.get('provider_name')}:{details.get('pattern_type')}:{details.get('risk_level')}:{details.get('eta_minutes')}"
    if cache_key in _advisor_cache:
        return _advisor_cache[cache_key]
        
    res = _generate_alerts_raw(context_type, details)
    _advisor_cache[cache_key] = res
    return res
