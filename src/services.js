export async function fetchGPTResponse(prompt) {
    const response = await fetch('http://localhost:3001/api/recipe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch response from GPT.');
    }

    return await response.json();
}