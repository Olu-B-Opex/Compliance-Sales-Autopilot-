from flask import Flask, request, jsonify
import requests
import os
import traceback

app = Flask(__name__)

# Read DashScope API key from environment variable
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY")

if not DASHSCOPE_API_KEY:
    raise Exception("DASHSCOPE_API_KEY environment variable is not set.")


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "running",
        "service": "RegTech365 Qwen Backend"
    })


@app.route("/generate-followup", methods=["POST"])
def generate_followup():

    try:

        data = request.get_json()

        organization = data.get("organization", "")
        industry = data.get("industry", "")
        service = data.get("service", "")
        contact = data.get("contactName", "")

        prompt = f"""
You are a senior Business Development Executive at RegTech365.

Write a professional follow-up email.

Organization: {organization}
Industry: {industry}
Service: {service}
Contact Person: {contact}

The proposal was sent three days ago.

Requirements:

- Warm and professional.
- Maximum 180 words.
- Mention that the proposal was sent three days ago.
- Encourage a short 15-minute meeting.
- Do not sound pushy.
- Sender is RegTech365.
- Return ONLY the email body.

Finish with:

Kind regards,

RegTech365
Business Development Team
"""

        url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"

        headers = {
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}}",
"Content-Type": "application/json"
}

payload = {
            "model": "qwen3-32b",
            "enable_thinking": False,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert consulting sales assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=60
        )

        print("Status Code:", response.status_code)
        print("Response:")
        print(response.text)

        response.raise_for_status()

        result = response.json()

        if "choices" not in result:
            return jsonify({
                "success": False,
                "dashscope_response": result
            }), 500

        email = result["choices"][0]["message"]["content"]

        return jsonify({
            "success": True,
            "followup": email
        })

    except Exception as e:

        traceback.print_exc()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=9000,
        debug=True
    )
app.py
Displaying app.py.
    
