import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description } = req.body;
  if (!description) {
    return res.status(400).json({ error: 'Missing startup description' });
  }

  try {
    const { data: problems, error } = await supabase
      .from('problems')
      .select('id, title, description, location')
      .limit(20);

    if (error) throw error;

    const formattedProblems = problems
      .map(
        (p, i) => \`Problem \${i + 1}:
Title: \${p.title}
Location: \${p.location}
Description: \${p.description}\`
      )
      .join("\n\n");

    const prompt = \`A startup has submitted the following idea:
"\""
\${description}
"\""

Here are real-world problems reported from different parts of the world:

\${formattedProblems}

Rank the problems from most to least relevant based on how well the startup could help solve them. Return an ordered list with short reasoning.\`;

    const response = await fetch(\`\${GEMINI_API_URL}?key=\${GEMINI_API_KEY}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    const result = await response.json();

    if (!result.candidates || !result.candidates[0].content.parts[0].text) {
      throw new Error("Invalid response from Gemini");
    }

    const answer = result.candidates[0].content.parts[0].text;
    return res.status(200).json({ result: answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}
