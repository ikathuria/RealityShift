import os
from dotenv import load_dotenv

from mistralai import Mistral
from utils.constants import MISTRAL_MODEL, SYSTEM_PROMPT

load_dotenv()
client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))


def get_code_stream(user_intent, current_code, screen):
    """
    Interleaves LLM streaming with Pygame rendering to prevent freezing.
    """

    return client.chat.stream(
        model=MISTRAL_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context: {current_code}.\nUpdate this code based on intent: {user_intent}"}
        ]
    )
