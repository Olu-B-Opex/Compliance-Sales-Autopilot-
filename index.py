import json
import os
import requests

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY")

def handler(event, context):

    try:
        if environ["REQUEST_METHOD"] == "GET":
            status = "200 OK"
            headers = [("Content-Type", "application/json")]
            start_response(status, headers)
            return [json.dumps({
                "status": "running",
                "service": "RegTech365 Qwen Backend"
            }).encode()]

        body_size = int(environ.get("CONTENT_LENGTH", 0))
        body = environ["wsgi.input"].read(body_size)

        data = json.loads(body)

        organization = data.get("organization", "")
        industry = data.get("industry", "")
        service = data.get("service", "")
        contact = data.get("contactName", "")

        prompt = f"""
Write a professional follow-up email.

Organization: {organization}
Industry: {industry}
Service: {service}
Contact: {contact}

The proposal was sent three days ago.

Maximum 180 words.

Return only the email.
"""

        response = requests.post(
            "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
            "model": "qwen3-32b",
            "messages": [
        {
            "role": "system",
            "content": "You are a business development assistant."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
}
        )

        result = response.json()

        email = result["choices"][0]["message"]["content"]

        start_response(
            "200 OK",
            [("Content-Type", "application/json")]
        )

        return [json.dumps({
            "success": True,
            "followup": email
        }).encode()]

    except Exception as e:

        start_response(
            "500 Internal Server Error",
            [("Content-Type", "application/json")]
        )

        return [json.dumps({
            "success": False,
            "error": str(e)
        }).encode()]