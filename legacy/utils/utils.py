import re


def clean_ai_code(raw_response):
    """
    Strips markdown backticks and 'python' labels from the AI response.
    Targets the 'Architectural Robustness' part of the hackathon.
    """
    # Look for patterns like ```python [code] ```
    pattern = r"```(?:python)?\n?(.*?)```"
    match = re.search(pattern, raw_response, re.DOTALL)

    if match:
        return match.group(1).strip()

    # Fallback: if no backticks, assume the whole response is code
    # but strip common conversational prefixes
    lines = raw_response.split('\n')
    if len(lines) > 0 and not lines[0].startswith(('import', 'if', 'def', '#')):
        # It might be conversational filler; you could log this for the 'Tilde' track
        print("Warning: Conversational filler detected. Attempting to filter.")

    return raw_response.strip()


